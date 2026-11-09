export function formatDiaryCardDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(date).toUpperCase();
}
