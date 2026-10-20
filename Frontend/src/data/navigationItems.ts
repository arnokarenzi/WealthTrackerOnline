export interface NavigationItem {
  label: string;
  path: string;
  description: string;
  keywords: string[];
}

/** Searchable app pages only; this intentionally does not claim to search transactions. */
export const navigationItems: NavigationItem[] = [
  { label: "Overview", path: "/", description: "Dashboard, wallet, shift progress and financial health", keywords: ["home", "dashboard", "wallet", "shift", "health", "letters"] },
  { label: "Budget", path: "/budget", description: "Plan income, allocations and spending limits", keywords: ["plan", "income", "salary", "allocation", "limits"] },
  { label: "Expenses", path: "/expenses", description: "Record expenses and review expense history", keywords: ["spending", "transactions", "history", "cost"] },
  { label: "Bills", path: "/bills", description: "Track bills and payment status", keywords: ["payments", "utilities", "due"] },
  { label: "Reports", path: "/reports", description: "Review financial summaries and trends", keywords: ["charts", "analytics", "summary"] },
  { label: "Debt", path: "/debt", description: "Review the debt section", keywords: ["loan", "loans", "borrowing", "interest"] },
  { label: "Investments", path: "/investments", description: "Review investments and reserves", keywords: ["assets", "portfolio", "reserve", "emergency"] },
  { label: "Allocations", path: "/allocations", description: "Set allocation percentages and recommendations", keywords: ["emergency", "essentials", "savings", "investment"] },
  { label: "Savings Goals", path: "/savings", description: "Set and track savings targets", keywords: ["goals", "target", "saving"] },
  { label: "Net Worth", path: "/networth", description: "Review the net-worth view", keywords: ["assets", "wealth", "liabilities"] },
  { label: "Settings", path: "/settings", description: "Open profile and preference settings", keywords: ["profile", "preferences", "account", "password"] },
];
