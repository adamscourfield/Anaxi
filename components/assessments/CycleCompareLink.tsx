import Link from "next/link";
import { Button } from "@/components/ui/button";

type PointRef = { id: string; entryCount: number };

type Props = {
  cycleId: string;
  points: PointRef[];
};

/** Compare link when at least two points have uploaded data. */
export function CycleCompareLink({ cycleId, points }: Props) {
  const withData = points.filter((p) => p.entryCount > 0);
  if (withData.length < 2) return null;

  const from = withData[withData.length - 2]!.id;
  const to = withData[withData.length - 1]!.id;

  return (
    <Button asChild variant="secondary" className="h-8 py-0 text-xs">
      <Link href={`/assessments/${cycleId}/compare?from=${from}&to=${to}`}>Compare points</Link>
    </Button>
  );
}
