import { Alert, CardContent } from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import Item from "../../../components/Item";
import { DebtToIncomeRatioChart } from "./DebtToIncomeRatioChart";

export default function DebtToIncomeRatio({ data }: { data: BarDatum[] }) {
  return <Item title="Debt-to-Income Ratio" content={<CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
    {data.length ? <DebtToIncomeRatioChart data={data} /> : <Alert severity="info" sx={{ m: 2 }}>A ratio is unavailable because there is no income recorded in WalletIncome for the current Kigali month.</Alert>}
  </CardContent>} height={500} />;
}
