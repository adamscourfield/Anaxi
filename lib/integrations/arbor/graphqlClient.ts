import { logger } from "@/lib/logger";
import type { ArborCredentials } from "./types";

/**
 * Low-level GraphQL transport for Arbor's API. Implements the documented HTTP
 * contract from the Developer Portal (developers-portal.arbor.sc/pages/graphql,
 * captured 2026-10-01) for real — this part doesn't depend on per-entity field
 * knowledge, only on the mechanics Arbor's own docs spell out:
 *
 * - Endpoint: POST https://{schoolHostname}.uk.arbor.sc/graphql/query
 *   (the sandbox hostname is "api-sandbox"; a live school uses its own subdomain).
 * - Auth: HTTP Basic, same credentials as the GraphQL editor login.
 * - Body: {"query": "<graphql query string>"}, Content-Type: application/json.
 * - Response: standard GraphQL envelope, {data, errors?}. An `errors` entry for a
 *   permission gap reads "You do not have access to `EntityName.propertyName`." —
 *   which names exactly what to add to Anaxi's Arbor permission set.
 * - Pagination inside a query: `page_size` (default 3000, Arbor recommends smaller)
 *   and `page_num` (0-based) as query arguments, e.g. `Student(page_size: 500, page_num: 0)`.
 *   NOTE: this differs from the REST API's pagination params, which use dashes
 *   (`page-size`, `page-number`) instead of underscores — easy to mix up.
 *
 * UNVERIFIED against a live Arbor instance — written from the documented contract,
 * not tested against a sandbox (no credentials/network access yet). Retry/backoff
 * behaviour here is a reasonable default, not something Arbor's docs specify.
 */

export class ArborGraphqlError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ message: string; locations?: Array<{ line: number; column: number }> }>
  ) {
    super(message);
    this.name = "ArborGraphqlError";
  }
}

const MAX_RETRIES = 2;

/** Skips real retry delays under the test suite, same convention as lib/email/send.ts. */
async function backoffDelay(attempt: number): Promise<void> {
  if (process.env.VITEST) return;
  await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
}

function arborGraphqlUrl(schoolHostname: string): string {
  return `https://${schoolHostname}.uk.arbor.sc/graphql/query`;
}

function basicAuthHeader(credentials: ArborCredentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

/**
 * Runs a single GraphQL query string against a school's Arbor instance and returns
 * its `data`. Throws ArborGraphqlError if the response carries an `errors` array
 * (e.g. a permission gap, or a field that doesn't exist on the entity queried).
 */
export async function runArborGraphqlQuery<T = unknown>(
  credentials: ArborCredentials,
  query: string
): Promise<T> {
  const url = arborGraphqlUrl(credentials.schoolHostname);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(credentials),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await backoffDelay(attempt);
        continue;
      }
      throw err;
    }

    if (!response.ok && response.status >= 500 && attempt < MAX_RETRIES) {
      logger.warn("arbor.graphql.retrying", { status: response.status, attempt });
      await backoffDelay(attempt);
      continue;
    }

    const body = (await response.json().catch(() => null)) as
      | { data?: T; errors?: ArborGraphqlError["errors"] }
      | null;

    if (!body) {
      throw new Error(`Arbor GraphQL request failed: HTTP ${response.status}, unreadable response body.`);
    }

    if (body.errors?.length) {
      throw new ArborGraphqlError(
        `Arbor GraphQL query returned ${body.errors.length} error(s): ${body.errors
          .map((e) => e.message)
          .join("; ")}`,
        body.errors
      );
    }

    if (!response.ok) {
      throw new Error(`Arbor GraphQL request failed: HTTP ${response.status}.`);
    }

    return body.data as T;
  }

  throw lastError instanceof Error ? lastError : new Error("Arbor GraphQL request failed after retries.");
}
