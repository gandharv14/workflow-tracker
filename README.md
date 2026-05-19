# Workflow Tracker

A kanban-style board to track people through project-specific workflows.

**CC-Agentic-Coding-Taiga** uses the full workflow:

1. **Eval** — initial evaluation and screening
2. **Interview** — interview round
3. **Background Check** — background verification and Gmail account provisioning
4. **Sent Contracts** — contract sent, awaiting signature
5. **In Production** — live and working

**Transcript Consensus** uses a shorter workflow: Eval, Background Check, and In Production.

Email is the unique identifier within each project, name is optional. Drag cards between columns, select multiple cards for bulk moves, and search across the active project board.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Base UI primitives) + lucide-react icons
- `@dnd-kit/core` for drag-and-drop
- `zod` for request validation, `nanoid` for ids
- Persistence: a single `people.json` object in Vercel Blob storage, updated via ETag-based conditional writes

## Getting started

```bash
npm install
vercel link                  # links / creates the Vercel project
vercel storage add blob      # provisions a Blob store and injects BLOB_READ_WRITE_TOKEN
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM    # e.g. Alexia <alexia@example.com>
vercel env pull .env.local   # pulls the token locally
npm run dev                  # http://localhost:3000
```

End-to-end tests install the required Chromium browser automatically:

```bash
npm run test:e2e
```

Production:

```bash
npm run build
vercel --prod
```

## Features

- **Drag & drop** to move a single person between stages (powered by `@dnd-kit`).
- **Card menu** (kebab icon on hover) for Edit / Delete / Move-to ▸ as a keyboard-and-mobile-friendly alternative to DnD.
- **Bulk operations** — check off multiple cards to reveal the floating bottom bar with "Move to ▸" and "Delete".
- **Project switcher** — use the left sidebar to switch between CC-Agentic-Coding-Taiga and Transcript Consensus.
- **Sent Contracts email** — sends the SME engagement terms to everyone currently in Sent Contracts for projects that include that stage, with one personalized email per person.
- **Global search** — filters cards by email or name (case-insensitive). Column headers show `visible / total` while a query is active.
- **Optimistic updates** with rollback + toast on failure.
- **Unique emails per project** — duplicates rejected with `409 Conflict` within a project.
- **Vercel Blob persistence** — a single `people.json` blob written with ETag-based conditional `put` (max 3 retries on contention) plus an in-process mutex, so concurrent requests within and across runtime instances cannot lose updates.
- **Email delivery** — uses the Resend HTTP API with server-only `RESEND_API_KEY` and `EMAIL_FROM` environment variables.

## API surface

| Method | Path                  | Body                                                 | Description                          |
| ------ | --------------------- | ---------------------------------------------------- | ------------------------------------ |
| GET    | `/api/people?project=...` | —                                                | List people for a project            |
| POST   | `/api/people?project=...` | `{ email, name?, step? }`                        | Create a person (defaults to `eval`) |
| PATCH  | `/api/people/[id]?project=...` | `{ email?, name?, step? }`                  | Update a person in a project         |
| DELETE | `/api/people/[id]?project=...` | —                                           | Delete a person in a project         |
| POST   | `/api/people/bulk?project=...` | `{ action: "move" \| "delete", ids[], step? }` | Bulk move or delete                  |
| POST   | `/api/people/import?project=...` | `{ people: [...] }`                       | Import CSV-parsed people             |
| POST   | `/api/people/sent-contracts-email?project=...` | —                         | Email everyone in Sent Contracts     |

Project ids: `cc-agentic-coding-taiga`, `transcript-consensus`.

Steps: `eval`, `interview`, `background_check`, `sent_contracts`, `in_production`. Transcript Consensus accepts only `eval`, `background_check`, and `in_production`.

## File layout

```
app/
  api/people/route.ts             # GET + POST
  api/people/[id]/route.ts        # PATCH + DELETE
  api/people/bulk/route.ts        # POST bulk
  api/people/sent-contracts-email/route.ts
  layout.tsx                       # Toaster + TooltipProvider
  page.tsx                         # server: loads list, renders <Board>
components/
  board.tsx                        # DnD, search, selection, mutations
  column.tsx                       # droppable column
  person-card.tsx                  # draggable card + menu
  add-person-dialog.tsx
  edit-person-dialog.tsx
  bulk-action-bar.tsx
  search-bar.tsx
  ui/*                             # shadcn components
lib/
  store.ts                         # Vercel Blob read/write with mutex + ETag retry
  email.ts                         # Resend email transport
  sent-contracts-email.ts          # SME terms email template
  projects.ts                      # project ids, names, workflows, feature flags
  steps.ts                         # step order, labels, colors, project-aware helpers
  schemas.ts                       # zod request schemas
  api.ts                           # client fetch helpers
  types.ts
```
