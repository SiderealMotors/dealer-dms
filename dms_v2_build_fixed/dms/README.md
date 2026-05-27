# Sidereal Motors — DMS v2

Full-stack Dealer Management System: **NestJS + Prisma + PostgreSQL** API, **Next.js 14** frontend, **Supabase Auth + Realtime**. Built for small Ontario used-car dealerships.

---

## What's included

| Module | Features |
|--------|---------|
| **Inventory** | Vehicle CRUD, lot days, profit engine, status badges, CSV export, Realtime sync |
| **CRM** | Customers, leads (Kanban pipeline), deals, tasks, interaction logs |
| **Accounting** | Double-entry GL, chart of accounts (Ontario), journal entries, trial balance, general ledger |
| **Expenses** | Full expense tracking by category, auto-posts to GL + HST ITC, CSV export |
| **HST** | Quarterly HST collected vs paid summary, net remittance to CRA |
| **Reports** | Income statement, balance sheet, vehicle profit, bill of sale (print-to-PDF) |
| **Settings** | Dealer info, HST number, OMVIC number, salesperson commission rules |
| **Website widget** | Embeddable inventory widget + lead capture form for your existing website |

---

## Cost: $0/month to start

| Service | Plan | Cost |
|---------|------|------|
| Supabase (DB + Auth + Realtime + Storage) | Free tier | $0 |
| Railway (backend API) | Free tier (500h/mo) | $0 |
| Vercel (frontend) | Free tier | $0 |

Upgrade Railway to $5/mo Hobby plan when you need 24/7 uptime without sleep.

---

## Quick start (local)

### Prerequisites
- Node.js 20+
- A Supabase project (free at supabase.com)

### 1. Install dependencies
```bash
npm install          # installs all workspaces
```

### 2. Configure backend
```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
SUPABASE_JWT_SECRET="[from Supabase → Settings → API → JWT Secret]"
FRONTEND_ORIGIN="http://localhost:3000"
```

### 3. Configure frontend
```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your anon key]
```

### 4. Run database migrations + seed
```bash
cd backend
npx prisma migrate deploy    # runs all migrations
npx prisma db seed           # seeds chart of accounts + sample data
```

### 5. Start both servers
```bash
# Terminal 1 — backend (port 4000)
cd backend && npm run start:dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Production deployment

### Backend → Railway

1. Push this repo to GitHub
2. Create new Railway project → Deploy from GitHub → select this repo
3. Set root directory: `backend`
4. Add environment variables (same as `.env` above, plus production values)
5. Railway auto-detects NestJS and deploys

### Frontend → Vercel

1. Import repo into Vercel
2. Set root directory: `frontend`
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Deploy

### Run migrations on production
```bash
# From local machine, targeting production DB:
cd backend
DATABASE_URL="your-production-url" npx prisma migrate deploy
DATABASE_URL="your-production-url" npx prisma db seed
```

---

## Supabase setup

### Auth
1. Create users in Supabase Dashboard → Authentication → Users
2. For each user, edit their `app_metadata` to add role:
   ```json
   { "role": "ADMIN" }
   ```
   Valid roles: `ADMIN`, `SALES`, `ACCOUNTANT`
3. After first login, the DMS will sync the Supabase user ID to the User table

### Realtime (inventory live sync)
```sql
-- Run in Supabase SQL editor:
alter publication supabase_realtime add table "Vehicle";
alter table "Vehicle" replica identity full;
```

### Storage (vehicle photos)
1. In Supabase Dashboard → Storage → Create bucket: `vehicle-photos`
2. Set bucket to public
3. Upload photos via the DMS inventory form

---

## Website integration

### Embed inventory widget on your website

Add this to any page on your website (WordPress, Squarespace, Wix, custom HTML):

```html
<div id="sidereal-inventory"></div>
<script>
  window.DMS_API_BASE = 'https://your-api.railway.app';
</script>
<script src="https://your-frontend.vercel.app/widget.js"></script>
```

The widget:
- Shows all **Available** vehicles with photos, price, specs
- Search + filter by make and max price
- "Enquire" button creates a CRM lead automatically (source: WEB)
- Works on any website — no framework required

### Allow your website domain in backend CORS

In backend `.env`:
```
FRONTEND_ORIGIN="https://your-frontend.vercel.app,https://www.your-website.com"
```

---

## Chart of accounts

The seed creates a full Ontario used-car dealer chart of accounts:

| Code | Account | Notes |
|------|---------|-------|
| 1000 | Cash – operating | Main chequing |
| 1200 | Vehicle inventory | Cost basis on lot |
| 1300 | HST receivable (ITC) | Input tax credits |
| 2200 | HST payable | 13% collected on sales → CRA |
| 4000 | Vehicle sales revenue | Pre-tax selling proceeds |
| 5000 | COGS – vehicles | Full acquisition cost |
| 6100–7400 | Operating expenses | Rent, insurance, advertising, etc. |

When a vehicle is marked sold, the system **automatically posts**:
1. Dr Cash/AR · Cr Revenue · Cr HST Payable (sale journal)
2. Dr COGS · Cr Vehicle Inventory (cost journal)

---

## Month-end checklist

1. **Review expenses** — ensure all bills entered in Expenses → GL auto-posted
2. **Income statement** — Reports → Income Statement (current month)
3. **HST summary** — Reports → HST Summary (quarterly)
4. **Trial balance** — Accounting → Trial Balance (as of month end)
5. **Vehicle profit** — Reports → Vehicle Profit (month range)
6. **Back up** — Supabase keeps 7-day rolling backups automatically

---

## Folder layout

```
dms/
  backend/          NestJS + Prisma API
    src/
      accounting/   Double-entry GL, reports
      auth/         Supabase JWT verification
      crm/          Customers, leads, deals, tasks
      expenses/     Expense tracking + HST
      inventory/    Vehicle CRUD + profit engine
      public/       Unauthenticated API for website widget
      settings/     Dealer config + commission rules
  frontend/         Next.js 14 App Router
    src/app/
      accounting/   GL journal entries, chart of accounts, trial balance
      crm/          CRM pipeline + kanban board
      expenses/     Expense log + category summary
      inventory/    Vehicle management
      reports/      Income statement, balance sheet, vehicle profit, HST, bill of sale
      settings/     Dealer info + commission rules
  packages/
    inventory-calculations/  Shared tax + profit engine (Ontario 13% HST)
  website-widget/   Embeddable inventory widget for customer website
```
