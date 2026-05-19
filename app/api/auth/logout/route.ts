import { NextResponse } from "next/server";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  return NextResponse.redirect(new URL("/login/sign-out", req.url));
});
