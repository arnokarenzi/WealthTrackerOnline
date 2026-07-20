import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  TextField,
  Button,
  CircularProgress,
  Alert,
  IconButton, // Added for Delete button
} from "@mui/material";
import { DeleteOutline } from "@mui/icons-material"; // Added icon
import { tokens } from "../../assets/theme";
import { financeApi } from "../../services/api";

interface SavingsGoal {
  id: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
}

export default function SavingsGoals() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [amountsToAdd, setAmountsToAdd] = useState<{ [key: number]: string }>(
    {},
  );
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await financeApi.getSavingsGoals();
      setGoals(response);
    } catch (err) {
      setError("Failed to fetch goals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreateGoal = async () => {
    if (!newGoalName || !newGoalTarget) return;
    try {
      await financeApi.createSavingsGoal({
        goalName: newGoalName,
        targetAmount: Number(newGoalTarget),
      });
      setNewGoalName("");
      setNewGoalTarget("");
      fetchGoals();
    } catch (err) {
      setError("Failed to create goal.");
    }
  };

  const handleAddFunds = async (id: number) => {
    const amount = amountsToAdd[id];
    if (!amount) return;
    try {
      await financeApi.updateSavingsGoal(id, { amountToAdd: amount });
      setAmountsToAdd({ ...amountsToAdd, [id]: "" });
      fetchGoals();
    } catch (err) {
      setError("Failed to update goal.");
    }
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      await financeApi.deleteSavingsGoal(id);
      fetchGoals();
    } catch (err) {
      setError("Failed to delete goal.");
    }
  };

  // Sort goals: Active first, Completed last
  const sortedGoals = [...goals].sort((a, b) => {
    const aCompleted = Number(a.currentAmount) >= Number(a.targetAmount);
    const bCompleted = Number(b.currentAmount) >= Number(b.targetAmount);
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;
    return 0;
  });

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Savings Goals
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          mb: 4,
          p: 2,
          backgroundColor: colors.primary[400],
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          Create New Goal
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            label="Goal Name"
            size="small"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
          />
          <TextField
            label="Target Amount"
            size="small"
            type="number"
            value={newGoalTarget}
            onChange={(e) => setNewGoalTarget(e.target.value)}
          />
          <Button variant="contained" onClick={handleCreateGoal}>
            Create
          </Button>
        </Box>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={3}>
          {sortedGoals.map((goal) => {
            // FIXED: Explicitly convert to Number to prevent string comparison bugs
            const isCompleted =
              Number(goal.currentAmount) >= Number(goal.targetAmount);
            const progress = Math.min(
              (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100,
              100,
            );

            return (
              <Grid item xs={12} md={6} lg={4} key={goal.id}>
                <Card
                  sx={{
                    backgroundColor: colors.primary[400],
                    p: 2,
                    opacity: isCompleted ? 0.6 : 1,
                    filter: isCompleted ? "grayscale(100%)" : "none",
                    position: "relative",
                  }}
                >
                  {/* Delete Button */}
                  <Box sx={{ position: "absolute", top: 8, right: 8 }}>
                    <IconButton
                      onClick={() => handleDeleteGoal(goal.id)}
                      size="small"
                    >
                      <DeleteOutline color="error" />
                    </IconButton>
                  </Box>

                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                      {goal.goalName}
                    </Typography>
                    <Typography
                      variant="h6"
                      color={
                        isCompleted ? "text.secondary" : colors.greenAccent[500]
                      }
                      sx={{ mb: 2 }}
                    >
                      {Number(goal.currentAmount).toLocaleString()} /{" "}
                      {Number(goal.targetAmount).toLocaleString()} RWF
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      color={isCompleted ? "success" : "primary"}
                      sx={{ height: 10, borderRadius: 5, mb: 2 }}
                    />
                    <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                      <TextField
                        size="small"
                        type="number"
                        placeholder="Amount"
                        disabled={isCompleted}
                        value={amountsToAdd[goal.id] || ""}
                        onChange={(e) =>
                          setAmountsToAdd({
                            ...amountsToAdd,
                            [goal.id]: e.target.value,
                          })
                        }
                      />
                      <Button
                        variant="contained"
                        disabled={isCompleted}
                        onClick={() => handleAddFunds(goal.id)}
                      >
                        {isCompleted ? "Completed" : "Add"}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
