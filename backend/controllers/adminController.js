const pool = require("../db");
const { createSellerNotification } = require("../services/notificationService");

function validId(value) {
    return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;
}

function publicSeller(row) {
    return {
        seller_id: row.seller_id, name: row.name, email: row.email, phone: row.phone,
        approval_status: row.approval_status, created_at: row.created_at
    };
}
function publicDeliveryman(row) { return { deliveryman_id: row.deliveryman_id, name: row.name, email: row.email, phone: row.phone, approval_status: row.approval_status, availability_status: row.availability_status, created_at: row.created_at }; }

exports.getSellers = async (req, res) => {
    try {
        const result = await pool.query(`SELECT seller_id, name, email, phone, approval_status, created_at
            FROM sellers ORDER BY seller_id DESC`);
        return res.json(result.rows.map(publicSeller));
    } catch (error) {
        console.error("Admin seller list error:", error);
        return res.status(500).json({ message: "Unable to retrieve sellers." });
    }
};

exports.getPendingSellers = async (req, res) => {
    try {
        const result = await pool.query(`SELECT seller_id, name, email, phone, approval_status, created_at
            FROM sellers WHERE approval_status = 'pending' ORDER BY created_at, seller_id`);
        return res.json(result.rows.map(publicSeller));
    } catch (error) {
        console.error("Pending seller list error:", error);
        return res.status(500).json({ message: "Unable to retrieve pending sellers." });
    }
};

exports.setSellerDecision = async (req, res) => {
    const { sellerId } = req.params;
    const status = req.decision;
    if (!validId(sellerId)) return res.status(400).json({ message: "sellerId must be a positive integer." });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const seller = await client.query("SELECT seller_id FROM sellers WHERE seller_id = $1 FOR UPDATE", [sellerId]);
        if (seller.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Seller not found." });
        }
        const result = await client.query(`UPDATE sellers SET approval_status = $1 WHERE seller_id = $2
            RETURNING seller_id, name, email, phone, approval_status, created_at`, [status, sellerId]);
        const message = status === "approved"
            ? "Your seller account has been approved by the admin. You can now access seller features."
            : "Your seller account has been rejected by the admin.";
        await createSellerNotification(client, sellerId, message);
        await client.query("COMMIT");
        return res.json({ message: `Seller ${status} successfully.`, seller: publicSeller(result.rows[0]) });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) { /* transaction was not started */ }
        console.error("Seller decision error:", error);
        return res.status(500).json({ message: "Unable to update seller approval status." });
    } finally {
        client.release();
    }
};

exports.approveSeller = (req, res) => { req.decision = "approved"; return exports.setSellerDecision(req, res); };
exports.rejectSeller = (req, res) => { req.decision = "rejected"; return exports.setSellerDecision(req, res); };

exports.getDeliverymen = async (req, res) => {
    try { const result = await pool.query("SELECT deliveryman_id, name, email, phone, approval_status, availability_status, created_at FROM deliverymen ORDER BY deliveryman_id DESC"); return res.json(result.rows.map(publicDeliveryman)); }
    catch (error) { console.error("Admin deliveryman list error:", error); return res.status(500).json({ message: "Unable to retrieve deliverymen." }); }
};
exports.setDeliverymanDecision = async (req, res) => {
    const { deliverymanId } = req.params; const status = req.decision;
    if (!validId(deliverymanId)) return res.status(400).json({ message: "deliverymanId must be a positive integer." });
    try {
        const result = await pool.query(`UPDATE deliverymen SET approval_status = $1, availability_status = CASE WHEN $1 = 'approved' AND availability_status = 'offline' THEN 'available' ELSE availability_status END WHERE deliveryman_id = $2 RETURNING deliveryman_id, name, email, phone, approval_status, availability_status, created_at`, [status, deliverymanId]);
        if (!result.rowCount) return res.status(404).json({ message: "Deliveryman not found." });
        return res.json({ message: `Deliveryman ${status} successfully.`, deliveryman: publicDeliveryman(result.rows[0]) });
    } catch (error) { console.error("Deliveryman decision error:", error); return res.status(500).json({ message: "Unable to update deliveryman approval status." }); }
};
exports.approveDeliveryman = (req, res) => { req.decision = "approved"; return exports.setDeliverymanDecision(req, res); };
exports.rejectDeliveryman = (req, res) => { req.decision = "rejected"; return exports.setDeliverymanDecision(req, res); };
