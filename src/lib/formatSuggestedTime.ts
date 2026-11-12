// "Suggested time: 5 min". Seconds round up to whole minutes, so it never says 0 min.
export function formatSuggestedTime(seconds: number) {
  return `Suggested time: ${Math.ceil(seconds / 60)} min`
}
