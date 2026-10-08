# ProofHub Time Logger (unofficial)

A free, open-source **time logging app for ProofHub**, built on the public [ProofHub API v3](https://github.com/ProofHub/api_v3). One flat list of your ProofHub tasks, a week grid, and a single **Save all** button — log time against many tasks at once instead of opening each one in the ProofHub web UI.

**Live app:** https://sreenathkallada.github.io/spoofhub-time-logger/ — nothing to install; sign in with your own ProofHub API key.

> **Independent project — not affiliated with ProofHub.** This is a community-made client that talks to the ProofHub API using the API key each user obtains from their *own* ProofHub account. It is not developed, endorsed, supported or reviewed by ProofHub or its owners. *ProofHub* is a trademark of its respective owner and is used here only to describe which service the app connects to. See [Disclaimer](#disclaimer).

> Inside the app the service is referred to as "SpoofHub" — a deliberate placeholder name so the interface makes no claim to be an official ProofHub product.

---

## Contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Getting started (users)](#getting-started-users)
- [How it works](#how-it-works)
- [Developers](#developers)
- [Deploying your own copy](#deploying-your-own-copy)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Related](#related)
- [Disclaimer](#disclaimer)

## Why this exists

Logging time in ProofHub means opening a task, opening its time section, adding an entry, closing it, and repeating for the next task. If you fill timesheets at the end of a day or a week, that adds up. ProofHub publishes a REST API with an API key per user, so this app uses it to put everything on one page: your tasks, your recent entries, a week grid, and one save for the lot. It also handles the API's rate limit, its 200-with-error-body responses and its escaped description HTML so you don't have to.

It was written for a small team and shared in case it is useful to other ProofHub users. Nothing company-specific is built in — any ProofHub account works.

## Features

**Time logging**
- Open tasks across all your projects or one project, filtered to *assigned to me*, *mine + unassigned* or *unassigned only*.
- Expand a task to see your recent entries and add new rows: date, hours, minutes, description, timesheet, billable status. `Enter` adds another row.
- Edit or delete existing entries inline.
- Keep several tasks open with unsaved rows; one **Save all** sends them all. Drafts survive a page refresh. Failed rows stay editable so you fix and re-save only those.
- **Week grid**: Monday–Friday columns, tasks as rows. Type hours (`2`, `1.5`, `1:30`, `1h 30m`) straight into cells. Day totals are coloured against a daily target you set. "Copy last week" pre-fills drafts; "Add task" adds any open task as a row.

**Tasks**
- Change a task's workflow stage from the list (tasks assigned to you). Stage changes go out with **Save all**; the last stage completes the task.
- **Take** an unassigned task (assigns it to you, with undo).
- Create and **edit** tasks: title, rich-text description (bold, lists, checklists, links — ProofHub's own HTML is kept, so checklists made in the web UI can be ticked off here), dates, estimate, assignees, labels, progress.
- Add a comment to a task.

**Safety and privacy**
- Your ProofHub address, API key and user id live only in your browser's `localStorage`. The app sends requests to your ProofHub address and nowhere else — no backend, no analytics, no third-party scripts.
- Rate-limit aware: stays under ProofHub's 25 requests / 10 seconds and waits automatically on `429`.

## Getting started (users)

1. Open https://sreenathkallada.github.io/spoofhub-time-logger/ (or your own deployment).
2. Enter your **ProofHub address** — the one you open ProofHub at, e.g. `yourcompany.proofhub.com`. With or without `https://`; the app adds `/api/v3` itself.
3. Get your API key: in ProofHub open the **profile menu** (top right) and **click your profile picture five times**. Copy the key and paste it under the address. Press **Next**.
4. Enter the email of your ProofHub account. The app finds you and shows your name — confirm it.

**Settings** (avatar, top right) lets you change address, key or email, set the default billing status, how far back to load entries, your daily target, and which view opens first. **Sign out** wipes everything stored.

## How it works

- Pure static single-page app (React + Vite). The browser calls `https://<your-address>/api/v3` directly; ProofHub's API sends permissive CORS headers, so no proxy is needed.
- All requests go through one queue (`src/api/queue.js`): max 3 in flight, max 20 started per 10 s, pause on `429` for `Retry-After`, exponential retry on `5xx`/network, no retry on auth or validation errors.
- ProofHub sometimes answers HTTP 200 with an error body (`{"success":false,"code":1001,…}` or `{"code":1301,"message":"Invalid request"}`); `src/api/client.js` turns these into real errors.
- Every request carries `X-Comp-Url` (derived from the address); `/workflows` refuses without it. Every non-GET request carries `Content-Type: application/json`; `DELETE` refuses without it.
- Task descriptions come back HTML-entity-escaped; `src/utils/html.js` decodes once, sanitises against an allow-list and writes them back in ProofHub's own markup.
- Endpoints used: `/projects`, `/people`, `/labels`, `/workflows`, `/alltodo`, `/alltime`, `/projects/:id/timesheets`, `/projects/:id/todolists`, task create/update (`title`, `description`, dates, estimate, `assigned`, `labels`, `percent_progress`, `stage`, `completed`), task comments, and time entry create/update/delete. All documented in the [ProofHub API v3 repository](https://github.com/ProofHub/api_v3) except `percent_progress`, `stage` and the two headers above, which were verified by testing.

## Developers

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: request queue, error handling, time and HTML utils
npm run build      # static output in dist/
```

Requires Node 18+.

**Test without a real account:** `python3 mock/server.py` runs a fake ProofHub API on `http://127.0.0.1:8787` (key `testkey`) that reproduces the real server's quirks. See `mock/README.md`.

```
src/
  api/        request queue, error normalisation, endpoint functions
  store/      settings (address, key, user, preferences) and drafts — both persisted
  hooks/      TanStack Query hooks, save-all engine, take-task action
  components/ Setup, Header, TaskList/TaskRow/TaskExpanded, WeekView, TaskFormModal, RichEditor, SaveBar, Settings, Toast
  utils/      time parsing/formatting, description HTML, timesheet default rule, tooltip text
mock/         fake API server for local testing
tests/        Vitest unit tests
```

## Deploying your own copy

`npm run build` produces a static site in `dist/` — one HTML, one JS and one CSS file. Serve it over **HTTPS** (the API key travels in a request header).

| Where | How |
|---|---|
| GitHub Pages | `.github/workflows/deploy.yml` builds and publishes on every push to `main`. In the repository: **Settings → Pages → Source → GitHub Actions** (once). The base path follows the repository name automatically. |
| Netlify / Vercel / Cloudflare Pages | Connect the repo; build command `npm run build`, publish directory `dist`. |
| Your own server | Copy the contents of `dist/` to the web root. No rewrites needed. |

`BASE_PATH` overrides the base path (e.g. `BASE_PATH=/` for a custom domain). Optionally set `VITE_DEFAULT_SPOOFHUB_URL` in `.env` (see `.env.example`) to pre-fill the address field for your team.

## Known limitations

- ProofHub's `/alltodo?assigned=` filter is unreliable, so all open tasks are fetched (100 per request) and filtered locally. With thousands of open tasks, choose a project to load less.
- Only your own entries are listed under a task; the task's total still includes everyone's.
- Time logged in the ProofHub UI straight to a timesheet, with no task link, is shown as a separate read-only row in the week grid and not under any task.
- Moving an entry to a different timesheet is done as delete + create; the API has no move.
- Stage colours aren't exposed to API keys, so stages are shown without colour.
- Subtasks, timers and attachments are out of scope.
- The rate limit is per ProofHub account per IP; colleagues saving at the same moment from one office network share it. The app recovers automatically.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Couldn't reach …" at sign-in | Wrong address or blocked network. Use the address you open ProofHub at. |
| "That key was rejected" | Key copied incompletely or regenerated. Get it again from the profile picture pop-up. |
| "No … user has that email" | The email must match your ProofHub profile exactly. Ask an admin which email is on the account. |
| Red banner: key belongs to a different user | The email isn't the owner of the API key. Sign in again with your own email. |
| A row shows "Invalid request" | ProofHub rejected the payload (code 1301): usually the timesheet or task no longer exists. Refresh and retry. |
| "INCOMPLETE HEADERS" | Seen when a required header is missing. The app sends them; if you see this, you are probably on an old build — redeploy. |
| "rate limit hit, resuming in …" | Expected when saving many rows; it continues by itself. |

## Related

- **Official ProofHub API documentation:** https://github.com/ProofHub/api_v3 — the source of truth for every endpoint this app uses. Start there if you want to build your own integration.
- ProofHub product site: https://www.proofhub.com

## Disclaimer

This software is an independent, unofficial, community project provided free of charge **"as is", without warranty of any kind**, express or implied, including but not limited to fitness for a particular purpose, accuracy or non-infringement.

- The author is **not affiliated with, endorsed by, or acting on behalf of** ProofHub, its parent company, or any organisation that uses ProofHub, including the author's own employer. Nothing here represents the views or policies of any such organisation.
- Use of the ProofHub API through this app is subject to **ProofHub's own terms of service**. You are responsible for making sure your use of your API key complies with them and with your organisation's policies.
- **Use at your own risk.** The author accepts **no responsibility or liability** for any loss, damage, incorrect time records, data changes, account consequences or other outcome arising from use of, or inability to use, this software, by anyone, in any circumstances.
- Any changes this app makes (time entries, task edits, stage changes, comments, assignments) are made under **your** API key and are **your** actions.
- The app stores your API key only in your own browser. You are responsible for keeping that browser and key secure.

*ProofHub* and related marks are trademarks of their respective owners. Their use here is nominative, to identify the service the software connects to, and implies no sponsorship or endorsement.
