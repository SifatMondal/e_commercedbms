require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../db");

const BCRYPT_SALT_ROUNDS = 12;

async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = (process.env.ADMIN_NAME || "Administrator").trim();
    if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running this command.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address.");
    if (Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) throw new Error("ADMIN_PASSWORD must be between 8 and 72 bytes.");
    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const result = await pool.query(`INSERT INTO admins (name, email, password) VALUES ($1, $2, $3)
        ON CONFLICT (email) DO NOTHING RETURNING admin_id`, [name || "Administrator", email, hash]);
    console.log(result.rowCount ? "Admin account created." : "An admin with that email already exists.");
}

seedAdmin().catch((error) => { console.error("Admin seed failed:", error.message); process.exitCode = 1; }).finally(() => pool.end());
