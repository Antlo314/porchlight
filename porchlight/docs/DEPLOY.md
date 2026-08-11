# Deploying Porchlight

The code is deploy-ready. What's left is provisioning, which needs your
accounts and credentials — work through this top to bottom.

**Roughly 45 minutes**, most of it waiting on DNS.

---

## Before you start

**Vercel's Hobby plan forbids commercial use**, and Porchlight charges
businesses. You need **Pro ($20/mo)**. Start on it rather than migrating later.

Running costs at launch: Vercel Pro $20/mo, Neon free tier (plenty for one
neighborhood), Vercel Blob free tier, domain ~$15/yr.

---

## 1 · Postgres (Neon)

1. Sign up at [neon.tech], create a project named `porchlight`, region
   **AWS us-east-1** or **us-east-2** (closest to Georgia).
2. From the dashboard, copy **two** connection strings:
   - **Pooled** — the one containing `-pooler`. This is `DATABASE_URL`.
   - **Direct** — no `-pooler`. This is `DIRECT_URL`.

   Both are needed. Serverless functions open many short-lived connections and
   exhaust a direct connection; migrations need a real session the pooler can't
   provide. The schema already declares both.

3. **Create a `dev` branch** (Neon → Branches → New branch, from `main`). Use
   *that* branch's two URLs in your local `.env`. Local and production then run
   the same engine and can never drift.

## 2 · Blob storage (uploads)

Vercel dashboard → **Storage** → **Create** → **Blob**, name it `porchlight`.
Copy the `BLOB_READ_WRITE_TOKEN`.

Uploads switch automatically: token present → Vercel Blob; token absent →
local disk. Local development needs no token.

## 3 · Push to GitHub

```bash
gh repo create porchlight --private --source=. --remote=origin --push
```

Or create an empty private repo on github.com and:

```bash
git remote add origin https://github.com/YOUR_USERNAME/porchlight.git && git push -u origin master
```

`.env`, `.uploads/`, and `*.db` are gitignored — no secrets or uploads travel.

## 4 · Deploy

Vercel → **Add New Project** → import the repo. Framework auto-detects as
Next.js; **Root Directory must be `porchlight`**, not the repo root.

Set these environment variables (Production scope):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (`main` branch) |
| `DIRECT_URL` | Neon **direct** string (`main` branch) |
| `AUTH_SECRET` | Generate fresh — see below. **Never** the dev value. |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com`, no trailing slash |
| `BLOB_READ_WRITE_TOKEN` | From step 2 (Vercel may add this itself) |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Rotating `AUTH_SECRET` later invalidates every session and logs everyone out.
Set it once and keep it.

Deploy. The build runs `prisma generate && next build` and needs no database.

## 5 · Create the schema and seed it

From your machine, pointed at production. **Both steps are required** — without
the seed there are no Georgia neighborhoods, and signup is impossible.

```bash
cd porchlight && DATABASE_URL="<prod-pooled>" DIRECT_URL="<prod-direct>" npx prisma migrate deploy
```

```bash
cd porchlight && DATABASE_URL="<prod-pooled>" DIRECT_URL="<prod-direct>" npm run db:seed
```

On Windows PowerShell, set them first instead:

```bash
$env:DATABASE_URL="<prod-pooled>"; $env:DIRECT_URL="<prod-direct>"; npx prisma migrate deploy; npm run db:seed
```

The seed also creates three demo accounts (`demo@`, `maya@`, `jerome@`
`porchlight.app`). **Delete them before real neighbors arrive** — they share a
published password.

## 6 · Domain

Vercel → Project → **Settings → Domains** → add it, then point DNS as shown.
Once live, update `NEXT_PUBLIC_APP_URL` to the real origin and **redeploy** —
invite links and social share images are built from it, so a stale value sends
neighbors to `localhost`.

## 7 · Verify production

- [ ] Landing page loads with the porch hero
- [ ] Sign up a real account — the neighborhood list is populated
- [ ] Post something with a photo; reload and confirm the photo persists
      (this proves Blob, not disk)
- [ ] `/invite` shows a QR; open the link in a private window
- [ ] Post a job, reply as a business
- [ ] Install to a phone home screen from the browser share menu

---

## Do this before real signups

Deployment is not launch. From `HANDOFF.md`, still open:

1. **Email verification.** Nothing proves an address belongs to whoever typed
   it, so the 25-credit signup bonus can be minted per throwaway address.
   Invite bonuses are capped, but this hole is independent of them. **Porch
   Credits are the community's currency; if they can be manufactured, the
   barter economy is worth nothing.**
2. **Rate limit `POST /api/auth/signup`.** It is public by necessity and has no
   throttling. Upstash Ratelimit in middleware is the usual fix.
3. **Delete the demo accounts.**
4. **Stripe**, when a business actually wants to upgrade. Plan selection
   currently switches the plan and charges nothing, and says so.

## Day-two notes

- **Schema changes:** edit `schema.prisma`, run `npm run db:migrate` against
  your dev branch, commit the generated migration, and `prisma migrate deploy`
  against production. Don't use `db push` on production — it has no history and
  can drop columns.
- **Rollback:** Vercel keeps every deployment; promote a previous one from the
  dashboard. Database migrations do **not** roll back with it.
- **Neon autosuspend** pauses a free-tier database after inactivity; the first
  request afterwards takes a second or two. Normal, not a bug.
