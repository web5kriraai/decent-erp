export function aggregateCompletionTotals(
  employees: Array<{
    activeSeconds: number;
    holdSeconds: number;
    totalElapsedSeconds: number;
  }>,
) {
  return {
    peopleCount: employees.length,
    totalActiveSeconds: employees.reduce((sum, e) => sum + e.activeSeconds, 0),
    totalHoldSeconds: employees.reduce((sum, e) => sum + e.holdSeconds, 0),
    totalElapsedSeconds: employees.reduce((sum, e) => sum + e.totalElapsedSeconds, 0),
  };
}
