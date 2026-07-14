# Workflow Overview

How to work in the **codex** knowledge base. This is a docs workspace, so the
"workflow" is about capturing, organizing, and maintaining notes rather than
building software.

## Principles

1. **Capture first, organize later.** Get the thought down; structure can come
   after.
2. **One topic per file.** Avoid giant catch-all notes.
3. **Link everything.** A note that nothing points to is easy to lose.
4. **Keep an index.** The workspace is only useful if you can find things.

## Routine

### 1. Starting a session
- Skim the top-level index (`README.md` or `CLAUDE.md`) to see what already
  exists.
- Decide whether the task is: capture a new note, update an existing note,
  reorganize, or review.

### 2. Adding a note
- Create a `lowercase-kebab-case.md` file in the relevant folder (or root if
  uncategorized yet).
- Add a short title (H1) and, optionally, frontmatter (`title`, `tags`,
  `updated`).
- Write the content. Keep it scannable: short paragraphs, lists, headings.
- Link it from the index and from any related notes.

### 3. Updating or reorganizing
- Edit in place where possible; avoid duplicating content across files.
- If a topic outgrows its file, split it and update all inbound links.
- If notes overlap, merge them and fix the index.

### 4. Reviewing
- Periodically check for orphaned notes (no inbound links) and either link or
  retire them.
- Keep the index current — it is the entry point to the whole workspace.

## Folder layout (suggested)

```
codex/
├── CLAUDE.md        # project memory + conventions
├── WORKFLOW.md      # this file
├── README.md        # index of notes (recommended)
├── notes/           # everyday captures
├── references/      # durable reference material
└── drafts/          # works in progress, not yet linked
```

This layout is a starting suggestion; adapt it as the workspace grows.
