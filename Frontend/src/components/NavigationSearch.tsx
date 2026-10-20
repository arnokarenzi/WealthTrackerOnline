import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, ClickAwayListener, CircularProgress, InputBase, ListItemButton, ListItemText, Paper, Popper, Typography, useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { tokens } from "../assets/theme";
import { navigationItems } from "../data/navigationItems";
import { financeApi } from "../services/api";
import type { SearchResult } from "../types/api";

const money = (value: number | null) => value == null ? "" : `${Math.round(value).toLocaleString()} RWF`;

export default function NavigationSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [recordResults, setRecordResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const pageResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return navigationItems.slice(0, 5);
    return navigationItems.map((item) => {
      const label = item.label.toLowerCase();
      const matches = [label, item.path, item.description.toLowerCase(), ...item.keywords].some((candidate) => candidate.toLowerCase().includes(normalized));
      const rank = label === normalized ? 0 : label.startsWith(normalized) ? 1 : 2;
      return { item, matches, rank };
    }).filter((result) => result.matches).sort((a, b) => a.rank - b.rank).map((result) => result.item);
  }, [query]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRecordResults([]); setSearchError(""); setSearchLoading(false); return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true); setSearchError("");
      try {
        const response = await financeApi.searchRecords(normalized, { limit: 8 });
        if (!cancelled) setRecordResults(response.results);
      } catch (caught) {
        if (!cancelled) {
          setRecordResults([]);
          setSearchError(caught instanceof Error ? caught.message : "Financial record search is unavailable.");
        }
      } finally { if (!cancelled) setSearchLoading(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [query]);

  const goTo = (path: string) => { navigate(path); setQuery(""); setFocused(false); };
  const goToRecord = (result: SearchResult) => goTo(result.route);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (pageResults.length) goTo(pageResults[0].path);
      else if (recordResults.length) goToRecord(recordResults[0]);
    }
    if (event.key === "Escape") setFocused(false);
  };

  const open = focused;
  return (
    <ClickAwayListener onClickAway={() => setFocused(false)}>
      <Box sx={{ minWidth: 0, flex: 1, maxWidth: 420, position: "relative" }}>
        <Box ref={anchorRef} sx={{ border: `1px solid ${colors.primary[500]}`, borderRadius: 1, display: "flex", alignItems: "center", width: "100%", minWidth: 0, backgroundColor: colors.primary[400], px: 1 }}>
          <SearchIcon aria-hidden="true" sx={{ color: colors.primary[100], flexShrink: 0 }} />
          <InputBase value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} onKeyDown={handleKeyDown} placeholder="Search pages and records" inputProps={{ "aria-label": "Search FinTrack pages and financial records", autoComplete: "off" }} sx={{ flex: 1, minWidth: 0, ml: 1, py: 0.5, color: colors.primary[100] }} />
          {searchLoading && <CircularProgress size={16} sx={{ mr: 0.5 }} />}
        </Box>
        <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" style={{ zIndex: 1500, width: anchorRef.current?.clientWidth ?? 300 }}>
          <Paper elevation={8} sx={{ mt: 0.5, maxHeight: 420, overflowY: "auto", backgroundColor: colors.primary[400] }}>
            <Typography variant="caption" sx={{ display: "block", px: 2, pt: 1.25, color: colors.grey[300] }}>{query.trim() ? "Matching pages" : "Quick navigation"}</Typography>
            {pageResults.map((item) => <ListItemButton key={item.path} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.path)} sx={{ alignItems: "flex-start", py: 1 }}><ListItemText primary={item.label} secondary={item.description} /></ListItemButton>)}
            {query.trim().length >= 2 && <>
              <Typography variant="caption" sx={{ display: "block", px: 2, pt: 1.25, color: colors.grey[300], borderTop: `1px solid ${colors.primary[500]}` }}>Financial records</Typography>
              {searchError && <Alert severity="error" sx={{ m: 1 }}>{searchError}</Alert>}
              {!searchLoading && !searchError && recordResults.map((item) => <ListItemButton key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => goToRecord(item)} sx={{ alignItems: "flex-start", py: 1 }}><ListItemText primary={item.title} secondary={`${item.type.replace("-", " ")} · ${item.detail}${item.amount == null ? "" : ` · ${money(item.amount)}`}${item.date ? ` · ${item.date}` : ""}`} /></ListItemButton>)}
              {!searchLoading && !searchError && recordResults.length === 0 && <Box sx={{ px: 2, py: 1.5 }}><Typography variant="body2">No matching persisted financial records.</Typography></Box>}
            </>}
            {!pageResults.length && !recordResults.length && !searchError && !searchLoading && query.trim().length < 2 && <Box sx={{ p: 2 }}><Typography variant="body2">No matching page found.</Typography></Box>}
            <Box sx={{ p: 1.25, borderTop: `1px solid ${colors.primary[500]}` }}><Typography variant="caption" color="text.secondary">Press Enter to open the first page result, or first financial result when no page matches · Esc to close</Typography></Box>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
