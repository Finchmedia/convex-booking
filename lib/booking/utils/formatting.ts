// Format date for display (e.g. "Friday, November 22, 2024")
export const formatDate = (dateStr: string, timezone: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
};

// Format time for display (e.g. "9:30 AM")
export const formatTime = (
  timeStr: string,
  format: "12h" | "24h",
  timezone: string
): string => {
  const date = new Date(timeStr);
  return date.toLocaleTimeString("en-US", {
    hour: format === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: format === "12h",
    timeZone: timezone,
  });
};

// Format duration (e.g. "30m" or "1h 30m")
export const formatDuration = (milliseconds: number): string => {
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
};

// Format full date time
export const formatDateTime = (timestamp: number, timezone: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
};

