import { Alert, CardContent } from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import Item from "../../../components/Item";
import { DebtBurdenRatioChart } from "./DebtBurdenRatioChart";

export default function DebtBurdenRatio({ data }: { data: BarDatum[] }) {
  return <Item title="Debt Burden by Type" content={<CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
    {data.length ? <DebtBurdenRatioChart data={data} /> : <Alert severity="info" sx={{ m: 2 }}>No debt minimum-payment burden can be calculated until income and minimum payment amounts are recorded.</Alert>}
  </CardContent>} height={500} />;
}
