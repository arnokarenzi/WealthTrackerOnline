import { Alert, Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import CustomToolbar from "../../../components/CustomToolbar";
import type { NetWorthLiabilityRecord } from "../../../types/api";

export default function Liabilities({ rows, loading }: { rows: NetWorthLiabilityRecord[]; loading: boolean }) {
  const columns: GridColDef<NetWorthLiabilityRecord>[] = [
    { field: "name", headerName: "Creditor", minWidth: 150, flex: 1 },
    { field: "type", headerName: "Type", minWidth: 120, flex: 1 },
    { field: "amount", headerName: "Outstanding (RWF)", type: "number", minWidth: 160, flex: 1, valueFormatter: (params) => Number(params.value || 0).toLocaleString() },
    { field: "interestRate", headerName: "Interest (%)", minWidth: 105, valueFormatter: (params) => params.value == null ? "Not set" : `${params.value}%` },
    { field: "minimumPayment", headerName: "Minimum (RWF)", minWidth: 125, valueFormatter: (params) => params.value == null ? "Not set" : Number(params.value).toLocaleString() },
    { field: "dueDate", headerName: "Due date", minWidth: 120, valueFormatter: (params) => params.value || "Not set" },
    { field: "loanTerm", headerName: "Term", minWidth: 120 },
    { field: "status", headerName: "Status", minWidth: 95 },
  ];
  return <Item title="Liabilities" content={<Box sx={{ height: 400, width: "100%" }}>
    <DataGrid rows={rows} columns={columns} loading={loading} getRowId={(row) => row.id}
      disableColumnSelector disableDensitySelector slots={{ toolbar: CustomToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }} pageSizeOptions={[5, 10]}
      localeText={{ noRowsLabel: "No outstanding debt records are available." }} />
    {!loading && rows.length === 0 && <Alert severity="info" sx={{ mt: 1 }}>Only debts with a positive saved balance are included in this liabilities table. Unpaid bills are excluded until a transaction relationship is defined.</Alert>}
  </Box>} height={500} />;
}
