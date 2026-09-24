require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function runMigrations() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const migrationsDir = path.resolve(__dirname, "../../database/migrations");
        if (!fs.existsSync(migrationsDir)) {
            console.log("No migrations directory found at:", migrationsDir);
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter((file) => file.endsWith(".sql"))
            .sort();

        const appliedRes = await client.query("SELECT version FROM schema_migrations");
        const appliedSet = new Set(appliedRes.rows.map((row) => row.version));

        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`[skip] ${file} already applied.`);
                continue;
            }

            console.log(`[apply] Executing migration: ${file}...`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, "utf8");

            await client.query("BEGIN");
            await client.query(sql);
            await client.query(
                "INSERT INTO schema_migrations (version) VALUES ($1)",
                [file]
            );
            await client.query("COMMIT");
            console.log(`[done] Applied migration: ${file}`);
        }

        console.log("All migrations are up to date!");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Migration failed:", error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
