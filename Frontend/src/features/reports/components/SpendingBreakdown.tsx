import { Alert, CardContent } from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import Item from "../../../components/Item";
import { SpendingBreakdownChart } from "./SpendingBreakdownChart";

export default function SpendingBreakdown({ data, keys }: { data: Array<Record<string, string | number>>; keys: string[] }) {
  return <Item title="Spending Breakdown" content={
    <CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
      {data.length && keys.length ? <SpendingBreakdownChart data={data as BarDatum[]} keys={keys} /> : <Alert severity="info" sx={{ m: 2 }}>No current-month expenses are logged.</Alert>}
    </CardContent>
  } height={500} />;
}
