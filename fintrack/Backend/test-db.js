import { pool } from "./models/MonthlyBudget.js";

async function testConnection() {
  try {
    console.log("Attempting to connect to database...");
    const [rows] = await pool.query("SELECT 1 AS test_val");
    console.log("Connection successful! Database returned:", rows[0].test_val);
  } catch (err) {
    console.error("Database connection failed:", err.message);
  } finally {
    process.exit();
  }
}

testConnection();
