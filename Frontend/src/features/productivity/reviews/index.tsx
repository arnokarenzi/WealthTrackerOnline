import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid,
  MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivityDailyReview, ProductivityWeeklyReview } from "../../../services/productivityApi";

type Mode = "daily" | "weekly";
type DailyDraft = { moodRating: string; energyRating: string; wins: string; challenges: string; lessons: string; gratitude: string; tomorrowPriorities: string; notes: string };
type WeeklyDraft = { overallRating: string; wins: string; challenges: string; lessons: string; nextWeekPriorities: string; notes: string };

const todayInKigali = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
const shiftDate = (value: string, amount: number) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
const startOfWeek = (value: string, weekStartsOn: "monday" | "sunday") => { const date = new Date(`${value}T00:00:00.000Z`); const day = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - (weekStartsOn === "monday" ? (day + 6) % 7 : day)); return date.toISOString().slice(0, 10); };
const dateLabel = (value: string) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const emptyDaily: DailyDraft = { moodRating: "", energyRating: "", wins: "", challenges: "", lessons: "", gratitude: "", tomorrowPriorities: "", notes: "" };
const emptyWeekly: WeeklyDraft = { overallRating: "", wins: "", challenges: "", lessons: "", nextWeekPriorities: "", notes: "" };
const fromDaily = (review: ProductivityDailyReview | null): DailyDraft => review ? ({ moodRating: review.moodRating == null ? "" : String(review.moodRating), energyRating: review.energyRating == null ? "" : String(review.energyRating), wins: review.wins, challenges: review.challenges, lessons: review.lessons, gratitude: review.gratitude, tomorrowPriorities: review.tomorrowPriorities, notes: review.notes }) : { ...emptyDaily };
const fromWeekly = (review: ProductivityWeeklyReview | null): WeeklyDraft => review ? ({ overallRating: review.overallRating == null ? "" : String(review.overallRating), wins: review.wins, challenges: review.challenges, lessons: review.lessons, nextWeekPriorities: review.nextWeekPriorities, notes: review.notes }) : { ...emptyWeekly };

