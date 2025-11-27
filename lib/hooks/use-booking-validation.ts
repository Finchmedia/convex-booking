import { useMemo } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

export type ValidationErrorType =
  | "event_deleted"
  | "event_deactivated"
  | "resource_deleted"
  | "resource_deactivated"
  | "duration_invalid"
  | "resource_unlinked";

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  recoveryPath: string;
}

export interface ValidationResult {
  status: "loading" | "valid" | "error";
  error?: ValidationError;
}

/**
 * Validates booking flow state reactively.
 * Monitors event type, resource, and link state for mid-booking changes.
 *
 * @param eventType - Event type query result (may be null/undefined)
 * @param resource - Resource query result (may be null/undefined)
 * @param hasLink - Link state query result (may be null/undefined)
 * @param selectedDuration - Currently selected duration in minutes
 * @param resourceId - Resource ID for recovery path
 * @returns Validation result with status and optional error
 */
export function useBookingValidation(
  eventType: Doc<"event_types"> | null | undefined,
  resource: Doc<"resources"> | null | undefined,
  hasLink: boolean | null | undefined,
  selectedDuration: number,
  resourceId: string
): ValidationResult {
  return useMemo(() => {
    // Loading state: any query is still loading
    if (eventType === undefined || resource === undefined || hasLink === undefined) {
      return { status: "loading" };
    }

    // 1. Event type deleted
    if (eventType === null) {
      return {
        status: "error",
        error: {
          type: "event_deleted",
          message: "This event type has been deleted and is no longer available for booking.",
          recoveryPath: `/book/${resourceId}`,
        },
      };
    }

    // 2. Event type deactivated
    if (eventType.isActive === false) {
      return {
        status: "error",
        error: {
          type: "event_deactivated",
          message: "This event type has been deactivated and is no longer available for booking.",
          recoveryPath: `/book/${resourceId}`,
        },
      };
    }

    // 3. Resource deleted
    if (resource === null) {
      return {
        status: "error",
        error: {
          type: "resource_deleted",
          message: "This resource has been deleted and is no longer available for booking.",
          recoveryPath: "/book",
        },
      };
    }

    // 4. Resource deactivated
    if (resource.isActive === false) {
      return {
        status: "error",
        error: {
          type: "resource_deactivated",
          message: "This resource has been deactivated and is no longer available for booking.",
          recoveryPath: "/book",
        },
      };
    }

    // 5. Selected duration removed from options
    const availableDurations = eventType.lengthInMinutesOptions?.length
      ? eventType.lengthInMinutesOptions
      : [eventType.lengthInMinutes];

    if (!availableDurations.includes(selectedDuration)) {
      return {
        status: "error",
        error: {
          type: "duration_invalid",
          message: "The selected booking duration is no longer available. Please select a new duration.",
          recoveryPath: "reset", // Special value to signal calendar reset
        },
      };
    }

    // 6. Resource unlinked from event type
    if (hasLink === false) {
      return {
        status: "error",
        error: {
          type: "resource_unlinked",
          message: "This resource is no longer available for this event type.",
          recoveryPath: `/book/${resourceId}`,
        },
      };
    }

    // All validations passed
    return { status: "valid" };
  }, [eventType, resource, hasLink, selectedDuration, resourceId]);
}
