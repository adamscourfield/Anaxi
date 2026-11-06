# Daily Arbor attendance

The primary trigger is Vercel Cron (`vercel.json`), calling the protected
`/api/cron/arbor-attendance` endpoint daily at 01:17 UTC. This is 01:17 GMT
or 02:17 BST. On Hobby, Vercel can invoke it anywhere within that hour;
this is an early overnight window, not a guaranteed exact start time.
The existing production `CRON_SECRET` authenticates the request.
The attendance worker is called through the public `NEXTAUTH_URL` origin,
because deployment URLs can require Vercel sign-in. Worker authentication
still requires the same cron secret.

The independent `Arbor attendance fallback` GitHub workflow runs at 04:17 UTC
(04:17 GMT / 05:17 BST). It has its own concurrency group, so assessment
catalogue and historic timetable jobs cannot queue ahead of it. It can also
be dispatched manually. GitHub scheduling may itself be delayed; this is a
fallback, not the primary timing mechanism.

Each protected call imports up to seven completed days, then subsequent calls
return `upToDate`. The fallback checks each connection's JSON response, retries
rate limits, and exits once every connection confirms it is current. It fails
rather than silently accepting login HTML, import errors or an unfinished
backlog. The normal nightly workflow no longer imports attendance on its
scheduled runs; its explicit `scope=attendance` manual option remains available.

The homepage keeps the last complete import and labels the reporting date
while the next daily update is pending. This is completed-day lesson attendance,
not a live register or statutory AM/PM attendance. Missing dates within a
reporting period still prevent a percentage from being displayed.

After deployment, verify the Vercel project's cron definitions include the
attendance path and schedule, test the protected endpoint via the fallback,
and check the recorded date on the live homepage. Registration and a manual
test do not prove the next overnight invocation has run: check Vercel's Cron
logs after the next scheduled window if investigating freshness again.

## Half-day calculation (sync version 4)

The agreed session boundary is 12:00 Europe/London for both schools. A pupil
contributes at most one AM and one PM session per date. Any statistical present
or approved-activity evidence in an eligible lesson marks that session attended.
Repeated lessons do not add denominator units. Known eligible absence evidence
counts once when no present or incomplete evidence exists in that session.
Missing marks, missing timestamps and unavailable registers are never invented
as absences. Unknown sessions are excluded and counted separately in the daily
audit aggregate. Non-counting codes remain outside the denominator.

These are half-day inferences from lesson marks, not Arbor statutory roll-call
records. In particular, later presence can differ from the official registration
code. User-facing dashboard labels remain unchanged. The underlying lesson
source remains identified by the existing dashboard label.

Version 4 replays the current academic year from 1 September. Each day's
independent totals are tagged AM_PM, so the homepage cannot sum old per-lesson
totals together with new half-day totals. The fallback allows sixteen bounded
batches, enough to rebuild the current academic-year backlog, and must confirm
upToDate before reporting success.
