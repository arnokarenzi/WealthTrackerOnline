import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemButton,
  Menu,
  Typography,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import { useNavigate } from "react-router-dom";
import { financeApi } from "../services/api";
import { tokens } from "../assets/theme";
import { useTheme } from "@mui/material/styles";

type AlertLevel = "critical" | "warning" | "info" | "success";

interface LiveNotification {
  id: string;
  title: string;
  message: string;
  level: AlertLevel;
  route: string;
}

const READ_KEY = "fintrack-read-live-notifications-v1";

function readIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function localDateKey(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function Notifications() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [items, setItems] = useState<LiveNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        financeApi.getDailyLetterStatus(),
        financeApi.getBudgetAlerts(),
      ]);
      const nextItems: LiveNotification[] = [];
      const [dailyResult, budgetResult] = results;

      if (dailyResult.status === "fulfilled") {
        const daily = dailyResult.value;
        const date = localDateKey(daily.date);
        nextItems.push({
          id: `daily-progress-${date}-${daily.dailyTarget <= 0 ? "not-set" : daily.targetReached ? "complete" : "in-progress"}`,
          title: daily.dailyTarget <= 0 ? "Daily target not set" : daily.targetReached ? "Daily letter target reached" : "Daily letter progress",
          message: daily.dailyTarget <= 0
            ? "No active daily letter target is currently configured. Check your shift setup on Overview."
            : daily.targetReached
              ? `You have completed ${daily.dailyLetterCount} of ${daily.dailyTarget} letters for today.`
              : `${daily.dailyLetterCount} of ${daily.dailyTarget} letters completed; ${daily.dailyRemaining} remaining today. Current shift pace: ${daily.currentRequiredPerDay} letters/day.`,
          level: daily.dailyTarget <= 0 ? "info" : daily.targetReached ? "success" : "info",
          route: "/",
        });
      }

      if (budgetResult.status === "fulfilled") {
        const response = budgetResult.value;
        const monthKey = localDateKey(dailyResult.status === "fulfilled" ? dailyResult.value.date : undefined).slice(0, 7);
        response.alerts.forEach((alert, index) => {
          const stableDescription = alert.message.split("(")[0].replace(/\d+%/g, "percent").trim();
          nextItems.push({
            id: `${monthKey}-budget-${alert.level}-${stableDescription.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
            title: alert.level === "critical" ? "Budget alert" : "Spending warning",
            message: alert.message,
            level: alert.level,
            route: "/expenses",
          });
        });
        if (response.recommended > 0 && response.alerts.length === 0) {
          nextItems.push({
            id: `${monthKey}-budget-on-track`,
            title: "Essentials spending",
            message: `No budget warning is currently reported. Logged essentials: ${Math.round(response.essentialsSpent).toLocaleString()} of ${Math.round(response.recommended).toLocaleString()} planned.`,
            level: "success",
            route: "/expenses",
          });
        }
      }

      if (dailyResult.status === "rejected" && budgetResult.status === "rejected") {
        throw new Error("FinTrack could not load daily-letter status or budget alerts.");
      }
      setItems(nextItems);
      setLoaded(true);
      setReadNotificationIds(readIds());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (anchorEl && !loaded) void refresh();
  }, [anchorEl, loaded, refresh]);

  const unreadCount = useMemo(
    () => items.filter((item) => !readNotificationIds.includes(item.id)).length,
    [items, readNotificationIds],
  );

  const markRead = (id: string) => {
    const next = [...new Set([...readNotificationIds, id])];
    setReadNotificationIds(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-300))); } catch { /* session still works */ }
  };

  const markAllRead = () => {
    const next = [...new Set([...readNotificationIds, ...items.map((item) => item.id)])];
    setReadNotificationIds(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-300))); } catch { /* session still works */ }
  };

  const openItem = (item: LiveNotification) => {
    markRead(item.id);
    setAnchorEl(null);
    navigate(item.route);
  };

  const levelColor = (level: AlertLevel): "error" | "warning" | "info" | "success" => {
    if (level === "critical") return "error";
    if (level === "warning") return "warning";
    if (level === "success") return "success";
    return "info";
  };

  return (
    <Box>
      <Tooltip title="Live app notifications">
        <IconButton
          size="large"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 390 }, maxWidth: 390, maxHeight: "75vh", backgroundColor: colors.primary[400] } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 1.5, pb: 1 }}>
          <Box>
            <Typography variant="h6">Notifications</Typography>
            <Typography variant="caption" color="text.secondary">Live daily-letter progress and budget alerts</Typography>
          </Box>
          <Button size="small" onClick={markAllRead} disabled={!unreadCount}>Mark all read</Button>
        </Box>
        <Divider />
        {loading && <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={24} /></Box>}
        {error && (
          <Box sx={{ p: 2, display: "grid", gap: 1 }}>
            <Alert severity="error">{error}</Alert>
            <Button size="small" onClick={() => void refresh()}>Retry</Button>
          </Box>
        )}
        {!loading && !error && items.length === 0 && (
          <Box sx={{ p: 2 }}><Typography variant="body2">No current alerts. Refresh to check again.</Typography></Box>
        )}
        {!loading && !error && items.map((item) => {
          const isRead = readNotificationIds.includes(item.id);
          return (
            <Box key={item.id}>
              <ListItemButton onClick={() => openItem(item)} sx={{ alignItems: "flex-start", gap: 1.25, py: 1.25, opacity: isRead ? 0.78 : 1 }}>
                <Box sx={{ pt: 0.5, width: 10, flexShrink: 0 }}>
                  {!isRead && <Badge color="error" variant="dot" />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: isRead ? 500 : 700 }}>{item.title}</Typography>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere", mt: 0.25 }}>{item.message}</Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Alert severity={levelColor(item.level)} icon={false} sx={{ display: "inline-flex", py: 0, px: 1, "& .MuiAlert-message": { p: 0, fontSize: "0.72rem" } }}>
                      {item.level === "critical" ? "Needs attention" : item.level === "warning" ? "Warning" : item.level === "success" ? "Good progress" : "Daily update"}
                    </Alert>
                  </Box>
                </Box>
              </ListItemButton>
              <Divider />
            </Box>
          );
        })}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", p: 1.25 }}>
          <Button size="small" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
          <Button size="small" onClick={() => { setAnchorEl(null); navigate("/"); }}>Overview</Button>
        </Box>
      </Menu>
    </Box>
  );
}
