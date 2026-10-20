import { Alert, CardContent } from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import Item from "../../../components/Item";
import { BudgetComparisonChart } from "./BudgetComparisonChart";

export default function BudgetComparison({ data }: { data: Array<{ category: string; budget: number; actual: number }> }) {
  return <Item title="Budget Comparison" content={
    <CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
      {data.length ? <BudgetComparisonChart data={data as BarDatum[]} /> : <Alert severity="info" sx={{ m: 2 }}>No saved budget exists for the current Kigali calendar month. This report will not fill the comparison with example values.</Alert>}
    </CardContent>
  } height={500} />;
}
