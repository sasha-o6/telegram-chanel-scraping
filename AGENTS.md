# Repository Guidelines

## Project Structure & Module Organization

This is a small Node.js Telegram monitoring script:

- `app.js` is the runtime entrypoint. It connects to Telegram, reads channels, filters messages, and optionally forwards matches.
- `const.js` contains local config: Telegram API values, session string, channel IDs, keyword lists, and runtime mode. Treat it as sensitive.
- `ai/DOCUMENTATION.MD` documents current behavior in Ukrainian.
- `telegram-scraping` is a shell-note launch reference, not a build artifact.
- `.env` and `node_modules/` are local-only.

There is no dedicated `src/`, `tests/`, or assets directory. Keep new code close to the entrypoint unless the project grows enough to justify splitting modules.

## Build, Test, and Development Commands

- `npm install` installs locked dependencies from `package-lock.json`.
- `node app.js` runs the Telegram monitor using values from `const.js`.
- `node --env-file=.env app.js` loads `.env`, but current config mostly comes from `const.js`; wire env usage through `process.env` explicitly.
- `npx prettier . --check` checks formatting.
- `npx prettier . --write` formats files using `.prettierrc`.

No `npm test` script is defined yet.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) to match the current code. Follow `.prettierrc`: 2 spaces, no semicolons, single quotes, no trailing commas, and `arrowParens: avoid`. Prefer descriptive camelCase names such as `createChanelLinkId` and `getTextAfterLinkLabel`. Existing user-facing console text is Ukrainian; preserve that language for related prompts and logs.

## Testing Guidelines

There is no test framework configured. For logic changes, add focused tests before broad refactors; Node's built-in test runner is acceptable. Name test files after behavior, for example `app.test.js` or `filterMessages.test.js`. Until tests exist, verify with `npx prettier . --check` and a dry run in `nodeEnv: 'dev'` so messages are logged, not sent.

## Commit & Pull Request Guidelines

Recent commits use short imperative messages such as `add: doc` and `remove threads and add trim to link checker`. Keep commits concise and action-oriented. Pull requests should include purpose, config changes, manual verification, and whether Telegram sending was tested in `dev` or `prod`.

## Security & Configuration Tips

Do not commit real Telegram API hashes, phone numbers, or `StringSession` values. Move secrets toward `.env` and keep `const.js` free of production credentials where possible. Use `nodeEnv: 'dev'` while developing.
