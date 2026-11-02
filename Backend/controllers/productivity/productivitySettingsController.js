import {
  getProductivitySettings,
  updateProductivitySettings,
} from "../../services/productivity/productivitySettingsService.js";
import { normalizeProductivitySettingsPatch } from "../../utils/productivitySettings.js";

const sendSettingsError = (res, error, operation) => {
  if (error.code === "PRODUCTIVITY_SETTINGS_NOT_INITIALIZED" || error.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      error: "Productivity storage is not initialized. Apply the productivity foundation migration and try again.",
      code: "PRODUCTIVITY_MIGRATION_REQUIRED",
    });
  }

  console.error(`${operation} productivity settings error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity settings.` });
};

export const getProductivitySettingsController = async (_req, res) => {
  try {
    const settings = await getProductivitySettings();
    return res.json(settings);
  } catch (error) {
    return sendSettingsError(res, error, "retrieve");
  }
};

export const updateProductivitySettingsController = async (req, res) => {
  const result = normalizeProductivitySettingsPatch(req.body);
  if (result.errors.length > 0) {
    return res.status(400).json({ error: result.errors.join(" ") });
  }

  try {
    const settings = await updateProductivitySettings(result.values);
    return res.json({
      message: "Productivity preferences saved successfully.",
      settings,
    });
  } catch (error) {
    return sendSettingsError(res, error, "update");
  }
};
