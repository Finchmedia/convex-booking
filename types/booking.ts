// Core booking step states
export type BookingStep = "event-meta" | "booking-form" | "success";

// Slot interface
export interface CalcomSlot {
  time: string;      // ISO timestamp: "2024-11-21T14:00:00.000Z"
  attendees?: number; // For future multi-attendee support
}

// Form data collected from user
export interface BookingFormData {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

// Complete booking object (matches extended DB schema)
export interface Booking {
  _id: string;
  uid: string;
  resourceId: string;
  eventTypeId: string;
  start: number;
  end: number;
  timezone: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerNotes?: string;
  eventTitle: string;
  eventDescription?: string;
  location: { type: string; value?: string };
  createdAt: number;
  updatedAt: number;
}

