import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ArborGraphqlError, runArborGraphqlQuery } from "@/lib/integrations/arbor/graphqlClient";

const fetchMock = vi.fn();
const credentials = { schoolHostname: "api-sandbox", username: "app-user", password: "app-pass" };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runArborGraphqlQuery", () => {
  it("posts to the school's subdomain with Basic auth and the query body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Student: [] } }),
    });

    await runArborGraphqlQuery(credentials, "{ Student { id } }");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.uk.arbor.sc/graphql/query");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("app-user:app-pass").toString("base64")}`
    );
    expect(JSON.parse(init.body)).toEqual({ query: "{ Student { id } }" });
  });

  it("returns the data object on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Student: [{ id: "1" }] } }),
    });

    const data = await runArborGraphqlQuery<{ Student: Array<{ id: string }> }>(
      credentials,
      "{ Student { id } }"
    );
    expect(data.Student).toEqual([{ id: "1" }]);
  });

  it("throws ArborGraphqlError naming the missing entity/field on a permission error", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: "You do not have access to `Guardian.displayName`." }],
      }),
    });

    await expect(runArborGraphqlQuery(credentials, "{ Guardian { displayName } }")).rejects.toThrow(
      ArborGraphqlError
    );
    await expect(runArborGraphqlQuery(credentials, "{ Guardian { displayName } }")).rejects.toThrow(
      /Guardian\.displayName/
    );
  });

  it("retries once on a 500 and succeeds on the second attempt", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { Staff: [] } }) });

    const data = await runArborGraphqlQuery<{ Staff: unknown[] }>(credentials, "{ Staff { id } }");
    expect(data.Staff).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a 4xx and throws", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });

    await expect(runArborGraphqlQuery(credentials, "{ Staff { id } }")).rejects.toThrow(/HTTP 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
