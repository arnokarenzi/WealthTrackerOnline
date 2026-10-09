import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  NotificationsActive,
  NotificationsOff,
  CheckCircle,
} from "@mui/icons-material";
import { financeApi } from "../services/api";
import {
  disableDailyLetterNotifications,
  enableDailyLetterNotifications as enableDailyLetterNotification,
  getExistingPushSubscription,
  getPushSupportInfo,
} from "../services/pushNotifications";
import type { DailyLetterStatus } from "../types/api";

export default function DailyLetterNotificationSettings() {
  const [status, setStatus] = useState<DailyLetterStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [dailyStatus, subscription] = await Promise.all([
        financeApi.getDailyLetterStatus(),
        getExistingPushSubscription().catch(() => null),
      ]);
      setStatus(dailyStatus);
      setEnabled(Boolean(subscription));
    } catch (error) {
      console.error("Shift pacing notification status error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleEnable = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await enableDailyLetterNotification();
      setEnabled(true);
      setFeedback({
        severity: "success",
        message: "Shift pacing notifications are enabled on this device.",
      });
      await load();
    } catch (error) {
      setFeedback({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not enable notifications.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTestNotification = async (
    kind: "morning" | "midday" | "evening" | "target",
  ) => {
    setTestBusy(kind);
    setFeedback(null);
    try {
      await enableDailyLetterNotification();
      setFeedback({
        severity: "success",
        message: "Test notification sent to this device.",
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not send the test notification.",
      });
    } finally {
      setTestBusy(null);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await disableDailyLetterNotifications();
      setEnabled(false);
      setFeedback({
        severity: "info",
        message: "Shift pacing notifications are disabled on this device.",
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not disable notifications.",
      });
    } finally {
      setBusy(false);
    }
  };

  const support = getPushSupportInfo();
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const homeScreenRequired = isIOS && !support.standalone;

  const todayTarget = status?.dailyTarget ?? 0;
  const todayCount = status?.dailyLetterCount ?? 0;
  const todayRemaining = status?.dailyRemaining ?? 0;
  const currentRequired = status?.currentRequiredPerDay ?? 0;
  const remainingShift = status?.remainingShiftLetters ?? 0;
  const remainingDays = status?.remainingDaysInShift ?? 0;

  const description = useMemo(
    () =>
      "08:00, 12:00 and 18:00 Kigali-time pacing alerts are sent while today's target is still unfinished. The target-complete notification is sent immediately when you reach the morning target.",
    [],
  );

  return (
    <Box
      sx={{
        borderRadius: 3,
        p: 2.5,
        mb: 3,
        backgroundColor: "background.paper",
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Shift Pacing Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        {status && (
          <Box>
            <Typography variant="body2" fontWeight={800}>
              Day {status.shiftDay} of {status.totalDaysInShift}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Today: {todayCount.toLocaleString()} /{" "}
              {todayTarget.toLocaleString()} letters
              {status.targetReached
                ? " — target complete"
                : ` — ${todayRemaining.toLocaleString()} remaining today`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Live shift pace: {currentRequired.toLocaleString()} letters/day
              required • {remainingShift.toLocaleString()} letters left across{" "}
              {remainingDays.toLocaleString()} days
            </Typography>
          </Box>
        )}

        {!support.supported ? (
          <Alert severity="warning">
            Push notifications are not supported by this browser/device.
          </Alert>
        ) : homeScreenRequired ? (
          <Alert severity="info">
            On iPhone, open FinTrack from the Home Screen app icon before
            enabling notifications.
          </Alert>
        ) : null}

        {feedback && (
          <Alert severity={feedback.severity}>{feedback.message}</Alert>
        )}

        {enabled ? (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<NotificationsOff />}
            onClick={handleDisable}
            disabled={busy}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {busy ? "Updating…" : "Disable Notifications"}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={
              busy ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <NotificationsActive />
              )
            }
            onClick={handleEnable}
            disabled={
              busy || loading || !support.supported || homeScreenRequired
            }
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {busy ? "Enabling…" : "Enable Shift Pacing Notifications"}
          </Button>
        )}

        {enabled && (
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 2,
              border: "1px dashed",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" fontWeight={800} mb={1}>
              Test notifications on this device
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mb={1.5}
            >
              These tests do not add letters, change your daily target, or
              create a scheduled-alert log. They go only to the device/browser
              that presses the button.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              flexWrap="wrap"
            >
              {[
                ["morning", "Test 8:00 Alert"],
                ["midday", "Test 12:00 Alert"],
                ["evening", "Test 18:00 Alert"],
                ["target", "Test Target Complete"],
              ].map(([kind, label]) => (
                <Button
                  key={kind}
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    handleTestNotification(
                      kind as "morning" | "midday" | "evening" | "target",
                    )
                  }
                  disabled={Boolean(testBusy) || busy}
                  sx={{ textTransform: "none" }}
                >
                  {testBusy === kind ? "Sending…" : label}
                </Button>
              ))}
            </Stack>
          </Box>
        )}

        {status?.targetReached && enabled && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircle fontSize="small" color="success" />
            <Typography variant="caption" color="success.main" fontWeight={700}>
              Today&apos;s pacing target has been reached.
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
