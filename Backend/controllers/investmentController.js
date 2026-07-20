import ActualInvestments from "../models/ActualInvestments.js";

export const getInvestments = async (req, res) => {
  try {
    const data = await ActualInvestments.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createInvestment = async (req, res) => {
  const { asset_name, principal_invested, month, year } = req.body;
  try {
    const result = await ActualInvestments.addInvestment(
      asset_name,
      principal_invested,
      month,
      year,
    );
    res
      .status(201)
      .json({
        message: "Investment recorded successfully!",
        id: result.insertId,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateValuation = async (req, res) => {
  const { id } = req.params;
  const { current_value } = req.body;
  try {
    await ActualInvestments.updateValue(id, current_value);
    res.json({ message: "Asset valuation updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteInvestment = async (req, res) => {
  const { id } = req.params;
  try {
    await ActualInvestments.deleteInvestment(id);
    res.json({ message: "Asset record deleted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
