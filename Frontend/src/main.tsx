import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; //[cite: 7]
import {
  createHashRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom"; //[cite: 7]
import Dashboard from "./pages/Dashboard"; //[cite: 7]
import Budget from "./features/budget"; //[cite: 7]
import Expenses from "./features/expenses"; // 📑 Added import for Daily Expenses
import Bills from "./features/bills"; //[cite: 7]
import Reports from "./features/reports"; //[cite: 7]
import Debt from "./features/debt"; //[cite: 7]
import Settings from "./features/settings"; //[cite: 7]
import Investments from "./features/investments"; //[cite: 7]
import NetWorth from "./features/networth"; //[cite: 7]
import Overview from "./features/overview"; //[cite: 7]
import Error from "./pages/Error"; //[cite: 7]
import SavingsGoals from "./features/savings/SavingsGoals";

const router = createHashRouter(
  createRoutesFromElements(
    <Route path="/" element={<Dashboard />} errorElement={<Error />}>
      {" "}
      {/*[cite: 7] */}
      <Route path="/" element={<Overview />} /> {/*[cite: 7] */}
      <Route path="/budget" element={<Budget />} /> {/*[cite: 7] */}
      <Route path="/expenses" element={<Expenses />} />{" "}
      {/* 💸 Added route path */}
      <Route path="/bills" element={<Bills />} /> {/*[cite: 7] */}
      <Route path="/reports" element={<Reports />} /> {/*[cite: 7] */}
      <Route path="/debt" element={<Debt />} /> {/*[cite: 7] */}
      <Route path="/investments" element={<Investments />} /> {/*[cite: 7] */}
      <Route path="/savings" element={<SavingsGoals />} />
      <Route path="/networth" element={<NetWorth />} /> {/*[cite: 7] */}
      <Route path="/settings" element={<Settings />} /> {/*[cite: 7] */}
    </Route>,
  ),
); //[cite: 7]

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
); //[cite: 7]
