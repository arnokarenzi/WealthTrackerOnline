import { useContext } from "react";
import { Box, Divider, IconButton, Tooltip, useTheme } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import SidebarContext from "../context/SidebarContext";
import Notifications from "../components/Notifications";
import Messages from "../components/Messages";
import UserMenu from "../components/UserMenu";
import NavigationSearch from "../components/NavigationSearch";
import HelpDialog from "../components/HelpDialog";
import { ColorModeContext, tokens } from "../assets/theme";

export default function Navbar() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const { setHideSidebar } = useContext(SidebarContext);

  const handleClick = () => {
    setHideSidebar((prevState) => !prevState);
  };

  return (
    <Box display="flex" justifyContent="space-between" p={{ xs: 0.5, sm: 1, md: 2 }} width="100%">
      <AppBar position="static" elevation={4} sx={{ minWidth: 0 }}>
        <Toolbar
          disableGutters
          sx={{
            px: { xs: 0.75, sm: 1.5, md: 2 },
            gap: { xs: 0.5, sm: 1, md: 1.5 },
            minHeight: { xs: 58, sm: 64 },
            backgroundColor: colors.primary[400],
            display: "flex",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <Tooltip title="Open navigation menu">
            <IconButton
              sx={{ display: { xs: "flex", lg: "none" }, flexShrink: 0 }}
              size="large"
              edge="start"
              aria-label="Open navigation menu"
              onClick={handleClick}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: "1 1 auto", minWidth: 0, maxWidth: 420 }}>
            <NavigationSearch />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, sm: 0.5, md: 1 }, flexShrink: 0 }}>
            <Tooltip title={theme.palette.mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              <IconButton
                aria-label={theme.palette.mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={colorMode.toggleColorMode}
                sx={{ display: { xs: "none", sm: "none", md: "flex" }, height: "100%" }}
              >
                {theme.palette.mode === "dark" ? (
                  <DarkModeOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} />
                ) : (
                  <LightModeOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} />
                )}
              </IconButton>
            </Tooltip>
            <Messages />
            <Notifications />
            <Box sx={{ display: "flex", alignItems: "center" }}><HelpDialog /></Box>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "flex" }, mx: { xs: 0, sm: 0.5 } }} />
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
