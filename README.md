# CryoFlow ❄️

**A light-first, CryoSPARC-style workflow builder for cryo-EM single-particle analysis — inspired by RELION job types, rebuilt for the browser.**

[![Next.js](https://img.shields.io/badge/Next.js%2016-black?logo=next.js)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript%205-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org) [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%204-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com) [![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000)](https://ui.shadcn.com) [![Prisma](https://img.shields.io/badge/Prisma%206-2D3748?logo=prisma)](https://www.prisma.io)

CryoFlow lets you design cryo-EM processing pipelines the way you think about them — as a graph of connected jobs. Pick job types from a palette, drop them on an infinite dot-grid canvas, wire them together port-to-port, tune parameters in an inspector panel, and watch runs progress live. Everything persists in SQLite.

> The UI ships with a **light theme by default** — a cool "Cryo Ice" palette with teal accents on paper white — plus a carefully matched **Deep Ice dark mode**. Toggle anytime; the choice is remembered.

## ✨ Features

- **Workflow canvas** — drag job cards anywhere, connect output ports to input ports with animated bezier edges, zoom 60–150 %, reset view
- **10 RELION-style job types** across 7 groups: Import · Motion Correction · CTF Estimation · Particle Picking · Extraction · 2D/3D Classification · 3D Refinement · Post-Processing · Mask Creation
- **Parameter inspector** — per-type parameter schemas (numbers with units, enum selects), inline rename, save/reset, and a connections manager
- **Live run simulation** — server-authoritative time-based progress (polling), status badges (`idle → running → completed`), shimmer progress bars, "Ready" hints for downstream jobs, deterministic pseudo-results
- **Graph safety** — duplicate-edge (409) and cycle detection (DFS) on both client and server; cascade deletes
- **Light-first theming** — next-themes with `class` strategy, zero hydration flash, full keyboard + ARIA support
- **Responsive app shell** — desktop three-column, tablet two-column, mobile FAB + slide-in Sheets for palette and inspector, sticky footer with iOS safe-area insets
- **Full REST API** — `/api/project`, `/api/jobs`, `/api/jobs/[id]`, `/api/jobs/[id]/run`, `/api/edges`, `/api/edges/[id]`

## 🚀 Getting started

```bash
# 1. Install dependencies
bun install        # or npm install / pnpm install

# 2. Configure the database (SQLite, file-based)
cp .env.example .env

# 3. Push the Prisma schema
bun run db:push

# 4. Start the dev server
bun run dev        # http://localhost:3000
```

A demo project — **β-Galactosidase Tutorial** (Import → Motion Correction → CTF) — is seeded automatically on first API call.

## 🧭 How to use

| Action | How |
| --- | --- |
| Add a job | Click a type in the left palette (or the **+** FAB on mobile) |
| Move a job | Drag the card body |
| Connect jobs | Click the **output port** (right dot), then a target's **input port** (left dot) · `ESC` cancels |
| Inspect / run | Select a card → right panel (or bottom sheet) → **Run Job** |
| Delete | Select → **Delete Job** → confirm (connections cascade) |

## 🏗️ Architecture

```
src/
├─ app/
│  ├─ page.tsx              # App shell (client): layout, polling, sheets
│  ├─ layout.tsx            # ThemeProvider (light default) + fonts
│  ├─ globals.css           # Cryo Ice / Deep Ice OKLCH palettes + canvas & edge utilities
│  └─ api/                  # REST routes (jobs, edges, project, run)
├─ components/
│  ├─ ui/                   # shadcn/ui primitives
│  └─ workflow/             # Header, Palette, Canvas, JobCard, EdgesLayer, JobPanel, Footer…
└─ lib/
   ├─ workflow.ts           # Job-type catalog, param schemas, card geometry
   ├─ store.ts              # Zustand store (jobs, edges, selection, connect-mode, zoom)
   ├─ seed.ts               # Idempotent project seeding + run reconciliation
   └─ db.ts                 # Prisma client singleton
```

**Data model** (Prisma / SQLite): `Project → Job (x, y, status, progress, params JSON, startedAt, duration) → Edge (from/to, unique)`.

Runs are *simulated*: `startedAt + duration` drives progress, computed server-side on every poll — no background workers required. Swap the run endpoint for real `relion_*` CLI calls and the rest of the app works unchanged.

## 📜 License

[MIT](./LICENSE) — built for the structural-biology community with ❤️ and teal.
