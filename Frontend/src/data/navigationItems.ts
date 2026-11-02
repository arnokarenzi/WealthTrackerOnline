export interface NavigationItem {
  label: string;
  path: string;
  description: string;
  keywords: string[];
}

/** Static page navigation, supplemented by backend-backed financial record search. */
export const navigationItems: NavigationItem[] = [
  { label: "Overview", path: "/", description: "Dashboard, wallet, shift progress and financial health", keywords: ["home", "dashboard", "wallet", "shift", "health", "letters"] },
  { label: "Action Center", path: "/actions", description: "Review upcoming and overdue bills and debt actions", keywords: ["reminders", "tasks", "overdue", "due soon", "alerts"] },
  { label: "Budget", path: "/budget", description: "Plan income, allocations and spending limits", keywords: ["plan", "income", "salary", "allocation", "limits"] },
  { label: "Expenses", path: "/expenses", description: "Record expenses and review expense history", keywords: ["spending", "transactions", "history", "cost"] },
  { label: "Bills", path: "/bills", description: "Track bills and payment status", keywords: ["payments", "utilities", "due"] },
  { label: "Reports", path: "/reports", description: "Review financial summaries and trends", keywords: ["charts", "analytics", "summary"] },
  { label: "Debt", path: "/debt", description: "Review the debt section", keywords: ["loan", "loans", "borrowing", "interest"] },
  { label: "Investments", path: "/investments", description: "Review investments and reserves", keywords: ["assets", "portfolio", "reserve", "emergency"] },
  { label: "Allocations", path: "/allocations", description: "Set allocation percentages and recommendations", keywords: ["emergency", "essentials", "savings", "investment"] },
  { label: "Savings Goals", path: "/savings", description: "Set and track savings targets", keywords: ["goals", "target", "saving"] },
  { label: "Net Worth", path: "/networth", description: "Review the net-worth view", keywords: ["assets", "wealth", "liabilities"] },
  { label: "Productivity Home", path: "/productivity", description: "Plan tasks, habits, focus and personal goals", keywords: ["productivity", "tasks", "planner", "habits", "focus", "goals", "calendar"] },
  { label: "My Day", path: "/productivity/my-day", description: "See overdue tasks, today’s plan and completed work", keywords: ["today", "daily plan", "overdue", "tasks"] },
  { label: "Tasks", path: "/productivity/tasks", description: "Create, organize and prioritize personal tasks", keywords: ["todo", "checklist", "priority", "projects"] },
  { label: "Projects", path: "/productivity/projects", description: "Group tasks and track project progress", keywords: ["work", "planning", "milestones"] },
  { label: "Calendar", path: "/productivity/calendar", description: "Plan appointments, scheduled tasks and deadlines", keywords: ["planner", "schedule", "week", "month", "events"] },
  { label: "Eisenhower Matrix", path: "/productivity/eisenhower", description: "Prioritize tasks by urgency and importance", keywords: ["urgent", "important", "quadrants", "priorities"] },
  { label: "Habits", path: "/productivity/habits", description: "Track routines, streaks and daily completion", keywords: ["routine", "streak", "daily", "habit tracker"] },
  { label: "Focus Timer", path: "/productivity/focus", description: "Run Pomodoro sessions and review focus time", keywords: ["pomodoro", "timer", "concentration", "focus"] },
  { label: "Personal Goals", path: "/productivity/goals", description: "Set personal goals, milestones and track progress", keywords: ["objectives", "milestones", "targets", "progress"] },
  { label: "Notes", path: "/productivity/notes", description: "Capture ideas and organize personal notes", keywords: ["quick capture", "ideas", "journal", "memo"] },
  { label: "Countdowns", path: "/productivity/countdowns", description: "Track birthdays, trips, holidays and important dates", keywords: ["events", "days remaining", "anniversary", "birthday"] },
  { label: "Daily and Weekly Reviews", path: "/productivity/reviews", description: "Reflect on progress, lessons and priorities", keywords: ["reflection", "journal", "weekly review", "daily review"] },
  { label: "Productivity Insights", path: "/productivity/insights", description: "Measure task, habit, focus, project and goal activity", keywords: ["analytics", "performance", "statistics", "trends"] },
  { label: "Settings", path: "/settings", description: "Open profile and preference settings", keywords: ["profile", "preferences", "account", "password"] },
];
