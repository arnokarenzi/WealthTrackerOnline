import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Formik } from "formik";
import * as yup from "yup";
import { useState } from "react";
// 🛡️ Import the strict type to replace 'any'
import { MonthlyBudget } from "../../../../types/api";

const validationSchema = yup.object().shape({
  fieldKey: yup.string().required("Selection required"),
  limit: yup.number().min(0, "Must be positive").required("Required"),
});

type ExpenseFormProps = {
  currentBudget: MonthlyBudget; // 🚀 Replaced 'any' with strict typing
  onSaveSuccess: () => Promise<void>;
  onClose: () => void;
};

const ExpenseForm = ({
  currentBudget,
  onSaveSuccess,
  onClose,
}: ExpenseFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inside /src/features/budget/components/ExpenseForm.tsx
  // Inside your ExpenseForm.tsx file, verify or update the fieldsList array:
  const fieldsList = [
    { label: "Other Auxiliary Income", key: "otherIncome" }, // 🚀 Added for your manual income streams
    { label: "Shift Salary Base (Logs)", key: "salary" }, // 🚀 Added for manual adjustments to salary roots
    { label: "Core Rent Base", key: "rent" },
    { label: "Food Provisions", key: "food" },
    { label: "Electricity & Water Grid", key: "electricityWater" },
    { label: "Network Phone & Internet", key: "phoneInternet" },
    { label: "Medical Safeguards", key: "medical" },
    { label: "Family Direct Support", key: "familySupport" },
    { label: "Miscellaneous Buffers", key: "miscellaneous" },
    { label: "Emergency Reserves Target", key: "emergencyFund" }, // 🚀 Added to manually customize saving allocations
    { label: "Investment Capital Roots", key: "investment" }, // 🚀 Added
    { label: "School Fees Buffer Fund", key: "schoolSaving" }, // 🚀 Added
  ];

  const handleFormSubmit = async (values: {
    fieldKey: string;
    limit: number;
  }) => {
    setIsSubmitting(true);
    try {
      const updatedBudget = {
        ...currentBudget,
        [values.fieldKey]: values.limit,
      };

      // 🗺️ Adopted IDE path correction
      const { financeApi } = await import("../../../../services/api");
      await financeApi.updateBudgetPlan(updatedBudget);

      await onSaveSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to commit target limit mutation:", err);
      alert("Error writing limits change back to Aiven cloud instance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ textAlign: "center", mb: 3 }}>
        Adjust Target Operating Limit
      </Typography>

      <Formik
        onSubmit={handleFormSubmit}
        initialValues={{ fieldKey: "rent", limit: 0 }}
        validationSchema={validationSchema}
      >
        {({
          values,
          errors,
          touched,
          handleBlur,
          handleChange,
          handleSubmit,
        }) => (
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: "flex", gap: 3, flexDirection: "column" }}>
              <TextField
                select
                fullWidth
                variant="filled"
                color="info"
                label="Select Expenditure Category Pipeline"
                name="fieldKey"
                value={values.fieldKey}
                onChange={handleChange}
                onBlur={handleBlur}
                SelectProps={{ native: true }}
                error={!!touched.fieldKey && !!errors.fieldKey}
                helperText={touched.fieldKey && errors.fieldKey}
              >
                {fieldsList.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </TextField>

              <TextField
                fullWidth
                variant="filled"
                color="info"
                type="number"
                label="New Target Operational Limit (RWF)"
                name="limit"
                value={values.limit}
                onChange={handleChange}
                onBlur={handleBlur}
                error={!!touched.limit && !!errors.limit}
                helperText={touched.limit && errors.limit}
              />

              <Button
                type="submit"
                color="info"
                variant="contained"
                size="large"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Commit New Limit"
                )}
              </Button>
            </Box>
          </form>
        )}
      </Formik>
    </Box>
  );
};

export default ExpenseForm;
