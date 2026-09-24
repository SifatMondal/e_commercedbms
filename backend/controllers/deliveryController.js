const pool = require("../db");
const { createCustomerNotification, createSellerNotification, createAdminNotification } = require("../services/notificationService");
const eventService = require("../services/eventService");
const ACTIVE = ["assigned", "picked_up", "out_for_delivery"];
const NEXT = { assigned: "picked_up", picked_up: "out_for_delivery", out_for_delivery: "delivered" };
const idOk = (value) => typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;

exports.getDashboard = async (req, res) => {
  try {
    const me = await pool.query("SELECT deliveryman_id, name, email, phone, delivery_location, approval_status, availability_status FROM deliverymen WHERE deliveryman_id=$1", [req.user.sub]);
    const requests = await pool.query(`SELECT r.delivery_request_id,r.order_id,r.status,r.created_at,o.shipping_address,o.delivery_latitude,o.delivery_longitude,c.name customer_name,c.phone customer_phone FROM delivery_requests r JOIN orders o ON o.order_id=r.order_id JOIN customers c ON c.customer_id=o.customer_id WHERE r.deliveryman_id=$1 AND r.status='pending' ORDER BY r.created_at DESC`, [req.user.sub]);
    const orders = await pool.query(`SELECT o.order_id,o.order_date,o.total_amount,o.payment_method,o.shipping_address,o.delivery_latitude,o.delivery_longitude,o.delivery_status,o.estimated_delivery_time,o.status,c.name customer_name,c.phone customer_phone,c.email customer_email FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE o.deliveryman_id=$1 ORDER BY o.order_id DESC`, [req.user.sub]);
    return res.json({ deliveryman: me.rows[0], requests: requests.rows, orders: orders.rows });
  } catch (error) { console.error("Delivery dashboard error:", error); return res.status(500).json({ message: "Unable to load delivery dashboard." }); }
};

exports.respondToRequest = async (req, res) => {
  const requestId = req.params.requestId; const decision = req.body?.decision;
  if (!idOk(requestId) || !["accept", "reject"].includes(decision)) return res.status(400).json({ message: "A valid requestId and decision (accept or reject) are required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query(`SELECT r.delivery_request_id,r.order_id,r.seller_id,r.status,o.deliveryman_id,o.status AS order_status FROM delivery_requests r JOIN orders o ON o.order_id=r.order_id WHERE r.delivery_request_id=$1 AND r.deliveryman_id=$2 FOR UPDATE OF r,o`, [requestId, req.user.sub]);
    if (!request.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Delivery request not found." }); }
    const item = request.rows[0];
    if (item.status !== "pending") { await client.query("ROLLBACK"); return res.status(409).json({ message: "This delivery request has already been handled." }); }
    if (decision === "reject") {
      await client.query("UPDATE delivery_requests SET status='rejected',responded_at=CURRENT_TIMESTAMP WHERE delivery_request_id=$1", [requestId]);
      await createSellerNotification(client, item.seller_id, `Deliveryman declined the delivery request for Order #${item.order_id}.`);
      await client.query("COMMIT"); return res.json({ message: "Delivery request rejected." });
    }
    const driver = await client.query("SELECT deliveryman_id FROM deliverymen WHERE deliveryman_id=$1 AND approval_status='approved' AND availability_status='available' FOR UPDATE", [req.user.sub]);
    if (!driver.rowCount || item.deliveryman_id || item.order_status !== "Shipped") { await client.query("ROLLBACK"); return res.status(409).json({ message: "This order or deliveryman is no longer available for assignment." }); }
    // The locked order row serializes simultaneous accepts; only the first can assign it.
    const assigned = await client.query("UPDATE orders SET deliveryman_id=$1,delivery_status='assigned' WHERE order_id=$2 AND deliveryman_id IS NULL RETURNING customer_id", [req.user.sub, item.order_id]);
    if (!assigned.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ message: "This order has already been assigned." }); }
    await client.query("UPDATE delivery_requests SET status=CASE WHEN delivery_request_id=$1 THEN 'accepted' ELSE 'cancelled' END,responded_at=CURRENT_TIMESTAMP WHERE order_id=$2 AND status='pending'", [requestId, item.order_id]);
    await client.query("UPDATE deliverymen SET availability_status='busy',last_assigned_at=CURRENT_TIMESTAMP WHERE deliveryman_id=$1", [req.user.sub]);
    await createSellerNotification(client, item.seller_id, `Deliveryman accepted the delivery request for Order #${item.order_id}.`);
    await createCustomerNotification(client, assigned.rows[0].customer_id, `A deliveryman has been assigned to Order #${item.order_id}.`);
    await client.query("COMMIT");
    eventService.broadcast("order_updated", { orderId: item.order_id, delivery_status: "assigned" });
    eventService.broadcast("stats_updated");
    return res.json({ message: "Delivery request accepted and order assigned." });
  } catch (error) { try { await client.query("ROLLBACK"); } catch (_) {} console.error("Delivery request response error:", error); return res.status(500).json({ message: "Unable to respond to delivery request." }); } finally { client.release(); }
};

