# Put Porchlight on Vercel (and porchatl.com)

Signup and login need a live Postgres. Local `.env` still points at
`localhost:5432`, which is why the neighborhood picker is empty. Follow this
once. About 20 minutes plus DNS.

The GitHub repo is already `https://github.com/Antlo314/porchlight.git`.

---

## 1. Neon database (5 min)

1. Go to [neon.tech](https://neon.tech) and create a project named `porchlight`,
   region **AWS us-east-2**.
2. Copy **two** connection strings from the dashboard:
   - **Pooled** (has `-pooler` in the host) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. On your machine, in `C:\Users\aarons\Desktop\NextDoor`, put both in `.env`
   (replace the `localhost:5432` placeholders). Keep `AUTH_SECRET` as-is for
   local; generate a **new** one for Vercel.

```powershell
npx prisma migrate deploy
npm run db:seed
```

Signup should now list Georgia neighborhoods. Try creating an account.

---

## 2. Push the game + signup fixes

```powershell
cd C:\Users\aarons\Desktop\NextDoor
git add -A
git commit -m "Add Light the Block and fix signup when the database is offline"
git push origin master
```

---

## 3. Vercel project (5 min)

1. [vercel.com/new](https://vercel.com/new) → import **Antlo314/porchlight**.
2. Framework: Next.js. Root Directory: **leave blank**.
3. Before the first deploy, add these env vars (Production + Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string |
| `DIRECT_URL` | Neon **direct** string |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_APP_URL` | `https://porchatl.com` once the domain is attached; until then use the `*.vercel.app` URL Vercel shows |

4. Deploy. The build is `prisma generate && next build` and does **not** need
   the database during the build.

---

## 4. Attach porchatl.com

1. Vercel → Project → **Settings → Domains** → add `porchatl.com` (and
   `www` if you want).
2. At your registrar, add the records Vercel prints (usually an A record
   `10.0.1.2` and a CNAME for `www`).
3. Set `NEXT_PUBLIC_APP_URL=https://porchatl.com` and **redeploy**.
4. Games live at **https://porchatl.com/games**.

---

## If signup is still empty after Neon

The seed didn't run. From the project folder, with the Neon URLs in `.env`:

```powershell
npm run db:seed
```

Then refresh `/signup`. You should see Kirkwood, Grant Park, etc.
