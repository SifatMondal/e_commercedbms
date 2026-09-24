const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authorization token is required." });
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Authentication is not configured. Set JWT_SECRET in the environment." });

    try {
        req.user = jwt.verify(token, secret);
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired authorization token." });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You are not authorized to access this resource." });
        }
        return next();
    };
}

async function requireApprovedSeller(req, res, next) {
    if (!req.user || req.user.role !== "seller") {
        return res.status(403).json({ message: "Only seller accounts can access seller management endpoints." });
    }

    try {
        const pool = require("../db");
        const result = await pool.query("SELECT approval_status FROM sellers WHERE seller_id = $1", [req.user.sub]);
        if (result.rowCount === 0) return res.status(401).json({ message: "Seller account no longer exists." });
        if (result.rows[0].approval_status !== "approved") {
            return res.status(403).json({ message: "Your seller account is awaiting admin approval or has been rejected." });
        }
        return next();
    } catch (error) {
        console.error("Seller approval check error:", error);
        return res.status(500).json({ message: "Unable to verify seller approval status." });
    }
}

async function requireApprovedDeliveryman(req, res, next) {
    if (!req.user || req.user.role !== "deliveryman") return res.status(403).json({ message: "Only deliveryman accounts can access delivery features." });
    try {
        const pool = require("../db");
        const result = await pool.query("SELECT approval_status FROM deliverymen WHERE deliveryman_id = $1", [req.user.sub]);
        if (!result.rowCount) return res.status(401).json({ message: "Deliveryman account no longer exists." });
        if (result.rows[0].approval_status !== "approved") return res.status(403).json({ message: "Your deliveryman account is awaiting approval or has been rejected." });
        return next();
    } catch (error) { console.error("Deliveryman approval check error:", error); return res.status(500).json({ message: "Unable to verify deliveryman approval status." }); }
}

module.exports = authenticateToken;
module.exports.requireRole = requireRole;
module.exports.requireApprovedSeller = requireApprovedSeller;
module.exports.requireApprovedDeliveryman = requireApprovedDeliveryman;
