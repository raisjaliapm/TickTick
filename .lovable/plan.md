# Apple Reminders Sync

## Plan
- Add an iOS-only Reminders connection and list selector using a maintained Capacitor EventKit plugin; explain unavailability on web and Android.
- Store a private per-user mapping between PTT task IDs and Apple reminder IDs with row-level access restricted to the signed-in user.
- Sync regular PTT tasks and their due dates/completion in both directions. Detect native edits when the app is opened/resumed and via an explicit sync action, while guarding against sync loops and preserving unlinked Reminders.
- Add required iOS permission descriptions and document native rebuild steps; verify what can be tested in the browser preview and run applicable checks.

## Technical details
- Use `@ebarooni/capacitor-calendar` EventKit APIs and Capacitor App lifecycle events.
- Never delete unrelated Apple Reminders; removing an app task only removes the mapped reminder.
- Apple-side deletions remove the paired PTT task; conflicts use the latest available update timestamp where supported, otherwise PTT wins for the initial reconciliation.
- Apply the mapping table through the Lovable database migration tool, with grants, RLS, and per-user CRUD policies in the same migration.
- The current project has no checked-in `ios/` directory, so native project generation, permission-plist inclusion, and real-device verification may require the user to export and sync the project.
