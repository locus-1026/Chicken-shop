// Mock data — used when Supabase is not yet connected. The UI falls back to
// these values so the portal can be explored end-to-end out of the box.

import type {
  Announcement,
  ComplianceAudit,
  Franchisee,
  MarketingAsset,
  Outlet,
  Royalty,
  SalesReport,
  SupplyOrder,
  SupportTicket,
  TicketMessage,
  TrainingModule,
  TrainingProgress,
} from "./types";

export const mockFranchisees: Franchisee[] = [
  {
    id: "f-1",
    business_name: "Coco Chick PJ Sdn Bhd",
    owner_name: "Lim Chee Keong",
    ic_number: "750812-10-5533",
    contact: "+6012-345 6781",
    email: "lim@cocochick.my",
    agreement_start: "2021-01-10",
    agreement_end: "2027-01-09",
    status: "active",
    risk_flag: false,
  },
  {
    id: "f-2",
    business_name: "Coco Chick Central Sdn Bhd",
    owner_name: "Priya Nair",
    ic_number: "820315-14-4421",
    contact: "+6013-222 1188",
    email: "priya@cocochick.my",
    agreement_start: "2021-06-01",
    agreement_end: "2026-05-31",
    status: "active",
    risk_flag: false,
  },
  {
    id: "f-3",
    business_name: "Coco Chick Johor Sdn Bhd",
    owner_name: "Ahmad Fadzli",
    ic_number: "880922-01-6677",
    contact: "+6019-667 3322",
    email: "fadzli@cocochick.my",
    agreement_start: "2023-09-15",
    agreement_end: "2026-09-14",
    status: "active",
    risk_flag: true,
  },
  {
    id: "f-4",
    business_name: "Coco Chick Borneo Sdn Bhd",
    owner_name: "Kevin Ooi",
    ic_number: "910204-13-2211",
    contact: "+6016-889 7744",
    email: "kevin@cocochick.my",
    agreement_start: "2024-02-10",
    agreement_end: "2027-02-09",
    status: "active",
    risk_flag: false,
  },
];

export const mockOutlets: Outlet[] = [
  { id: "o-1", franchisee_id: "f-1", outlet_code: "CC-001", location: "Sunway Pyramid, Petaling Jaya", state: "Selangor",     opening_date: "2021-01-15", monthly_target: 180000, monthly_actual: 172400 },
  { id: "o-2", franchisee_id: "f-2", outlet_code: "CC-002", location: "Mid Valley Megamall, KL",       state: "Kuala Lumpur", opening_date: "2021-06-10", monthly_target: 200000, monthly_actual: 215600 },
  { id: "o-3", franchisee_id: "f-2", outlet_code: "CC-003", location: "Gurney Plaza, Georgetown",     state: "Penang",       opening_date: "2022-03-20", monthly_target: 160000, monthly_actual: 148200 },
  { id: "o-4", franchisee_id: "f-3", outlet_code: "CC-004", location: "Aeon Tebrau City, JB",         state: "Johor",        opening_date: "2023-09-25", monthly_target: 150000, monthly_actual: 112800 },
  { id: "o-5", franchisee_id: "f-4", outlet_code: "CC-005", location: "The Spring Bintawa, Kuching",  state: "Sarawak",      opening_date: "2024-02-20", monthly_target: 120000, monthly_actual:  98300 },
];

const monthKey = (offset: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - offset, 1);
  return d.toISOString().slice(0, 10);
};

// Deterministic multipliers so royalty totals are identical everywhere they're shown.
const multipliers = [0.97, 1.03, 1.0] as const;
export const mockRoyalties: Royalty[] = mockOutlets.flatMap((o) =>
  [3, 2, 1].map((back, idx) => {
    const gross = Math.round(o.monthly_actual * multipliers[idx]);
    const paid = back > 1;
    return {
      id: `r-${o.id}-${back}`,
      outlet_id: o.id,
      period: monthKey(back),
      gross_sales: gross,
      royalty_amount: Math.round(gross * 0.05),
      marketing_fee: Math.round(gross * 0.02),
      due_date: monthKey(back - 1),
      paid_at: paid ? new Date(Date.now() - back * 30 * 864e5).toISOString() : null,
      status: paid ? "paid" : back === 1 && o.outlet_code === "CC-003" ? "overdue" : "pending",
    } satisfies Royalty;
  })
);

