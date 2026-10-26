# ezlife26

A full-stack, mobile-friendly life planner. A little better, every day.

## Included

- A daily dashboard with live progress, six life areas, an agenda, quick habit check-ins, and recent files.
- Complete create, read, edit, and delete flows for targets, daily plans, habits, notes, files, and life areas.
- Target progress and deadlines, date-based planning, habit streaks and seven-day history, pinned notes, file previews, downloads, and invoice tracking.
- Private, automatically seeded demo workspaces. Creating an account preserves the current demo and its changes.
- Email/password sign-up and sign-in, scrypt password hashing, opaque HTTP-only sessions, per-user authorization, request validation, same-origin checks, and authentication rate limiting.
- PostgreSQL persistence through Drizzle ORM, including uploaded file content (up to 2 MB per file).
- Optimistic updates with rollback, loading skeletons, empty states, confirmation dialogs, search, filters, reminders, preferences, and JSON export.
- Responsive desktop sidebar and mobile bottom navigation. Installable as a progressive web app on Android and iOS, with an offline connection fallback.

## Stack

Next.js 16 App Router · React 19 · TypeScript · PostgreSQL · Drizzle ORM · Tailwind CSS · Lucide icons · locally served DM Sans and Manrope fonts.

## Development

1. Install dependencies with `npm install`.
2. Set `DATABASE_URL` in `.env` to your PostgreSQL connection string.
3. Apply the database schema with `npx drizzle-kit push` (the provided Drizzle configuration targets the sandbox database).
4. Run `npm run dev`.

The first visit creates a private demo session with six life areas, 13 targets, four daily habits, a realistic daily plan, three notes, and three actual downloadable files. No shared demo credentials are needed.

## Validation

- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npm run build`

With the application running on port 3000, browser checks can be run with:

- `npx playwright install --with-deps chromium`
- `node tests/smoke.mjs`

The smoke suite checks CRUD, persistence, optimistic check-ins, file uploads and downloads, workspace isolation, account conversion, sign-in/sign-out, preferences, global search, and mobile layouts. Use `TEST_BASE_URL` to test a different running deployment.

## Mobile installation

- **Android:** Open ezlife26 in Chrome, then choose **Install app** from the browser menu.
- **iOS/iPadOS:** Open ezlife26 in Safari, tap **Share**, then **Add to Home Screen**.

This is an installable web app, not an App Store/Play Store native binary. A connection is required to load, edit, and sync planner data; the service worker provides a safe offline fallback and does not cache private API responses.

Embedded HTTPS previews use partitioned secure sessions. Standalone sessions use SameSite=Lax cookies. Both are HTTP-only, and writes are protected by same-origin checks.

## Demo media

The seeded family picnic photo is by Kampus Production on Pexels. The PDF estimate and text document are generated sample files, not real invoices or personal records.

## Repeating targets, tasks, and planned moments

Choose **Repeat** in an item editor: does not repeat, daily, weekly, monthly, or yearly.
**Number of repeats** means additional occurrences after the first: 3 repeats saves 4 dated occurrences.
Counts are whole numbers from 0 to 365. Each occurrence has independent progress and completion.
The preview shows the first dates and the final date before saving. Month-end dates and leap years are clamped without drifting.

Editing the repeat schedule reschedules the selected and following occurrences; earlier records remain.
Deleting normally removes only the selected occurrence; the confirmation also offers deletion of the whole series.
All generated occurrences are created in a PostgreSQL transaction, and remain available after refresh and across signed-in devices.

New targets support optional deadlines and life areas. Browser-safe temporary IDs work even if `crypto.randomUUID` is unavailable, and a failed save preserves the form for retry.
