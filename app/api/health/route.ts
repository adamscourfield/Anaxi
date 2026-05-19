import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Liveness/readiness probe for load balancers (no auth). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