exports.setAvailability = async (req, res) => {
  const status = req.body?.availability_status;
  if (!["available", "offline"].includes(status)) return res.status(400).json({ message: "availability_status must be available or offline." });
  try { if (status === "available") { const active = await pool.query("SELECT 1 FROM orders WHERE deliveryman_id=$1 AND delivery_status = ANY($2::VARCHAR[]) LIMIT 1", [req.user.sub, ACTIVE]); if (active.rowCount) return res.status(409).json({ message: "Complete active deliveries before becoming available." }); }
    const result = await pool.query("UPDATE deliverymen SET availability_status=$1 WHERE deliveryman_id=$2 RETURNING availability_status", [status, req.user.sub]);
    eventService.broadcast("deliveryman_updated", { deliverymanId: req.user.sub, availability_status: status });
    eventService.broadcast("stats_updated");
    return res.json({ message: "Availability updated.", availability_status: result.rows[0].availability_status });
  } catch (error) { console.error("Availability error:", error); return res.status(500).json({ message: "Unable to update availability." }); }
};

exports.updateDelivery = async (req, res) => {
  const { orderId } = req.params; const { delivery_status, estimated_delivery_time } = req.body || {};
  if (!idOk(orderId)) return res.status(400).json({ message: "orderId must be a positive integer." });
  if (delivery_status !== undefined && !["picked_up", "out_for_delivery", "delivered"].includes(delivery_status)) return res.status(400).json({ message: "Invalid delivery status." });
  let eta = null; if (estimated_delivery_time !== undefined) { eta = new Date(estimated_delivery_time); if (Number.isNaN(eta.getTime())) return res.status(400).json({ message: "estimated_delivery_time must be a valid date/time." }); }
  const client = await pool.connect(); try {
    await client.query("BEGIN"); const found = await client.query("SELECT order_id,customer_id,delivery_status FROM orders WHERE order_id=$1 AND deliveryman_id=$2 FOR UPDATE", [orderId, req.user.sub]);
    if (!found.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Assigned order not found." }); }
    const order = found.rows[0];
    const currentStatus = order.delivery_status || "assigned";
    if (delivery_status && NEXT[currentStatus] !== delivery_status) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Delivery status transition is not allowed." }); }
    const updated = await client.query("UPDATE orders SET delivery_status=COALESCE($1,delivery_status),estimated_delivery_time=COALESCE($2,estimated_delivery_time),status=CASE WHEN $1='delivered' THEN 'Delivered' ELSE status END WHERE order_id=$3 RETURNING order_id,delivery_status,estimated_delivery_time,status", [delivery_status || null, eta, orderId]);
    await createCustomerNotification(client, order.customer_id, delivery_status ? `Order #${orderId} delivery status: ${delivery_status.replaceAll("_", " ")}.` : `Order #${orderId} estimated delivery time was updated.`);
    if (delivery_status === "delivered") {
      const requester = await client.query("SELECT seller_id FROM delivery_requests WHERE order_id=$1 AND status='accepted'", [orderId]);
      for (const row of requester.rows) await createSellerNotification(client, row.seller_id, `Order #${orderId} has been delivered.`);
      await createAdminNotification(client, `Order #${orderId} has been delivered.`);
      const active = await client.query("SELECT 1 FROM orders WHERE deliveryman_id=$1 AND delivery_status = ANY($2::VARCHAR[]) LIMIT 1", [req.user.sub, ACTIVE]); if (!active.rowCount) await client.query("UPDATE deliverymen SET availability_status='available' WHERE deliveryman_id=$1", [req.user.sub]);
    }
    await client.query("COMMIT");
    if (delivery_status === "delivered") {
      eventService.broadcast("notification_sent", { role: "admin" });
    }
    eventService.broadcast("order_updated", { orderId, delivery_status, status: updated.rows[0].status });
    eventService.broadcast("stats_updated");
    return res.json({ message: "Delivery updated.", order: updated.rows[0] });
  } catch (error) { try { await client.query("ROLLBACK"); } catch (_) {} console.error("Delivery update error:", error); return res.status(500).json({ message: "Unable to update delivery." }); } finally { client.release(); }
};
