# Anantkaal IoT Manufacturing Portal

Internal admin portal for managing IoT device manufacturing, client
assignment, firmware, and OTA updates. Built and operated by Anantkaal LLP
(Surat, India) — an R&D electronics company producing ESP32/ESP8266-based
IoT devices for clients including Indian Railways, L&T, and Tata Motors.

## Who is building this

The developer is an embedded systems engineer — deeply experienced with
ESP32/STM32 firmware, PCB design, GSM modules, and RF systems, but a
**beginner at web and backend development**. Explain web concepts when they
come up. Do not assume familiarity with React data flow, server components,
ORMs, or auth patterns. Embedded and hardware concepts need no explanation.

## Scope

This is **site 1 of 2**. Site 1 is the internal admin portal (this project).
Site 2 will be a client-facing portal, built later. Do not build site 2
features now, but keep the ownership chain (Client → Product → Device)
intact on every table so client-scoped filtering can be added later.

**Auth model:** single hardcoded admin account. No registration page.
Client login comes in site 2.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma 6.19.3 |
| Database | PostgreSQL 18, local, **port 1294** (not 5432) |
| Password hashing | bcryptjs |

There is **no separate backend project**. Next.js serves both. Server
components query Prisma directly; `actions.ts` files hold mutations;
`app/api/*/route.ts` holds JSON endpoints for ESP32 devices.

## Database

Schema lives in `prisma/schema.prisma`. Read it before writing any query —
it is the source of truth, not this summary.

Models: `Admin`, `Client`, `Product`, `Device`, `Firmware`, `OtaJob`,
`OtaTarget`, `Counter`.

Key relations:

```
Client 1──* Product 1──* Device
              └──* Firmware 1──* OtaJob 1──* OtaTarget *──1 Device
```

Design decisions worth preserving:

- **Firmware belongs to a Product**, not global. This makes pushing the
  wrong firmware to the wrong chip structurally impossible — OTA targets
  are constrained to devices under the same product.
- **OtaJob vs OtaTarget** are separate. The job is "roll out v1.4.2"; each
  target is one device's copy with its own status. Single-device and bulk
  updates are therefore the same code path — a job with one target vs fifty.
- **Counter table** generates device serial numbers atomically. Increment
  inside a transaction and zero-pad to 6 digits (`String(v).padStart(6,"0")`).
  Never generate serials from a count query — concurrent flashes would collide.
- **Cellular fields are optional.** `Product.isCellular` flags GSM products;
  `Device.imei / iccid / operator / lastRssi` are null for WiFi devices.
  Modules in use: A7672S, SIM7600 series.
- `onDelete: Cascade` on Product→Firmware, but **not** Product→Device.
  Deleting a product with live devices must fail — those devices physically
  exist in the field.

## File structure

```
portal/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                  admin account + serial counter
├── lib/
│   └── prisma.ts                shared PrismaClient singleton
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx           sidebar + auth guard
│   │   ├── dashboard/
│   │   ├── clients/             page.tsx + actions.ts + [id]/
│   │   ├── products/
│   │   ├── devices/             + [mac]/
│   │   ├── flash/               Web Serial flashing station
│   │   ├── firmware/
│   │   └── ota/                 + [id]/
│   └── api/
│       ├── devices/register/    ESP32 posts MAC at flash time
│       └── ota/check/           ESP32 polls for updates
└── components/ui/               shadcn components
```

Parenthesised folders are route groups — they do not appear in the URL.
`app/(dashboard)/clients/page.tsx` serves `/clients`.

## Established patterns

Follow `app/(dashboard)/clients/` exactly. It is the reference
implementation. Every new page matches its shape.

**Page** — async server component, queries Prisma directly:

```tsx
export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  });
  return <table>{/* ... */}</table>;
}
```

**Mutations** — `actions.ts` with `"use server"`, always call
`revalidatePath` or the UI will not update:

```ts
"use server";
export async function createClient(formData: FormData) {
  await prisma.client.create({ data: { /* ... */ } });
  revalidatePath("/clients");
}
```

Rules:
- No `useEffect` + `fetch` for page data. Query Prisma in the server component.
- No API routes for browser actions. Use server actions.
- API routes are **only** for ESP32 devices.
- `"use client"` only where interactivity genuinely requires it (Web Serial,
  multi-select tables, filter state).

## Build order

1. Clients — DONE
2. Products (client dropdown, `isCellular` toggle, chip family)
3. Devices (filterable table; manual add form first)
4. Admin login + route protection
5. `POST /api/devices/register` — flash-time registration
6. Flash station (Web Serial via esptool-js, serial generation, QR)
7. Firmware upload (bin file, SHA-256, size)
8. OTA jobs + `GET /api/ota/check`

Do not start step 6 before steps 2–5 work. The flash station depends on
products existing, devices being creatable, and knowing the logged-in admin.

## Device-side contract (for later steps)

- Devices are ESP32/ESP8266 on WiFi or GSM (A7672S / SIM7600).
- OTA uses **HTTP polling**, not push. Device calls `/api/ota/check` with
  its MAC and current version; server returns 204 or a bin URL + SHA-256.
- Always return SHA-256 with the binary. The device verifies before reboot.
  Half-downloaded firmware over a flaky GSM link is the top cause of
  bricked fleets.
- GSM bandwidth costs money. Never stream logs continuously; fetch on demand.
- Support HTTP `Range` requests on firmware downloads so a dropped GSM
  connection resumes instead of restarting.

## Conventions

- When changing existing code, show only the changed lines, not whole files.
- Explain web/backend concepts; skip explanation of embedded concepts.
- Prefer editing the reference pattern over inventing a new one.