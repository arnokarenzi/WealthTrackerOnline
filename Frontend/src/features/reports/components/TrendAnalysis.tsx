import { Alert, CardContent } from "@mui/material";
import Item from "../../../components/Item";
import { TrendAnalysisChart } from "./TrendAnalysisChart";

interface Series { id: string; data: { x: string; y: number }[] }
export default function TrendAnalysis({ data }: { data: Series[] }) {
  return <Item title="Trend Analysis" content={
    <CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
      {data.length ? <TrendAnalysisChart data={data} /> : <Alert severity="info" sx={{ m: 2 }}>No saved expense records exist in this period.</Alert>}
    </CardContent>
  } height={500} />;
}
