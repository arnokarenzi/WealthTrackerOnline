import { pool } from "./MonthlyBudget.js";

const ActualInvestments = {
  // Fetch all physical investments in chronological order
  getAll: async () => {
    const [rows] = await pool.query(
      "SELECT * FROM ActualInvestments ORDER BY year DESC, month DESC",
    );
    return rows;
  },

  // Insert a new market asset entry
  addInvestment: async (assetName, principal, month, year) => {
    const sql = `
      INSERT INTO ActualInvestments (asset_name, principal_invested, current_value, month, year) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      assetName,
      principal,
      principal,
      month,
      year,
    ]);
    return result;
  },

  // Adjust valuation dynamically as market variables change
  updateValue: async (id, newValue) => {
    const sql = "UPDATE ActualInvestments SET current_value = ? WHERE id = ?";
    const [result] = await pool.query(sql, [newValue, id]);
    return result;
  },

  // Remove an asset entry from the records
  deleteInvestment: async (id) => {
    const sql = "DELETE FROM ActualInvestments WHERE id = ?";
    const [result] = await pool.query(sql, [id]);
    return result;
  },
};

export default ActualInvestments;
