# Implementation Plan: Multi-user Telegram Scraper

## Goal

Rewrite the current Telegram scraper into a Dockerized multi-user system based on `specs.md`. Each Telegram bot user must have isolated config, encrypted Telegram credentials/session, source lists, filtering rules, scheduler state, and delivered-post history.

## Architecture Direction

- Run one Node.js app container initially, with separate internal modules for bot and scraper.
- Use PostgreSQL for users, configs, encrypted secrets, auth flow state, scrape runs, delivery outbox, and delivered posts.
- Target TDLib for Telegram account access, but implement a `telegramAccountClient` adapter first so TDLib package and Docker viability can be validated before broad feature work.
- Keep GramJS only as a documented fallback if TDLib validation fails.

## Implementation Phases

1. **Baseline and dependency gate**

   - Confirm current worktree baseline before coding; recent planning found `app.js`, `package.json`, `package-lock.json`, and `telegram-scraping` may be deleted.
   - Validate TDLib Node package choice and required Docker native dependencies.
   - Add or restore project scaffolding, npm scripts, Dockerfile, Docker Compose, and `.env.example`.

2. **Database and security foundation**

   - Add migrations for `bot_users`, `scraper_configs`, `telegram_secrets`, `auth_flows`, `delivery_outbox`, `delivered_posts`, and `scrape_runs`.
   - Enforce `unique(user_id)` for one config per user and one secrets row per user.
   - Enforce at most one active auth flow per user.
   - Implement AES-256-GCM secret encryption using `ENCRYPTION_KEY` from environment.

3. **Bot and config flows**

   - Implement `/start` user registration.
   - Implement CRUD for allowed config fields only: `isEnable`, `days`, `limit`, `intervalMinutes`, `channelToSend`, `apiId`, `apiHash`, `channels`, `keywords`, `keywords2`, `banWords`.
   - Scope every operation by Telegram bot user ID.

4. **Telegram auth flow**

   - Accept account authorization only in private bot chats.
   - Collect phone, verification code, and 2FA password only when required.
   - Never persist phone codes or 2FA passwords.
   - Add TTL, purge, cancellation, and redacted logging for auth flows.
   - Store `stringSessionSTR` encrypted after successful authorization.

5. **Scraper and scheduler**

   - Implement global scheduler tick every 20 minutes.
   - Select due configs using `last_scraped_at` and per-user `intervalMinutes`.
   - Lock due configs to avoid overlapping runs.
   - Scrape v1 source types: groups, channels, chats.
   - Filter by `keywords`, optional `keywords2`, and `banWords`.

6. **Delivery and duplicate prevention**

   - Insert unique `delivery_outbox` rows for matching messages.
   - Send pending outbox rows to `channelToSend`.
   - On success, mark outbox row `sent` and insert `delivered_posts`.
   - Document at-least-once residual risk: Telegram send and PostgreSQL commit cannot be truly atomic.

7. **Verification**
   - Unit tests: filtering, formatting, scheduler gating, encryption.
   - Integration tests: repository scoping, uniqueness constraints, auth TTL/purge, outbox dedupe.
   - Bot tests: private-chat auth guard, config CRUD, expired-session notification.
   - Docker smoke test with fake Telegram adapter.
   - Manual real-Telegram test only with explicit local credentials.

## Acceptance Criteria

- Users cannot read or mutate another user’s config or secrets.
- Sensitive fields are encrypted at rest and never logged in plaintext.
- Missing or expired sessions trigger bot notification and re-authorization.
- Scheduler respects global 20-minute tick and each user’s `intervalMinutes`.
- Scraper does not resend posts after recorded successful delivery.
- Docker Compose starts app and PostgreSQL with documented environment variables.
