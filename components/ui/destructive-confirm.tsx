import { ConfirmDialog, type ConfirmDialogProps } from "@/components/ui/confirm-dialog";

/** Destructive confirmations — same as `ConfirmDialog` with danger styling on the primary action. */
export function DestructiveConfirmDialog(props: Omit<ConfirmDialogProps, "variant">) {
  return <ConfirmDialog {...props} variant="danger" />;
}
