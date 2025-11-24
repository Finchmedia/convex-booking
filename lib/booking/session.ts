const USER_ID_KEY = "convex-booking-session-id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  
  let id = sessionStorage.getItem(USER_ID_KEY);
  if (!id) {
    // Generate a random ID: timestamp + random string
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

