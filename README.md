# Time Logger for SpoofHub

An independent, unofficial tool. It is not affiliated with, endorsed by or supported by the vendor of the project-management service it connects to; it only uses the API key that each user obtains from their own account.

A single-page app for logging time against SpoofHub tasks without the SpoofHub UI: one flat list of your tasks, expand any of them, add as many time entries as you like across several tasks, then press **Save all** once.

Works with any SpoofHub account: each user enters their own SpoofHub address at sign-in. The browser talks directly to the SpoofHub v3 API — there is no backend.

## What it does

- Lists open tasks across all your projects (or one project), filtered to *assigned to me*, *mine + unassigned* or *unassigned only*. Unassigned tasks are clearly badged.
- Expand a task to see your recent entries on it and add new ones: date, hours, minutes, description, timesheet, billable status. `Enter` in the description adds another row.
- Edit or delete your existing entries inline.
- Keep several tasks expanded with unsaved rows; the footer shows the total and one **Save all** pushes everything. Drafts survive a page refresh.
- Respects SpoofHub's rate limit (25 requests / 10 s): it stays under it and waits automatically when told to. Failed rows stay editable so you can fix and re-save just those.
- Create a task (project → task list → title, dates, estimate, assignees).
- Change a task's workflow stage from the list (only on tasks assigned to you). Stage changes are drafts sent with **Save all**; the last stage (marked ✓) completes the task.
- Each person signs in with their SpoofHub address, their own API key and their email. Nothing is sent anywhere except that address.

## For users: signing in

1. Open the app. Enter your **SpoofHub address** — the one you open SpoofHub at, e.g. `projects.yourcompany.com` (with or without `https://`; the app adds `/api/v3` itself).
2. In SpoofHub, open the **profile menu** (top right), then **click your profile picture five times**. A window shows your API key — copy it and paste it under the address. Press **Next**; the app checks both.
3. Enter the email you use for SpoofHub. The app finds your account and shows your name — confirm it.

The address, key and your user id are stored only in your browser (`localStorage`) until you **Sign out** (Settings), which clears all three. Settings also shows which SpoofHub you're connected to and lets you change it.

## For developers

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the request queue, error handling, time utils
npm run build      # static output in dist/
```

Requires Node 18+.

### Deploying

`npm run build` produces a static site in `dist/` — an `index.html`, one JS file, one CSS file. Deployment must be over **HTTPS** (the API key travels in a request header).

| Where | How |
|---|---|
| Netlify / Vercel / Cloudflare Pages | Connect the repo. Build command `npm run build`, publish directory `dist`. |
| GitHub Pages | Already wired up: `.github/workflows/deploy.yml` builds and publishes on every push to `main`. In the repository go to **Settings → Pages → Source** and choose **GitHub Actions** (once). The base path is detected from the repository name automatically. |
| Internal server (nginx, IIS, Apache) | Copy the contents of `dist/` to the site root. No rewrites needed — the app has no client-side routes. |

The site's base path is chosen in `vite.config.js`: `/<repo-name>/` when built by GitHub Actions, `/` everywhere else. Set `BASE_PATH` to override (for example `BASE_PATH=/` if the Pages site uses a custom domain or a `<user>.github.io` repository).

Nothing company-specific is built in. Optionally, copy `.env.example` to `.env` and set `VITE_DEFAULT_SPOOFHUB_URL` to pre-fill the address field for your colleagues; they can still change it.

### How it talks to SpoofHub

All requests go through one queue (`src/api/queue.js`):

- at most 3 requests in flight, at most 20 started in any 10-second window;
- on `429` it pauses for `Retry-After` seconds (min 3, max 60) and retries the request;
- on `5xx` or a network failure it retries with 2 s / 4 s / 8 s backoff, then marks the row failed;
- auth and validation errors are never retried.

SpoofHub sometimes returns errors as HTTP 200 with an error body (`{"success":false,"code":1001,...}` or `{"code":1301,"message":"Invalid request"}`); `src/api/client.js` detects these and treats them as errors.

Requests made at startup: `/projects`, `/people`, `/workflows` (needs the `X-Comp-Url` header, which the app derives from the address), `/alltodo` (paged, 100 per request), `/alltime` (paged, last N days, N in Settings). Timesheets and task lists of a project are fetched the first time they're needed and cached.

### Local testing without a real SpoofHub

`python3 mock/server.py` runs a small fake SpoofHub on `http://127.0.0.1:8787` (key `testkey`). See `mock/README.md`.

### Project layout

```
src/
  api/        queue, error normalisation, endpoint functions
  store/      settings (key, user, preferences) and drafts (unsaved rows) — both persisted
  hooks/      TanStack Query hooks and the save-all engine
  components/ Setup, Header, TaskList, TaskRow, TaskExpanded, EntryRow, ExistingEntry, NewTaskModal, SaveBar, Settings, Toast
  utils/      time formatting/validation, timesheet default rule
tests/        Vitest unit tests
```

### Known limitations

- The `assigned` filter of `/alltodo` is unreliable on SpoofHub's side, so all open tasks are fetched and filtered locally. With thousands of open tasks, pick a project to load less.
- Only your own time entries are listed under a task (the task's total still includes everyone's).
- Time you logged straight to a timesheet without a task link (common in the SpoofHub UI) isn't shown under any task; the header shows how much of that exists in the history window.
- Moving an existing entry to a different timesheet is done as delete + create, because the API has no move.
- Subtasks, comments, timers and attachments are out of scope.
- The rate limit is per SpoofHub account per IP address. Several colleagues saving at the same moment from one office network share the budget; the app recovers automatically when SpoofHub says 429.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Couldn't reach …" at sign-in | The address is wrong, or the network blocks it. Use the address you open SpoofHub at in the browser. |
| "That key was rejected" at sign-in | The key was copied incompletely, or SpoofHub invalidated it. Get it again from the profile picture pop-up. |
| "No SpoofHub user has that email" | The email doesn't match the one on your SpoofHub profile exactly. Ask an admin which email is on the account. |
| Red banner: key belongs to a different user | The email you typed isn't the owner of the API key. Sign in again with your own email. |
| A row shows "Invalid request" | SpoofHub rejected the payload (code 1301). Usually the timesheet or task no longer exists — refresh and try again. |
| Everything stalls with "rate limit hit" | Expected when saving many rows; it resumes by itself. |
