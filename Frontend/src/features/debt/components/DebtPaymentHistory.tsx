import { Alert, Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import CustomToolbar from "../../../components/CustomToolbar";
import type { DebtPaymentRecord } from "../../../types/api";

export default function DebtPaymentHistory({ rows, loading }: { rows: DebtPaymentRecord[]; loading: boolean }) {
  const columns: GridColDef<DebtPaymentRecord>[] = [
    { field: "date", headerName: "Date", minWidth: 110, flex: 1 },
    { field: "description", headerName: "Description", minWidth: 160, flex: 1 },
    { field: "type", headerName: "Type", minWidth: 125, flex: 1 },
    { field: "category", headerName: "Category", minWidth: 120, flex: 1 },
    { field: "amount", headerName: "Amount (RWF)", type: "number", minWidth: 140, flex: 1, valueFormatter: (params) => Number(params.value || 0).toLocaleString() },
    { field: "paymentMethod", headerName: "Payment Method", minWidth: 130, flex: 1, valueFormatter: (params) => params.value || "—" },
    { field: "reference", headerName: "Reference", minWidth: 130, flex: 1 },
  ];
  return <Item title="Debt Payment History" content={<Box sx={{ height: 400, width: "100%" }}>
    <DataGrid rows={rows} columns={columns} loading={loading} disableColumnSelector disableDensitySelector
      slots={{ toolbar: CustomToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }} pageSizeOptions={[5, 10]}
      localeText={{ noRowsLabel: "No debt repayments have been recorded." }} />
    {!loading && rows.length === 0 && <Alert severity="info" sx={{ mt: 1 }}>Payment history is created only after a repayment is confirmed by the backend.</Alert>}
  </Box>} height={500} />;
}
