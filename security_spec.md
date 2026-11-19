# Security Specification for Life Reset

## Data Invariants
1. A user can only access, create, read, update, or delete their own documents.
2. All personal items (tasks, goals, habits, weekly blueprints, daily notes, focus sessions) are sub-resources strictly scoped under `/users/{userId}/`.
3. An unauthenticated user cannot read or write any user data.
4. User A cannot view or manipulate User B's tasks or goals under any condition.
5. All document IDs must adhere to safe alphanumeric identifiers (`isValidId`).

## Dirty Dozen Attack Payloads
1. Cross-Tenant Read: User B querying `/users/userA/tasks` (Must return PERMISSION_DENIED).
2. Unauthenticated Write: Anonymous post to `/users/userA/tasks/task-1` (Must return PERMISSION_DENIED).
3. Cross-Tenant Update: User B attempting to mark User A's task as complete (Must return PERMISSION_DENIED).
4. ID Poisoning: Inserting 10KB string document ID into task path (Must return PERMISSION_DENIED).
5. Cross-Tenant Goal Deletion: User B attempting to delete `/users/userA/goals/goal-1` (Must return PERMISSION_DENIED).
6. Cross-Tenant Habit Tampering: User B toggling User A's streaks (Must return PERMISSION_DENIED).
7. Cross-Tenant Note Snooping: User B reading User A's daily brain dump (Must return PERMISSION_DENIED).
8. Global Document Scraping: Broad collectionGroup query across all users (Must return PERMISSION_DENIED).
9. Root Bypass Attack: Direct write to arbitrary root collection (Must return PERMISSION_DENIED via catch-all).
10. Impersonation Profile Write: User B overwriting `/users/userA` profile details (Must return PERMISSION_DENIED).
11. Unauthenticated Profile Creation: Calling write on `/users/userA` without credentials (Must return PERMISSION_DENIED).
12. Session Log Tampering: User B attempting to log or delete focus sessions for User A (Must return PERMISSION_DENIED).
