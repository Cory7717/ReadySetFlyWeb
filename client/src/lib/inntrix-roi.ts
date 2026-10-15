export type LaborRoiInputs = {
  currentWeeklyHours: number;
  targetWeeklyHours: number;
  hourlyLaborCost: number;
  monthlySubscription: number;
};

const nonNegativeNumber = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function calculateLaborRoi(inputs: LaborRoiInputs) {
  const currentWeeklyHours = nonNegativeNumber(inputs.currentWeeklyHours);
  const targetWeeklyHours = nonNegativeNumber(inputs.targetWeeklyHours);
  const hourlyLaborCost = nonNegativeNumber(inputs.hourlyLaborCost);
  const monthlySubscription = nonNegativeNumber(inputs.monthlySubscription);
  const weeklyHoursSaved = Math.max(
    0,
    currentWeeklyHours - targetWeeklyHours,
  );
  const annualizedHoursSaved = weeklyHoursSaved * 52;
  const estimatedWeeklyLaborSavings = weeklyHoursSaved * hourlyLaborCost;
  const estimatedAnnualLaborSavings = estimatedWeeklyLaborSavings * 52;
  const estimatedAnnualSubscriptionExpense = monthlySubscription * 12;
  const estimatedAnnualNetBenefit =
    estimatedAnnualLaborSavings - estimatedAnnualSubscriptionExpense;

  return {
    currentWeeklyHours,
    targetWeeklyHours,
    hourlyLaborCost,
    monthlySubscription,
    weeklyHoursSaved,
    annualizedHoursSaved,
    estimatedWeeklyLaborSavings,
    estimatedAnnualLaborSavings,
    estimatedAnnualSubscriptionExpense,
    estimatedAnnualNetBenefit,
  };
}
