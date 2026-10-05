import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import {
  createHashRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Budget from "./features/budget";
import Expenses from "./features/expenses";
import Bills from "./features/bills";
import Reports from "./features/reports";
import Debt from "./features/debt";
import Settings from "./features/settings";
import Investments from "./features/investments";
import NetWorth from "./features/networth";
import Overview from "./features/overview";
import Error from "./pages/Error";
import SavingsGoals from "./features/savings/SavingsGoals";
import AllocationsPage from "./features/allocations";

// Register the service worker early so the Home Screen app can receive
// standards-based Web Push notifications. Permission is requested later
// from an explicit user tap, as required by iOS Home Screen web apps.
if ("serviceWorker" in navigator) {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const serviceWorkerUrl = new URL("sw.js", baseUrl);
  navigator.serviceWorker
    .register(serviceWorkerUrl.href, {
      scope: baseUrl.pathname.endsWith("/")
        ? baseUrl.pathname
        : `${baseUrl.pathname}/`,
    })
    .catch((error) => console.error("Service worker registration failed:", error));
}

const router = createHashRouter(
  createRoutesFromElements(
    <Route path="/" element={<Dashboard />} errorElement={<Error />}>
      <Route path="/" element={<Overview />} />
      <Route path="/budget" element={<Budget />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/bills" element={<Bills />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/debt" element={<Debt />} />
      <Route path="/investments" element={<Investments />} />
      <Route path="/allocations" element={<AllocationsPage />} />
      <Route path="/savings" element={<SavingsGoals />} />
      <Route path="/networth" element={<NetWorth />} />
      <Route path="/settings" element={<Settings />} />
    </Route>,
  ),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
