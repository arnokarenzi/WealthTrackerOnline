import { Alert, CardContent } from "@mui/material";
import Item from "../../../components/Item";
import { FinancialOverviewChart } from "./FinancialOverviewChart";

interface Series { id: string; data: { x: string; y: number }[] }
export default function FinancialOverview({ data }: { data: Series[] }) {
  const hasRecords = data.some((series) => series.data.some((point) => point.y !== 0));
  return <Item title="Financial Overview" content={
    <CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
      {data.length && hasRecords ? <FinancialOverviewChart data={data} /> : <Alert severity="info" sx={{ m: 2 }}>No recorded income or expense records are available for this period.</Alert>}
    </CardContent>
  } height={500} />;
}
