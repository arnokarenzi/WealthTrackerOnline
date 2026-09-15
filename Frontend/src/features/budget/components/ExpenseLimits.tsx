import { Avatar, Box, Chip, LinearProgress, Stack, Typography, useTheme } from "@mui/material";
import WalletOutlinedIcon from "@mui/icons-material/WalletOutlined";
import Item from "../../../components/Item";
import { tokens } from "../../../assets/theme";
import { MonthlyBudget } from "../../../types/api";

export default function ExpenseLimits({ budget }: { budget: MonthlyBudget }) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  // Total shift salary available to distribute through waterfall sequence
  const earnedSalary = Number(budget?.salary || 0);

  // Priority queue order (1: Rent -> 7: Miscellaneous)
  const PRIORITY_ORDER = [
    { key: "rent", title: "Core Rent Base", limit: Number(budget?.rent || 0) },
    { key: "food", title: "Food Provisions", limit: Number(budget?.food || 0) },
    { key: "phoneInternet", title: "Network Phone & Internet", limit: Number(budget?.phoneInternet || 0) },
    { key: "electricityWater", title: "Electricity & Water Grid", limit: Number(budget?.electricityWater || 0) },
    { key: "medical", title: "Medical Safeguard Layer", limit: Number(budget?.medical || 0) },
    { key: "familySupport", title: "Family Direct Support", limit: Number(budget?.familySupport || 0) },
    { key: "miscellaneous", title: "Miscellaneous Contingency", limit: Number(budget?.miscellaneous || 0) },
  ];

  let remainingSalary = earnedSalary;

  // Compute sequential waterfall allocations
  const dynamicExpenseBuckets = PRIORITY_ORDER.map((item, index) => {
    const isLast = index === PRIORITY_ORDER.length - 1;
    const limit = item.limit;

    let allocated = 0;
    let isSurplus = false;

    if (isLast) {
      // Priority 7 (Miscellaneous) receives all remaining salary, including surplus
      allocated = Math.max(0, remainingSalary);
      isSurplus = allocated > limit;
    } else {
      // Priorities 1-6 fill up to 100% of target limit
      allocated = Math.min(remainingSalary, limit);
      remainingSalary = Math.max(0, remainingSalary - allocated);
    }

    const percentage = limit > 0 ? (allocated / limit) * 100 : 0;

    return {
      ...item,
      priority: index + 1,
      allocated,
      percentage,
      isSurplus,
    };
  });

  const cardStyle = {
    backgroundColor: colors.primary[500],
    borderRadius: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "1rem",
    width: "100%",
  };

  return (
    <Item
      title="Expense Limits (Waterfall Allocation)"
      content={
        <Stack
          sx={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: "0.5rem",
          }}
        >
          {dynamicExpenseBuckets.map((obj) => {
            let chipColor: "success" | "warning" | "default" | "secondary" = "default";
            let chipLabel = "0% Waiting";

            if (obj.isSurplus) {
              chipColor = "secondary";
              chipLabel = `${Math.round(obj.percentage)}% Surplus`;
            } else if (obj.percentage >= 100) {
              chipColor = "success";
              chipLabel = "100% Funded";
            } else if (obj.percentage > 0) {
              chipColor = "warning";
              chipLabel = `${Math.round(obj.percentage)}% Funded`;
            }

            return (
              <Box sx={cardStyle} key={obj.key}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                  <Box display="flex" alignItems="center" gap="0.75rem">
                    <Avatar
                      sx={{
                        backgroundColor:
                          obj.percentage >= 100
                            ? colors.greenAccent[500]
                            : obj.percentage > 0
                            ? colors.blueAccent[300]
                            : colors.grey[600],
                        width: 36,
                        height: 36,
                      }}
                    >
                      <WalletOutlinedIcon sx={{ fontSize: "1.2rem" }} />
                    </Avatar>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      P{obj.priority}. {obj.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={chipLabel}
                    color={chipColor}
                    size="small"
                    sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: colors.grey[300] }}>
                    Covered:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: colors.blueAccent[400] }}>
                    {obj.allocated.toLocaleString()} / {obj.limit.toLocaleString()} RWF
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(obj.percentage, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary[600],
                    "& .MuiLinearProgress-bar": {
                      backgroundColor:
                        obj.percentage >= 100
                          ? colors.greenAccent[500]
                          : obj.percentage > 0
                          ? colors.blueAccent[400]
                          : colors.grey[600],
                    },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      }
      height={500}
    />
  );
}
