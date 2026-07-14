# codex — Knowledge Base

A personal docs / knowledge base for notes, references, and AI-assisted
writing. See [`CLAUDE.md`](./CLAUDE.md) for conventions and
[`WORKFLOW.md`](./WORKFLOW.md) for the daily routine.

A premium **portfolio site** also lives here in [`web/`](./web/index.html)
(open `web/index.html` in a browser).

A **vocabulary trainer** (memorize the B1 English words from the 120-day
plan) lives in [`web/vocab/index.html`](./web/vocab/index.html) — open it in a
browser. Daily words are seeded from [`notes/english-b1-plan.md`](./notes/english-b1-plan.md)
into [`web/vocab/vocab-data.js`](./web/vocab/vocab-data.js).

## Index

> Add new notes here as you create them. Group by folder or topic.

- (no notes yet — start with `notes/` or `references/`)

## Structure

```
codex/
├── CLAUDE.md        # project memory + conventions
├── WORKFLOW.md      # daily workflow overview
├── README.md        # this index
├── web/             # premium portfolio site (index.html + style.css + script.js)
├── Bio/             # bio / about material
├── notes/           # everyday captures & course notes
├── references/      # durable reference material (cheat sheets, vocab)
├── templates/       # reusable note templates (start from note-template.md)
└── assets/          # images & static assets
```

## Start a new note

Copy the template and fill it in:

```bash
cp templates/note-template.md notes/my-new-note.md
```

Then link it from this index and from any related notes.
