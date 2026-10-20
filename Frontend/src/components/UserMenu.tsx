import { useContext, useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import { useNavigate } from "react-router-dom";

import userImage from "../assets/user.png";
import { ColorModeContext, tokens } from "../assets/theme";
import { getLocalUserProfile, PROFILE_UPDATED_EVENT } from "../utils/userPreferences";

export default function UserMenu() {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [displayName, setDisplayName] = useState(() => getLocalUserProfile().displayName);
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const navigate = useNavigate();

  useEffect(() => {
    const refreshProfile = () => setDisplayName(getLocalUserProfile().displayName);
    window.addEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
    window.addEventListener("storage", refreshProfile);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
      window.removeEventListener("storage", refreshProfile);
    };
  }, []);

  const handleCloseUserMenu = () => setAnchorElUser(null);
  const openSettings = (section?: "notifications") => {
    handleCloseUserMenu();
    navigate(section ? `/settings?section=${section}` : "/settings");
  };

  return (
    <Box sx={{ alignItems: "center", display: "inline-flex", flexGrow: 0, gap: { xs: 0.5, md: 1 } }}>
      <Typography
        variant="h6"
        color={colors.primary[100]}
        sx={{ display: { xs: "none", sm: "none", md: "flex" }, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {displayName || "My profile"}
      </Typography>
      <Tooltip title="Open profile and settings">
        <IconButton onClick={(event) => setAnchorElUser(event.currentTarget)} sx={{ p: 0 }} aria-label="Open profile and settings menu">
          <Avatar alt={displayName || "FinTrack profile"} src={userImage} />
        </IconButton>
      </Tooltip>
      <Menu
        sx={{ mt: "45px", "& .MuiMenu-paper": { backgroundColor: colors.primary[400], minWidth: 240 } }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        keepMounted
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle1" fontWeight={700}>{displayName || "FinTrack profile"}</Typography>
          <Typography variant="caption" color="text.secondary">Local browser profile</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => openSettings()}>
          <ListItemIcon><PersonOutlineOutlinedIcon /></ListItemIcon>
          <Typography variant="body2">Profile and settings</Typography>
        </MenuItem>
        <MenuItem onClick={() => openSettings("notifications")}>
          <ListItemIcon><NotificationsActiveOutlinedIcon /></ListItemIcon>
          <Typography variant="body2">Notification settings</Typography>
        </MenuItem>
        <MenuItem onClick={() => { handleCloseUserMenu(); colorMode.toggleColorMode(); }}>
          <ListItemIcon>
            {theme.palette.mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
          </ListItemIcon>
          <Typography variant="body2">Switch to {theme.palette.mode === "dark" ? "light" : "dark"} mode</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => openSettings()}>
          <ListItemIcon><SettingsOutlinedIcon /></ListItemIcon>
          <Typography variant="body2">Settings</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
