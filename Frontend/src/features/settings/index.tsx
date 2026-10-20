import { useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import { useLocation } from "react-router-dom";
import DailyLetterNotificationSettings from "../../components/DailyLetterNotificationSettings";
import { ColorModeContext } from "../../assets/theme";
import { getLocalUserProfile, saveLocalUserProfile } from "../../utils/userPreferences";

export default function Settings() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const location = useLocation();
  const savedProfile = getLocalUserProfile();
  const [displayName, setDisplayName] = useState(savedProfile.displayName);
  const [savedName, setSavedName] = useState(savedProfile.displayName);
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("section") === "notifications") {
      window.setTimeout(() => {
        document.getElementById("notification-settings")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [location.search]);

  const handleSaveProfile = () => {
    try {
      const nextProfile = { displayName: displayName.trim().slice(0, 50) };
      saveLocalUserProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setSavedName(nextProfile.displayName);
      setFeedback({
        severity: "success",
        message: nextProfile.displayName
          ? "Display name saved on this browser."
          : "Display name cleared on this browser.",
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not save the display name in this browser.",
      });
    }
  };

  const handleCancelProfile = () => {
    setDisplayName(savedName);
    setFeedback(null);
  };

  const handleThemeChange = (
    _event: React.MouseEvent<HTMLElement>,
    selectedMode: "light" | "dark" | null,
  ) => {
    if (selectedMode && selectedMode !== theme.palette.mode) {
      colorMode.toggleColorMode();
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h1">Settings</Typography>
        <Typography color="text.secondary" variant="body1">
          Manage the preferences that FinTrack currently supports on this device.
        </Typography>
      </Stack>

      <Stack spacing={2.5}>
        <Paper id="profile-settings" elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <PersonOutlineOutlinedIcon color="primary" />
            <Typography variant="h4">Profile label</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the name shown beside the profile menu. This is a local display preference, not a login or server-side account profile.
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
              <Button variant="contained" onClick={handleSaveProfile}>Save name</Button>
              <Button variant="outlined" onClick={handleCancelProfile} disabled={displayName === savedName}>Cancel</Button>
            </Stack>
          </Stack>
          {feedback && (
            <Alert severity={feedback.severity} sx={{ mt: 2 }} onClose={() => setFeedback(null)}>
              {feedback.message}
            </Alert>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            The display name is stored only in this browser. It does not change authentication details or sync to other devices. FinTrack does not currently provide sign-in, multiple accounts, or server-side profile editing, so this page intentionally does not offer fake password or logout controls.
          </Alert>
        </Paper>

        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            {theme.palette.mode === "dark" ? <DarkModeOutlinedIcon color="primary" /> : <LightModeOutlinedIcon color="primary" />}
            <Typography variant="h4">Appearance</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the theme for the entire FinTrack interface. Your choice is saved in this browser and restored when you return.
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={theme.palette.mode}
            onChange={handleThemeChange}
            aria-label="FinTrack color theme"
            size="large"
          >
            <ToggleButton value="light" aria-label="Light theme">
              <LightModeOutlinedIcon sx={{ mr: 1 }} /> Light
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Dark theme">
              <DarkModeOutlinedIcon sx={{ mr: 1 }} /> Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </Paper>

        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <ScheduleOutlinedIcon color="primary" />
            <Typography variant="h4">Time and shift schedule</Typography>
          </Stack>
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Application timezone</Typography>
              <Typography fontWeight={700}>Africa/Kigali (CAT, UTC+02:00)</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Daily count and target snapshot</Typography>
              <Typography>00:00 midnight Kigali time</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Shift pacing reminders</Typography>
              <Typography>08:00, 12:00, and 18:00 Kigali time</Typography>
            </Box>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            These times are fixed to match the shift calculations and scheduled reminders. Changing the device timezone does not change FinTrack's Kigali-time schedule.
          </Alert>
        </Paper>

        <Box id="notification-settings" sx={{ scrollMarginTop: 16 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <NotificationsActiveOutlinedIcon color="primary" />
            <Typography variant="h4">Device notifications</Typography>
          </Stack>
          <DailyLetterNotificationSettings />
        </Box>
      </Stack>
    </Box>
  );
}
