"use client";

import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ValidationError } from "@/lib/hooks/use-booking-validation";

interface BookingErrorDialogProps {
  error: ValidationError;
  onReset?: () => void; // Called for duration_invalid case
  onEventTypeReset?: () => void; // Called for event_deleted/deactivated/unlinked (state-based navigation)
}

/**
 * Blocking error dialog for mid-booking validation failures.
 * Uses AlertDialog (non-dismissible) to force user action.
 *
 * Recovery actions:
 * - event_deleted / event_deactivated / resource_unlinked → Navigate to resource selection
 * - resource_deleted / resource_deactivated → Navigate to resource list
 * - duration_invalid → Reset calendar to default duration
 */
export function BookingErrorDialog({
  error,
  onReset,
  onEventTypeReset,
}: BookingErrorDialogProps) {

  const getActionLabel = () => {
    switch (error.type) {
      case "event_deleted":
      case "event_deactivated":
      case "resource_unlinked":
        return "Back to Event Selection";
      case "resource_deleted":
      case "resource_deactivated":
        return "Back to Resources";
      case "duration_invalid":
        return "Reset Calendar";
      default:
        return "Continue";
    }
  };

  // Determine action type:
  // - duration_invalid: Reset calendar state
  // - event_deleted/deactivated/unlinked: Reset to event selection (state-based, no navigation)
  // - resource_deleted/deactivated: Navigate to /book (different page)
  const isResetAction = error.recoveryPath === "reset";
  const isEventTypeAction =
    error.type === "event_deleted" ||
    error.type === "event_deactivated" ||
    error.type === "resource_unlinked";

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Booking No Longer Available</AlertDialogTitle>
          <AlertDialogDescription>{error.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isResetAction ? (
            <AlertDialogAction onClick={onReset}>
              {getActionLabel()}
            </AlertDialogAction>
          ) : isEventTypeAction && onEventTypeReset ? (
            <AlertDialogAction onClick={onEventTypeReset}>
              {getActionLabel()}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction asChild>
              <Link href={error.recoveryPath}>{getActionLabel()}</Link>
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
