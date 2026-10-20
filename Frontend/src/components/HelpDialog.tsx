import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { tokens } from "../assets/theme";
import { navigationItems } from "../data/navigationItems";

export default function HelpDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const openPage = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <Tooltip title="Help and app guide">
        <IconButton aria-label="Help and app guide" onClick={() => setOpen(true)} size="large">
          <InfoOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 7 }}>
          FinTrack help and app guide
          <IconButton
            aria-label="Close help"
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Use the page search to jump to a section. The guide below opens the corresponding page.
          </Typography>
          <List disablePadding>
            {navigationItems.map((item) => (
              <ListItemButton key={item.path} onClick={() => openPage(item.path)} sx={{ borderRadius: 1 }}>
                <ListItemText primary={item.label} secondary={item.description} />
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ mt: 2, p: 2, borderRadius: 1, backgroundColor: colors.primary[400] }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Top-bar tools</Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Search:</strong> finds FinTrack pages and sections; it does not search individual transaction records.
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Messages & notes:</strong> personal notes are saved in this browser on this device and do not sync to other devices.
            </Typography>
            <Typography variant="body2">
              <strong>Notifications:</strong> shows current daily-letter progress and any budget alerts returned by the app. Phone push reminders are managed from the Overview page.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => openPage("/settings")}>Open Settings</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
