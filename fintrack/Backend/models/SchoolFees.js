import { pool } from "./MonthlyBudget.js";

const SchoolFees = {
  getAll: () => pool.query("SELECT * FROM SchoolFees ORDER BY id ASC"),
  getLatestCumulative: () =>
    pool.query("SELECT cumulative FROM SchoolFees ORDER BY id DESC LIMIT 1"),
};

export default SchoolFees;
