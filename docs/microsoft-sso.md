# Microsoft school sign-in

Password sign-in remains available, including for `hi@anaxi.io` and all super admins. Microsoft sign-in only opens existing, active staff accounts with an explicitly provisioned Microsoft identity. No accounts or permissions are created from an email claim.

## Deployment

1. In Microsoft Entra, register a **Web** application supporting accounts in any organisational directory (multi-tenant; exclude personal Microsoft accounts).
2. Add `https://YOUR_ANAXI_HOST/api/auth/callback/azure-ad` as a Web redirect URI. For local testing add `http://localhost:3000/api/auth/callback/azure-ad`.
3. Create a client secret. Configure `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` on the server, alongside the existing `NEXTAUTH_URL` and `NEXTAUTH_SECRET`. Restart/redeploy. The button appears only when both Microsoft settings exist. Rotate the secret before it expires.
4. Apply the Prisma migration with `npx prisma migrate deploy`.
5. Have each school's Microsoft administrator consent to the application if required by their policies, and provision staff links below.

## Provision staff identities

Obtain the school's Microsoft **Directory (tenant) ID** and each staff member's **Object ID** from the school's Entra user directory. Match these to existing Anaxi staff by school and email. Use a trusted administrator/database connection to set `User.microsoftTenantId` and `User.microsoftObjectId` on the corresponding existing User row, for example using parameterised SQL:

```sql
UPDATE "User"
SET "microsoftTenantId" = $1, "microsoftObjectId" = $2
WHERE "tenantId" = $3 AND lower("email") = lower($4)
  AND "role" <> 'SUPER_ADMIN' AND lower("email") <> 'hi@anaxi.io';
```

Check that exactly the intended row was updated. Do not take these IDs from an unauthenticated browser or automatically link accounts based on an email claim. Emails identify rows during trusted provisioning; Microsoft tenant/object IDs authenticate subsequent logins. This also survives an email rename. Clear both fields to revoke Microsoft sign-in while keeping password access.

For staff with multiple Anaxi schools, provision the same directory/object ID on each authorised membership. Sign-in opens the first school in stable tenant-ID order; the existing school switcher can select another linked school. Microsoft sessions cannot switch to a membership linked to a different Microsoft identity. Password sessions retain their existing school selection flow.

## Acceptance checks

- A provisioned staff member signs in with Microsoft and receives their existing Anaxi role and school.
- Unprovisioned, inactive, personal Microsoft, and super-admin accounts cannot sign in through Microsoft.
- Duplicate email addresses in other schools do not grant access.
- A linked multi-school staff member can switch to their other linked school; an unlinked membership is denied.
- `hi@anaxi.io` continues signing in with its Anaxi password.
- OAuth cancellation/denial returns to the login screen with feedback.

A real Microsoft redirect/consent test requires an Entra app registration and provisioned test user; local unit tests do not verify Microsoft's live service.
