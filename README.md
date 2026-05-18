# Workflow Tracker

A kanban-style board to track people through a multi-stage workflow:

1. **Eval** — initial evaluation and screening
2. **Interview** — interview round
3. **Background Check** — background verification
4. **Gmail Creation** — provisioning the Gmail account
5. **Sent Contracts** — contract sent, awaiting signature
6. **In Production** — live and working

Email is the unique identifier, name is optional. Drag cards between columns, select multiple cards for bulk moves, and search across the whole board.

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
vercel env pull .env.local   # pulls the token locally
npm run dev                  # http://localhost:3000
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
- **Global search** — filters cards by email or name (case-insensitive). Column headers show `visible / total` while a query is active.
- **Optimistic updates** with rollback + toast on failure.
- **Unique emails** — duplicates rejected with `409 Conflict`.
- **Vercel Blob persistence** — a single `people.json` blob written with ETag-based conditional `put` (max 3 retries on contention) plus an in-process mutex, so concurrent requests within and across runtime instances cannot lose updates.

## API surface

| Method | Path                  | Body                                                 | Description                          |
| ------ | --------------------- | ---------------------------------------------------- | ------------------------------------ |
| GET    | `/api/people`         | —                                                    | List all people                      |
| POST   | `/api/people`         | `{ email, name?, step? }`                            | Create a person (defaults to `eval`) |
| PATCH  | `/api/people/[id]`    | `{ email?, name?, step? }`                           | Update a person                      |
| DELETE | `/api/people/[id]`    | —                                                    | Delete a person                      |
| POST   | `/api/people/bulk`    | `{ action: "move" \| "delete", ids[], step? }`       | Bulk move or delete                  |

Steps: `eval`, `interview`, `background_check`, `gmail_creation`, `sent_contracts`, `in_production`.

## File layout

```
app/
  api/people/route.ts             # GET + POST
  api/people/[id]/route.ts        # PATCH + DELETE
  api/people/bulk/route.ts        # POST bulk
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
  steps.ts                         # STEP_ORDER, labels, colors
  schemas.ts                       # zod request schemas
  api.ts                           # client fetch helpers
  types.ts
```
