import { Box, Button, Stack } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import CustomToolbar from "../../../components/CustomToolbar";
import type { NetWorthAssetRecord } from "../../../types/api";

export default function Assets({ rows, loading, onArchive }: { rows: NetWorthAssetRecord[]; loading: boolean; onArchive: (asset: NetWorthAssetRecord) => void }) {
  const columns: GridColDef<NetWorthAssetRecord>[] = [
    { field: "assetName", headerName: "Name", minWidth: 170, flex: 1 },
    { field: "assetType", headerName: "Type", minWidth: 130, flex: 1 },
    { field: "currentValue", headerName: "Current Value (RWF)", type: "number", minWidth: 170, flex: 1, valueFormatter: (params) => Number(params.value || 0).toLocaleString() },
    { field: "currency", headerName: "Currency", minWidth: 90 },
    { field: "acquisitionDate", headerName: "Acquisition Date", minWidth: 135, valueFormatter: (params) => params.value || "—" },
    { field: "description", headerName: "Details", minWidth: 180, flex: 1, valueFormatter: (params) => params.value || "—" },
    { field: "source", headerName: "Source", minWidth: 130, valueFormatter: (params) => ({ wallet: "Wallet balance", "emergency-fund": "Emergency fund", "investment-reserve": "Investment reserve", "actual-investment": "Investment holding", manual: "Manual asset" }[String(params.value)] || String(params.value)) },
    { field: "actions", headerName: "Actions", minWidth: 100, sortable: false, filterable: false, renderCell: ({ row }) => row.source === "manual" ? <Button size="small" onClick={() => onArchive(row)}>Archive</Button> : <Stack /> },
  ];
  return <Item title="Assets" content={<Box sx={{ height: 400, width: "100%" }}>
    <DataGrid rows={rows} columns={columns} loading={loading} getRowId={(row) => row.id}
      disableColumnSelector disableDensitySelector slots={{ toolbar: CustomToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize: 5 } } }} pageSizeOptions={[5, 10]}
      localeText={{ noRowsLabel: "No asset balances are available. Add a manually tracked asset or populate an existing supported balance." }} />
  </Box>} height={500} />;
}
