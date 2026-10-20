import { Alert, CardContent } from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import Item from "../../../components/Item";
import { AssetsVsLiabilitiesChart } from "./AssetsVsLiabilitiesChart";

export default function AssetsVsLiabilities({ data, hasValues }: { data: BarDatum[]; hasValues: boolean }) {
  return <Item title="Assets vs Liabilities" content={<CardContent style={{ height: "400px", padding: 0 }} className="Mui-Chart">
    {hasValues ? <AssetsVsLiabilitiesChart data={data} /> : <Alert severity="info" sx={{ m: 2 }}>No non-zero asset or liability values are currently saved.</Alert>}
  </CardContent>} height={500} />;
}
