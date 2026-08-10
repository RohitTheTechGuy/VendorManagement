# VendorManagement

A web application for managing an organization's vendors — the companies and
individuals that supply goods and services. It centralizes vendor records,
contracts, and communications so procurement and finance teams have a single,
reliable source of truth.

## What it does

Vendor Management replaces scattered spreadsheets and email threads with one
place to onboard, track, and evaluate suppliers across their lifecycle.

### Core features

- **Vendor directory** — Maintain a searchable catalog of vendors with contact
  details, categories, tax/legal identifiers, and status (active, pending,
  suspended, archived).
- **Onboarding** — Capture the documents and approvals a new vendor needs
  (registration details, banking info, compliance documents) through a guided
  intake flow.
- **Contracts & renewals** — Store contract terms, start/end dates, and renewal
  reminders so agreements don't lapse unnoticed.
- **Documents & compliance** — Attach and version key files (agreements,
  insurance certificates, tax forms) and flag ones that are missing or expired.
- **Performance tracking** — Record ratings, notes, and issues over time to
  inform which vendors to keep, grow, or replace.
- **Roles & permissions** — Separate what buyers, approvers, and administrators
  can view and change.

## Tech stack

- **Frontend** — React 19, Vite, TypeScript, and React Router 7
- **Backend** — Express 5 and TypeScript
- **Authentication** — Better Auth inside the Express API
- **Database** — Neon Postgres
- **Database access** — Prisma
- **Validation** — Zod
- **UI** — Tailwind CSS and shadcn/ui
- **Motion** — Paid Animmaster Library components
- **Tests** — Vitest, React Testing Library, Supertest, and Playwright
- **Package management** — npm workspaces
- **Deployment** — One Docker image on Railway

## Application structure

The frontend and backend remain separate applications:

- `apps/web` — React frontend
- `apps/api` — Express backend
- `packages/shared` — Shared TypeScript types and Zod schemas
- `packages/db` — Prisma schema, generated client, and migrations

The Dockerfile builds both applications in separate stages. The Express API serves the built React application in production.

## Getting started

> Prerequisite: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

The exact local URLs will be documented when the application servers are added.

## Deployment

Railway builds the root `Dockerfile` and runs the backend server. The backend serves the frontend build from the same Docker image.

Railway checks the backend health endpoint at `/api/health`.

## Environment variables

Keep environment values in local `.env` files or Railway environment settings.

Never commit `.env` files, database URLs, authentication secrets, private keys, or other secret values.

The repository ignores local environment files. Use `.env.example` only for empty variable names and safe example values.

## Design mocks

The `mocks/` folder contains wireframe prototypes that define the target user flows:

- `mocks/vendor-onboarding-prototype.html` — 15-screen onboarding journey with buyer, platform, and vendor lanes.
- `mocks/index.html` — GitHub Pages redirect.
- `mocks/README.md` — Details from the upstream mock repository.

Open `mocks/vendor-onboarding-prototype.html` in a browser to view the wireframes. All feature implementation follows these mocks.

## Project status

Early development — the repository is being scaffolded. Features listed above
describe the intended scope and will land incrementally.

## License

See [LICENSE](./LICENSE).
