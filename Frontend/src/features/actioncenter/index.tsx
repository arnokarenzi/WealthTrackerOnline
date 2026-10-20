import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { financeApi } from "../../services/api";
import type { ActionCenterItem, ActionCenterPayload } from "../../types/api";

const moneyDate = (value: string) => value;

function ActionCard({ item, onOpen }: { item: ActionCenterItem; onOpen: (item: ActionCenterItem) => void }) {
  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip size="small" color={item.severity === "critical" ? "error" : "warning"} label={item.severity === "critical" ? "Overdue" : "Due soon"} />
          <Typography variant="caption" color="text.secondary">Due {moneyDate(item.dueDate)}</Typography>
        </Stack>
        <Typography variant="h5" sx={{ mb: 1 }}>{item.title}</Typography>
        <Typography variant="body2" color="text.secondary">{item.message}</Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}><Button variant="contained" onClick={() => onOpen(item)}>{item.actionLabel}</Button></CardActions>
    </Card>
  );
}

export default function ActionCenter() {
  const [data, setData] = useState<ActionCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await financeApi.getActionCenter()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load actionable items from the backend."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openItem = (item: ActionCenterItem) => navigate(item.route);
  const overdueCount = data?.items.filter((item) => item.severity === "critical").length ?? 0;

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1} sx={{ py: 2, mb: 1 }}>
        <Box><Typography variant="h1">Action Center</Typography><Typography variant="body1" color="text.secondary">Upcoming and overdue bill/debt due dates from saved records.</Typography></Box>
        <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh actions</Button>
      </Stack>
      {loading && <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {data && !loading && !error && <>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip label={`${data.count} action${data.count === 1 ? "" : "s"}`} />
          <Chip color={overdueCount ? "error" : "default"} label={`${overdueCount} overdue`} />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>As of {data.asOfDate}; upcoming items are included through {data.dueThrough}.</Typography>
        </Stack>
        {!data.items.length ? <Alert severity="success">No unpaid bills or active debt due dates are currently overdue or due within the next seven days.</Alert> :
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            {data.items.map((item) => <ActionCard key={item.id} item={item} onOpen={openItem} />)}
          </Box>}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>These items are derived from current bill and debt due dates; opening an item takes you to its feature. Recording a payment still requires confirmation in that feature and does not happen from this page.</Typography>
      </>}
    </Box>
  );
}
