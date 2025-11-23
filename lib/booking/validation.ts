import { z } from "zod";

export const bookingFormSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string().optional(),
  notes: z.string()
    .max(500, "Notes must be 500 characters or less")
    .optional(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

