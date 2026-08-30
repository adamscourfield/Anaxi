-- "LEAVE_OF_ABSENCE" was a legacy duplicate of the "LEAVE" feature key left
-- over from before the flag was renamed. No requireFeature() gate anywhere
-- in the app checks it, so it was pure dead weight -- an inert toggle in
-- Admin -> Feature flags with no friendly name and no effect.
DELETE FROM "TenantFeature" WHERE "key" = 'LEAVE_OF_ABSENCE';
