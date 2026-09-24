const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { createAdminNotification } = require("../services/notificationService");
const eventService = require("../services/eventService");

const BCRYPT_SALT_ROUNDS = 12;
const publicRoles = ["customer", "seller", "deliveryman"];
const loginRoles = ["customer", "seller", "deliveryman", "admin"];

function validateRole(role) {
    return typeof role === "string" && publicRoles.includes(role.toLowerCase());
}

function validateRegistration(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object.";

    const requiredFields = ["role", "name", "email", "phone", "password"];
    const missingFields = requiredFields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
    if (missingFields.length > 0) return `Missing required fields: ${missingFields.join(", ")}.`;
    if (!validateRole(body.role)) return "role must be customer, seller, or deliveryman.";
    if (typeof body.name !== "string" || body.name.trim() === "" || body.name.trim().length > 150) return "name must be a non-empty string of at most 150 characters.";
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.trim().length > 254) return "email must be a valid email address.";
    if (typeof body.phone !== "string" || body.phone.trim() === "" || body.phone.trim().length > 30) return "phone must be a non-empty string of at most 30 characters.";
    if (typeof body.password !== "string" || Buffer.byteLength(body.password, "utf8") < 8 || Buffer.byteLength(body.password, "utf8") > 72) return "password must be between 8 and 72 bytes.";

    return null;
}

function createSafeUser(row, role) {
    return {
        id: row.id,
        role,
        name: row.name,
        email: row.email,
        phone: row.phone,
        ...(["seller", "deliveryman"].includes(role) ? { approval_status: row.approval_status } : {}),
        ...(role === "deliveryman" ? { availability_status: row.availability_status } : {})
    };
}

function signToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured.");

    return jwt.sign(
        { sub: String(user.id), role: user.role, email: user.email },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
}

function ensureJwtIsConfigured(res) {
    if (process.env.JWT_SECRET) return true;
    res.status(500).json({ message: "Authentication is not configured. Set JWT_SECRET in the environment." });
    return false;
}

async function findAccountByEmail(email) {
    const result = await pool.query(
        `SELECT id, name, email, phone, password, approval_status, suspended_until, availability_status, role
         FROM (
             SELECT customer_id AS id, name, email, phone, password, NULL::VARCHAR AS approval_status, NULL::TIMESTAMPTZ AS suspended_until, NULL::VARCHAR AS availability_status, 'customer' AS role FROM customers WHERE email = $1
             UNION ALL
             SELECT seller_id AS id, name, email, phone, password, approval_status, suspended_until, NULL::VARCHAR AS availability_status, 'seller' AS role FROM sellers WHERE email = $1
             UNION ALL
             SELECT deliveryman_id AS id, name, email, phone, password, approval_status, suspended_until, availability_status, 'deliveryman' AS role FROM deliverymen WHERE email = $1
             UNION ALL
             SELECT admin_id AS id, name, email, NULL::VARCHAR AS phone, password, NULL::VARCHAR AS approval_status, NULL::TIMESTAMPTZ AS suspended_until, NULL::VARCHAR AS availability_status, 'admin' AS role FROM admins WHERE email = $1
         ) AS accounts`,
        [email]
    );
    return result.rows;
}

