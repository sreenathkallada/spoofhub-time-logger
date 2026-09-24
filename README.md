# Time Logger for Spoofhub

A single-page app for logging time against Spoofhub tasks without the Spoofhub UI: one flat list of your tasks, expand any of them, add as many time entries as you like across several tasks, then press **Save all** once.

Built for `https://projects.corp.com`. Talks directly to the Spoofhub v3 API from the browser — there is no backend.

> [!IMPORTANT]
> **Disclaimer & Privacy Notice**: This is an independent, client-side open-source utility that interacts solely with publicly available APIs. No API keys, credentials, or personal data are ever transmitted to or stored on any external server—everything remains strictly inside your local browser. See the full [Disclaimer & Legal Notice](#disclaimer--legal-notice) below.


## What it does

- Lists open tasks across all your projects (or one project), filtered to *assigned to me*, *mine + unassigned*, or *everyone's*. Unassigned tasks are clearly badged.
- Expand a task to see your recent entries on it and add new ones: date, hours, minutes, description, timesheet, billable status. `Enter` in the description adds another row.
- Edit or delete your existing entries inline.
- Keep several tasks expanded with unsaved rows; the footer shows the total and one **Save all** pushes everything. Drafts survive a page refresh.
- Respects Spoofhub's rate limit (25 requests / 10 s): it stays under it and waits automatically when told to. Failed rows stay editable so you can fix and re-save just those.
- Create a task (project → task list → title, dates, estimate, assignees).
- Mark a task complete from the list, with undo.
- Each person signs in with their own Spoofhub API key and email. Nothing is sent anywhere except `projects.corp.com`.

## For users: signing in

1. In Spoofhub, open the **profile menu** (top right), then **click your profile picture five times**. A window shows your API key — copy it.
2. Open the app, paste the key, press **Next**.
3. Enter the email you use for Spoofhub. The app finds your account and shows your name — confirm it.

The key and your user id are stored only in your browser (`localStorage`). Use **Settings → Sign out** to remove them.

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
| GitHub Pages | Set `base: '/<repo-name>/'` in `vite.config.js`, build, publish `dist`. |
| Internal server (nginx, IIS, Apache) | Copy the contents of `dist/` to the site root. No rewrites needed — the app has no client-side routes. |

If the Spoofhub company URL ever changes, copy `.env.example` to `.env`, set `VITE_API_BASE`, and rebuild.

### How it talks to Spoofhub

All requests go through one queue (`src/api/queue.js`):

- at most 3 requests in flight, at most 20 started in any 10-second window;
- on `429` it pauses for `Retry-After` seconds (min 3, max 60) and retries the request;
- on `5xx` or a network failure it retries with 2 s / 4 s / 8 s backoff, then marks the row failed;
- auth and validation errors are never retried.

Spoofhub sometimes returns errors as HTTP 200 with an error body (`{"success":false,"code":1001,...}` or `{"code":1301,"message":"Invalid request"}`); `src/api/client.js` detects these and treats them as errors.

Requests made at startup: `/projects`, `/people`, `/workflows`, `/alltodo` (paged, 100 per request), `/alltime` (paged, last N days, N in Settings). Timesheets and task lists of a project are fetched the first time they're needed and cached.

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

- The `assigned` filter of `/alltodo` is unreliable on Spoofhub's side, so all open tasks are fetched and filtered locally. With thousands of open tasks, pick a project to load less.
- Only your own time entries are listed under a task (the task's total still includes everyone's).
- Time you logged straight to a timesheet without a task link (common in the Spoofhub UI) isn't shown under any task; the header shows how much of that exists in the history window.
- Moving an existing entry to a different timesheet is done as delete + create, because the API has no move.
- Subtasks, comments, timers and attachments are out of scope.
- The rate limit is per Spoofhub account per IP address. Several colleagues saving at the same moment from one office network share the budget; the app recovers automatically when Spoofhub says 429.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "That key was rejected" at sign-in | The key was copied incompletely, or Spoofhub invalidated it. Get it again from the profile picture pop-up. |
| "No Spoofhub user has that email" | The email doesn't match the one on your Spoofhub profile exactly. Ask an admin which email is on the account. |
| Red banner: key belongs to a different user | The email you typed isn't the owner of the API key. Sign in again with your own email. |
| A row shows "Invalid request" | Spoofhub rejected the payload (code 1301). Usually the timesheet or task no longer exists — refresh and try again. |
| Everything stalls with "rate limit hit" | Expected when saving many rows; it resumes by itself. |

---

## Disclaimer & Legal Notice

### 1. Data Privacy & Zero-Server Architecture
- **Client-Side Only**: This application operates entirely within your web browser. There is **no backend server, intermediate proxy, database, analytics tracker, or telemetry service** hosted or managed by the author.
- **Local Storage Only**: Your API key, user identification, account details, and drafts are saved exclusively in your browser's local storage (`localStorage`).
- **Direct Communication**: All network requests travel directly and securely over HTTPS from your browser to the designated API endpoint. At no point does the author, maintainer, or any third party have visibility into, access to, or custody of your credentials, project data, or time entries.

### 2. Publicly Available APIs & Independent Development
- This software solely interacts with standard, publicly documented API endpoints using credentials provided directly and voluntarily by the end user.
- It does not bypass any authentication, modify proprietary server software, or access unauthorized resources.

### 3. Trademarks & Non-Affiliation
- **Non-Affiliation**: This software is an independent, unofficial, open-source project and is **NOT affiliated, associated, authorized, endorsed by, or in any way officially connected** with ProofHub, Spoofhub, or any of their subsidiaries, parent companies, or affiliates.
- **Trademarks**: All product names, logos, brand names, trademarks, and registered trademarks mentioned or referenced in this project are the property of their respective owners. Any reference to third-party names, products, or services is strictly for identification, interoperability, and descriptive purposes only, and does not imply any sponsorship, affiliation, or endorsement.

### 4. "AS IS" & Limitation of Liability
- **No Warranty**: This software is provided strictly on an **"AS IS"** and **"AS AVAILABLE"** basis, without warranty of any kind, whether express, implied, statutory, or otherwise, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, or uninterrupted operation.
- **Limitation of Liability**: To the maximum extent permitted by applicable law, in no event shall the author(s), developer(s), or copyright holder(s) be held liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, loss of data, lost profits, business interruption, time logging discrepancies, account suspension, rate limit penalties, or API service changes) arising out of or in connection with the software or the use or other dealings in the software.
- **User Responsibility**: Users assume full responsibility for safeguarding their own API credentials, verifying the accuracy of all submitted time entries, and ensuring that their usage complies with their organization's internal policies as well as the third-party platform's Terms of Service and Acceptable Use Policies.

