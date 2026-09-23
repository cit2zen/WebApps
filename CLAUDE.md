# WebApps Monorepo Conventions

## Stack
- Default: vanilla HTML/CSS/JS with no build step (ES modules, CDN import only).
- Apps that need a server may use **Flask** (precedent: balancegame·onmantle·studyai); Agent SDK apps use Next.js/Node (Dockerfile).

## Coding Rules (Static Apps)
- Single responsibility per function; 200 lines or fewer per file recommended.
- Game loops use requestAnimationFrame; setInterval is forbidden.

## Flask Rules
- Entry point `wsgi:app` + Procfile `web: gunicorn wsgi:app --bind 0.0.0.0:$PORT`.
- Keep template autoescape on (do not abuse `|safe`); passwords and DB credentials go through environment variables; the DB is Postgres (psycopg2/SQLAlchemy).
- Uploaded files go to a persistent volume path (`uploads/`) and are processed with Pillow.

## Running & Verification
- Local: Live Server (static) / `flask run` (Flask).
- For verification criteria and post-deploy smoke tests, **the "Verification workflow" section of the root `C:\factory\CLAUDE.md` is the single source of truth** (Playwright screenshot + 0 console.error, etc.).

## Git / Deployment
- Remote https://github.com/cit2zen/WebApps (`main`); each app = its own subfolder.
- This folder is a **direct clone** of cit2zen/WebApps (single source) — edit, commit, and push here. For deployment, domain, and hosting status, the "Deployment" section of the root CLAUDE.md is the single source of truth.
- `.gitignore` is a whitelist — for a new app, add one line `!/<폴더명>` (`<폴더명>` = folder name). Do not commit artifacts such as screenshots.
