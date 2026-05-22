import type { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/apiErrors";

export type ApiRouteContext = { params: Promise<Record<string, string>> };

export function withApi<T = ApiRouteContext>(
  handler: (req: NextRequest | Request, context: T) => Promise<Response>,
) {
  return async (req: NextRequest | Request, context: T) => {
    try {
      return await handler(req, context);
    } catch (err) {
      return apiErrorResponse(err);
    }
  };
}
