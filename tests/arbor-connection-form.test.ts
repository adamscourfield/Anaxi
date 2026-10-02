import { describe, expect, it } from "vitest";
import { parseArborConnectionForm } from "@/lib/integrations/arbor/connectionForm";

describe("Arbor connection form", () => {
  it("normalises a valid Arbor hostname without touching the password", () => {
    expect(parseArborConnectionForm({ schoolHostname: " Goresbrook ", username: " user ", password: " secret " })).toEqual({
      schoolHostname: "goresbrook",
      username: "user",
      password: " secret ",
    });
  });

  it("does not accept a URL as an Arbor hostname", () => {
    expect(() => parseArborConnectionForm({ schoolHostname: "https://example.com", username: "user", password: "secret" })).toThrow(
      "Enter the Arbor school name only"
    );
  });
});
