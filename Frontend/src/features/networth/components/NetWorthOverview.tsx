import { Alert, Box, CardContent, Stack, Typography } from "@mui/material";
import Item from "../../../components/Item";
import { NetWorthOverviewChart } from "./NetWorthOverviewChart";
import type { NetWorthSnapshotRecord } from "../../../types/api";

const money = (amount: number) => `${Number(amount || 0).toLocaleString()} RWF`;
export default function NetWorthOverview({ history, totalAssets, totalLiabilities, netWorth, asOfDate }: {
  history: NetWorthSnapshotRecord[]; totalAssets: number; totalLiabilities: number; netWorth: number; asOfDate: string;
}) {
  const chartData = history.length ? [{ id: "Net worth", data: history.map((point) => ({ x: point.date, y: point.netWorth })) }] : [];
  return <Item title="Net Worth History" content={<Box>
    <Stack spacing={0.5} sx={{ px: 1, pb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">Current value as of {asOfDate}</Typography>
      <Typography variant="h3">{money(netWorth)}</Typography>
      <Typography variant="body2" color="text.secondary">Assets {money(totalAssets)} − liabilities {money(totalLiabilities)}</Typography>
    </Stack>
    <CardContent style={{ height: "320px", padding: 0 }} className="Mui-Chart">
      {chartData.length ? <NetWorthOverviewChart data={chartData} /> : <Alert severity="info" sx={{ m: 2 }}>No historical snapshots have been saved. Use “Save today’s snapshot” to begin a truthful history; FinTrack does not fabricate prior balances.</Alert>}
    </CardContent>
  </Box>} height={500} />;
}
