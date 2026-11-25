import { StatusTag, type OnCallStatus } from "./shared";

/** Status pill for an on-call request, with the same wording and colours as the On Call pages. */
export function OnCallStatusBadge({ status }: { status: OnCallStatus; className?: string }) {
  return <StatusTag status={status} />;
}
