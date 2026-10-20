import { useEffect, useState } from "react";
import { Alert, Box, CardContent, CircularProgress } from "@mui/material";
import Item from "../../../components/Item";
import { BillPaymentTrendsChart } from "./BillPaymentTrendsChart";
import { financeApi } from "../../../services/api";

export default function BillPaymentTrends() {
  const [data, setData] = useState<Array<{ id: string; color?: string; data: { x: string; y: number }[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasPayments, setHasPayments] = useState(false);

  useEffect(() => {
    let active = true;
    financeApi.getBillPaymentTrends()
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setHasPayments(response.hasPayments);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load payment trends.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <Item title="Bill Payment Trends" content={
      <CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
        {loading ? <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress /></Box>
          : error ? <Alert severity="error">{error}</Alert>
            : !hasPayments ? <Alert severity="info" sx={{ m: 2 }}>No bill payment history is recorded yet. Trends will appear after a payment is confirmed by the backend.</Alert>
              : <BillPaymentTrendsChart data={data} />}
      </CardContent>
    } height={500} />
  );
}
