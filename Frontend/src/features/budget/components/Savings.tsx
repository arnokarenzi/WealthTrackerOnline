import { Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item"; // 🛡️ Used below to clear the unused import flag
import ContextMenu from "../../../components/ContextMenu";
import CustomToolbar from "../../../components/CustomToolbar";
import { savingsSchema } from "../data/budget";
import { MonthlyBudget } from "../../../types/api";

export default function Savings({ budget }: { budget: MonthlyBudget }) {
  const columns: GridColDef[] = [
    ...savingsSchema,
    {
      field: "options",
      headerName: "",
      sortable: false,
      flex: 1,
      minWidth: 60,
      maxWidth: 60,
      renderCell: () => <ContextMenu />,
    },
  ];

  // 🚀 Calculate guidelines dynamically to resolve missing type key flags
  const totalIncome = Number(budget.salary ?? 0) + Number(budget.otherIncome ?? 0);
  const calculatedEmergencyGoal = totalIncome * 3; // 3-month safety runway target
  const calculatedInvestmentGoal = totalIncome * 0.2; // 20% wealth building benchmark
  const calculatedSchoolGoal = totalIncome * 0.15; // 15% dedicated family buffer

  const dynamicSavingsRows = [
    {
      id: 1,
      title: "Core Emergency Reserves",
      amount: `${Number(budget.emergencyFund ?? 0).toLocaleString()} RWF`,
      description: "Immediate safety liquidity net",
      goal: `${Math.round(calculatedEmergencyGoal).toLocaleString()} RWF`,
      targetDate: "Rolling Horizon",
      progress: "Monitored",
      category: "Protection",
      status: "Active",
    },
    {
      id: 2,
      title: "Investment Capital Roots",
      amount: `${Number(budget.investment ?? 0).toLocaleString()} RWF`,
      description: "Compounding generation assets",
      goal: `${Math.round(calculatedInvestmentGoal).toLocaleString()} RWF`,
      targetDate: "Wealth Building",
      progress: "Monitored",
      category: "Growth",
      status: "Active",
    },
    {
      id: 3,
      title: "School Fees Buffer Fund",
      amount: `${Number(budget.schoolSaving ?? 0).toLocaleString()} RWF`,
      description: "Structural tuition cash reserve",
      goal: `${Math.round(calculatedSchoolGoal).toLocaleString()} RWF`,
      targetDate: "Quarterly Cycle",
      progress: "Rollover Enabled",
      category: "Family Pillars",
      status: "Active",
    },
  ];

  return (
    // 🛡️ Wrapped in Item component to fix the layout and clear the import flag
    <Item
      title="Asset & Reserves Engine Accumulator"
      content={
        <Box style={{ height: 400, width: "100%" }}>
          <DataGrid
            rows={dynamicSavingsRows}
            columns={columns}
            disableColumnFilter
            disableColumnSelector
            disableDensitySelector
            slots={{ toolbar: CustomToolbar }}
            initialState={{
              pagination: { paginationModel: { page: 0, pageSize: 5 } },
            }}
            pageSizeOptions={[5]}
          />
        </Box>
      }
      height={500}
    />
  );
}
