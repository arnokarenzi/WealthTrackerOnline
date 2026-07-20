import { CardContent } from "@mui/material";
import Item from "../../../components/Item";
import { BudgetAllocationChart } from "./BudgetAllocationChart";
import { MonthlyBudget } from "../../../types/api";

export default function BudgetAllocation({
  budget,
}: {
  budget: MonthlyBudget;
}) {
  // 🚀 Added nullish coalescing (?? 0) to defend against strict 'possibly undefined' flags
  const rentBase = Number(budget.rent ?? 0);
  const foodBase = Number(budget.food ?? 0);
  const electricityWaterBase = Number(budget.electricityWater ?? 0);
  const phoneInternetBase = Number(budget.phoneInternet ?? 0);
  const medicalBase = Number(budget.medical ?? 0);
  const familySupportBase = Number(budget.familySupport ?? 0);
  const miscellaneousBase = Number(budget.miscellaneous ?? 0);

  const totalOutlays =
    rentBase +
      foodBase +
      electricityWaterBase +
      phoneInternetBase +
      medicalBase +
      familySupportBase +
      miscellaneousBase || 1;

  const realChartData = [
    {
      id: "Rent",
      label: "Rent Base",
      value: Math.round((rentBase / totalOutlays) * 100),
      color: "hsl(210, 70%, 50%)",
    },
    {
      id: "Food",
      label: "Provisions",
      value: Math.round((foodBase / totalOutlays) * 100),
      color: "hsl(145, 70%, 45%)",
    },
    {
      id: "Utilities",
      label: "Utilities & Network",
      value: Math.round(
        ((electricityWaterBase + phoneInternetBase) / totalOutlays) * 100,
      ),
      color: "hsl(45, 75%, 50%)",
    },
    {
      id: "Medical",
      label: "Medical Care",
      value: Math.round((medicalBase / totalOutlays) * 100),
      color: "hsl(0, 75%, 50%)",
    },
    {
      id: "Family",
      label: "Direct Support",
      value: Math.round((familySupportBase / totalOutlays) * 100),
      color: "hsl(285, 70%, 50%)",
    },
    {
      id: "Misc",
      label: "Contingencies",
      value: Math.round((miscellaneousBase / totalOutlays) * 100),
      color: "hsl(200, 15%, 60%)",
    },
  ].filter((item) => item.value > 0);

  return (
    <Item
      title="Budget Allocation"
      content={
        <CardContent style={{ height: "400px", padding: 0 }}>
          <BudgetAllocationChart data={realChartData} />
        </CardContent>
      }
      height={500}
    />
  );
}
