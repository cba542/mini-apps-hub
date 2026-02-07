# AGENTS.md

## Overview
- Repo is a Flask hub app plus two static mini apps and one Flask blueprint app.
- Primary entry point is `app.py` at repo root.
- Static apps live in `meal-time-planner/` and `web-game-egg/`.
- Dianping review generator is in `dianping-review/` and is mounted as a blueprint.

## Repo Map
- `app.py`: Flask hub app, mounts mini apps and serves static assets.
- `templates/home.html`: hub landing page.
- `dianping-review/app.py`: Dianping blueprint and AI request logic.
- `dianping-review/templates/index.html`: Dianping UI.
- `meal-time-planner/index.html`: Meal planner UI shell.
- `meal-time-planner/script.js`: Meal planner logic and state.
- `meal-time-planner/style.css`: Meal planner styles.
- `web-game-egg/index.html`: Web game prototype shell.
- `web-game-egg/script.js`: Web game logic.
- `web-game-egg/style.css`: Web game styles.
- `requirements.txt`: Python deps for Flask and requests.

## Setup And Run
### Python (Flask)
- Create venv: `python -m venv .venv`
- Activate venv:
  - Windows: `.venv\Scripts\activate`
  - Linux/macOS: `source .venv/bin/activate`
- Install deps: `pip install -r requirements.txt`
- Run dev server: `python app.py` (serves at `http://127.0.0.1:5000`)
- Production example: `gunicorn -w 4 -b 0.0.0.0:5000 app:app`

### Web Apps (standalone)
- Open `meal-time-planner/index.html` in a browser.
- Open `web-game-egg/index.html` in a browser.
- When served by Flask, use:
  - `http://127.0.0.1:5000/meal-time-planner/`
  - `http://127.0.0.1:5000/web-game-egg/`

## Build / Lint / Test
- No build pipeline configured.
- No linter configured.
- No test runner configured.

### Running A Single Test
- There are no tests yet.
- If you add pytest later, prefer:
  - `pytest path/to/test_file.py::TestClass::test_name`
  - `pytest -k test_name path/to/test_file.py`
- If you add JS tests later, document the exact command here.

## Runtime Data And Storage
- SQLite file used by meal planner rooms: `meal-time-rooms.db` in repo root.
- DB is created on first API request via `/api/rooms` or `/api/rooms/<id>`.
- Meal planner stores local state in browser localStorage under `meal-time-planner-state`.

## Config And Secrets
- Dianping app reads JSON config from `dianping-review/config.json` by default.
- Optional env overrides:
  - `CONFIG_PATH`, `STYLES_PATH`
  - `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
- Do not commit secrets or API keys.

## HTTP Endpoints (Flask)
- `GET /` renders the hub page.
- `GET /meal-time-planner/` and `GET /web-game-egg/` serve static index files.
- `POST /api/rooms` creates a shared room for the meal planner.
- `GET /api/rooms/<room_id>` fetches room state.
- `PUT /api/rooms/<room_id>` updates room state.

## Code Style Guidelines
### General
- Keep changes minimal and consistent with existing patterns in each app.
- Prefer ASCII in new files unless the file already uses non-ASCII text.
- Do not reformat unrelated code or run formatters unless requested.
- Avoid introducing new dependencies without a clear need.

### Python
- Use `from __future__ import annotations` at the top of Python modules.
- Imports order: stdlib, third-party, then local modules.
- Use explicit imports and avoid wildcard imports.
- Indentation is 4 spaces.
- Keep line length moderate (roughly 88-120 chars).
- Naming: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- Types: prefer builtin generics like `list[str]`, `dict[str, int]`.
- Errors: raise specific exceptions where possible; include clear error messages.
- Flask: keep route handlers thin, push logic to helpers, and use `Blueprint` for modular apps.
- Avoid committing config files with secrets (check `config.json`).
- Prefer context managers for file and DB access.
- Use `jsonify` for JSON responses and `abort(..., description=...)` for errors.
- Keep global config loading at module import time minimal and resilient to missing files.
- Prefer dataclasses for structured config passed to helpers.

### JavaScript
- Start files with `"use strict"`.
- Use `const` by default, `let` only when reassigning.
- Prefer small pure functions for formatting and validation helpers.
- Use 2-space indentation and semicolons.
- Strings use double quotes.
- Use `textContent` for user-visible text; avoid `innerHTML` unless needed.
- Cache DOM references in a single `elements` object.
- Store persistent data in a single state object, then serialize to localStorage.
- Use `dataset` attributes for DOM state, and update via `classList` or `style`.
- For pointer and drag interactions, use pointer events and guard on pointer id.
- Network calls use `fetch` with JSON payloads and explicit error handling.
- Prefer `async`/`await` and check `response.ok` before reading JSON.
- Keep state mutation in helpers and call UI update functions explicitly.
- When storing Sets, serialize to arrays and rebuild with `new Set` on load.

### HTML
- Use semantic elements and minimal inline scripts.
- Keep indentation at 2 spaces.
- Use `data-*` attributes for i18n and UI hooks.
- Prefer buttons for actions and inputs for editable fields.
- Keep external CSS and JS linked in the HTML shells.

### CSS
- Define theme tokens in `:root` with CSS variables.
- Use class selectors and avoid deep nesting.
- Prefer consistent spacing and sizing; keep border radius values consistent.
- Keep layout in CSS grid or flexbox as established in `meal-time-planner/style.css`.
- Use `color-scheme: light` when setting light-only palettes.
- Keep type and layout tokens near the top of the file.

### Internationalization
- UI copy is mapped via data attributes and an `I18N` dictionary.
- Use `data-i18n` for text and `data-i18n-placeholder` for placeholders.
- When adding strings, update both `zh-CN` and `zh-TW` entries.

### Frontend Data Flow
- Cache DOM in a single `elements` object and avoid repeated selectors.
- Prefer `render*` and `update*` functions over inline DOM manipulation.
- When adding new UI state, store it in the central `state` object.
- For room sync, reuse the existing `fetch` helpers and status updates.

### Error Handling
- Validate inputs at the edges (route handlers and event handlers).
- Use early returns for invalid state to keep logic readable.
- For external API calls, handle non-200 status codes and surface the response text.
- For JSON parsing, wrap in `try`/`catch` or `try`/`except` and provide a fallback.

## Agent Workflow Notes
- Keep changes small and targeted unless the task asks for a refactor.
- Do not remove or reformat unrelated code.
- When editing JSON config, keep existing keys and structure.
- Update docs if you add a new command or dependency.
- Avoid adding new dependencies unless required and document them in `requirements.txt`.

## Cursor / Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` detected.
