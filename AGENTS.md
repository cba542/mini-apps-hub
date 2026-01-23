# AGENTS.md

## Overview
- Repo contains a Flask hub app plus three mini apps:
  - Dianping review generator (Flask blueprint) in `dianping-review/`.
  - Meal time planner (static HTML/CSS/JS) in `meal-time-planner/`.
  - Web game prototype in `web-game-egg/` (static HTML/CSS/JS).
- The hub app (`app.py`) mounts mini apps and serves static assets.
- Python dependencies are pinned in `requirements.txt`.

## Build / Run / Test / Lint Commands
### Python (Flask apps)
- Create venv:
  - `python -m venv .venv`
  - Windows: `.venv\Scripts\activate`
  - Linux/macOS: `source .venv/bin/activate`
- Install deps: `pip install -r requirements.txt`
- Run dev server: `python app.py` (serves at `http://127.0.0.1:5000`)
- Production: `gunicorn -w 4 -b 0.0.0.0:5000 app:app`

### Web Apps
- Open `meal-time-planner/index.html` or `web-game-egg/index.html` in browser.

### Tests / Lint
- No test runner or linter configured.
- If you add tests later, document commands here.

## Cursor / Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` detected.

## Code Style Guidelines

### Python
- **Imports**: stdlib first, then third-party, then local. Use explicit imports.
- **Typing**: `from __future__ import annotations` at top. Use builtin generics (`list[dict]`).
- **Formatting**: 4-space indentation, moderate line length (~88-120).
- **Naming**: ALL_CAPS for constants, snake_case for functions/vars. Dataclasses for config.
- **Error handling**: Prefer specific exceptions (`FileNotFoundError`, `RuntimeError`).
- **Flask**: Use `Blueprint` for modular apps. Keep route functions thin.
- **Config**: Load from JSON with env overrides. Never commit secrets.

### JavaScript
- **Style**: Start with `"use strict"`. Use `const`/`let`. Prefer pure functions.
- **Naming**: camelCase for variables/functions. Double quotes for strings.
- **Formatting**: 2-space indentation. Trailing commas in objects/arrays.
- **DOM**: Cache element references at top. Use `textContent` for UI updates.
- **State**: Centralized state objects. localStorage key constant.
- **Events**: Pointer events for touch/mouse support. setPointerCapture for dragging.
- **Utilities**: Small pure helpers (clamp, parseDate, formatTime).

### HTML / CSS
- **HTML**: 2-space indentation. Semantic tags. Inline scripts small/self-contained.
- **CSS**: CSS variables in `:root`. Class-based selectors. Consistent units/radii.

## Project Layout
- `app.py`: hub Flask app mounting mini apps.
- `dianping-review/`: Dianping review generator (`app.py`, `templates/index.html`).
- `meal-time-planner/`: static time planner app.
- `web-game-egg/`: static game app.
- `templates/home.html`: hub landing page.
- `requirements.txt`: Python dependencies.

## Agent Workflow Tips
- Do not add dependencies without updating `requirements.txt`.
- Avoid editing `config.json` / `styles.json` unless asked.
- Prefer small targeted changes; keep UI style consistent.
- When adding Flask routes, use Blueprint pattern.
- For static apps, use localStorage for persistence with a key constant.
- Handle pointer events for both mouse and touch interactions.
