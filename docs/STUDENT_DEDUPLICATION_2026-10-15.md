# Student identity consolidation — 15 October 2026

Completed on production: 9 duplicate records merged into 8 surviving student records. Matching required both the normalized full name and normalized phone. Names were not fuzzily matched. The user explicitly excluded the two age-conflict cases below.

The precise old-to-new mapping and student names are retained only in the private database audit, not in this public repository.

Retention scores considered populated student fields plus existing academic and financial history. Missing non-credential fields were filled from the duplicate; existing canonical values won conflicts. Passwords were not copied between auth accounts. Existing student logins resolve through a server-only alias to the retained user identity.

## Preservation and recovery

- All distinct contracts and payments retained their IDs and values. No payment was inferred to be a duplicate merely because its amount matched.
- Roster entries were consolidated per group before removing duplicates, with contract membership references remapped first. Historical membership in other groups remained available; only one active same-course membership is retained.
- Duplicate attendance for a lesson retained its funded record. Two funded records for the same lesson cause the entire merge transaction to abort for manual review.
- Every student foreign key and the legacy references in attendance consumptions, student projects and welcome-message logs were reassigned. A post-run catalog scan found no references to archived duplicate student IDs.
- The committed transaction checked unchanged global contract/payment counts and values, consumption-ledger count, certificate count and evaluation count. It also checked financial-account and attendance-ledger ownership.
- Original students, users, profiles and related rows are retained in `private.student_merge_audit.before_snapshot`, inaccessible to browser roles. Student duplicates are soft-deleted with `merged_into_student_id`, not permanently erased. Restoring a merge requires administrative review of subsequent activity and the snapshots; do not blindly recreate financial entries.
- `scripts/maintenance/merge-exact-student-duplicates.sql` is the reviewed one-time dry-run script. Its final ROLLBACK and expected-plan count are intentional. The individual merge operation is idempotent; the one-time script will refuse a changed plan.

## Left for review, unchanged

- Two exact-name/phone clusters had conflicting ages. All four original records were left unchanged, per the user's decision. Their identities are recorded privately, not here.

## Prevention

Registration preflight covers standard creation, modal creation and lead conversion. A unique database identity registry handles simultaneous requests, and triggers cover later name/phone changes. Phone formatting, Arabic/Persian digits and Egyptian country-prefix variants are normalized. Different children may share a phone if their full names differ. Records without a usable phone cannot be matched safely by this rule.

Database triggers resolve writes from stale forms to the retained student, waiting for an in-flight merge before checking ownership. The private registry and snapshots have RLS enabled with no browser policies or grants by design; service-only operations are explicitly granted.

Verification: 604 unit/integration component tests passed, TypeScript passed, targeted ESLint had no errors, database dry runs passed as both administrative and service roles, and database regressions verify registration, merge replay, login aliases, stale references and age-conflict rejection.