// Simple deterministic wiggle — same across reloads.
const wiggle = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
export const mockSalesReports: SalesReport[] = mockOutlets.flatMap((o, oi) =>
  Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const avg = o.monthly_target / 30;
    const factor = 0.7 + wiggle(oi * 31 + i) * 0.6;
    return {
      id: `s-${o.id}-${i}`,
      outlet_id: o.id,
      report_date: d.toISOString().slice(0, 10),
      gross_sales: Math.round(avg * factor),
      transactions: Math.round(80 + wiggle(oi * 7 + i) * 60),
      notes: null,
    };
  })
);

export const mockTrainingModules: TrainingModule[] = [
  { id: "t-1", title: "Signature Chicken Rice Preparation", description: "Master the Hainanese poaching technique and the signature chilli sauce.", video_url: "https://example.com/v/1.mp4", materials_url: null, category: "Operations", passing_score: 80 },
  { id: "t-2", title: "Food Safety & Hygiene SOP",          description: "MOH-aligned food handling, temperature control, and cleaning protocols.",   video_url: "https://example.com/v/2.mp4", materials_url: "https://example.com/p/2.pdf", category: "Compliance", passing_score: 85 },
  { id: "t-3", title: "POS System Walkthrough",             description: "End-to-end tour of the Coco Chick POS, reports, and cashier shortcuts.",    video_url: "https://example.com/v/3.mp4", materials_url: null, category: "Technology",  passing_score: 75 },
  { id: "t-4", title: "Handling Customer Complaints",       description: "De-escalation and recovery playbooks for common front-line situations.",     video_url: "https://example.com/v/4.mp4", materials_url: null, category: "Service",     passing_score: 80 },
  { id: "t-5", title: "Brand Standards & Outlet Display",   description: "Storefront merchandising, uniforms, and signage guidelines.",                 video_url: null, materials_url: "https://example.com/p/5.pdf", category: "Brand", passing_score: 70 },
];

export const mockTrainingProgress: TrainingProgress[] = [
  { id: "tp-1", user_id: "u-1", module_id: "t-1", completed_at: new Date().toISOString(), score: 92, attempts: 1 },
  { id: "tp-2", user_id: "u-1", module_id: "t-2", completed_at: new Date().toISOString(), score: 88, attempts: 2 },
  { id: "tp-3", user_id: "u-1", module_id: "t-3", completed_at: null, score: null, attempts: 0 },
];

export const mockAudits: ComplianceAudit[] = [
  { id: "a-1", outlet_id: "o-1", audit_date: new Date(Date.now() - 15 * 864e5).toISOString().slice(0,10), score: 88, checklist_items: [{ item: "Food temperature log", pass: true }, { item: "Staff uniform", pass: true }, { item: "Back kitchen cleanliness", pass: false }], auditor: "HQ Ops — Tan", signed_off_by: "Chan Kok Weng", risk_flag: false, notes: null },
  { id: "a-2", outlet_id: "o-1", audit_date: new Date(Date.now() - 90 * 864e5).toISOString().slice(0,10), score: 92, checklist_items: [{ item: "Food temperature log", pass: true }, { item: "Staff uniform", pass: true }], auditor: "HQ Ops — Tan", signed_off_by: "Chan Kok Weng", risk_flag: false, notes: null },
  { id: "a-3", outlet_id: "o-3", audit_date: new Date(Date.now() - 10 * 864e5).toISOString().slice(0,10), score: 74, checklist_items: [{ item: "Food temperature log", pass: false }, { item: "Back kitchen cleanliness", pass: false }], auditor: "HQ Ops — Tan", signed_off_by: "Chan Kok Weng", risk_flag: true, notes: "Follow-up scheduled." },
  { id: "a-4", outlet_id: "o-4", audit_date: new Date(Date.now() - 14 * 864e5).toISOString().slice(0,10), score: 68, checklist_items: [{ item: "Food temperature log", pass: false }, { item: "Back kitchen cleanliness", pass: false }, { item: "Staff hygiene", pass: false }], auditor: "HQ Ops — Raj", signed_off_by: "Chan Kok Weng", risk_flag: true, notes: "Risk flag raised." },
];

