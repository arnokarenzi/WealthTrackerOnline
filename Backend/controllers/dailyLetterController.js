import { getDailyPacingStatus } from "../services/dailyLetterService.js";

export const getDailyLetterStatus = async (req, res) => {
  try {
    res.json(await getDailyPacingStatus());
  } catch (err) {
    console.error("Daily letter status error:", err);
    res.status(500).json({ error: err.message });
  }
};
