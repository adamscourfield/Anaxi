function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Build a minimal VCALENDAR for a single meeting invite. */
export function buildMeetingIcs(options: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
}): string {
  const now = formatIcsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Anaxi//Meeting Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${options.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsUtc(options.start)}`,
    `DTEND:${formatIcsUtc(options.end)}`,
    `SUMMARY:${escapeIcsText(options.title)}`,
    `ORGANIZER;CN=${escapeIcsText(options.organizerName)}:mailto:${options.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(options.attendeeName)};RSVP=TRUE:mailto:${options.attendeeEmail}`,
  ];
  if (options.description) lines.push(`DESCRIPTION:${escapeIcsText(options.description)}`);
  if (options.location) lines.push(`LOCATION:${escapeIcsText(options.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
