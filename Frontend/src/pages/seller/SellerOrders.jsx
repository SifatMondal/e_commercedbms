import { useEffect, useState } from "react";
import Spinner from "../../components/Spinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { getSellerOrders, updateSellerOrderStatus, getAvailableDeliverymen, sendDeliveryRequest } from "../../services/sellerService";
import { useToast } from "../../context/ToastContext";

const money = (value) => `$${Number(value).toFixed(2)}`;
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const NEXT_STATUS = { Pending: "Processing", Processing: "Shipped" };

export default function SellerOrders() {
  const { showToast } = useToast(); const [orders, setOrders] = useState([]); const [status, setStatus] = useState("loading"); const [error, setError] = useState(""); const [updatingId, setUpdatingId] = useState(null); const [drivers, setDrivers] = useState([]); const [requestOrderId, setRequestOrderId] = useState(null);
  function load() { setStatus("loading"); getSellerOrders().then((data) => { setOrders(Array.isArray(data) ? data : []); setStatus("ready"); }).catch((e) => { setError(e.message); setStatus("error"); }); }
  useEffect(load, []);
  async function handleAdvance(order) { const nextStatus = NEXT_STATUS[order.status]; if (!nextStatus) return; setUpdatingId(order.order_id); try { await updateSellerOrderStatus(order.order_id, nextStatus); showToast(`Order #${order.order_id} marked as ${nextStatus}`); load(); } catch (e) { showToast(e.message, "error"); } finally { setUpdatingId(null); } }
  async function openRequest(orderId) { try { setDrivers(await getAvailableDeliverymen()); setRequestOrderId(orderId); } catch (e) { showToast(e.message, "error"); } }
  async function request(orderId, driverId) { setUpdatingId(orderId); try { await sendDeliveryRequest(orderId, driverId); showToast("Delivery request sent."); setRequestOrderId(null); load(); } catch (e) { showToast(e.message, "error"); } finally { setUpdatingId(null); } }
  if (status === "loading") return <Spinner label="Loading orders…" />;
  if (status === "error") return <ErrorState message={error} onRetry={load} />;
  if (!orders.length) return <EmptyState title="No orders yet" description="Orders containing your products will show up here." />;
  return <section className="seller-orders-page"><p className="eyebrow">Fulfilment</p><h1>Customer orders</h1><ul className="order-list">{orders.map((order) => { const nextStatus = NEXT_STATUS[order.status]; const canRequest = order.status === "Shipped" && !order.deliveryman_id; const deliveryInfo = order.deliveryman_name ? `Assigned: ${order.deliveryman_name}` : order.delivery_request_status ? `Request ${order.delivery_request_status}${order.requested_deliveryman_name ? `: ${order.requested_deliveryman_name}` : ""}` : ""; return <li key={order.order_id} className="order-card seller-order-card"><div className="order-card-head"><div><strong>Order #{order.order_id}</strong><p className="hint">{formatDate(order.order_date)} · {order.customer.name} ({order.customer.email})</p></div><StatusBadge status={order.status} /></div><ul className="simple-list">{order.items.map((item) => <li key={item.order_item_id}><span>{item.product_name} × {item.quantity}</span><span>{money(item.subtotal)}</span></li>)}</ul><div className="order-card-foot"><span className="hint">Shipping to: {order.shipping_address}{deliveryInfo ? ` · ${deliveryInfo}` : ""}</span>{nextStatus && <button onClick={() => handleAdvance(order)} disabled={updatingId === order.order_id}>{updatingId === order.order_id ? "Updating…" : `Mark as ${nextStatus}`}</button>}{canRequest && <button onClick={() => openRequest(order.order_id)}>Send Delivery Request</button>}</div>{requestOrderId === order.order_id && <div className="delivery-details"><strong>Available deliverymen</strong>{drivers.length ? drivers.map((driver) => <div className="summary-row" key={driver.deliveryman_id}><span>{driver.name} · {driver.phone}{driver.delivery_location ? ` · ${driver.delivery_location}` : ""}</span><button disabled={updatingId === order.order_id} onClick={() => request(order.order_id, driver.deliveryman_id)}>Send request</button></div>) : <span className="hint">No approved, available deliverymen right now.</span>}<button className="text-button" onClick={() => setRequestOrderId(null)}>Close</button></div>}</li>; })}</ul></section>;
}
