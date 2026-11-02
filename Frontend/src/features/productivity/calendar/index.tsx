import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format,
  startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowBackIosNewOutlinedIcon from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type {
  CalendarEventInput, ProductivityCalendarEvent, ProductivityTask,
} from "../../../services/productivityApi";
import { getKigaliDateInputValue, formatKigaliDate } from "../../../utils/kigaliTime";

type CalendarView = "day" | "week" | "month";
type EventDraft = {
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  color: string;
};
type CalendarItem = {
  key: string;
  title: string;
  time: string | null;
  kind: "event" | "task";
  label: string;
  color: string;
  completed?: boolean;
  isAllDay?: boolean;
  event?: ProductivityCalendarEvent;
};

const localDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};
const dateValue = (value: Date) => format(value, "yyyy-MM-dd");
const blankDraft = (eventDate: string): EventDraft => ({
  title: "", description: "", eventDate, startTime: "", endTime: "", isAllDay: true, color: "#1976d2",
});
const toDraft = (event: ProductivityCalendarEvent): EventDraft => ({
  title: event.title, description: event.description, eventDate: event.eventDate,
  startTime: event.startTime?.slice(0, 5) || "", endTime: event.endTime?.slice(0, 5) || "",
  isAllDay: event.isAllDay, color: event.color,
});

