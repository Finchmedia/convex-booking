import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EventMetaPanel } from "@/components/booking-calendar/event-meta-panel";
import {
  BookingFormData,
  BookingFormValues,
  bookingFormSchema,
} from "@/lib/booking/validation";
import { formatDate, formatTime } from "@/lib/booking/utils/formatting";
import { Spinner } from "@/components/ui/spinner";

// Define a local interface for EventType to match EventMetaPanel's expectation
interface EventType {
  title: string;
  description?: string;
  lengthInMinutes: number;
  lengthInMinutesOptions?: number[];
  locations: Array<{
    type: string;
    address?: string;
    public?: boolean;
  }>;
  timezone: string;
  lockTimeZoneToggle: boolean;
}

interface BookingFormProps {
  eventType: EventType;
  selectedSlot: string; // ISO timestamp
  selectedDuration: number;
  timezone: string;
  onSubmit: (data: BookingFormData) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  eventType,
  selectedSlot,
  selectedDuration,
  timezone,
  onSubmit,
  onBack,
  isSubmitting,
}) => {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Left: Event Summary (reuse EventMetaPanel with read-only variant) */}
      <EventMetaPanel
        eventType={eventType}
        selectedDuration={selectedDuration}
        onDurationChange={() => {}} // No-op in read-only
        userTimezone={timezone}
        onTimezoneChange={() => {}} // No-op in read-only
        timezoneLocked={true}
        readOnly={true} // NEW: Hide interactive controls
      />

      {/* Right: Booking Form */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-neutral-100">
            Enter Details
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            {formatDate(selectedSlot, timezone)} at{" "}
            {formatTime(selectedSlot, "12h", timezone)}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      {...field}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:ring-neutral-500 focus:border-neutral-500"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">Email *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="john@example.com"
                      type="email"
                      {...field}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:ring-neutral-500 focus:border-neutral-500"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center px-4 py-2 border border-neutral-700 rounded-md shadow-sm text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center px-4 py-2 border border-neutral-700 rounded-md shadow-sm text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                <svg
                  className="h-5 w-5 mr-2 text-neutral-100"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.88-.01-1.73-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.016 10.016 0 0022 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Sign in with GitHub
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-neutral-900 text-neutral-400">
                  Or continue with email
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">
                    Phone Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      type="tel"
                      {...field}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:ring-neutral-500 focus:border-neutral-500"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">
                    Additional Notes
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please share anything that will help prepare for our meeting."
                      {...field}
                      rows={4}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100 focus:ring-neutral-500 focus:border-neutral-500 resize-none"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="flex-1 border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-2">Confirming...</span>
                  </div>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
