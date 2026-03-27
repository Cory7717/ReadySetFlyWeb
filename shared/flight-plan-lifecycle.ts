const OVERDUE_CLOSE_GRACE_MINUTES = 30;

export const isFlightPlanCloseOverdue = (
  plannedArrivalAt?: Date | string | null,
  now = new Date(),
) => {
  if (!plannedArrivalAt) return false;
  const arrival = new Date(plannedArrivalAt);
  if (Number.isNaN(arrival.getTime())) return false;
  return now.getTime() > arrival.getTime() + OVERDUE_CLOSE_GRACE_MINUTES * 60 * 1000;
};
