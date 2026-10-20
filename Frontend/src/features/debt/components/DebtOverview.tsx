import { Box, Button, Stack } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import CustomToolbar from "../../../components/CustomToolbar";
import type { DebtRecord } from "../../../types/api";

interface Props {
  rows: DebtRecord[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (debt: DebtRecord) => void;
  onPay: (debt: DebtRecord) => void;
  onArchive: (debt: DebtRecord) => void;
}

export default function DebtOverview({ rows, loading, onAdd, onEdit, onPay, onArchive }: Props) {
  const columns: GridColDef<DebtRecord>[] = [
    { field: "creditor", headerName: "Creditor", minWidth: 150, flex: 1 },
    { field: "debtType", headerName: "Debt Type", minWidth: 125, flex: 1 },
    { field: "balance", headerName: "Balance (RWF)", type: "number", minWidth: 145, flex: 1, valueFormatter: (params) => Number(params.value || 0).toLocaleString() },
    { field: "interestRate", headerName: "Interest (%)", minWidth: 110, valueFormatter: (params) => params.value == null ? "Not set" : `${params.value}%` },
    { field: "minimumPayment", headerName: "Minimum Payment", minWidth: 145, valueFormatter: (params) => params.value == null ? "Not set" : Number(params.value).toLocaleString() },
    { field: "dueDate", headerName: "Due Date", minWidth: 115, valueFormatter: (params) => params.value || "Not set" },
    { field: "status", headerName: "Status", minWidth: 100 },
    { field: "progress", headerName: "Repaid", minWidth: 90, valueFormatter: (params) => `${Number(params.value || 0)}%` },
    {
      field: "actions", headerName: "Actions", sortable: false, filterable: false, minWidth: 230, flex: 1,
      renderCell: ({ row }) => <Stack direction="row" spacing={0.5}>
        <Button size="small" onClick={() => onEdit(row)}>Edit terms</Button>
        {row.status === "Active" && <Button size="small" variant="contained" onClick={() => onPay(row)}>Repay</Button>}
        {row.status === "Paid off" && <Button size="small" onClick={() => onArchive(row)}>Archive</Button>}
      </Stack>,
    },
  ];
  return <Item title="Debt Overview" content={<Box sx={{ width: "100%" }}>
    <Button variant="contained" sx={{ mb: 1.5 }} onClick={onAdd}>Add debt</Button>
    <Box sx={{ height: 400, width: "100%" }}>
      <DataGrid rows={rows} columns={columns} loading={loading} disableColumnSelector disableDensitySelector
        slots={{ toolbar: CustomToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }} pageSizeOptions={[5, 10]}
        localeText={{ noRowsLabel: "No debts have been recorded." }} />
    </Box>
  </Box>} height={500} />;
}
