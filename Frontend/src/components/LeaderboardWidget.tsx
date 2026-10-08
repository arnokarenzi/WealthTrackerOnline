import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { tokens } from "../assets/theme";

interface LeaderboardCompetitor {
  id: string;
  name: string;
  gap: number;
  score: number;
}

export interface LeaderboardData {
  shiftDay: number;
  totalDaysInShift: number;
  shiftLetters: number;
  goldTarget: number;
  goldDailyPace: number;
  shiftElapsedDays: number;
  topScore: number;
  serverNowMs: number;
  competitionFinishDay: number;
  userScore: number;
  competitors: LeaderboardCompetitor[];
}

interface Props {
  data: LeaderboardData;
}

interface Entry {
  id: string;
  name: string;
  score: number;
  isUser: boolean;
}

const iconForRank = (rank: number) => {
  if (rank === 1) return <EmojiEventsIcon fontSize="small" />;
  if (rank === 2) return <MilitaryTechIcon fontSize="small" />;
  if (rank === 3) return <WorkspacePremiumIcon fontSize="small" />;
  return null;
};

export default function LeaderboardWidget({ data }: Props) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(() => {
    const serverElapsedSinceFetchDays =
      Math.max(0, nowMs - Number(data.serverNowMs || nowMs)) / 86400000;

    const liveElapsedDays = Math.min(
      Number(data.totalDaysInShift) || 1,
      Math.max(
        0,
        Number(data.shiftElapsedDays || 0) + serverElapsedSinceFetchDays,
      ),
    );

    const liveTopScore = Math.min(
      Number(data.goldTarget) || 0,
      Math.max(
        0,
        (liveElapsedDays + 1) * Number(data.goldDailyPace || 0),
      ),
    );

    const competitors = (data.competitors || []).map((competitor) => ({
      ...competitor,
      score: Math.round(Math.max(0, liveTopScore - Number(competitor.gap || 0))),
    }));

    return {
      liveTopScore: Math.round(liveTopScore),
      competitors,
      elapsedDays: liveElapsedDays,
    };
  }, [data, nowMs]);

  const entries: Entry[] = useMemo(
    () => [
      ...live.competitors.map((competitor) => ({
        id: competitor.id,
        name: competitor.name,
        score: competitor.score,
        isUser: false,
      })),
      {
        id: "user",
        name: "You",
        score: Math.min(
          Number(data.goldTarget) || 0,
          Math.max(0, Number(data.shiftLetters) || 0),
        ),
        isUser: true,
      },
    ],
    [data, live.competitors],
  );

  const ranked = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((entry, index, array) => {
      const firstSameScore = array.findIndex(
        (candidate) => candidate.score === entry.score,
      );

      return {
        ...entry,
        rank: firstSameScore + 1,
        isLeader:
          firstSameScore === 0 && entry.score === live.liveTopScore,
      };
    });
  }, [entries, live.liveTopScore]);

  const userEntry = ranked.find((entry) => entry.isUser);
  const leaderEntry = ranked[0];
  const lettersToLeader = Math.max(
    0,
    Number(leaderEntry?.score || 0) - Number(userEntry?.score || 0),
  );

  const progressToGold = Math.min(
    100,
    (Number(live.liveTopScore || 0) / Math.max(1, Number(data.goldTarget || 1))) *
      100,
  );

  return (
    <Box
      sx={{
        width: "100%",
        mb: 2,
        backgroundColor: colors.primary[400],
        borderRadius: "4px",
        boxShadow: 4,
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmojiEventsIcon
              sx={{ color: colors.greenAccent[500], fontSize: 26 }}
            />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Gold Medal Leaderboard
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: colors.grey[300], mt: 0.4 }}>
            10 competitors • live race • leader finishes 24 hours before the shift deadline
          </Typography>
        </Box>

        <Chip
          label={`Day ${data.shiftDay} of ${data.totalDaysInShift}`}
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
          }}
        />
      </Stack>

      <Box sx={{ mb: 1.5 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mb: 0.5 }}
        >
          <Typography variant="caption" sx={{ color: colors.grey[300] }}>
            Leader benchmark
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {live.liveTopScore.toLocaleString()} / {data.goldTarget.toLocaleString()} letters
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progressToGold}
          sx={{ height: 7, borderRadius: 3 }}
        />
      </Box>

      <Box>
        {ranked.map((entry) => {
          const maxScore = Math.max(1, Number(data.goldTarget || 1));
          const percentage = Math.min(100, (entry.score / maxScore) * 100);
          const rankIcon = iconForRank(entry.rank);

          return (
            <Box
              key={entry.id}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "34px 1fr auto",
                  sm: "42px 1fr 100px auto",
                },
                gap: { xs: 1, sm: 1.5 },
                alignItems: "center",
                p: { xs: 0.9, sm: 1.1 },
                mb: 0.5,
                borderRadius: 1.5,
                backgroundColor: entry.isUser
                  ? "rgba(255,255,255,0.09)"
                  : "rgba(255,255,255,0.025)",
                border: entry.isUser
                  ? `1px solid ${colors.greenAccent[500]}`
                  : "1px solid transparent",
              }}
            >
              <Stack
                direction="row"
                spacing={0.4}
                alignItems="center"
                justifyContent="center"
              >
                {rankIcon}
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 800, textAlign: "center" }}
                >
                  {entry.rank}
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                minWidth={0}
              >
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {entry.isUser ? "YOU" : entry.name.slice(0, 2).toUpperCase()}
                </Avatar>
                <Box minWidth={0} flex={1}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: entry.isUser ? 800 : 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.name}
                    {entry.isLeader ? " • GOLD BENCHMARK" : ""}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                  />
                </Box>
              </Stack>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 800,
                  textAlign: { xs: "right", sm: "right" },
                  minWidth: 70,
                }}
              >
                {entry.score.toLocaleString()}
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  color: colors.grey[300],
                  display: { xs: "none", sm: "block" },
                  textAlign: "right",
                  minWidth: 70,
                }}
              >
                letters
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={0.5}
        sx={{ mt: 1.25 }}
      >
        <Typography variant="caption" sx={{ color: colors.grey[300] }}>
          {lettersToLeader > 0
            ? `${lettersToLeader.toLocaleString()} letters to catch the leader`
            : "You are tied with the leader"}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.grey[300] }}>
          Leader: {Math.round(live.liveTopScore).toLocaleString()} letters
        </Typography>
      </Stack>
    </Box>
  );
}