export default function ProductivityCalendarPage() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => localDate(getKigaliDateInputValue()));
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1);
  const calendarDefaultsLoaded = useRef(false);
  const [events, setEvents] = useState<ProductivityCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<ProductivityTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ProductivityCalendarEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(blankDraft(getKigaliDateInputValue()));

  const range = useMemo(() => {
    if (view === "day") return { start: anchorDate, end: anchorDate };
    if (view === "week") {
      const start = startOfWeek(anchorDate, { weekStartsOn });
      return { start, end: addDays(start, 6) };
    }
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn });
    const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn });
    return { start, end };
  }, [anchorDate, view, weekStartsOn]);

  const dates = useMemo(() => {
    const output: Date[] = [];
    for (let current = range.start; current <= range.end; current = addDays(current, 1)) output.push(current);
    return output;
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [calendar, settings] = await Promise.all([
        productivityApi.getCalendar(dateValue(range.start), dateValue(range.end)),
        productivityApi.getSettings(),
      ]);
      setEvents(calendar.events);
      setTasks(calendar.tasks);
      if (!calendarDefaultsLoaded.current) {
        setWeekStartsOn(settings.weekStartsOn === "sunday" ? 0 : 1);
        setView(settings.defaultCalendarView);
        calendarDefaultsLoaded.current = true;
      }
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not load the calendar. Confirm that the Phase 1, 2 and 3 productivity migrations have been applied."));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const movePeriod = (direction: -1 | 1) => {
    if (view === "day") setAnchorDate((current) => addDays(current, direction));
    else if (view === "week") setAnchorDate((current) => (direction < 0 ? subWeeks(current, 1) : addWeeks(current, 1)));
    else setAnchorDate((current) => (direction < 0 ? subMonths(current, 1) : addMonths(current, 1)));
  };

  const openCreate = (eventDate: string) => {
    setEditingEvent(null);
    setDraft(blankDraft(eventDate));
    setDialogOpen(true);
  };

  const openEdit = (event: ProductivityCalendarEvent) => {
    setEditingEvent(event);
    setDraft(toDraft(event));
    setDialogOpen(true);
  };

  const updateDraft = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveEvent = async () => {
    if (!draft.title.trim() || !draft.eventDate) {
      setError("Enter an event title and date.");
      return;
    }
    const payload: CalendarEventInput = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      eventDate: draft.eventDate,
      startTime: draft.isAllDay ? null : draft.startTime || null,
      endTime: draft.isAllDay ? null : draft.endTime || null,
      isAllDay: draft.isAllDay,
      color: draft.color,
    };
    setSaving(true);
    setError("");
    try {
      if (editingEvent) await productivityApi.updateCalendarEvent(editingEvent.id, payload);
      else await productivityApi.createCalendarEvent(payload);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not save the calendar event."));
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!editingEvent) return;
    if (!window.confirm(`Delete “${editingEvent.title}” from your calendar?`)) return;
    setSaving(true);
    try {
      await productivityApi.deleteCalendarEvent(editingEvent.id);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not delete the calendar event."));
    } finally {
      setSaving(false);
    }
  };

  const itemsForDate = (date: string): CalendarItem[] => {
    const items: CalendarItem[] = events
      .filter((event) => event.eventDate === date)
      .map((event) => ({
        key: `event-${event.id}`, title: event.title,
        time: event.isAllDay ? null : event.startTime?.slice(0, 5) || null,
        kind: "event", label: event.isAllDay ? "All-day event" : "Appointment",
        isAllDay: event.isAllDay, color: event.color, event,
      }));

    tasks.forEach((task) => {
      const isScheduled = task.scheduledDate === date;
      const isDue = task.dueDate === date;
      if (!isScheduled && !isDue) return;
      const label = isScheduled && isDue ? "Planned · Due" : isScheduled ? "Planned task" : "Deadline";
      items.push({
        key: `task-${task.id}-${date}`,
        title: task.title,
        time: isScheduled ? task.scheduledStartTime?.slice(0, 5) || null : task.dueTime?.slice(0, 5) || null,
        kind: "task", label, color: task.status === "completed" ? "#2e7d32" : "#64748b",
        completed: task.status === "completed",
      });
    });

    return items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title));
  };

  const headerLabel = view === "day"
    ? format(anchorDate, "EEEE, d MMMM yyyy")
    : view === "week"
      ? `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`
      : format(anchorDate, "MMMM yyyy");

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={2}>
          <Box>
            <Typography variant="h1" fontWeight={700}>Calendar</Typography>
            <Typography color="text.secondary">Plan appointments, scheduled tasks and deadlines in one view.</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => openCreate(dateValue(anchorDate))}>Add event</Button>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton aria-label="Previous period" onClick={() => movePeriod(-1)}><ArrowBackIosNewOutlinedIcon fontSize="small" /></IconButton>
                <IconButton aria-label="Next period" onClick={() => movePeriod(1)}><ArrowForwardIosOutlinedIcon fontSize="small" /></IconButton>
                <Button size="small" startIcon={<TodayOutlinedIcon />} onClick={() => setAnchorDate(localDate(getKigaliDateInputValue()))}>Today</Button>
                <Typography variant="h5" fontWeight={700} sx={{ ml: 1 }}>{headerLabel}</Typography>
              </Stack>
              <ToggleButtonGroup exclusive size="small" value={view} onChange={(_event, value: CalendarView | null) => { if (value) setView(value); }}>
                <ToggleButton value="day">Day</ToggleButton>
                <ToggleButton value="week">Week</ToggleButton>
                <ToggleButton value="month">Month</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ overflowX: "auto", pb: 1 }}>
          {loading ? <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box> : <Box sx={{ minWidth: view === "day" ? 300 : 840 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${view === "day" ? 1 : 7}, minmax(0, 1fr))`, gap: 0.75, mb: 0.75 }}>
              {dates.map((date) => {
                const dateKey = dateValue(date);
                const dayItems = itemsForDate(dateKey);
                const isCurrentMonth = date.getMonth() === anchorDate.getMonth();
                const isToday = dateKey === getKigaliDateInputValue();
                return <Card key={dateKey} variant="outlined" sx={{ minHeight: view === "month" ? 148 : 280, borderRadius: 2, borderColor: isToday ? "primary.main" : "divider", bgcolor: view === "month" && !isCurrentMonth ? "action.hover" : "background.paper" }}>
                  <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">{format(date, "EEE")}</Typography>
                        <Typography variant="subtitle1" fontWeight={750} color={isToday ? "primary.main" : "text.primary"}>{format(date, "d")}</Typography>
                      </Box>
                      <IconButton size="small" aria-label={`Add event on ${formatKigaliDate(dateKey)}`} onClick={() => openCreate(dateKey)}><AddOutlinedIcon fontSize="small" /></IconButton>
                    </Stack>
                    <Stack spacing={0.6}>
                      {dayItems.map((item) => item.kind === "event" && item.event ? (
                        <Button key={item.key} size="small" variant="text" onClick={() => openEdit(item.event!)} sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none", minWidth: 0, px: 0.75, py: 0.4, borderLeft: `3px solid ${item.color}`, borderRadius: 0.75, bgcolor: "action.hover", color: "text.primary", overflowWrap: "anywhere", lineHeight: 1.25 }}>
                          <Box component="span" sx={{ display: "block", width: "100%", minWidth: 0 }}>
                            <Typography component="span" variant="caption" color="text.secondary">{item.time ? `${item.time} · ` : item.isAllDay ? "All day · " : "No time · "}</Typography>
                            <Typography component="span" variant="caption" fontWeight={650}>{item.title}</Typography>
                          </Box>
                        </Button>
                      ) : (
                        <Button key={item.key} component={RouterLink} to={`/productivity/tasks?search=${encodeURIComponent(item.title)}`} size="small" variant="text" sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none", minWidth: 0, px: 0.75, py: 0.4, borderLeft: `3px solid ${item.color}`, borderRadius: 0.75, bgcolor: "action.hover", color: "text.primary", overflowWrap: "anywhere", lineHeight: 1.25 }}>
                          <Box component="span" sx={{ display: "block", width: "100%", minWidth: 0 }}>
                            <Typography component="span" variant="caption" color="text.secondary">{item.time ? `${item.time} · ` : ""}{item.label} · </Typography>
                            <Typography component="span" variant="caption" fontWeight={650} sx={{ textDecoration: item.completed ? "line-through" : "none" }}>{item.title}</Typography>
                          </Box>
                        </Button>
                      ))}
                      {dayItems.length === 0 && <Typography variant="caption" color="text.disabled">No items</Typography>}
                    </Stack>
                  </CardContent>
                </Card>;
              })}
            </Box>
          </Box>}
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label="Calendar events" sx={{ borderLeft: "4px solid #1976d2" }} />
          <Chip size="small" variant="outlined" label="Scheduled tasks" sx={{ borderLeft: "4px solid #64748b" }} />
          <Chip size="small" variant="outlined" label="Deadlines" />
        </Stack>
      </Stack>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingEvent ? "Edit calendar event" : "Add calendar event"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus required fullWidth label="Event title" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} inputProps={{ maxLength: 200 }} />
            <TextField fullWidth multiline minRows={2} label="Description" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
            <TextField fullWidth type="date" label="Date" value={draft.eventDate} onChange={(event) => updateDraft("eventDate", event.target.value)} InputLabelProps={{ shrink: true }} />
            <FormControlLabel control={<Checkbox checked={draft.isAllDay} onChange={(event) => updateDraft("isAllDay", event.target.checked)} />} label="All-day event" />
            {!draft.isAllDay && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth type="time" label="Start time" value={draft.startTime} onChange={(event) => updateDraft("startTime", event.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField fullWidth type="time" label="End time" value={draft.endTime} onChange={(event) => updateDraft("endTime", event.target.value)} InputLabelProps={{ shrink: true }} />
            </Stack>}
            <TextField fullWidth type="color" label="Event color" value={draft.color} onChange={(event) => updateDraft("color", event.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          {editingEvent ? <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => void deleteEvent()} disabled={saving}>Delete</Button> : <Box />}
          <Stack direction="row" spacing={1}><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void saveEvent()} disabled={saving}>{saving ? "Saving…" : "Save event"}</Button></Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
