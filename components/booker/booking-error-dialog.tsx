"use client";

import { useRouter } from "next/navigation";
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
}: BookingErrorDialogProps) {
  const router = useRouter();

  const handleAction = () => {
    if (error.recoveryPath === "reset") {
      // Special case: Reset calendar state without navigation
      onReset?.();
    } else {
      // Navigate to recovery path
      router.push(error.recoveryPath);
    }
  };

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

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Booking No Longer Available</AlertDialogTitle>
          <AlertDialogDescription>{error.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAction}>
            {getActionLabel()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
