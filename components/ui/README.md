# Shared UI components

## Reference implementations

- **`/my-actions`** — canonical list page: ledger `PageHeader`, KPI `StatCard` row, filter panel, and sectioned action lists with empty states.
- **`PageHeader`** (`page-header.tsx`) — use `variant="ledger"` for all tenant page titles.
- **`Breadcrumb`** (`breadcrumb.tsx`) — section navigation with `aria-current="page"`.
- **`FormField`** (`form-field.tsx`) — label, control, hint, and inline error slot using `.field` styles.
- **`TableScrollRegion`** (`table-scroll-region.tsx`) — horizontal tables with mobile scroll hint.
- **`TablePagination`** (`table-pagination.tsx`) — list/table footer pagination (matches user directory); use `pageHref` for server pages or `onPageChange` for client state.

## Mutation feedback (UX-040)

- **Success:** call `toast(message, "success")` from `@/components/toast-provider`, or redirect with `?created=1` and show a one-time banner on the destination page.
- **Validation errors:** return field-level errors from server actions and render via `FormField` `error` prop.
- **Pending:** disable primary submit buttons while `useFormStatus().pending` or local `isPending` is true.