export const mockMarketingAssets: MarketingAsset[] = [
  { id: "m-1", title: "Ramadan Kaw Kaw Set Poster",    category: "Seasonal Promotions", file_url: "#", thumbnail_url: null, file_type: "pdf" },
  { id: "m-2", title: "IG Reel — Signature Rice",      category: "Social Media",        file_url: "#", thumbnail_url: null, file_type: "zip" },
  { id: "m-3", title: "A1 Menu Board 2025",            category: "Menu Boards",         file_url: "#", thumbnail_url: null, file_type: "pdf" },
  { id: "m-4", title: "Counter Tent Card — Combo",     category: "In-Store POS",        file_url: "#", thumbnail_url: null, file_type: "pdf" },
  { id: "m-5", title: "Merdeka Facebook Cover",        category: "Social Media",        file_url: "#", thumbnail_url: null, file_type: "jpg" },
  { id: "m-6", title: "Father's Day Table Talker",     category: "Seasonal Promotions", file_url: "#", thumbnail_url: null, file_type: "pdf" },
];

export const mockTickets: SupportTicket[] = [
  { id: "tk-1", outlet_id: "o-1", category: "IT / POS",       subject: "Receipt printer jams on peak hour", description: "Paper keeps jamming from 12:30 onwards.", photo_url: null, status: "in_progress", created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
  { id: "tk-2", outlet_id: "o-1", category: "Supply Chain",   subject: "Short of chilli paste",              description: "Need 10 more tubs by Friday.",           photo_url: null, status: "open",        created_at: new Date(Date.now() - 1 * 864e5).toISOString() },
  { id: "tk-3", outlet_id: "o-1", category: "Marketing",      subject: "Missing Mother's Day posters",       description: "Haven't received courier yet.",          photo_url: null, status: "resolved",    created_at: new Date(Date.now() - 6 * 864e5).toISOString() },
];

export const mockAnnouncements: Announcement[] = [
  { id: "an-1", title: "Welcome to the Coco Chick Portal", body: "Your new home for sales reporting, training, royalties, and support. Pinned forever.", pinned: true,  publish_at: new Date(Date.now() - 30 * 864e5).toISOString(), target_role: null },
  { id: "an-2", title: "May Drop: Mother's Day Bundle",    body: "New creative assets are live in the Marketing tab. Campaign runs 3–12 May.",           pinned: false, publish_at: new Date(Date.now() - 3  * 864e5).toISOString(), target_role: null },
  { id: "an-3", title: "Food Safety Refresher Audit — Q2", body: "Audit window 1 May – 30 May. Please make sure your temperature logs are up to date.",   pinned: false, publish_at: new Date(Date.now() - 1  * 864e5).toISOString(), target_role: null },
];

// In the demo we pretend the current franchisee is Lim Chee Keong (CC-001).
export const DEMO_FRANCHISEE_ID = "f-1";
export const DEMO_OUTLET_ID = "o-1";

// Demo login PINs — one per outlet. Last 4 digits of outlet code.
// In production these would be Supabase Auth passwords.
// Bridge between real Supabase outlet ids (UUIDs) and the mock ids ("o-1" …)
// used throughout the seeded mock datasets. Pass the signed-in outlet (which
// has the real UUID + outlet_code) and you get back the mock id to filter with.
// Falls back to the real id when nothing matches.
export function resolveMockOutletId(outlet: { id: string; outlet_code: string }): string {
  const match = mockOutlets.find((o) => o.outlet_code === outlet.outlet_code);
  return match?.id ?? outlet.id;
}

export const outletPins: Record<string, string> = {
  "o-1": "1001",
  "o-2": "1002",
  "o-3": "1003",
  "o-4": "1004",
  "o-5": "1005",
};

// Threaded replies on support tickets.
const d = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();
export const mockTicketMessages: TicketMessage[] = [
  { id: "tm-1",  ticket_id: "tk-1", author: "franchisee", author_name: "Lim Chee Keong", body: "Paper keeps jamming from 12:30 onwards. Tried reseating the roll — no luck.", created_at: d(48) },
  { id: "tm-2",  ticket_id: "tk-1", author: "hq",         author_name: "HQ Support — Mei",   body: "Sorry for the pain. A tech will call within 2 hours. In the meantime, can you try cleaning the thermal head with isopropyl? Guide: hq.link/printer-clean", created_at: d(46) },
  { id: "tm-3",  ticket_id: "tk-1", author: "franchisee", author_name: "Lim Chee Keong", body: "Cleaned — still jamming. Staff on standby for the tech call.", created_at: d(40) },
  { id: "tm-4",  ticket_id: "tk-1", author: "hq",         author_name: "HQ Support — Mei",   body: "Tech en route — ETA 45 mins. Replacement printer dispatched as backup.", created_at: d(38) },
  { id: "tm-5",  ticket_id: "tk-2", author: "franchisee", author_name: "Lim Chee Keong", body: "Need 10 more tubs of chilli paste by Friday — weekend promo incoming.", created_at: d(24) },
  { id: "tm-6",  ticket_id: "tk-2", author: "hq",         author_name: "HQ Supply — Fazli",  body: "Added 10 tubs to your next delivery run (Thurs AM). No extra charge since it's within the monthly quota.", created_at: d(20) },
  { id: "tm-7",  ticket_id: "tk-3", author: "franchisee", author_name: "Lim Chee Keong", body: "Haven't received the Mother's Day posters. Campaign starts Monday.", created_at: d(144) },
  { id: "tm-8",  ticket_id: "tk-3", author: "hq",         author_name: "HQ Marketing — Sara", body: "Courier re-dispatched. Tracking: MY838124XX. Also sharing the print-ready PDF if you want to print locally as a fallback.", created_at: d(140) },
  { id: "tm-9",  ticket_id: "tk-3", author: "franchisee", author_name: "Lim Chee Keong", body: "Received, thanks!", created_at: d(100) },
  { id: "tm-10", ticket_id: "tk-3", author: "hq",         author_name: "HQ Marketing — Sara", body: "Glad it landed. Closing this ticket — reopen anytime.", created_at: d(96) },
];

export const mockSupplyOrders: SupplyOrder[] = [
  {
    id: "so-1", outlet_id: "o-1", submitted_at: new Date(Date.now() - 21 * 864e5).toISOString(), status: "delivered",
    delivered_at: new Date(Date.now() - 18 * 864e5).toISOString(), tracking_note: "Delivered by KTM Logistics — signed by En. Lim.",
    items: [
      { sku: "chilli",      name: "Signature chilli paste", unit: "1kg tub",  qty: 8, unit_price: 28 },
      { sku: "rice",        name: "Premium jasmine rice",   unit: "10kg bag", qty: 4, unit_price: 95 },
      { sku: "box-regular", name: "Takeaway box (regular)", unit: "100 pcs",  qty: 3, unit_price: 42 },
    ],
    total: 8 * 28 + 4 * 95 + 3 * 42,
  },
  {
    id: "so-2", outlet_id: "o-1", submitted_at: new Date(Date.now() - 7 * 864e5).toISOString(), status: "shipped",
    tracking_note: "In transit — ETA tomorrow afternoon.",
    items: [
      { sku: "ginger",  name: "Ginger-scallion oil", unit: "500ml", qty: 6, unit_price: 22 },
      { sku: "soy",     name: "Dark soy reduction",  unit: "1L",    qty: 4, unit_price: 18 },
    ],
    total: 6 * 22 + 4 * 18,
  },
  {
    id: "so-3", outlet_id: "o-1", submitted_at: new Date(Date.now() - 2 * 864e5).toISOString(), status: "confirmed",
    items: [
      { sku: "uniform",    name: "Staff uniform polo",      unit: "1 pc",    qty: 4, unit_price: 55 },
      { sku: "box-family", name: "Takeaway box (family)",   unit: "50 pcs",  qty: 2, unit_price: 38 },
    ],
    total: 4 * 55 + 2 * 38,
  },
  {
    id: "so-4", outlet_id: "o-2", submitted_at: new Date(Date.now() - 5 * 864e5).toISOString(), status: "delivered",
    delivered_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    items: [
      { sku: "chilli", name: "Signature chilli paste", unit: "1kg tub", qty: 5, unit_price: 28 },
    ],
    total: 5 * 28,
  },
  {
    id: "so-5", outlet_id: "o-3", submitted_at: new Date(Date.now() - 3 * 864e5).toISOString(), status: "submitted",
    items: [
      { sku: "rice",   name: "Premium jasmine rice", unit: "10kg bag", qty: 3, unit_price: 95 },
      { sku: "pandan", name: "Pandan essence",       unit: "250ml",    qty: 2, unit_price: 14 },
    ],
    total: 3 * 95 + 2 * 14,
  },
];
