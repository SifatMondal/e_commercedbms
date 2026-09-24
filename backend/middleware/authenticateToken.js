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
        const result = await pool.query("SELECT approval_status, suspended_until FROM sellers WHERE seller_id = $1", [req.user.sub]);
        if (result.rowCount === 0) return res.status(401).json({ message: "Seller account no longer exists." });
        const seller = result.rows[0];

        if (seller.approval_status === "suspended") {
            if (seller.suspended_until && new Date(seller.suspended_until) <= new Date()) {
                // Temporary suspension expired, auto-reactivate
                await pool.query("UPDATE sellers SET approval_status = 'approved', suspended_until = NULL WHERE seller_id = $1", [req.user.sub]);
                return next();
            }
            const untilText = seller.suspended_until
                ? ` until ${new Date(seller.suspended_until).toLocaleDateString()}`
                : " indefinitely";
            return res.status(403).json({
                message: `Your seller account is currently suspended${untilText}. You can contact admin to appeal this suspension.`,
                isSuspended: true,
                suspended_until: seller.suspended_until
            });
        }

        if (seller.approval_status !== "approved") {
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
        const result = await pool.query("SELECT approval_status, suspended_until FROM deliverymen WHERE deliveryman_id = $1", [req.user.sub]);
        if (!result.rowCount) return res.status(401).json({ message: "Deliveryman account no longer exists." });
        const driver = result.rows[0];

        if (driver.approval_status === "suspended") {
            if (driver.suspended_until && new Date(driver.suspended_until) <= new Date()) {
                // Temporary suspension expired, auto-reactivate
                await pool.query("UPDATE deliverymen SET approval_status = 'approved', availability_status = 'available', suspended_until = NULL WHERE deliveryman_id = $1", [req.user.sub]);
                return next();
            }
            const untilText = driver.suspended_until
                ? ` until ${new Date(driver.suspended_until).toLocaleDateString()}`
                : " indefinitely";
            return res.status(403).json({
                message: `Your deliveryman account is currently suspended${untilText}. You can contact admin to appeal this suspension.`,
                isSuspended: true,
                suspended_until: driver.suspended_until
            });
        }

        if (driver.approval_status !== "approved") return res.status(403).json({ message: "Your deliveryman account is awaiting approval or has been rejected." });
        return next();
    } catch (error) { console.error("Deliveryman approval check error:", error); return res.status(500).json({ message: "Unable to verify deliveryman approval status." }); }
}

module.exports = authenticateToken;
module.exports.requireRole = requireRole;
module.exports.requireApprovedSeller = requireApprovedSeller;
module.exports.requireApprovedDeliveryman = requireApprovedDeliveryman;
