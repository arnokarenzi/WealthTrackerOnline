import { useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useLocation } from "react-router-dom";
import DailyLetterNotificationSettings from "../../components/DailyLetterNotificationSettings";
import { ColorModeContext } from "../../assets/theme";
import { financeApi } from "../../services/api";
import { getLocalUserProfile, saveLocalUserProfile } from "../../utils/userPreferences";
import { getKigaliDateInputValue, getKigaliYearMonth } from "../../utils/kigaliTime";
import {
  getLocalSettingsPreferences,
  saveLocalSettingsPreferences,
  syncPushNotificationPreferences,
  type AppDateFormat,
  type LocalSettingsPreferences,
} from "../../utils/settingsPreferences";

type Feedback = { severity: "success" | "error" | "warning" | "info"; message: string };

const readLocalNotesForExport = (): unknown[] => {
  try {
    const raw = window.localStorage.getItem("fintrack-personal-notes-v1");
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { text?: unknown }).text === "string" &&
        typeof (item as { createdAt?: unknown }).createdAt === "string",
    );
  } catch {
    return [];
  }
};

export default function Settings() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const location = useLocation();
  const savedProfile = getLocalUserProfile();
  const [displayName, setDisplayName] = useState(savedProfile.displayName);
  const [savedName, setSavedName] = useState(savedProfile.displayName);
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState("");
  const [themeBusy, setThemeBusy] = useState(false);
  const [serverThemeMode, setServerThemeMode] = useState<"light" | "dark" | null>(null);
  const [preferences, setPreferences] = useState<LocalSettingsPreferences>(() => getLocalSettingsPreferences());
  const [savedPreferences, setSavedPreferences] = useState<LocalSettingsPreferences>(() => getLocalSettingsPreferences());
  const [settingsReload, setSettingsReload] = useState(0);
  const [preferencesFeedback, setPreferencesFeedback] = useState<Feedback | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<Feedback | null>(null);
  const [previewYear, previewMonth, previewDay] = getKigaliDateInputValue().split("-");
  const dateFormatPreview = preferences.dateFormat === "MM/dd/yyyy"
    ? `${previewMonth}/${previewDay}/${previewYear}`
    : preferences.dateFormat === "yyyy-MM-dd"
      ? `${previewYear}-${previewMonth}-${previewDay}`
      : `${previewDay}/${previewMonth}/${previewYear}`;

  useEffect(() => {
    let mounted = true;
    setSettingsLoading(true);
    setSettingsLoadError("");
    financeApi.getSettings().then(async (remote) => {
      if (!mounted) return;
      setDisplayName(remote.displayName);
      setSavedName(remote.displayName);
      setPreferences(remote.preferences);
      setSavedPreferences(remote.preferences);
      setServerThemeMode(remote.themeMode);
      try {
        saveLocalUserProfile({ displayName: remote.displayName });
        saveLocalSettingsPreferences(remote.preferences);
      } catch {
        // Browser caches are convenience mirrors; the server remains authoritative.
      }
      try {
        await syncPushNotificationPreferences(remote.preferences.notifications);
      } catch {
        // The server preferences are saved even if this browser cannot mirror them to IndexedDB.
      }
    }).catch((caught) => {
      if (mounted) setSettingsLoadError(caught instanceof Error ? caught.message : "Could not load saved settings from the backend.");
    }).finally(() => {
      if (mounted) setSettingsLoading(false);
    });
    return () => { mounted = false; };
  }, [settingsReload]);

  useEffect(() => {
    if (serverThemeMode && serverThemeMode !== theme.palette.mode) colorMode.toggleColorMode();
  }, [serverThemeMode, theme.palette.mode, colorMode.toggleColorMode]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get("section");
    const targetId = section === "notifications" ? "notification-settings" : section === "data" ? "data-management-settings" : null;
    if (targetId) {
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location.search]);

  const handleSaveProfile = async () => {
    const nextProfile = { displayName: displayName.trim().slice(0, 50) };
    setProfileBusy(true);
    setProfileFeedback(null);
    try {
      const saved = await financeApi.updateSettings({ displayName: nextProfile.displayName });
      setDisplayName(saved.displayName);
      setSavedName(saved.displayName);
      try { saveLocalUserProfile({ displayName: saved.displayName }); } catch { /* server save already succeeded */ }
      setProfileFeedback({ severity: "success", message: saved.displayName ? "Display name saved on the server." : "Display name cleared on the server." });
    } catch (error) {
      setProfileFeedback({ severity: "error", message: error instanceof Error ? error.message : "Could not save the display name on the server." });
    } finally { setProfileBusy(false); }
  };

  const handleCancelProfile = () => {
    setDisplayName(savedName);
    setProfileFeedback(null);
  };

  const handleThemeChange = async (
    _event: React.MouseEvent<HTMLElement>,
    selectedMode: "light" | "dark" | null,
  ) => {
    if (!selectedMode || selectedMode === theme.palette.mode || themeBusy) return;
    setThemeBusy(true);
    setPreferencesFeedback(null);
    try {
      const saved = await financeApi.updateSettings({ themeMode: selectedMode });
      setServerThemeMode(saved.themeMode);
      setPreferencesFeedback({ severity: "success", message: `The ${saved.themeMode} theme preference was saved on the server.` });
    } catch (caught) {
      setPreferencesFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not save the theme preference." });
    } finally { setThemeBusy(false); }
  };

  const updateNotificationPreference = (
    key: keyof LocalSettingsPreferences["notifications"],
    checked: boolean,
  ) => {
    setPreferences((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: checked },
    }));
    setPreferencesFeedback(null);
  };

  const handleDateFormatChange = (event: SelectChangeEvent) => {
    setPreferences((current) => ({ ...current, dateFormat: event.target.value as AppDateFormat }));
    setPreferencesFeedback(null);
  };

  const handleSavePreferences = async () => {
    if (preferences.budgetWarningPercent < 50 || preferences.budgetWarningPercent > 95) {
      setPreferencesFeedback({ severity: "error", message: "The budget warning threshold must be between 50% and 95%." });
      return;
    }
    if (
      preferences.budgetCriticalPercent < 60 ||
      preferences.budgetCriticalPercent > 200 ||
      preferences.budgetCriticalPercent <= preferences.budgetWarningPercent
    ) {
      setPreferencesFeedback({
        severity: "error",
        message: "The critical threshold must be between 60% and 200%, and higher than the warning threshold.",
      });
      return;
    }

    try {
      const response = await financeApi.updateSettings({ preferences });
      const saved = response.preferences;
      setPreferences(saved);
      setSavedPreferences(saved);
      let localMirrorSaved = true;
      let pushPreferencesSynced = true;
      try { saveLocalSettingsPreferences(saved); } catch { localMirrorSaved = false; }
      try { await syncPushNotificationPreferences(saved.notifications); } catch { pushPreferencesSynced = false; }
      if (localMirrorSaved && pushPreferencesSynced) {
        setPreferencesFeedback({ severity: "success", message: "Preferences were saved on the server and push-category choices were synced to this browser." });
      } else {
        const failures = [
          !localMirrorSaved ? "the browser compatibility cache could not be updated" : "",
          !pushPreferencesSynced ? "push-category choices could not be synced to this browser's service-worker storage" : "",
        ].filter(Boolean).join("; ");
        setPreferencesFeedback({ severity: "warning", message: `Preferences were saved on the server, but ${failures}.` });
      }
    } catch (error) {
      setPreferencesFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "Could not save preferences on the server.",
      });
    }
  };

  const handleExportData = async () => {
    setExportBusy(true);
    setExportFeedback(null);
    const now = getKigaliYearMonth();
    const tasks: Array<[string, () => Promise<unknown>]> = [
      ["dashboardSummary", () => financeApi.getDashboardSummary()],
      ["monthlyBudget", () => financeApi.getBudgetPlan()],
      ["activeExpenses", () => financeApi.getExpenses()],
      ["archivedExpenses", () => financeApi.getExpenseHistory("1970-01-01", "2099-12-31")],
      ["walletIncomeHistory", () => financeApi.getWalletIncomeHistory()],
      ["investmentAssets", () => financeApi.getInvestments(now.month, now.year)],
      ["savingsGoals", () => financeApi.getSavingsGoals()],
      ["pendingEarnings", () => financeApi.getPendingEarnings()],
      ["pendingEmergencySnapshots", () => financeApi.getPendingEmergency()],
      ["emergencyFund", () => financeApi.getEmergencyFund()],
      ["investmentReserve", () => financeApi.getInvestmentReserve()],
      ["allocationConfiguration", () => financeApi.getAllocations()],
      ["gratitudeHistory", () => financeApi.getGratitudeHistory()],
      ["schoolFeesHistory", () => financeApi.getSchoolFees()],
      ["termConfiguration", () => financeApi.getTermConfig()],
      ["dailyLetterStatus", () => financeApi.getDailyLetterStatus()],
      ["bills", () => financeApi.getBills({ limit: 200, includeArchived: true })],
      ["billPaymentHistory", () => financeApi.getBillPayments()],
      ["debts", () => financeApi.getDebts(true)],
      ["debtPaymentHistory", () => financeApi.getDebtPayments()],
      ["debtSummary", () => financeApi.getDebtSummary()],
      ["reports", () => financeApi.getReports()],
      ["netWorth", () => financeApi.getNetWorth()],
      ["settings", () => financeApi.getSettings()],
      ["inAppNotifications", () => financeApi.getNotifications()],
    ];

    try {
      const outcomes = await Promise.all(
        tasks.map(async ([name, load]) => {
          try {
            return { name, success: true as const, value: await load() };
          } catch {
            return { name, success: false as const };
          }
        }),
      );
      const data: Record<string, unknown> = {};
      const includedSections: string[] = [];
      const unavailableSections: string[] = [];
      outcomes.forEach((outcome) => {
        if (outcome.success) {
          data[outcome.name] = outcome.value;
          includedSections.push(outcome.name);
        } else {
          unavailableSections.push(outcome.name);
        }
      });

      const settingsRecord = data.settings as { themeMode?: "light" | "dark" } | undefined;
      const backup = {
        application: "FinTrack",
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        businessTimezone: "Africa/Kigali",
        baseCurrency: "RWF",
        exportSummary: {
          includedSections,
          unavailableSections,
          note: "This export includes data returned by the available FinTrack API endpoints, including server-saved settings and the newly persisted Bills, Debt, Reports, and Net Worth feature data, plus this browser's personal notes. Push subscriptions, credentials, and raw database-only records are intentionally excluded.",
        },
        cloudData: data,
        localDeviceData: {
          profile: getLocalUserProfile(),
          preferences: getLocalSettingsPreferences(),
          themeMode: settingsRecord?.themeMode ?? null,
          personalNotes: readLocalNotesForExport(),
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fintrack-backup-${getKigaliDateInputValue()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (unavailableSections.length === 0) {
        setExportFeedback({
          severity: "success",
          message: `Backup downloaded with ${includedSections.length} cloud-data sections and your local browser settings and notes.`,
        });
      } else {
        setExportFeedback({
          severity: "warning",
          message: `Backup downloaded, but ${unavailableSections.length} cloud section(s) could not be retrieved: ${unavailableSections.join(", ")}. Check the connection and export again for a more complete backup. The file lists any unavailable sections.`,
        });
      }
    } catch (error) {
      setExportFeedback({
        severity: "error",
        message: error instanceof Error ? error.message : "Could not build the backup file. Check browser download permissions and try again.",
      });
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h1">Settings</Typography>
        <Typography color="text.secondary" variant="body1">
          Manage appearance, regional display, alert thresholds, notifications, and backups. Saved settings are retrieved from the backend; browser storage is used only for local display and service-worker compatibility.
        </Typography>
      </Stack>
      {settingsLoading && <Alert severity="info" sx={{ mb: 2 }}>Loading saved settings from the backend…</Alert>}
      {settingsLoadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setSettingsReload((current) => current + 1)}>Retry</Button>}>{settingsLoadError} Settings remain unchanged until they can be retrieved.</Alert>}

      <Stack spacing={2.5}>
        <Paper id="profile-settings" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <PersonOutlineOutlinedIcon color="primary" />
            <Typography variant="h4">Profile label</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the name shown beside the profile menu. This persists as the server-wide display label because this application currently has no sign-in or per-user profile model.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "flex-start" }}>
            <TextField
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 50))}
              inputProps={{ maxLength: 50 }}
              placeholder="Enter a display name"
              helperText={`${displayName.length}/50 characters`}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void handleSaveProfile()} disabled={profileBusy || settingsLoading || Boolean(settingsLoadError)}>{profileBusy ? "Saving…" : "Save name"}</Button>
              <Button variant="outlined" onClick={handleCancelProfile} disabled={displayName === savedName}>Cancel</Button>
            </Stack>
          </Stack>
          {profileFeedback && <Alert severity={profileFeedback.severity} sx={{ mt: 2 }} onClose={() => setProfileFeedback(null)}>{profileFeedback.message}</Alert>}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This value is stored server-side and can be shared by all clients because FinTrack does not currently provide sign-in, multiple accounts, or authenticated user profiles. It does not change authentication details, and no password/logout controls are exposed without a real authentication system.
          </Alert>
        </Paper>

        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            {theme.palette.mode === "dark" ? <DarkModeOutlinedIcon color="primary" /> : <LightModeOutlinedIcon color="primary" />}
            <Typography variant="h4">Appearance</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the theme for the entire FinTrack interface. The preference is saved on the server and loaded when Settings opens.
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={theme.palette.mode}
            onChange={(event, mode) => void handleThemeChange(event, mode)}
            aria-label="FinTrack color theme"
            size="large"
            disabled={themeBusy || settingsLoading || Boolean(settingsLoadError)}
          >
            <ToggleButton value="light" aria-label="Light theme"><LightModeOutlinedIcon sx={{ mr: 1 }} /> Light</ToggleButton>
            <ToggleButton value="dark" aria-label="Dark theme"><DarkModeOutlinedIcon sx={{ mr: 1 }} /> Dark</ToggleButton>
          </ToggleButtonGroup>
        </Paper>

        <Paper id="regional-preferences" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <PublicOutlinedIcon color="primary" />
            <Typography variant="h4">Regional display preferences</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the date style used for displayed transaction dates. Business dates and shift schedules continue to use Africa/Kigali regardless of this display choice.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              label="Base currency"
              value="Rwandan franc (RWF)"
              size="small"
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Currency is fixed to RWF because saved budgets and transactions use RWF. Changing this label alone would not convert stored amounts."
            />
            <FormControl fullWidth size="small">
              <InputLabel id="date-format-label">Date format</InputLabel>
              <Select labelId="date-format-label" label="Date format" value={preferences.dateFormat} onChange={handleDateFormatChange}>
                <MenuItem value="dd/MM/yyyy">DD/MM/YYYY (20/10/2026)</MenuItem>
                <MenuItem value="MM/dd/yyyy">MM/DD/YYYY (10/20/2026)</MenuItem>
                <MenuItem value="yyyy-MM-dd">YYYY-MM-DD (2026-10-20)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Preview for the current Kigali date: <strong>{dateFormatPreview}</strong>. The date style affects displayed transaction dates and local note timestamps, not date-entry controls or export file data.
          </Alert>
        </Paper>

        <Paper id="alert-preferences" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <TuneOutlinedIcon color="primary" />
            <Typography variant="h4">Budget alert preferences</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These persisted thresholds control the server-generated budget messages in the top-bar notification menu. They do not change your budget plan or financial calculations.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Warning at (% of planned essentials)"
              type="number"
              value={preferences.budgetWarningPercent}
              onChange={(event) => {
                const value = event.target.value === "" ? 0 : Number(event.target.value);
                setPreferences((current) => ({ ...current, budgetWarningPercent: value }));
                setPreferencesFeedback(null);
              }}
              inputProps={{ min: 50, max: 95, step: 5 }}
              helperText="Allowed range: 50–95%. Default: 80%."
              fullWidth
              size="small"
            />
            <TextField
              label="Critical at (% of planned essentials)"
              type="number"
              value={preferences.budgetCriticalPercent}
              onChange={(event) => {
                const value = event.target.value === "" ? 0 : Number(event.target.value);
                setPreferences((current) => ({ ...current, budgetCriticalPercent: value }));
                setPreferencesFeedback(null);
              }}
              inputProps={{ min: 60, max: 200, step: 5 }}
              helperText="Allowed range: 60–200%, and must be above warning. Default: 100%."
              fullWidth
              size="small"
            />
          </Stack>
        </Paper>

        <Paper id="notification-preferences" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <NotificationsActiveOutlinedIcon color="primary" />
            <Typography variant="h4">Notification categories</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Category preferences and thresholds are persisted by the backend. Push-category values are also mirrored to this browser’s service-worker storage; budget alerts are shown in the in-app notification menu.
          </Typography>
          <Stack divider={<Divider flexItem />} spacing={0}>
            <FormControlLabel
              sx={{ py: 0.75, alignItems: "flex-start", mx: 0 }}
              control={<Switch checked={preferences.notifications.shiftPacing} onChange={(event) => updateNotificationPreference("shiftPacing", event.target.checked)} />}
              label={<Box sx={{ pt: 0.5 }}><Typography fontWeight={700}>Shift pacing reminders</Typography><Typography variant="body2" color="text.secondary">The scheduled 08:00, 12:00 and 18:00 Kigali-time push reminders.</Typography></Box>}
            />
            <FormControlLabel
              sx={{ py: 0.75, alignItems: "flex-start", mx: 0 }}
              control={<Switch checked={preferences.notifications.dailyTarget} onChange={(event) => updateNotificationPreference("dailyTarget", event.target.checked)} />}
              label={<Box sx={{ pt: 0.5 }}><Typography fontWeight={700}>Daily target completion</Typography><Typography variant="body2" color="text.secondary">A push notification when today’s frozen letter target has been reached.</Typography></Box>}
            />
            <FormControlLabel
              sx={{ py: 0.75, alignItems: "flex-start", mx: 0 }}
              control={<Switch checked={preferences.notifications.leaderboard} onChange={(event) => updateNotificationPreference("leaderboard", event.target.checked)} />}
              label={<Box sx={{ pt: 0.5 }}><Typography fontWeight={700}>Leaderboard improvements</Typography><Typography variant="body2" color="text.secondary">Push notifications when a leaderboard position improves.</Typography></Box>}
            />
            <FormControlLabel
              sx={{ py: 0.75, alignItems: "flex-start", mx: 0 }}
              control={<Switch checked={preferences.notifications.budgetAlerts} onChange={(event) => updateNotificationPreference("budgetAlerts", event.target.checked)} />}
              label={<Box sx={{ pt: 0.5 }}><Typography fontWeight={700}>Budget alerts in the app</Typography><Typography variant="body2" color="text.secondary">Show budget threshold warnings and status in the top-bar notification menu.</Typography></Box>}
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button variant="contained" onClick={() => void handleSavePreferences()} disabled={settingsLoading || Boolean(settingsLoadError)}>Save preferences</Button>
            <Button variant="text" onClick={() => { setPreferences(savedPreferences); setPreferencesFeedback(null); }}>Discard unsaved changes</Button>
          </Stack>
          {preferencesFeedback && <Alert severity={preferencesFeedback.severity} sx={{ mt: 2 }} onClose={() => setPreferencesFeedback(null)}>{preferencesFeedback.message}</Alert>}
        </Paper>

        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <ScheduleOutlinedIcon color="primary" />
            <Typography variant="h4">Time and shift schedule</Typography>
          </Stack>
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            <Box><Typography variant="subtitle2" color="text.secondary">Application timezone</Typography><Typography fontWeight={700}>Africa/Kigali (CAT, UTC+02:00)</Typography></Box>
            <Box><Typography variant="subtitle2" color="text.secondary">Daily count and target snapshot</Typography><Typography>00:00 midnight Kigali time</Typography></Box>
            <Box><Typography variant="subtitle2" color="text.secondary">Shift pacing reminders</Typography><Typography>08:00, 12:00, and 18:00 Kigali time</Typography></Box>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            These times are fixed to match the shift calculations and scheduled reminders. Changing the device timezone does not change FinTrack&apos;s Kigali-time schedule.
          </Alert>
        </Paper>

        <Box id="notification-settings" sx={{ scrollMarginTop: 16 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <NotificationsActiveOutlinedIcon color="primary" />
            <Typography variant="h4">Device push setup and tests</Typography>
          </Stack>
          <DailyLetterNotificationSettings />
        </Box>

        <Paper id="data-management-settings" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <FileDownloadOutlinedIcon color="primary" />
            <Typography variant="h4">Data management and backup</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download a portable JSON backup of financial data exposed by the current API plus local profile, theme, preferences, and personal notes. Export does not change or delete records.
          </Typography>
          <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExportData} disabled={exportBusy}>
            {exportBusy ? "Collecting data…" : "Export app data (JSON)"}
          </Button>
          {exportFeedback && <Alert severity={exportFeedback.severity} sx={{ mt: 2 }} onClose={() => setExportFeedback(null)}>{exportFeedback.message}</Alert>}
          <Alert severity="warning" sx={{ mt: 2 }}>
            Keep the downloaded file private because it can contain sensitive financial records and personal notes. Sections the API cannot provide are listed in the backup report. Import/restore is not enabled in this version, and this export does not include push subscriptions, credentials, or every raw database-only table.
          </Alert>
        </Paper>
      </Stack>
    </Box>
  );
}