exports.register = async (req, res) => {
    const validationError = validateRegistration(req.body);
    if (validationError) return res.status(400).json({ message: validationError });
    if (!ensureJwtIsConfigured(res)) return;

    const role = req.body.role.toLowerCase();
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const phone = req.body.phone.trim();

    try {
        const existingAccounts = await findAccountByEmail(email);
        if (existingAccounts.length > 0) return res.status(409).json({ message: "An account with this email already exists." });

        const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_SALT_ROUNDS);
        const query = role === "customer"
            ? `INSERT INTO customers (name, email, password, phone)
               VALUES ($1, $2, $3, $4)
               RETURNING customer_id AS id, name, email, phone`
            : role === "seller" ? `INSERT INTO sellers (name, email, phone, password, approval_status)
               VALUES ($1, $2, $3, $4, 'pending')
               RETURNING seller_id AS id, name, email, phone, approval_status, NULL::VARCHAR AS availability_status`
            : `INSERT INTO deliverymen (name, email, phone, password, delivery_location, approval_status, availability_status)
               VALUES ($1, $2, $3, $4, $5, 'pending', 'offline')
               RETURNING deliveryman_id AS id, name, email, phone, approval_status, availability_status`;
        const values = role === "customer"
            ? [name, email, passwordHash, phone]
            : role === "seller" ? [name, email, phone, passwordHash] : [name, email, phone, passwordHash, typeof req.body.delivery_location === "string" ? req.body.delivery_location.trim() || null : null];
        const result = await pool.query(query, values);
        const user = createSafeUser(result.rows[0], role);

        if (role === "seller") {
            await createAdminNotification(null, `New seller registration: "${name}" (${email}) is waiting for review.`);
            eventService.broadcast("notification_sent", { role: "admin" });
            eventService.broadcast("stats_updated");
        } else if (role === "deliveryman") {
            await createAdminNotification(null, `New deliveryman registration: "${name}" (${email}) is waiting for review.`);
            eventService.broadcast("notification_sent", { role: "admin" });
            eventService.broadcast("stats_updated");
        }

        const message = ["seller", "deliveryman"].includes(role)
            ? `${role[0].toUpperCase() + role.slice(1)} account created successfully. Your account is awaiting admin approval.`
            : "Registration successful. Please log in.";
        return res.status(201).json({ message, user });
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === "23505") return res.status(409).json({ message: "An account with this email already exists." });
        if (error.message === "JWT_SECRET is not configured.") return res.status(500).json({ message: "Authentication is not configured. Set JWT_SECRET in the environment." });
        return res.status(500).json({ message: "Unable to register account." });
    }
};

exports.login = async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ message: "Request body must be a JSON object." });
    const { email, password } = req.body;
    if (typeof email !== "string" || email.trim() === "" || typeof password !== "string" || password === "") {
        return res.status(400).json({ message: "email and password are required." });
    }
    if (!ensureJwtIsConfigured(res)) return;

    try {
        const accounts = await findAccountByEmail(email.trim().toLowerCase());
        if (!accounts || accounts.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // With cross-table email uniqueness enforced, email uniquely identifies the user
        const account = accounts[0];
        const roleName = account.role;

        if (!(await bcrypt.compare(password, account.password))) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Approval and suspension checks
        if (["seller", "deliveryman"].includes(roleName)) {
            if (account.approval_status === "pending") {
                return res.status(403).json({ message: `Your ${roleName} account is awaiting admin approval. Please wait until an admin approves your account.` });
            }
            if (account.approval_status === "rejected") {
                return res.status(403).json({ message: `Your ${roleName} account has been rejected by the admin.` });
            }
            if (account.approval_status === "suspended") {
                const now = new Date();
                if (account.suspended_until && new Date(account.suspended_until) <= now) {
                    // Temporary suspension has expired; auto-reactivate
                    const table = roleName === "seller" ? "sellers" : "deliverymen";
                    const idCol = roleName === "seller" ? "seller_id" : "deliveryman_id";
                    await pool.query(`UPDATE ${table} SET approval_status = 'approved', suspended_until = NULL WHERE ${idCol} = $1`, [account.id]);
                    account.approval_status = "approved";
                } else if (account.suspended_until) {
                    const untilDate = new Date(account.suspended_until).toLocaleDateString();
                    return res.status(403).json({ message: `Your ${roleName} account is temporarily suspended until ${untilDate}.` });
                } else {
                    return res.status(403).json({ message: `Your ${roleName} account has been suspended by the admin.` });
                }
            }
        }

        const user = createSafeUser(account, roleName);
        const token = signToken(user);
        return res.status(200).json({ message: "Login successful.", token, user });
    } catch (error) {
        console.error("Login error:", error);
        if (error.message === "JWT_SECRET is not configured.") return res.status(500).json({ message: "Authentication is not configured. Set JWT_SECRET in the environment." });
        return res.status(500).json({ message: "Unable to log in." });
    }
};
