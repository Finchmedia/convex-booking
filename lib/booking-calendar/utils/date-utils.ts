export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Helper function to get date string in local timezone
// Format time based on preference and user's timezone
export const formatTime = (
  timeString: string,
  timeFormat: '12h' | '24h',
  timezone: string
) => {
  const date = new Date(timeString);

  // Ensure we're displaying in user's selected timezone
  if (timeFormat === '24h') {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  }
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
};

export interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasSlots: boolean;
  disabled: boolean;
}

// Generate calendar days for a given month
export const generateCalendarDays = (
  currentDate: Date,
  selectedDate: Date | null,
  monthSlots: Record<string, boolean>
): CalendarDay[] => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);

  // Adjust to Monday start (getDay() returns 0 for Sunday)
  const dayOffset = (firstDay.getDay() + 6) % 7;
  startDate.setDate(firstDay.getDate() - dayOffset);

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const isCurrentMonth = date.getMonth() === month;
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSelected =
      !!selectedDate && date.getTime() === selectedDate.getTime();

    // Check if this date has available slots using O(1) Set lookup
    const dateStr = date.toISOString().split('T')[0];
    const hasSlots = Boolean(monthSlots[dateStr]);

    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth,
      isPast,
      isToday,
      isSelected,
      hasSlots,
      disabled: isPast || !isCurrentMonth,
    });
  }

  return days;
};
