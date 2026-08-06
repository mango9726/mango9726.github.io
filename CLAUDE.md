# CLAUDE.md

This is the project memory file for the **codex** workspace. It is a
**docs / knowledge base** — a place for notes, references, and AI-assisted
writing tasks, not a software codebase.

## Purpose

`codex` is a personal knowledge base. Use it to capture, organize, and
cross-link notes, research, and reference material. Content is written in
plain Markdown; structure is lightweight and meant to grow organically.

## Conventions

- **Format:** Markdown (`.md`) files. Keep one topic per file.
- **Naming:** lowercase-kebab-case filenames (e.g. `git-cheatsheet.md`).
- **Links:** use relative links between notes so the knowledge base stays
  navigable (e.g. `[workflow](../WORKFLOW.md)`).
- **Indexing:** maintain a top-level `README.md` (or this file) listing the
  main notes and how they relate.
- **Frontmatter:** optional YAML frontmatter for metadata (`title`, `tags`,
  `updated`) is welcome but not required.

## How Claude should help here

- Draft, summarize, and restructure notes on request.
- Keep language consistent with existing notes.
- When adding a new note, link it from the relevant index and cross-reference
  related notes instead of leaving it orphaned.
- Prefer editing in place over creating duplicate files.

## Workflow

The day-to-day routine for working in this workspace is documented separately
in [`WORKFLOW.md`](./WORKFLOW.md). Read it before starting a session that
involves adding or reorganizing notes.

---

## Developer Workflow & Task Tracker
- **ALWAYS read `DEVELOPMENT_WORKFLOW.md`** (repository root) **before starting any
  coding session** — it summarizes the project, how to run it, and what to work on next.
- **ALWAYS update the "Dynamic Task Board"** in `DEVELOPMENT_WORKFLOW.md` **immediately
  after** any code change, refactor, or bug fix: check/uncheck boxes, move tasks between
  Backlog / In Progress / Done, and stamp Done items with the date (`YYYY-MM-DD`).
- Keep `DEVELOPMENT_WORKFLOW.md` organized and current **without being reminded**.
- The web app lives in **`web/vocab/`** (vanilla HTML/CSS/JS, no build step). Run it with
  `python -m http.server 8000` from that folder and open `http://localhost:8000`.
  Full detail is in `DEVELOPMENT_WORKFLOW.md`.
