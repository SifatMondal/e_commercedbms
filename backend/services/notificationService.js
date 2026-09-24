const pool = require("../db");

function validateRecipientId(value, recipientType) {
    if (!/^\d+$/.test(String(value)) || BigInt(String(value)) <= 0n) {
        throw new Error(`A valid ${recipientType} recipient id is required.`);
    }
}

async function createCustomerNotification(client, customerId, message) {
    validateRecipientId(customerId, "customer");
    if (typeof message !== "string" || message.trim() === "") throw new Error("Notification message is required.");
    const runner = client || pool;

    const result = await runner.query(
        `INSERT INTO notifications (message, notification_date, status, customer_id, seller_id)
         VALUES ($1, CURRENT_DATE, 'Unread', $2, NULL)
         RETURNING notification_id, message, notification_date, status, customer_id, seller_id`,
        [message.trim(), customerId]
    );
    return result.rows[0];
}

async function createSellerNotification(client, sellerId, message) {
    validateRecipientId(sellerId, "seller");
    if (typeof message !== "string" || message.trim() === "") throw new Error("Notification message is required.");
    const runner = client || pool;

    const result = await runner.query(
        `INSERT INTO notifications (message, notification_date, status, customer_id, seller_id)
         VALUES ($1, CURRENT_DATE, 'Unread', NULL, $2)
         RETURNING notification_id, message, notification_date, status, customer_id, seller_id`,
        [message.trim(), sellerId]
    );
    return result.rows[0];
}

async function createDeliverymanNotification(client, deliverymanId, message) {
    validateRecipientId(deliverymanId, "deliveryman");
    const runner = client || pool;
    const result = await runner.query(
        `INSERT INTO notifications (message, notification_date, status, customer_id, seller_id, deliveryman_id)
         VALUES ($1, CURRENT_DATE, 'Unread', NULL, NULL, $2)
         RETURNING notification_id, message, notification_date, status, deliveryman_id`,
        [message.trim(), deliverymanId]
    );
    return result.rows[0];
}

async function createAdminNotification(client, message) {
    if (typeof message !== "string" || message.trim() === "") throw new Error("Notification message is required.");
    const runner = client || pool;
    const adminRes = await runner.query("SELECT admin_id FROM admins");
    const created = [];
    for (const row of adminRes.rows) {
        const result = await runner.query(
            `INSERT INTO notifications (message, notification_date, status, customer_id, seller_id, deliveryman_id, admin_id)
             VALUES ($1, CURRENT_DATE, 'Unread', NULL, NULL, NULL, $2)
             RETURNING notification_id, message, notification_date, status, admin_id`,
            [message.trim(), row.admin_id]
        );
        created.push(result.rows[0]);
    }
    return created;
}

module.exports = {
    createCustomerNotification,
    createSellerNotification,
    createDeliverymanNotification,
    createAdminNotification
};

