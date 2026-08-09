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

- **Next.js** (React) — application framework and UI
- **TypeScript** — type-safe application code
- **Vercel** — deployment target

## Getting started

> Prerequisite: [Node.js](https://nodejs.org/) 18+ and npm.

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment variables

Copy the example environment file and fill in your values (database URL, auth
secrets, etc.):

```bash
cp .env.example .env.local
```

Local env files (`.env`, `.env*.local`) are git-ignored and should never be
committed.

## Project status

Early development — the repository is being scaffolded. Features listed above
describe the intended scope and will land incrementally.

## License

See [LICENSE](./LICENSE).
