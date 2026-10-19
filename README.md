# Team Task Tracker

A shared task board built with HTML, CSS, JavaScript,
Express, and SQLite.

## Features

- Create tasks with a title, description, assignee, and status.
- Edit existing tasks.
- Move tasks between To do, In progress, and Done.
- Show team progress counts and completion percentage.
- Filter tasks by assignee.
- Refresh the board to load teammates' changes.
- Protect task access with a shared team key.
- Preserve tasks and changes in SQLite.

## Requirements

Node.js 24 and npm.

## Setup

1. Run `npm ci`.
2. Copy `.env.example` to `.env`.
3. Replace TEAM_TOKEN with a random key of at least 32 characters.
4. Run `npm start`.
5. Open http://localhost:3002.
6. Enter the team key to access the board.

Generate a random key with:

node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

Existing local users should keep their current .env file.

## Development

Run `npm run dev` to restart automatically when server files change.

## Configuration

- TEAM_TOKEN: shared team access key.
- PORT: server port; defaults to 3002.
- DATABASE_PATH: SQLite file location; defaults to tasks.db.

## Manual checks

1. Reject an incorrect team key.
2. Create a task and refresh to verify persistence.
3. Edit a task without creating a duplicate.
4. Cancel an edit without changing the saved record.
5. Move a task to Done and check the progress count.
6. Filter by assignee.
7. Use two tabs to verify Refresh board loads changes.
8. Sign out and verify the board is hidden.

## Deployment

Use HTTPS and persistent storage for the SQLite database.
Set TEAM_TOKEN through the hosting service's environment settings.
Do not upload .env or local database files.

## Limitations

This demo uses a shared key and named assignees,
rather than individual user accounts.
Updates appear after refreshing the board.

## Vercel and Neon deployment

Local development still uses SQLite when DATABASE_URL is empty. Vercel requires DATABASE_URL; it will refuse to use temporary SQLite storage. The server is exported for Vercel's Express support.

1. Link the intended Vercel project and verify its owner.
2. Configure a Neon pooled PostgreSQL DATABASE_URL on the server and the app's ADMIN_TOKEN or TEAM_TOKEN. Never put these in public JavaScript.
3. With the intended database connection configured securely, run `npm run db:migrate` once. Each app uses its own private schema. The schema script creates tables without deleting records.
4. Deploy, then verify saving and reloading through the live application. Local SQLite records are not automatically copied to Neon.

Cloud storage has not been verified until a real configured database passes these checks. Keep all `.env` files and `.vercel` settings out of Git.