export default function ProductivityReviewsPage() {
  const [mode, setMode] = useState<Mode>("daily");
  const [selectedDate, setSelectedDate] = useState(todayInKigali);
  const [weekStartsOn, setWeekStartsOn] = useState<"monday" | "sunday">("monday");
  const [daily, setDaily] = useState<DailyDraft>(emptyDaily);
  const [weekly, setWeekly] = useState<WeeklyDraft>(emptyWeekly);
  const [dailySavedAt, setDailySavedAt] = useState<string | null>(null);
  const [weeklySavedAt, setWeeklySavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<ProductivityDailyReview | ProductivityWeeklyReview>>([]);
  const [snapshot, setSnapshot] = useState<{ completed: number; due: number; focusMinutes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const weekStart = useMemo(() => startOfWeek(selectedDate, weekStartsOn), [selectedDate, weekStartsOn]);
  const weekEnd = useMemo(() => shiftDate(weekStart, 6), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const settings = await productivityApi.getSettings();
      setWeekStartsOn(settings.weekStartsOn);
      if (mode === "daily") {
        const [review, day, focus, recent] = await Promise.all([
          productivityApi.getDailyReview(selectedDate), productivityApi.getMyDay(selectedDate),
          productivityApi.getFocusSummary(selectedDate), productivityApi.getDailyReviewHistory(10),
        ]);
        setDaily(fromDaily(review)); setDailySavedAt(review?.updatedAt || null); setHistory(recent);
        setSnapshot({ completed: day.totals.completed, due: day.totals.today + day.totals.overdue, focusMinutes: focus.focusMinutes });
      } else {
        const [review, insights, recent] = await Promise.all([
          productivityApi.getWeeklyReview(weekStart), productivityApi.getInsights(weekStart, weekEnd),
          productivityApi.getWeeklyReviewHistory(10),
        ]);
        setWeekly(fromWeekly(review)); setWeeklySavedAt(review?.updatedAt || null); setHistory(recent);
        setSnapshot({ completed: insights.metrics.tasksCompletedInPeriod, due: insights.metrics.dueTasks, focusMinutes: insights.metrics.focusMinutes });
      }
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "Could not load review information. Check that the productivity migrations are installed."));
      setHistory([]); setSnapshot(null);
    } finally { setLoading(false); }
  }, [mode, selectedDate, weekStart, weekEnd]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      if (mode === "daily") {
        const saved = await productivityApi.saveDailyReview({
          reviewDate: selectedDate, moodRating: daily.moodRating ? Number(daily.moodRating) : null,
          energyRating: daily.energyRating ? Number(daily.energyRating) : null, wins: daily.wins,
          challenges: daily.challenges, lessons: daily.lessons, gratitude: daily.gratitude,
          tomorrowPriorities: daily.tomorrowPriorities, notes: daily.notes,
        });
        setDailySavedAt(saved.updatedAt); setNotice("Daily review saved.");
      } else {
        const saved = await productivityApi.saveWeeklyReview({
          weekStart, overallRating: weekly.overallRating ? Number(weekly.overallRating) : null,
          wins: weekly.wins, challenges: weekly.challenges, lessons: weekly.lessons,
          nextWeekPriorities: weekly.nextWeekPriorities, notes: weekly.notes,
        });
        setWeeklySavedAt(saved.updatedAt); setNotice("Weekly review saved.");
      }
      setHistory(mode === "daily" ? await productivityApi.getDailyReviewHistory(10) : await productivityApi.getWeeklyReviewHistory(10));
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not save your review.")); }
    finally { setSaving(false); }
  };

  const dailyFields = [
    ["wins", "What went well today?"], ["challenges", "What was difficult?"], ["lessons", "What did you learn?"],
    ["gratitude", "What are you grateful for?"], ["tomorrowPriorities", "What are tomorrow's priorities?"], ["notes", "Additional notes"],
  ] as const;
  const weeklyFields = [
    ["wins", "What were your biggest wins?"], ["challenges", "What challenges did you face?"],
    ["lessons", "What did you learn this week?"], ["nextWeekPriorities", "What are your priorities for next week?"], ["notes", "Additional notes"],
  ] as const;

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}><Stack spacing={3}>
    <Box><Typography variant="h1" fontWeight={700} sx={{ mb: 0.5 }}>Daily and Weekly Reviews</Typography><Typography color="text.secondary">Reflect on what happened, capture lessons and prepare your next priorities. Saved reviews can be edited later.</Typography></Box>
    <Alert severity="info">Review records are saved in your FinTrack productivity workspace. The summary cards are pulled from saved tasks and focus sessions, not manually entered estimates.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
      <ToggleButtonGroup exclusive value={mode} onChange={(_, value: Mode | null) => { if (value) setMode(value); }} size="small"><ToggleButton value="daily">Daily review</ToggleButton><ToggleButton value="weekly">Weekly review</ToggleButton></ToggleButtonGroup>
      <TextField type="date" size="small" label={mode === "daily" ? "Review date" : "Choose a date in the review week"} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} InputLabelProps={{ shrink: true }} />
    </Stack>
    {mode === "weekly" && <Chip color="primary" variant="outlined" label={`Review week: ${dateLabel(weekStart)} – ${dateLabel(weekEnd)} (${weekStartsOn}-start week)`} sx={{ alignSelf: "flex-start" }} />}
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    {loading ? <CircularProgress size={28} /> : <>
      {snapshot && <Grid container spacing={1.5}>
        <Grid item xs={4}><Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">Tasks completed</Typography><Typography variant="h3" fontWeight={700}>{snapshot.completed}</Typography></CardContent></Card></Grid>
        <Grid item xs={4}><Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">{mode === "daily" ? "Due / planned tasks" : "Tasks with due dates"}</Typography><Typography variant="h3" fontWeight={700}>{snapshot.due}</Typography></CardContent></Card></Grid>
        <Grid item xs={4}><Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">Focus minutes</Typography><Typography variant="h3" fontWeight={700}>{snapshot.focusMinutes}</Typography></CardContent></Card></Grid>
      </Grid>}
      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={2.25}>
        {mode === "daily" ? <>
          <Box><Typography variant="h3" fontWeight={650}>Daily reflection</Typography><Typography variant="body2" color="text.secondary">{dateLabel(selectedDate)}</Typography></Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField select fullWidth size="small" label="Mood (optional)" value={daily.moodRating} onChange={(e) => setDaily((v) => ({ ...v, moodRating: e.target.value }))}><MenuItem value="">Not rated</MenuItem>{[1,2,3,4,5].map((v) => <MenuItem key={v} value={String(v)}>{v} — {v === 1 ? "Very low" : v === 5 ? "Excellent" : ""}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField select fullWidth size="small" label="Energy (optional)" value={daily.energyRating} onChange={(e) => setDaily((v) => ({ ...v, energyRating: e.target.value }))}><MenuItem value="">Not rated</MenuItem>{[1,2,3,4,5].map((v) => <MenuItem key={v} value={String(v)}>{v} — {v === 1 ? "Very low" : v === 5 ? "Excellent" : ""}</MenuItem>)}</TextField></Grid>
          </Grid>
          {dailyFields.map(([key, label]) => <TextField key={key} fullWidth multiline minRows={2} label={label} value={daily[key]} onChange={(e) => setDaily((v) => ({ ...v, [key]: e.target.value }))} />)}
          <Typography variant="caption" color="text.secondary">{dailySavedAt ? `Last saved: ${new Date(dailySavedAt).toLocaleString()}` : "This date has not been reviewed yet."}</Typography>
        </> : <>
          <Box><Typography variant="h3" fontWeight={650}>Weekly reflection</Typography><Typography variant="body2" color="text.secondary">{dateLabel(weekStart)} – {dateLabel(weekEnd)}</Typography></Box>
          <TextField select fullWidth size="small" label="Overall week rating (optional)" value={weekly.overallRating} onChange={(e) => setWeekly((v) => ({ ...v, overallRating: e.target.value }))}><MenuItem value="">Not rated</MenuItem>{[1,2,3,4,5].map((v) => <MenuItem key={v} value={String(v)}>{v} / 5</MenuItem>)}</TextField>
          {weeklyFields.map(([key, label]) => <TextField key={key} fullWidth multiline minRows={2} label={label} value={weekly[key]} onChange={(e) => setWeekly((v) => ({ ...v, [key]: e.target.value }))} />)}
          <Typography variant="caption" color="text.secondary">{weeklySavedAt ? `Last saved: ${new Date(weeklySavedAt).toLocaleString()}` : "This week has not been reviewed yet."}</Typography>
        </>}
        <Divider /><Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : mode === "daily" ? "Save daily review" : "Save weekly review"}</Button>
      </Stack></CardContent></Card>
      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={1.5}>
        <Typography variant="h3" fontWeight={650}>Recent {mode === "daily" ? "daily" : "weekly"} reviews</Typography>
        {history.length === 0 ? <Typography color="text.secondary">No saved reviews yet.</Typography> : history.map((item) => {
          const date = "reviewDate" in item ? item.reviewDate : item.weekStart;
          const rating = "moodRating" in item ? item.moodRating : item.overallRating;
          return <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
            <Box><Typography fontWeight={600}>{dateLabel(date)}</Typography><Typography variant="caption" color="text.secondary">Saved {new Date(item.updatedAt).toLocaleDateString()}</Typography></Box>
            <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={rating == null ? "Not rated" : `${rating} / 5`} /><Button size="small" onClick={() => setSelectedDate(date)}>Open</Button></Stack>
          </Stack>;
        })}
      </Stack></CardContent></Card>
    </>}
  </Stack></Box>;
}
