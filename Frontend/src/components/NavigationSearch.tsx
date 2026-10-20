import { useMemo, useRef, useState } from "react";
import {
  Box,
  ClickAwayListener,
  InputBase,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { tokens } from "../assets/theme";
import { navigationItems } from "../data/navigationItems";

export default function NavigationSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return navigationItems.slice(0, 5);

    return navigationItems
      .map((item) => {
        const label = item.label.toLowerCase();
        const matches = [label, item.path, item.description.toLowerCase(), ...item.keywords]
          .some((candidate) => candidate.toLowerCase().includes(normalized));
        const rank = label === normalized ? 0 : label.startsWith(normalized) ? 1 : 2;
        return { item, matches, rank };
      })
      .filter((result) => result.matches)
      .sort((a, b) => a.rank - b.rank)
      .map((result) => result.item);
  }, [query]);

  const open = focused;
  const goTo = (path: string) => {
    navigate(path);
    setQuery("");
    setFocused(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      goTo(results[0].path);
    }
    if (event.key === "Escape") {
      setFocused(false);
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setFocused(false)}>
      <Box sx={{ minWidth: 0, flex: 1, maxWidth: 420, position: "relative" }}>
      <Box
        ref={anchorRef}
        sx={{
          border: `1px solid ${colors.primary[500]}`,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          width: "100%",
          minWidth: 0,
          backgroundColor: colors.primary[400],
          px: 1,
        }}
      >
        <SearchIcon aria-hidden="true" sx={{ color: colors.primary[100], flexShrink: 0 }} />
        <InputBase
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages"
          inputProps={{ "aria-label": "Search FinTrack pages", autoComplete: "off" }}
          sx={{ flex: 1, minWidth: 0, ml: 1, py: 0.5, color: colors.primary[100] }}
        />
      </Box>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        style={{ zIndex: 1500, width: anchorRef.current?.clientWidth ?? 300 }}
      >
        <Paper
          elevation={8}
          sx={{ mt: 0.5, maxHeight: 360, overflowY: "auto", backgroundColor: colors.primary[400] }}
        >
          <Typography variant="caption" sx={{ display: "block", px: 2, pt: 1.25, color: colors.grey[300] }}>
            {query.trim() ? "Matching pages" : "Quick navigation"}
          </Typography>
          {results.length ? results.map((item) => (
            <ListItemButton
              key={item.path}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => goTo(item.path)}
              sx={{ alignItems: "flex-start", py: 1 }}
            >
              <ListItemText primary={item.label} secondary={item.description} />
            </ListItemButton>
          )) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2">No matching page found.</Typography>
              <Typography variant="caption" color="text.secondary">Search currently covers FinTrack pages and sections, not individual transactions.</Typography>
            </Box>
          )}
          <Box sx={{ p: 1.25, borderTop: `1px solid ${colors.primary[500]}` }}>
            <Typography variant="caption" color="text.secondary">Press Enter to open the first result · Esc to close</Typography>
          </Box>
        </Paper>
      </Popper>
      </Box>
    </ClickAwayListener>
  );
}
