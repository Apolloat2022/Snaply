# TODO — things only you can do

Everything in this repo is a working scaffold: real component/route logic, no
dependencies installed and nothing running yet. Here's what's left, roughly
in the order you'd hit it.

## 1. Push this repo somewhere

This folder is its own git repo now (`main` branch, no remote set):

```
cd C:\Projects\APPS\snaply-app
git remote add origin <your-new-github-repo-url>
git push -u origin main
```

Create the GitHub repo first (empty, no README/license — this repo already
has one) if it doesn't exist yet.

## 2. Provision the external services

- **Supabase** — new project, then:
  - Storage: create a bucket named `listing-images` (or set
    `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` to whatever you name it), and add an
    RLS policy allowing inserts (anon or authenticated — your call) so
    `ImageDropzone.tsx` can upload directly from the browser.
  - Database: grab the pooled + direct Postgres connection strings for
    `packages/db/.env` (`DATABASE_URL` / `DIRECT_URL`).
- **Anthropic** — API key for `apps/api/.env` (`ANTHROPIC_API_KEY`). This is
  what powers the vision/identification step.
- **Market search** (Tavily by default) — API key for
  `apps/api/.env` (`MARKET_SEARCH_API_KEY`). Without this, comparable-pricing
  search silently returns nothing and listings fall back to a $25 placeholder
  price (see `apps/api/app/agents/pricing_graph.py`) — you'll want this
  configured before treating listing prices as real.
- **Stripe** — from the [Dashboard](https://dashboard.stripe.com/apikeys) (sandbox
  mode), fill in `apps/web/.env.local`:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — the `pk_test_...` key.
  - `STRIPE_SECRET_KEY` — prefer a [restricted key](https://docs.stripe.com/keys/restricted-api-keys)
    (`rk_test_...`) scoped to Checkout Sessions + webhook read access over the
    full secret key.
  - `STRIPE_WEBHOOK_SECRET` — run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
    locally and use the `whsec_...` it prints, or the signing secret from a
    webhook endpoint you create in the Dashboard pointing at
    `/api/webhooks/stripe` (subscribed to `checkout.session.completed` and
    `checkout.session.async_payment_succeeded`).
- **Resend** (optional) — API key for `apps/web/.env.local`
  (`RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL`). Without it, seller
  sale-notification emails just log to the console instead of sending — the
  in-app notification (dashboard) still works either way.

Copy each `.env.example` / `.env.local.example` to a real `.env` /
`.env.local` and fill in the values above.

## 3. Install and run it

```
# from the repo root
pnpm install

# push the Prisma schema to your Supabase Postgres
cd packages/db && pnpm db:push

# backend
cd apps/api
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend (separate terminal)
cd apps/web
pnpm dev

# webhook forwarding (separate terminal) — required for a sale to actually
# get recorded in dev, since fulfillment happens in the webhook handler
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Then open `http://localhost:3000` and run through the flow: upload a photo →
review the AI-generated listing → publish → open the listing link → check
out with a [Stripe test card](https://docs.stripe.com/testing#cards) → confirm the notification shows up on
`/dashboard`.

## 4. Known placeholders to replace

- `apps/web/src/lib/auth.ts` — `CURRENT_SELLER_ID` / `CURRENT_BUYER_ID` are
  hardcoded strings (`"demo-seller"` / `"demo-buyer"`). There's no real
  auth/session system yet, and no seeded `User` rows for those IDs — you'll
  need both before anything that touches the database (publishing a listing,
  checking out) will actually succeed.
- `apps/web/src/lib/pricing.ts` — the state sales-tax table is a short,
  approximate list (`CA`, `NY`, `TX`, `WA`, `FL`, a few 0%-tax states, and a
  flat default). Swap it for a real tax API (Stripe Tax, TaxJar, etc.) before
  relying on it for actual transactions.
- `apps/api/app/services/shipping.py` — weight estimation is a rough
  category-keyword heuristic, not based on the actual photo/item. Fine for a
  first pass, but worth tightening once you have real listings to check it
  against.

## 5. Not built yet (came up in conversation but out of scope so far)

- No auth/session system (see placeholders above).
- No seller-side listing management (edit/archive a listing after publish).
- No buyer order history page (orders exist in the DB via the `Order`
  model, just nothing renders them yet).
