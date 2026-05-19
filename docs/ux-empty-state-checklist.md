# Empty state audit checklist (UX-152)

Routes under `app/(tenant)` should show a branded empty state with a clear next step when lists have zero rows.

| Route | Component | CTA | Status |
|-------|-----------|-----|--------|
| `/home` | inline cards | Explore / observe | OK |
| `/my-actions` | `EmptyState` | — | Reference |
| `/meetings` | `EmptyState` | Schedule meeting | OK |
| `/explorer/students` | `DataTableEmpty` | Clear filters | OK |
| `/explorer/teachers` | table message | — | Partial |
| `/observe/history` | inline | New observation | OK |
| `/leave` | inline | Request leave | OK |
| `/leave/history` | table message | — | OK |
| `/admin/users` | table + mobile | Add user (modal) | OK |
| `/assessments` | `DataTableEmpty` | New cycle | OK |
| `/assessments/triangulation` | `DataTableEmpty` | — | OK |
| `/on-call` | varies | New on-call | Review |
| `/students/my` | table message | — | Review |

**Gap process:** file a `UX-###` sub-issue or fix in the same PR when a route shows a bare “No results” string without CTA.
