import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { tokens } from "../assets/theme";

const NOTES_KEY = "fintrack-personal-notes-v1";
const MAX_NOTE_LENGTH = 300;

interface PersonalNote {
  id: string;
  text: string;
  createdAt: string;
}

function readNotes(): PersonalNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PersonalNote =>
      item && typeof item.id === "string" && typeof item.text === "string" && typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export default function Messages() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState("");
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  useEffect(() => {
    setNotes(readNotes());
  }, []);

  const persist = (nextNotes: PersonalNote[]) => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(nextNotes));
      setNotes(nextNotes);
      setSaveError("");
      return true;
    } catch {
      setSaveError("These notes could not be saved in this browser. Check device storage settings and try again.");
      return false;
    }
  };

  const saveNote = () => {
    const text = draft.trim();
    if (!text) {
      setSaveError("Write a note before saving.");
      return;
    }
    const nextNote: PersonalNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };
    if (persist([nextNote, ...notes].slice(0, 50))) setDraft("");
  };

  const deleteNote = (id: string) => {
    persist(notes.filter((note) => note.id !== id));
  };

  const noteCount = notes.length;

  return (
    <Box>
      <Tooltip title="Messages and personal notes">
        <IconButton
          size="large"
          aria-label="Open messages and personal notes"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Badge badgeContent={noteCount} color="secondary" max={99}>
            <MailOutlineOutlinedIcon sx={{ width: "1.5rem", height: "1.5rem" }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 380 }, maxWidth: 380, maxHeight: "75vh", backgroundColor: colors.primary[400] } }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography variant="h6">Messages & personal notes</Typography>
          <Typography variant="caption" color="text.secondary">
            FinTrack does not currently have a connected inbox for sending or receiving messages. Notes below are saved only in this browser on this device.
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: "grid", gap: 1 }}>
          <TextField
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value.slice(0, MAX_NOTE_LENGTH));
              if (saveError) setSaveError("");
            }}
            label="Write a private note"
            placeholder="e.g. Review my budget after payday"
            multiline
            minRows={2}
            maxRows={4}
            size="small"
            inputProps={{ maxLength: MAX_NOTE_LENGTH }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") saveNote();
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">{draft.length}/{MAX_NOTE_LENGTH}</Typography>
            <Button variant="contained" size="small" onClick={saveNote}>Save note</Button>
          </Box>
          {saveError && <Alert severity="warning">{saveError}</Alert>}
        </Box>
        <Divider />
        {notes.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2">No personal notes yet.</Typography>
          </Box>
        ) : notes.map((note) => (
          <Box key={note.id}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 1.25, px: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.text}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(note.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <IconButton size="small" aria-label="Delete note" onClick={() => deleteNote(note.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Divider />
          </Box>
        ))}
      </Menu>
    </Box>
  );
}
