import { Avatar, Box, Stack, Typography, useTheme } from "@mui/material";
import WalletOutlinedIcon from "@mui/icons-material/WalletOutlined";
import Item from "../../../components/Item";
import { tokens } from "../../../assets/theme";
import { MonthlyBudget } from "../../../types/api";

export default function ExpenseLimits({ budget }: { budget: MonthlyBudget }) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const styles = {
    alignItems: "center",
    backgroundColor: colors.primary[500],
    borderRadius: "1rem",
    display: "flex",
    gap: "1rem",
    padding: "1rem",
    width: "100%",
  };

  // Build the list directly from the database schema fields
  const dynamicExpenseBuckets = [
    { title: "Core Rent Base", limit: budget.rent },
    { title: "Food Provisions", limit: budget.food },
    { title: "Electricity & Water Grid", limit: budget.electricityWater },
    { title: "Network Phone & Internet", limit: budget.phoneInternet },
    { title: "Medical Safeguard Layer", limit: budget.medical },
    { title: "Family Direct Support", limit: budget.familySupport },
    { title: "Miscellaneous Contingency", limit: budget.miscellaneous },
  ];

  return (
    <Item
      title="Expense Limits"
      content={
        <Stack
          sx={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: "1rem",
          }}
        >
          {dynamicExpenseBuckets.map((obj, index) => (
            <Box sx={styles} key={index}>
              <Avatar sx={{ backgroundColor: colors.blueAccent[300] }}>
                <WalletOutlinedIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {obj.title}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: colors.blueAccent[400] }}
                >
                  {Number(obj.limit).toLocaleString()} RWF
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      }
      height={500}
    />
  );
}
