/** Validates the non-secret parts of the God Mode Arbor connection form. */
export function parseArborConnectionForm(values: {
  schoolHostname: unknown;
  username: unknown;
  password: unknown;
}) {
  const schoolHostname = String(values.schoolHostname ?? "").trim().toLowerCase();
  const username = String(values.username ?? "").trim();
  const password = String(values.password ?? "");

  // Arbor hostnames are subdomains, never full URLs. Restricting this also prevents
  // saved credentials from later being sent to an arbitrary host.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(schoolHostname)) {
    throw new Error("Enter the Arbor school name only, not a web address.");
  }
  if (!username || !password) {
    throw new Error("Both Arbor login values are required.");
  }

  return { schoolHostname, username, password };
}
