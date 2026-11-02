import axios from "axios";

export interface ProductivitySettings {
  weekStartsOn: "monday" | "sunday";
  defaultCalendarView: "day" | "week" | "month";
  defaultFocusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakAfterSessions: number;
  remindersEnabled: boolean;
  focusSoundEnabled: boolean;
  timeZone: string;
  updatedAt: string;
}

export interface ProductivityTask {
  id: number;
  projectId: number | null;
  projectName: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed" | "cancelled";
  priority: "none" | "low" | "medium" | "high";
  dueDate: string | null;
  dueTime: string | null;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  estimatedMinutes: number | null;
  isImportant: boolean;
  isUrgent: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: ProductivitySubtask[];
}

export interface ProductivitySubtask {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductivityProject {
  id: number;
  name: string;
  description: string;
  color: string;
  status: "active" | "completed" | "archived";
  targetDate: string | null;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductivityCalendarEvent {
  id: number;
  title: string;
  description: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductivityCalendarRange {
  startDate: string;
  endDate: string;
  events: ProductivityCalendarEvent[];
  tasks: ProductivityTask[];
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
  color?: string;
}


export interface ProductivityHabitLog {
  id: number;
  habitId: number;
  date: string;
  isCompleted: boolean;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductivityHabitDay {
  date: string;
  isScheduled: boolean;
  isCompleted: boolean;
}

export interface ProductivityHabit {
  id: number;
  name: string;
  description: string;
  category: string;
  frequency: "daily" | "selected_days";
  daysOfWeek: number[];
  color: string;
  status: "active" | "archived";
  todayStatus: "not_scheduled" | "completed" | "pending";
  currentStreak: number;
  completionRate30Days: number;
  completedDays30Days: number;
  scheduledDays30Days: number;
  recentLogs: ProductivityHabitDay[];
  createdAt: string;
  updatedAt: string;
}

export interface HabitInput {
  name: string;
  description?: string | null;
  category?: string | null;
  frequency?: "daily" | "selected_days";
  daysOfWeek?: number[];
  color?: string;
  status?: "active" | "archived";
}

export interface HabitLogInput {
  logDate: string;
  isCompleted: boolean;
  notes?: string | null;
}

export interface ProductivityFocusSession {
  id: number;
  sessionType: "focus" | "short_break" | "long_break";
  status: "completed" | "cancelled";
  taskId: number | null;
  taskTitle: string | null;
  plannedMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string;
  notes: string;
  createdAt: string;
}

export interface FocusSessionInput {
  sessionType: ProductivityFocusSession["sessionType"];
  status: ProductivityFocusSession["status"];
  taskId?: number | null;
  plannedMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string;
  notes?: string | null;
}

export interface ProductivityFocusSummary {
  date: string;
  sessionCount: number;
  completedFocusSessions: number;
  cancelledFocusSessions: number;
  focusSeconds: number;
  focusMinutes: number;
  breakSeconds: number;
}

export interface ProductivitySummary {
  openTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  activeProjects: number;
  completedTasks: number;
  asOfDate: string;
}

export interface ProductivityMyDay {
  date: string;
  overdue: ProductivityTask[];
  today: ProductivityTask[];
  completed: ProductivityTask[];
  totals: { overdue: number; today: number; completed: number };
}

export interface TaskInput {
  title: string;
  description?: string | null;
  projectId?: number | null;
  status?: ProductivityTask["status"];
  priority?: ProductivityTask["priority"];
  dueDate?: string | null;
  dueTime?: string | null;
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  estimatedMinutes?: number | null;
  isImportant?: boolean;
  isUrgent?: boolean;
  sortOrder?: number;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  color?: string;
  status?: ProductivityProject["status"];
  targetDate?: string | null;
}


export interface ProductivityGoalMilestone {
  id: number;
  goalId: number;
  title: string;
  description: string;
  dueDate: string | null;
  isCompleted: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductivityGoal {
  id: number;
  name: string;
  description: string;
  category: string;
  status: "active" | "completed" | "archived";
  startDate: string | null;
  targetDate: string | null;
  progressMode: "milestones" | "manual";
  manualProgress: number;
  progress: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  createdAt: string;
  updatedAt: string;
  milestones?: ProductivityGoalMilestone[];
}

export interface GoalInput {
  name: string;
  description?: string | null;
  category?: string | null;
  status?: ProductivityGoal["status"];
  startDate?: string | null;
  targetDate?: string | null;
  progressMode?: ProductivityGoal["progressMode"];
  manualProgress?: number;
}

export interface GoalMilestoneInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  isCompleted?: boolean;
  sortOrder?: number;
}

export interface ProductivityNote {
  id: number;
  title: string;
  content: string;
  category: string;
  color: string;
  isPinned: boolean;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title?: string | null;
  content: string;
  category?: string | null;
  color?: string;
  isPinned?: boolean;
  status?: ProductivityNote["status"];
}

export interface ProductivityCountdown {
  id: number;
  title: string;
  description: string;
  eventDate: string;
  nextEventDate: string;
  eventTime: string | null;
  category: string;
  color: string;
  recurrence: "none" | "yearly";
  status: "active" | "archived";
  daysRemaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountdownInput {
  title: string;
  description?: string | null;
  eventDate: string;
  eventTime?: string | null;
  category?: string | null;
  color?: string;
  recurrence?: ProductivityCountdown["recurrence"];
  status?: ProductivityCountdown["status"];
}



export interface ProductivityDailyReview {
  id: number;
  reviewDate: string;
  moodRating: number | null;
  energyRating: number | null;
  wins: string;
  challenges: string;
  lessons: string;
  gratitude: string;
  tomorrowPriorities: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReviewInput {
  reviewDate: string;
  moodRating?: number | null;
  energyRating?: number | null;
  wins?: string;
  challenges?: string;
  lessons?: string;
  gratitude?: string;
  tomorrowPriorities?: string;
  notes?: string;
}

export interface ProductivityWeeklyReview {
  id: number;
  weekStart: string;
  weekEnd: string;
  overallRating: number | null;
  wins: string;
  challenges: string;
  lessons: string;
  nextWeekPriorities: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReviewInput {
  weekStart: string;
  overallRating?: number | null;
  wins?: string;
  challenges?: string;
  lessons?: string;
  nextWeekPriorities?: string;
  notes?: string;
}

export interface ProductivityInsightsTrendDay {
  date: string;
  dueTasks: number;
  completedDueTasks: number;
  tasksCompleted: number;
  habitEntries: number;
  habitsCompleted: number;
  focusSessions: number;
  focusMinutes: number;
}

export interface ProductivityInsights {
  startDate: string;
  endDate: string;
  generatedAt: string;
  metrics: {
    dueTasks: number;
    completedDueTasks: number;
    pendingDueTasks: number;
    currentlyOverdueDueTasks: number;
    dueTaskCompletionRate: number | null;
    tasksCompletedInPeriod: number;
    loggedHabitEntries: number;
    completedHabitEntries: number;
    habitLoggedEntryCompletionRate: number | null;
    trackedHabits: number;
    completedFocusSessions: number;
    focusMinutes: number;
    averageFocusMinutes: number;
    activeGoals: number;
    averageActiveGoalProgress: number | null;
    goalsWithTargetInPeriod: number;
    activeProjects: number;
    completedProjects: number;
    dailyReviewsSaved: number;
    weeklyReviewsOverlappingPeriod: number;
  };
  trend: ProductivityInsightsTrendDay[];
  definitions: Record<string, string>;
}

const DEV_API_URL = "http://localhost:5000/api";
const PROD_API_URL = "https://wealthtrackeronline.onrender.com/api";
const baseURL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? DEV_API_URL
    : import.meta.env.VITE_API_BASE_URL || PROD_API_URL;

const client = axios.create({
  baseURL: `${baseURL}/productivity`,
  headers: { "Content-Type": "application/json" },
});

const errorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
  }
  return error instanceof Error ? error.message : fallback;
};

export { errorMessage as productivityErrorMessage };

export const productivityApi = {
  getSettings: async (): Promise<ProductivitySettings> => (await client.get<ProductivitySettings>("/settings")).data,
  updateSettings: async (
    values: Partial<Omit<ProductivitySettings, "timeZone" | "updatedAt">>,
  ): Promise<ProductivitySettings> => (await client.patch<{ settings: ProductivitySettings }>("/settings", values)).data.settings,

  getCalendar: async (startDate: string, endDate: string): Promise<ProductivityCalendarRange> =>
    (await client.get<ProductivityCalendarRange>("/calendar", { params: { startDate, endDate } })).data,
  createCalendarEvent: async (values: CalendarEventInput): Promise<ProductivityCalendarEvent> =>
    (await client.post<{ event: ProductivityCalendarEvent }>("/calendar/events", values)).data.event,
  updateCalendarEvent: async (id: number, values: Partial<CalendarEventInput>): Promise<ProductivityCalendarEvent> =>
    (await client.put<{ event: ProductivityCalendarEvent }>(`/calendar/events/${id}`, values)).data.event,
  deleteCalendarEvent: async (id: number): Promise<void> => { await client.delete(`/calendar/events/${id}`); },


  getHabits: async (includeArchived = false): Promise<ProductivityHabit[]> =>
    (await client.get<{ habits: ProductivityHabit[] }>("/habits", { params: { includeArchived } })).data.habits,
  createHabit: async (values: HabitInput): Promise<ProductivityHabit> =>
    (await client.post<{ habit: ProductivityHabit }>("/habits", values)).data.habit,
  updateHabit: async (id: number, values: Partial<HabitInput>): Promise<ProductivityHabit> =>
    (await client.put<{ habit: ProductivityHabit }>(`/habits/${id}`, values)).data.habit,
  archiveHabit: async (id: number): Promise<void> => { await client.delete(`/habits/${id}`); },
  saveHabitLog: async (id: number, values: HabitLogInput): Promise<ProductivityHabitLog> =>
    (await client.post<{ log: ProductivityHabitLog }>(`/habits/${id}/logs`, values)).data.log,
  deleteHabitLog: async (id: number, date: string): Promise<void> => { await client.delete(`/habits/${id}/logs/${date}`); },
  getHabitLogs: async (id: number, startDate?: string, endDate?: string): Promise<ProductivityHabitLog[]> =>
    (await client.get<{ logs: ProductivityHabitLog[] }>(`/habits/${id}/logs`, { params: { startDate, endDate } })).data.logs,

  getFocusSessions: async (startDate?: string, endDate?: string, limit = 50): Promise<ProductivityFocusSession[]> =>
    (await client.get<{ sessions: ProductivityFocusSession[] }>("/focus/sessions", { params: { startDate, endDate, limit } })).data.sessions,
  getFocusSummary: async (date?: string): Promise<ProductivityFocusSummary> =>
    (await client.get<ProductivityFocusSummary>("/focus/summary", { params: date ? { date } : undefined })).data,
  createFocusSession: async (values: FocusSessionInput): Promise<ProductivityFocusSession> =>
    (await client.post<{ session: ProductivityFocusSession }>("/focus/sessions", values)).data.session,

  getDailyReview: async (date: string): Promise<ProductivityDailyReview | null> =>
    (await client.get<{ reviewDate: string; review: ProductivityDailyReview | null }>("/reviews/daily", { params: { date } })).data.review,
  saveDailyReview: async (values: DailyReviewInput): Promise<ProductivityDailyReview> =>
    (await client.put<{ review: ProductivityDailyReview }>("/reviews/daily", values)).data.review,
  getDailyReviewHistory: async (limit = 30): Promise<ProductivityDailyReview[]> =>
    (await client.get<{ reviews: ProductivityDailyReview[] }>("/reviews/daily/history", { params: { limit } })).data.reviews,
  getWeeklyReview: async (weekStart: string): Promise<ProductivityWeeklyReview | null> =>
    (await client.get<{ review: ProductivityWeeklyReview | null }>("/reviews/weekly", { params: { weekStart } })).data.review,
  saveWeeklyReview: async (values: WeeklyReviewInput): Promise<ProductivityWeeklyReview> =>
    (await client.put<{ review: ProductivityWeeklyReview }>("/reviews/weekly", values)).data.review,
  getWeeklyReviewHistory: async (limit = 20): Promise<ProductivityWeeklyReview[]> =>
    (await client.get<{ reviews: ProductivityWeeklyReview[] }>("/reviews/weekly/history", { params: { limit } })).data.reviews,
  getInsights: async (startDate: string, endDate: string): Promise<ProductivityInsights> =>
    (await client.get<ProductivityInsights>("/insights", { params: { startDate, endDate } })).data,

  getSummary: async (): Promise<ProductivitySummary> => (await client.get<ProductivitySummary>("/summary")).data,
  getMyDay: async (date?: string): Promise<ProductivityMyDay> =>
    (await client.get<ProductivityMyDay>("/my-day", { params: date ? { date } : undefined })).data,

  getTasks: async (filters: {
    search?: string; status?: string; priority?: string; projectId?: number | null;
    date?: string; includeCompleted?: boolean;
  } = {}): Promise<ProductivityTask[]> =>
    (await client.get<{ tasks: ProductivityTask[] }>("/tasks", { params: filters })).data.tasks,
  getTask: async (id: number): Promise<ProductivityTask> =>
    (await client.get<{ task: ProductivityTask }>(`/tasks/${id}`)).data.task,
  createTask: async (values: TaskInput): Promise<ProductivityTask> =>
    (await client.post<{ message: string; task: ProductivityTask }>("/tasks", values)).data.task,
  updateTask: async (id: number, values: Partial<TaskInput>): Promise<ProductivityTask> =>
    (await client.put<{ task: ProductivityTask }>(`/tasks/${id}`, values)).data.task,
  deleteTask: async (id: number): Promise<void> => { await client.delete(`/tasks/${id}`); },

  getProjects: async (includeArchived = false): Promise<ProductivityProject[]> =>
    (await client.get<{ projects: ProductivityProject[] }>("/projects", { params: { includeArchived } })).data.projects,
  createProject: async (values: ProjectInput): Promise<ProductivityProject> =>
    (await client.post<{ project: ProductivityProject }>("/projects", values)).data.project,
  updateProject: async (id: number, values: Partial<ProjectInput>): Promise<ProductivityProject> =>
    (await client.put<{ project: ProductivityProject }>(`/projects/${id}`, values)).data.project,
  archiveProject: async (id: number): Promise<void> => { await client.delete(`/projects/${id}`); },


  getGoals: async (includeArchived = false, search = ""): Promise<ProductivityGoal[]> =>
    (await client.get<{ goals: ProductivityGoal[] }>("/goals", { params: { includeArchived, search: search || undefined } })).data.goals,
  getGoal: async (id: number): Promise<ProductivityGoal> =>
    (await client.get<{ goal: ProductivityGoal }>(`/goals/${id}`)).data.goal,
  createGoal: async (values: GoalInput): Promise<ProductivityGoal> =>
    (await client.post<{ goal: ProductivityGoal }>("/goals", values)).data.goal,
  updateGoal: async (id: number, values: Partial<GoalInput>): Promise<ProductivityGoal> =>
    (await client.put<{ goal: ProductivityGoal }>(`/goals/${id}`, values)).data.goal,
  archiveGoal: async (id: number): Promise<void> => { await client.delete(`/goals/${id}`); },
  createGoalMilestone: async (goalId: number, values: GoalMilestoneInput): Promise<ProductivityGoalMilestone> =>
    (await client.post<{ milestone: ProductivityGoalMilestone }>(`/goals/${goalId}/milestones`, values)).data.milestone,
  updateGoalMilestone: async (id: number, values: Partial<GoalMilestoneInput>): Promise<ProductivityGoalMilestone> =>
    (await client.put<{ milestone: ProductivityGoalMilestone }>(`/milestones/${id}`, values)).data.milestone,
  deleteGoalMilestone: async (id: number): Promise<void> => { await client.delete(`/milestones/${id}`); },

  getNotes: async (includeArchived = false, search = ""): Promise<ProductivityNote[]> =>
    (await client.get<{ notes: ProductivityNote[] }>("/notes", { params: { includeArchived, search: search || undefined } })).data.notes,
  createNote: async (values: NoteInput): Promise<ProductivityNote> =>
    (await client.post<{ note: ProductivityNote }>("/notes", values)).data.note,
  updateNote: async (id: number, values: Partial<NoteInput>): Promise<ProductivityNote> =>
    (await client.put<{ note: ProductivityNote }>(`/notes/${id}`, values)).data.note,
  archiveNote: async (id: number): Promise<void> => { await client.delete(`/notes/${id}`); },

  getCountdowns: async (includeArchived = false, search = ""): Promise<ProductivityCountdown[]> =>
    (await client.get<{ countdowns: ProductivityCountdown[] }>("/countdowns", { params: { includeArchived, search: search || undefined } })).data.countdowns,
  createCountdown: async (values: CountdownInput): Promise<ProductivityCountdown> =>
    (await client.post<{ countdown: ProductivityCountdown }>("/countdowns", values)).data.countdown,
  updateCountdown: async (id: number, values: Partial<CountdownInput>): Promise<ProductivityCountdown> =>
    (await client.put<{ countdown: ProductivityCountdown }>(`/countdowns/${id}`, values)).data.countdown,
  archiveCountdown: async (id: number): Promise<void> => { await client.delete(`/countdowns/${id}`); },

  createSubtask: async (taskId: number, values: { title: string; isCompleted?: boolean; sortOrder?: number }): Promise<ProductivitySubtask> =>
    (await client.post<{ subtask: ProductivitySubtask }>(`/tasks/${taskId}/subtasks`, values)).data.subtask,
  updateSubtask: async (id: number, values: Partial<Pick<ProductivitySubtask, "title" | "isCompleted" | "sortOrder">>): Promise<ProductivitySubtask> =>
    (await client.put<{ subtask: ProductivitySubtask }>(`/subtasks/${id}`, values)).data.subtask,
  deleteSubtask: async (id: number): Promise<void> => { await client.delete(`/subtasks/${id}`); },
};
