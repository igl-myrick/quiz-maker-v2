// Points to at most 2 decimal places: 7.5, 8, 6.33. Shared by the result page's
// headline and the dashboard's result rows, so both read the same way.
export function formatPoints(points: number) {
  return String(Number(points.toFixed(2)))
}
