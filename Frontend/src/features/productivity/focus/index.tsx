import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, FormControl, Grid,
  InputLabel, LinearProgress, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import PauseOutlinedIcon from "@mui/icons-material/PauseOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type {
  ProductivityFocusSession, ProductivityFocusSummary, ProductivitySettings, ProductivityTask,
} from "../../../services/productivityApi";

type SessionType = "focus" | "short_break" | "long_break";
const getKigaliDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
};
const sessionLabels: Record<SessionType, string> = {
  focus: "Focus", short_break: "Short break", long_break: "Long break",
};

export default function ProductivityFocusPage() {
  const today = getKigaliDate();
  const [settings, setSettings] = useState<ProductivitySettings | null>(null);
  const [tasks, setTasks] = useState<ProductivityTask[]>([]);
  const [summary, setSummary] = useState<ProductivityFocusSummary | null>(null);
  const [sessions, setSessions] = useState<ProductivityFocusSession[]>([]);
  const [mode, setMode] = useState<SessionType>("focus");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const finishedRef = useRef(false);

  const reloadData = useCallback(async () => {
    const [savedSettings, openTasks, daySummary, recentSessions] = await Promise.all([
      productivityApi.getSettings(),
      productivityApi.getTasks(),
      productivityApi.getFocusSummary(today),
      productivityApi.getFocusSessions(undefined, undefined, 30),
    ]);
    setSettings(savedSettings);
    setTasks(openTasks);
    setSummary(daySummary);
    setSessions(recentSessions);
  }, [today]);

  useEffect(() => {
    let active = true;
    reloadData()
      .catch((requestError) => { if (active) setError(productivityErrorMessage(requestError, "Could not load focus timer data.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadData]);

  const durationForMode = useCallback((nextMode: SessionType, saved = settings) => {
    if (nextMode === "focus") return saved?.defaultFocusMinutes || 25;
    if (nextMode === "short_break") return saved?.shortBreakMinutes || 5;
    return saved?.longBreakMinutes || 15;
  }, [settings]);

  const saveSession = useCallback(async (status: "completed" | "cancelled", actualSeconds: number) => {
    if (!startedAt) return;
    setSaving(true);
    setError("");
    try {
      const endedAt = new Date().toISOString();
      const saved = await productivityApi.createFocusSession({
        sessionType: mode,
        status,
        taskId: mode === "focus" && selectedTaskId !== "" ? selectedTaskId : null,
        plannedMinutes: durationMinutes,
        actualSeconds: Math.max(0, Math.round(actualSeconds)),
        startedAt,
        endedAt,
      });
      setSessions((current) => [saved, ...current].slice(0, 30));
      setNotice(status === "completed" ? `${sessionLabels[mode]} session completed and saved.` : `${sessionLabels[mode]} session saved as stopped.`);
      try {
        const updatedSummary = await productivityApi.getFocusSummary(today);
        setSummary(updatedSummary);
      } catch (summaryError) {
        setError(`Session was saved, but today's summary could not be refreshed. ${productivityErrorMessage(summaryError, "Refresh the page to reload it.")}`);
      }
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "The focus session could not be saved."));
    } finally {
      setSaving(false);
      setStartedAt(null);
      setRunning(false);
      setEndAt(null);
      setSecondsLeft(durationMinutes * 60);
    }
  }, [startedAt, mode, selectedTaskId, durationMinutes, today]);

  const completeTimer = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setEndAt(null);
    setSecondsLeft(0);
    void saveSession("completed", durationMinutes * 60);
  }, [durationMinutes, saveSession]);

  useEffect(() => {
    if (!running || endAt === null) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) completeTimer();
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, endAt, completeTimer]);

  const chooseMode = (nextMode: SessionType) => {
    if (running || saving || startedAt) return;
    setMode(nextMode);
    setDurationMinutes(durationForMode(nextMode));
    setSecondsLeft(durationForMode(nextMode) * 60);
    setStartedAt(null);
    setEndAt(null);
    finishedRef.current = false;
  };

  const startOrResume = () => {
    if (saving) return;
    if (!startedAt) {
      setStartedAt(new Date().toISOString());
      finishedRef.current = false;
    }
    setRunning(true);
    setEndAt(Date.now() + secondsLeft * 1000);
  };

  const pause = () => {
    if (endAt !== null) setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    setEndAt(null);
    setRunning(false);
  };

  const stop = async () => {
    if (!startedAt || saving) return;
    const elapsed = Math.max(0, durationMinutes * 60 - secondsLeft);
    setRunning(false);
    setEndAt(null);
    finishedRef.current = true;
    await saveSession("cancelled", elapsed);
  };

  const reset = () => {
    if (running || saving || startedAt) return;
    setStartedAt(null);
    setEndAt(null);
    setSecondsLeft(durationMinutes * 60);
    finishedRef.current = false;
  };

  const recommendedBreak: SessionType = summary && settings && summary.completedFocusSessions > 0
    && summary.completedFocusSessions % settings.longBreakAfterSessions === 0
    ? "long_break" : "short_break";
  const progress = useMemo(
    () => durationMinutes > 0 ? ((durationMinutes * 60 - secondsLeft) / (durationMinutes * 60)) * 100 : 0,
    [durationMinutes, secondsLeft],
  );

  if (loading) return <Box m={3}><CircularProgress /></Box>;

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h1" fontWeight={700}>Focus Timer</Typography>
          <Typography color="text.secondary">Use focused work sessions and breaks, then review the time you have recorded.</Typography>
        </Box>
        <Alert severity="info">Completed and stopped sessions are saved to FinTrack. An active timer runs in this browser; closing or refreshing the page before saving will lose that in-progress timer.</Alert>
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ height: "100%" }}><CardContent>
              <Typography color="text.secondary" variant="body2">Focus time today</Typography>
              <Typography variant="h2" fontWeight={750}>{summary?.focusMinutes || 0} min</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} md={4}>
            <Card variant="outlined" sx={{ height: "100%" }}><CardContent>
              <Typography color="text.secondary" variant="body2">Completed focus sessions</Typography>
              <Typography variant="h2" fontWeight={750}>{summary?.completedFocusSessions || 0}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={6} md={4}>
            <Card variant="outlined" sx={{ height: "100%" }}><CardContent>
              <Typography color="text.secondary" variant="body2">Break time today</Typography>
              <Typography variant="h2" fontWeight={750}>{formatDuration(summary?.breakSeconds || 0)}</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2} alignItems="center">
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                {(["focus", "short_break", "long_break"] as SessionType[]).map((item) => (
                  <Button key={item} variant={mode === item ? "contained" : "outlined"} onClick={() => chooseMode(item)} disabled={running || saving || Boolean(startedAt)}>
                    {sessionLabels[item]}
                  </Button>
                ))}
              </Stack>
              <Box sx={{ width: "100%", maxWidth: 620 }}>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 8 }} />
              </Box>
              <Typography variant="h1" fontWeight={800} sx={{ fontSize: { xs: "4rem", sm: "6rem" }, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {formatTime(secondsLeft)}
              </Typography>
              <Typography color="text.secondary">{running ? "Session in progress" : startedAt ? "Session paused" : `${durationMinutes} minute ${sessionLabels[mode].toLowerCase()}`}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                {!running ? (
                  <Button variant="contained" startIcon={<PlayArrowOutlinedIcon />} onClick={startOrResume} disabled={saving}>
                    {startedAt ? "Resume" : "Start"}
                  </Button>
                ) : (
                  <Button variant="contained" startIcon={<PauseOutlinedIcon />} onClick={pause}>Pause</Button>
                )}
                <Button variant="outlined" startIcon={<StopOutlinedIcon />} onClick={() => void stop()} disabled={!startedAt || saving}>Stop & save</Button>
                <Button variant="text" startIcon={<RestartAltOutlinedIcon />} onClick={reset} disabled={running || saving || Boolean(startedAt)}>Reset</Button>
              </Stack>

              <Box sx={{ width: "100%", maxWidth: 420 }}>
                <FormControl fullWidth size="small" disabled={mode !== "focus" || running || Boolean(startedAt)}>
                  <InputLabel>Link this focus session to a task</InputLabel>
                  <Select
                    label="Link this focus session to a task"
                    value={selectedTaskId}
                    onChange={(event) => setSelectedTaskId(event.target.value === "" ? "" : Number(event.target.value))}
                  >
                    <MenuItem value="">No task selected</MenuItem>
                    {tasks.map((task) => <MenuItem key={task.id} value={task.id}>{task.title}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              {!running && !startedAt && mode === "focus" && (
                <Button size="small" onClick={() => chooseMode(recommendedBreak)}>
                  After focus: {sessionLabels[recommendedBreak]}
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Typography variant="h3" fontWeight={700} sx={{ mb: 1.5 }}>Recent sessions</Typography>
          {sessions.length === 0 ? (
            <Card variant="outlined"><CardContent><Stack alignItems="center" spacing={1}>
              <TimerOutlinedIcon color="action" fontSize="large" />
              <Typography fontWeight={650}>No focus sessions recorded yet</Typography>
              <Typography color="text.secondary" variant="body2">Your completed or stopped sessions will appear here.</Typography>
            </Stack></CardContent></Card>
          ) : (
            <Stack spacing={1}>
              {sessions.slice(0, 15).map((session) => (
                <Card variant="outlined" key={session.id}><CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                    <Box flex={1}>
                      <Typography fontWeight={650}>{sessionLabels[session.sessionType]}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(session.startedAt).toLocaleString()} {session.taskTitle ? ` · ${session.taskTitle}` : ""}
                      </Typography>
                    </Box>
                    <Typography fontWeight={650}>{formatDuration(session.actualSeconds)}</Typography>
                    <Typography variant="caption" color={session.status === "completed" ? "success.main" : "text.secondary"}>{session.status === "completed" ? "Completed" : "Stopped"}</Typography>
                  </Stack>
                </CardContent></Card>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
