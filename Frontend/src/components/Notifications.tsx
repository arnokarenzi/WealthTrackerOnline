import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Box, Button, CircularProgress, Divider, IconButton, ListItemButton, Menu, Tooltip, Typography,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { financeApi } from "../services/api";
import type { AppNotificationRecord, NotificationLevel } from "../types/api";
import { tokens } from "../assets/theme";

const levelColor = (level: NotificationLevel): "error" | "warning" | "info" | "success" => {
  if (level === "critical") return "error";
  if (level === "warning") return "warning";
  if (level === "success") return "success";
  return "info";
};

export default function Notifications() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [items, setItems] = useState<AppNotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await financeApi.getNotifications()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load notifications from the server."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (anchorEl) void refresh(); }, [anchorEl, refresh]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const markRead = async (item: AppNotificationRecord) => {
    if (item.isRead) { setAnchorEl(null); navigate(item.route || "/"); return; }
    setUpdating(true); setActionError("");
    try {
      await financeApi.markNotificationRead(item.id);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, isRead: true } : row));
      setAnchorEl(null); navigate(item.route || "/");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not mark the notification as read.");
    } finally { setUpdating(false); }
  };

  const markAllRead = async () => {
    setUpdating(true); setActionError("");
    try {
      await financeApi.markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not mark notifications as read.");
    } finally { setUpdating(false); }
  };

  return (
    <Box>
      <Tooltip title="In-app notifications saved on the server">
        <IconButton size="large" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={(event) => setAnchorEl(event.currentTarget)}>
          <Badge badgeContent={unreadCount} color="error" max={99}><NotificationsOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} /></Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 390 }, maxWidth: 390, maxHeight: "75vh", backgroundColor: colors.primary[400] } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 1.5, pb: 1 }}>
          <Box><Typography variant="h6">Notifications</Typography><Typography variant="caption" color="text.secondary">Persisted in-app alerts · distinct from push delivery</Typography></Box>
          <Button size="small" onClick={() => void markAllRead()} disabled={!unreadCount || loading || updating}>Mark all read</Button>
        </Box>
        <Divider />
        {loading && <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={24} /></Box>}
        {error && <Box sx={{ p: 2, display: "grid", gap: 1 }}><Alert severity="error">{error}</Alert><Button size="small" onClick={() => void refresh()}>Retry</Button></Box>}
        {actionError && <Box sx={{ p: 2 }}><Alert severity="error" onClose={() => setActionError("")}>{actionError}</Alert></Box>}
        {!loading && !error && items.length === 0 && <Box sx={{ p: 2 }}><Typography variant="body2">No persisted notifications are currently available.</Typography></Box>}
        {!loading && !error && items.map((item) => (
          <Box key={item.id}>
            <ListItemButton disabled={updating} onClick={() => void markRead(item)} sx={{ alignItems: "flex-start", gap: 1.25, py: 1.25, opacity: item.isRead ? 0.78 : 1 }}>
              <Box sx={{ pt: 0.5, width: 10, flexShrink: 0 }}>{!item.isRead && <Badge color="error" variant="dot" />}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: item.isRead ? 500 : 700 }}>{item.title}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: "anywhere", mt: 0.25 }}>{item.message}</Typography>
                <Box sx={{ mt: 0.75 }}><Alert severity={levelColor(item.level)} icon={false} sx={{ display: "inline-flex", py: 0, px: 1, "& .MuiAlert-message": { p: 0, fontSize: "0.72rem" } }}>{item.level === "critical" ? "Needs attention" : item.level === "warning" ? "Warning" : item.level === "success" ? "Good progress" : "Information"}</Alert></Box>
                <Typography variant="caption" color="text.secondary">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</Typography>
              </Box>
            </ListItemButton>
            <Divider />
          </Box>
        ))}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", p: 1.25 }}>
          <Button size="small" onClick={() => void refresh()} disabled={loading || updating}>Refresh</Button>
          <Button size="small" onClick={() => { setAnchorEl(null); navigate("/"); }}>Overview</Button>
        </Box>
      </Menu>
    </Box>
  );
}
