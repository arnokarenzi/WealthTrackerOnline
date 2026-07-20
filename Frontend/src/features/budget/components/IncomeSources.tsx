import { Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import ContextMenu from "../../../components/ContextMenu";
import CustomToolbar from "../../../components/CustomToolbar";
import { incomeSourcesSchema } from "../data/budget";
import { MonthlyBudget } from "../../../types/api";

// 🚀 Removed the unused 'onRefresh' argument to clear the parameter flag
export default function IncomeSources({ budget }: { budget: MonthlyBudget }) {
  const columns: GridColDef[] = [
    ...incomeSourcesSchema,
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

  const dynamicRows = [
    {
      id: 1,
      sourceName: "Shift Salary (Auto)",
      amount: budget.salary ?? 0,
      paymentMethod: "Direct Deposit",
      frequency: "Shift-Based",
      status: "Active",
      received: "Synced",
      category: "Employment",
      description: "Calculated automatically via shifts engine logs",
      taxRate: 0,
    },
    {
      id: 2,
      sourceName: "Other Auxiliary Income",
      amount: budget.otherIncome ?? 0,
      paymentMethod: "Flexible",
      frequency: "Variable",
      status: "Active",
      received: "Current Cycle",
      category: "Side Hustle",
      description: "Manually managed income streams",
      taxRate: 0,
    },
  ];

  return (
    <Item
      title="Income Sources Ledger"
      content={
        <Box sx={{ height: 400, width: "100%" }}>
          <DataGrid
            rows={dynamicRows}
            columns={columns}
            disableColumnFilter
            disableColumnSelector
            disableDensitySelector
            slots={{ toolbar: CustomToolbar }}
            slotProps={{
              toolbar: { showQuickFilter: true },
            }}
            pageSizeOptions={[5, 10]}
          />
        </Box>
      }
      height={500}
    />
  );
}
