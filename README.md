# CampusConnect

CampusConnect is a production-grade, multi-tenant campus grievance and issue resolution platform built with the **Aether Civic** design system. Engineered with a strictly stateless architecture, CampusConnect deploys seamlessly to Vercel and cloud platforms without local disk dependencies.

Admins register on the main site to provision their isolated campus workspace (e.g. `<campus>.yourdomain.com` or `/c/<campus>`). Residents endorse priorities, Gemini AI inspects and triages reports, and field workers resolve issues with verified accountability.

---

## Key Features & Role Architecture

- **Aether Civic Design System**: Authoritative institutional typography (`Playfair Display` serif headings, `Archivo Narrow` compact grotesque body), skyward atmospheric glassmorphism, pill geometry (`rounded-full`), and soft sky tint KPI cards.
- **Strict Role Isolation**:
  1. **User (Resident)**: Campus Feed, My Tickets, and **Resolved History** showing who fixed each issue (name and job title, e.g. *Ramesh Kumar, Plumber*) with the completion date.
  2. **Worker (Field Staff)**: Assigned jobs only; one-click "Mark as solved" with an optional note about what was broken or fixed. Workers cannot access admin pages.
  3. **Admin & Co-Admin**: Real-time overview KPIs, all campus tickets, inline worker assignment, resolve/reject actions, and campus member & role management.
  4. **Founder (Platform Super-Admin)**: Global multi-tenant telemetry across all campuses with operational status ('active' or 'suspended') and breakdown counts, with the power to suspend or reactivate campuses. The founder sees aggregate statistics only, never private chat content.
- **Server-Side Gemini AI Triage**: Automated clarity scoring (1–10), safety check, hazard urgency ranking, and actionable maintenance instructions.
- **Stateless Cloud Storage**: Incident attachments upload directly to Vercel Blob or Supabase Storage; zero files touch local server disk.
- **Cryptographic Security**: Per-user salt with `scrypt` password hashing and HMAC SHA-256 signed session tokens with 7-day expiration.

---

## Responsive Breakpoints & Accessibility

The Aether Civic design system is fully responsive and tested across all standard viewport widths:
- **390px (Mobile)**: Compact single-column feed, streamlined floating navigation capsule, stacked action rows, touch-friendly 44px+ touch targets.
- **768px (Tablet)**: 2-column ticket grid, inline filters, tablet-optimized KPI metrics.
- **1024px (Laptop)**: 3-column grid, expanded top navigation bar with quick role switchers, multi-column admin dispatch table.
- **1440px (Desktop)**: Full 12-column layout, max-w-7xl anchored white sheet container, side-by-side incident thread dialogs.

### Accessibility & Reduced-Motion
- **Visible Focus States**: Global `:focus-visible` ring (`outline: 2px solid #003bbe; outline-offset: 2px;`) ensures keyboard navigation compliance.
- **Reduced-Motion Support**: Honors `@media (prefers-reduced-motion: reduce)` by clamping transition and animation durations to 0.001ms for users with vestibular sensitivities.

---

## Environment Variables Reference

Configure these in your `.env` or Vercel Project Settings:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | Optional | PostgreSQL connection string (Neon, Supabase, Cloud SQL) with `?sslmode=require`. Falls back to smart in-memory mock if omitted. |
| `SESSION_SECRET` | Required | 32+ character random secret used for signing HMAC-SHA256 user authentication tokens. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for server-side AI report triage. Deterministic fallback engine is used if absent. |
| `GEMINI_MODEL` | Optional | Gemini model identifier (default: `gemini-2.5-flash`). |
| `APP_URL` | Optional | Public URL where the application is hosted (e.g. `https://yourdomain.com`). |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob storage token for photo proof uploads. |
| `FOUNDER_REGISTRATION_KEY` | Optional | Secret key to provision initial global Founder accounts. |

---

## Vercel Deployment Guide

### 1. Standard Deployment
1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New Project** and import your repository.
3. In **Build & Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. In **Environment Variables**, add:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `GEMINI_API_KEY`
   - `BLOB_READ_WRITE_TOKEN` (optional for cloud photo uploads)
5. Click **Deploy**. The PostgreSQL schema auto-initializes upon first request.

---

## Configuring Wildcard Domains (`*.yourdomain.com`) with Vercel Nameservers

CampusConnect is built for multi-tenancy where each campus gets its own dedicated subdomain (e.g., `iitd.yourdomain.com`, `stanford.yourdomain.com`, `cambridge.yourdomain.com`).

Follow these steps to route all subdomains automatically to your deployment:

### Step 1: Add Custom Domain & Wildcard in Vercel
1. Open your project in the **Vercel Dashboard**.
2. Go to **Settings** > **Domains**.
3. Add your apex domain: `yourdomain.com`
4. Add the wildcard domain: `*.yourdomain.com`

### Step 2: Configure Vercel Nameservers at Your Domain Registrar
To enable seamless wildcard SSL certificates and automatic DNS routing for unlimited campus subdomains, switch your domain's DNS to Vercel Nameservers:

1. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, Google Domains/Squarespace, etc.).
2. Navigate to **DNS Management** or **Custom Nameservers**.
3. Replace the existing registrar nameservers with Vercel's authoritative nameservers:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
4. Save changes. DNS propagation typically takes between a few minutes and 24 hours.

### Step 3: Automatic Wildcard SSL & Subdomain Routing
- Vercel automatically generates and renews a free Let's Encrypt wildcard SSL certificate covering `*.yourdomain.com`.
- Any incoming request to `<campus>.yourdomain.com` is automatically routed to your CampusConnect deployment.
- The client-side application detects the campus subdomain via `detectCampusSlug()` in `src/api.ts` (e.g. `iitd.yourdomain.com` extracts `iitd`), seamlessly loading that campus's isolated workspace.
- In local development or preview deployments where wildcard DNS is not available, the app automatically supports path-based routing: `/c/<campus-slug>` (e.g. `localhost:3000/c/iitd`).

---

## Verification & Testing

Run the full isolation and role boundary test suite:
```bash
npm run test:isolation
```

Run static type checking:
```bash
npm run lint
```

Build for production:
```bash
npm run build
```
