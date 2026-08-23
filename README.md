# Snaply — AI-Driven Zero-Friction Marketplace

Snap a photo, let an AI vision + pricing agent draft the listing, publish, get paid.

## Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS
- **AI Engine:** Python FastAPI, async, orchestrating a multimodal LLM (Claude 3.5 Sonnet / GPT-4o) via LangGraph
- **Database/Storage:** Supabase (Postgres + Blob Storage), Prisma ORM
- **Payments:** Square Web Payments SDK + Square Payments API

## Monorepo layout

```
snaply-app/
├── apps/
│   ├── web/                          # Next.js 15 App Router frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                     # landing / new-listing flow
│   │   │   │   ├── listings/[id]/page.tsx       # published listing + checkout
│   │   │   │   ├── dashboard/page.tsx           # seller dashboard: notifications
│   │   │   │   └── api/
│   │   │   │       ├── analyze-item/route.ts    # proxies to FastAPI, keeps service keys server-side
│   │   │   │       ├── listings/route.ts         # persists a published listing via Prisma
│   │   │   │       ├── notifications/
│   │   │   │       │   ├── [id]/route.ts          # PATCH: mark one notification read
│   │   │   │       │   └── read-all/route.ts      # POST: mark all of a seller's notifications read
│   │   │   │       └── square/
│   │   │   │           └── create-payment/route.ts  # Square Payments API call (server-only)
│   │   │   ├── components/
│   │   │   │   ├── upload/
│   │   │   │   │   └── ImageDropzone.tsx        # drag-and-drop -> Supabase Storage
│   │   │   │   ├── listing/
│   │   │   │   │   ├── ListingProfileForm.tsx   # auto-generated, editable listing profile
│   │   │   │   │   └── NewListingFlow.tsx        # client flow: upload -> review -> published
│   │   │   │   ├── checkout/
│   │   │   │   │   ├── SquareCheckout.tsx        # ← deliverable 3
│   │   │   │   │   └── ListingCheckoutSection.tsx  # client wrapper: checkout -> confirmation
│   │   │   │   └── dashboard/
│   │   │   │       ├── NotificationList.tsx      # seller notification inbox (mark read / mark all read)
│   │   │   │       └── DashboardLink.tsx          # server component: "Dashboard" nav link + unread badge
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts                       # placeholder current-user IDs until real auth exists
│   │   │   │   ├── supabaseClient.ts
│   │   │   │   ├── pricing.ts                    # tax/shipping calc helpers shared with checkout
│   │   │   │   ├── notifications.ts               # seller sale notification (in-app + email)
│   │   │   │   └── email.ts                       # Resend wrapper, no-ops if unconfigured
│   │   │   └── types/
│   │   │       ├── listing.ts                    # shared AnalyzeItemResponse / Listing types
│   │   │       └── notification.ts                # SellerNotification type used by the dashboard
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── api/                          # FastAPI AI orchestration engine
│       ├── app/
│       │   ├── main.py                           # app factory, CORS, router mounting
│       │   ├── routers/
│       │   │   └── analyze.py                    # ← deliverable 2: POST /api/analyze-item
│       │   ├── agents/
│       │   │   └── pricing_graph.py               # LangGraph: identify -> search -> price -> synthesize
│       │   ├── services/
│       │   │   ├── vision.py                     # multimodal LLM call (item ID + condition)
│       │   │   ├── market_search.py               # secondary-market scrape/search tool
│       │   │   └── shipping.py                    # weight -> postal fee estimation
│       │   ├── models/
│       │   │   └── schemas.py                     # Pydantic request/response models
│       │   └── config.py                          # env-driven settings (API keys, model names)
│       ├── requirements.txt
│       └── .env.example
│
├── packages/
│   └── db/
│       └── prisma/
│           └── schema.prisma          # Listing, Order, User models (Supabase Postgres)
│
├── turbo.json / pnpm-workspace.yaml   # monorepo task orchestration (web + api dev/build in parallel)
└── README.md
```

**Data flow:**

1. `ImageDropzone.tsx` uploads the image directly to Supabase Storage (signed URL from a Next.js route handler), then POSTs the resulting public/object URL to the Next.js `api/analyze-item` route.
2. That route forwards the request to the FastAPI engine (`POST /api/analyze-item`), keeping the LLM/search API keys off the client.
3. FastAPI runs the LangGraph pipeline: vision identification → secondary-market pricing search → synthesis into a structured payload (`title`, `description`, `category`, `listing_price`, `estimated_shipping_weight`, plus `condition`/`manufacturer`).
4. The Next.js frontend receives that JSON and pre-fills `ListingProfileForm.tsx` for a one-click publish.
5. On checkout, `SquareCheckout.tsx` combines `listing_price` + regional sales tax + a postal fee derived from `estimated_shipping_weight`, requires the buyer to accept the **No Return Policy**, and submits a card nonce + order metadata to `api/square/create-payment`, which calls the Square Payments API server-side.
6. Once Square confirms the charge, `create-payment/route.ts` flips the `Listing` to `SOLD` and creates the `Order` in one transaction, writes an in-app `Notification` for the seller in that same transaction, then (best-effort, outside the transaction) emails the seller via `lib/email.ts`.

## Local dev (not run automatically — see below)

This scaffold intentionally does **not** install dependencies or start dev servers as part of authoring it. To bring it up locally:

```
# frontend
cd apps/web && pnpm install && pnpm dev

# backend
cd apps/api && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt && uvicorn app.main:app --reload
```
