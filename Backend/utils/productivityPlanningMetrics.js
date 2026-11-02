const dateOnly = (date) => new Date(`${date}T00:00:00.000Z`);

export const differenceInCalendarDays = (fromDate, toDate) =>
  Math.round((dateOnly(toDate).getTime() - dateOnly(fromDate).getTime()) / 86400000);

export const getNextCountdownDate = (eventDate, recurrence, today) => {
  if (recurrence !== "yearly") return eventDate;
  const [, monthText, dayText] = eventDate.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  const currentYear = Number(today.slice(0, 4));
  const makeDate = (year) => {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${monthText}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  };
  const thisYear = makeDate(currentYear);
  return thisYear < today ? makeDate(currentYear + 1) : thisYear;
};

export const calculateGoalProgress = ({ status, progressMode, manualProgress, milestoneCount, completedMilestoneCount }) => {
  if (status === "completed") return 100;
  if (progressMode === "manual") return Math.min(100, Math.max(0, Number(manualProgress) || 0));
  const total = Number(milestoneCount) || 0;
  if (total <= 0) return 0;
  return Math.round(((Number(completedMilestoneCount) || 0) / total) * 100);
};
