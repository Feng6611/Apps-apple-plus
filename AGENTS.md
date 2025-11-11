# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds WXT extension code. Use `src/popup/` for the popup UI, `src/content/` for content scripts injected into App Store pages, and `src/background/` for background workflows such as region syncing.
- `public/` stores icons and static assets exposed directly to the browser. Keep exported images prefixed with `icon-` (e.g., `icon-128.png`).
- `tests/` is reserved for Vitest unit suites. Mirror the folder structure from `src/` and suffix files with `.spec.ts`.
- Configuration lives in the repo root (`wxt.config.ts`, `tsconfig.json`, `package.json`). Centralize shared constants in `src/lib/` to avoid cross-module duplication.

## Build, Test, and Development Commands
- `npm install` — bootstrap dependencies.
- `npm run dev` — start WXT in watch mode with live reload for the extension.
- `npm run build` — produce a production extension bundle under `dist/`.
- `npm run test` — execute Vitest suites. Add `--runInBand` when debugging flaky tests.
- `npm run lint` — run ESLint + Prettier checks; use `--fix` before opening a PR.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation and trailing commas in multiline literals.
- Follow camelCase for variables/functions, PascalCase for React/Vue components, and SCREAMING_SNAKE_CASE for compile-time constants.
- Export default only for React/Vue components in `popup/`; prefer named exports elsewhere.
- Run `npm run lint -- --fix` to auto-format with Prettier and enforce ESLint rules.

## Testing Guidelines
- Write unit coverage for region parsing and URL mutation helpers under `tests/lib/`.
- Name test files `<feature>.spec.ts` and use `describe` blocks per module.
- Target >80% branch coverage; review `coverage/` after `npm run test -- --coverage`.
- For UI behavior, add Playwright scenarios in `tests/e2e/` when DOM interactions grow complex.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) and keep subject ≤72 characters.
- Reference tracked issues with `Closes #ID` in the PR description.
- Each PR should include: summary of changes, testing checklist, and screenshots/gifs for UI updates (popup or in-page controls).
- Request review from at least one maintainer and ensure CI (build, lint, test) passes before merging.

## Security & Configuration Tips
- Never commit API keys or Apple credentials; store secrets in `.env.local` (excluded via `.gitignore`).
- When testing region switching, use staging Apple IDs and reset stored regions via the popup settings before sharing builds.

## MCP Tooling (Chrome Dev)
- When configured, the `chrome-dev` MCP server lets us capture Chrome DevTools data (DOM snapshots, console logs, network events) from a running extension session without screen-sharing.
- Before debugging injection issues, run `list_mcp_resources` with `server: "chrome-dev"` to confirm the connection and discover which resources (e.g., DOM, console) are currently exposed.
- Use `read_mcp_resource` against `chrome-dev` to pull console logs and verify the `[asrs]` messages emitted by the content script; missing logs usually means the script never executed.
- When DOM-related regressions occur, request a DOM snapshot via the same server and search for `#appstore-region-switcher-embed` or the platform selector container to confirm whether the embed was inserted.
- Capture the MCP output in bug reports/PRs whenever possible so other contributors can reproduce or compare App Store markup changes.
