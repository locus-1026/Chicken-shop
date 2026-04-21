-- Coco Chick seed data
-- Run AFTER 0001_init.sql

-- Franchisees
insert into public.franchisees (id, business_name, owner_name, ic_number, contact, email, agreement_start, agreement_end, status) values
  ('11111111-1111-1111-1111-111111111101', 'Coco Chick PJ Sdn Bhd', 'Lim Chee Keong', '750812-10-5533', '+6012-345 6781', 'lim@cocochick.my', '2021-01-10', '2027-01-09', 'active'),
  ('11111111-1111-1111-1111-111111111102', 'Coco Chick Central Sdn Bhd', 'Priya Nair', '820315-14-4421', '+6013-222 1188', 'priya@cocochick.my', '2021-06-01', '2026-05-31', 'active'),
  ('11111111-1111-1111-1111-111111111103', 'Coco Chick Johor Sdn Bhd', 'Ahmad Fadzli', '880922-01-6677', '+6019-667 3322', 'fadzli@cocochick.my', '2023-09-15', '2026-09-14', 'active'),
  ('11111111-1111-1111-1111-111111111104', 'Coco Chick Borneo Sdn Bhd', 'Kevin Ooi', '910204-13-2211', '+6016-889 7744', 'kevin@cocochick.my', '2024-02-10', '2027-02-09', 'active');

-- Outlets
insert into public.outlets (id, franchisee_id, outlet_code, location, state, opening_date, monthly_target, monthly_actual) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'CC-001', 'Sunway Pyramid, Petaling Jaya',      'Selangor',   '2021-01-15', 180000, 172400),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 'CC-002', 'Mid Valley Megamall, Kuala Lumpur',   'Kuala Lumpur','2021-06-10', 200000, 215600),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'CC-003', 'Gurney Plaza, Georgetown',           'Penang',     '2022-03-20', 160000, 148200),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 'CC-004', 'Aeon Tebrau City, Johor Bahru',      'Johor',      '2023-09-25', 150000, 112800),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111104', 'CC-005', 'The Spring Bintawa, Kuching',        'Sarawak',    '2024-02-20', 120000,  98300);

-- Training modules
insert into public.training_modules (id, title, description, video_url, materials_url, category, passing_score) values
  ('33333333-3333-3333-3333-333333333301', 'Signature Chicken Rice Preparation', 'Master the Hainanese poaching technique and signature chilli sauce.', 'https://example.com/videos/chicken-rice.mp4', null, 'Operations', 80),
  ('33333333-3333-3333-3333-333333333302', 'Food Safety & Hygiene SOP', 'MOH-aligned food handling, temperature control, and cleaning protocols.', 'https://example.com/videos/food-safety.mp4', 'https://example.com/pdfs/food-safety.pdf', 'Compliance', 85),
  ('33333333-3333-3333-3333-333333333303', 'POS System Walkthrough', 'End-to-end tour of the Coco Chick POS, reports, and cashier shortcuts.', 'https://example.com/videos/pos.mp4', null, 'Technology', 75),
  ('33333333-3333-3333-3333-333333333304', 'Handling Customer Complaints', 'De-escalation and recovery playbooks for common front-line situations.', 'https://example.com/videos/complaints.mp4', null, 'Service', 80),
  ('33333333-3333-3333-3333-333333333305', 'Brand Standards & Outlet Display', 'Storefront merchandising, uniform, and signage guidelines.', null, 'https://example.com/pdfs/brand-standards.pdf', 'Brand', 70);

-- Royalties (3 months)
insert into public.royalties (outlet_id, period, gross_sales, due_date, status, paid_at) values
  ('22222222-2222-2222-2222-222222222201', date_trunc('month', current_date - interval '3 month')::date, 168500, (date_trunc('month', current_date - interval '3 month') + interval '14 days')::date, 'paid',   now() - interval '70 days'),
  ('22222222-2222-2222-2222-222222222201', date_trunc('month', current_date - interval '2 month')::date, 175200, (date_trunc('month', current_date - interval '2 month') + interval '14 days')::date, 'paid',   now() - interval '40 days'),
  ('22222222-2222-2222-2222-222222222201', date_trunc('month', current_date - interval '1 month')::date, 172400, (date_trunc('month', current_date - interval '1 month') + interval '14 days')::date, 'pending', null),

  ('22222222-2222-2222-2222-222222222202', date_trunc('month', current_date - interval '3 month')::date, 208800, (date_trunc('month', current_date - interval '3 month') + interval '14 days')::date, 'paid',   now() - interval '68 days'),
  ('22222222-2222-2222-2222-222222222202', date_trunc('month', current_date - interval '2 month')::date, 221100, (date_trunc('month', current_date - interval '2 month') + interval '14 days')::date, 'paid',   now() - interval '38 days'),
  ('22222222-2222-2222-2222-222222222202', date_trunc('month', current_date - interval '1 month')::date, 215600, (date_trunc('month', current_date - interval '1 month') + interval '14 days')::date, 'pending', null),

  ('22222222-2222-2222-2222-222222222203', date_trunc('month', current_date - interval '3 month')::date, 152400, (date_trunc('month', current_date - interval '3 month') + interval '14 days')::date, 'paid',   now() - interval '69 days'),
  ('22222222-2222-2222-2222-222222222203', date_trunc('month', current_date - interval '2 month')::date, 144800, (date_trunc('month', current_date - interval '2 month') + interval '14 days')::date, 'paid',   now() - interval '39 days'),
  ('22222222-2222-2222-2222-222222222203', date_trunc('month', current_date - interval '1 month')::date, 148200, (date_trunc('month', current_date - interval '1 month') + interval '14 days')::date, 'overdue', null),

  ('22222222-2222-2222-2222-222222222204', date_trunc('month', current_date - interval '3 month')::date, 119400, (date_trunc('month', current_date - interval '3 month') + interval '14 days')::date, 'paid',   now() - interval '67 days'),
  ('22222222-2222-2222-2222-222222222204', date_trunc('month', current_date - interval '2 month')::date, 108200, (date_trunc('month', current_date - interval '2 month') + interval '14 days')::date, 'paid',   now() - interval '37 days'),
  ('22222222-2222-2222-2222-222222222204', date_trunc('month', current_date - interval '1 month')::date, 112800, (date_trunc('month', current_date - interval '1 month') + interval '14 days')::date, 'pending', null),

  ('22222222-2222-2222-2222-222222222205', date_trunc('month', current_date - interval '3 month')::date,  92200, (date_trunc('month', current_date - interval '3 month') + interval '14 days')::date, 'paid',   now() - interval '66 days'),
  ('22222222-2222-2222-2222-222222222205', date_trunc('month', current_date - interval '2 month')::date, 101300, (date_trunc('month', current_date - interval '2 month') + interval '14 days')::date, 'paid',   now() - interval '36 days'),
  ('22222222-2222-2222-2222-222222222205', date_trunc('month', current_date - interval '1 month')::date,  98300, (date_trunc('month', current_date - interval '1 month') + interval '14 days')::date, 'pending', null);

-- Daily sales (last 30 days, rough synthetic)
insert into public.sales_reports (outlet_id, report_date, gross_sales, transactions)
select o.id,
       (current_date - (g || ' days')::interval)::date,
       round((o.monthly_target/30.0) * (0.7 + random() * 0.6))::numeric(12,2),
       floor(80 + random()*60)::int
from public.outlets o, generate_series(1,30) g;

-- Compliance audits
insert into public.compliance_audits (outlet_id, audit_date, score, checklist_items, auditor, signed_off_by) values
  ('22222222-2222-2222-2222-222222222201', current_date - 90, 92, '[{"item":"Food temperature log","pass":true},{"item":"Staff uniform","pass":true},{"item":"Signage condition","pass":true}]'::jsonb, 'HQ Ops — Tan', 'Chan Kok Weng'),
  ('22222222-2222-2222-2222-222222222201', current_date - 15, 88, '[{"item":"Food temperature log","pass":true},{"item":"Staff uniform","pass":true},{"item":"Back kitchen cleanliness","pass":false}]'::jsonb, 'HQ Ops — Tan', 'Chan Kok Weng'),

  ('22222222-2222-2222-2222-222222222202', current_date - 88, 95, '[{"item":"Food temperature log","pass":true},{"item":"Staff uniform","pass":true}]'::jsonb, 'HQ Ops — Mei', 'Chan Kok Weng'),
  ('22222222-2222-2222-2222-222222222202', current_date - 12, 91, '[{"item":"Food temperature log","pass":true},{"item":"Staff uniform","pass":true}]'::jsonb, 'HQ Ops — Mei', 'Chan Kok Weng'),

  ('22222222-2222-2222-2222-222222222203', current_date - 85, 78, '[{"item":"Food temperature log","pass":false},{"item":"Staff uniform","pass":true},{"item":"Signage condition","pass":true}]'::jsonb, 'HQ Ops — Tan', 'Chan Kok Weng'),
  ('22222222-2222-2222-2222-222222222203', current_date - 10, 74, '[{"item":"Food temperature log","pass":false},{"item":"Back kitchen cleanliness","pass":false}]'::jsonb, 'HQ Ops — Tan', 'Chan Kok Weng'),

  ('22222222-2222-2222-2222-222222222204', current_date - 80, 82, '[{"item":"Food temperature log","pass":true},{"item":"Staff uniform","pass":true}]'::jsonb, 'HQ Ops — Raj', 'Chan Kok Weng'),
  ('22222222-2222-2222-2222-222222222204', current_date - 14, 68, '[{"item":"Food temperature log","pass":false},{"item":"Back kitchen cleanliness","pass":false},{"item":"Staff hygiene","pass":false}]'::jsonb, 'HQ Ops — Raj', 'Chan Kok Weng'),

  ('22222222-2222-2222-2222-222222222205', current_date - 60, 86, '[{"item":"Food temperature log","pass":true}]'::jsonb, 'HQ Ops — Mei', 'Chan Kok Weng');

-- Marketing assets
insert into public.marketing_assets (title, category, file_url, thumbnail_url, file_type) values
  ('Ramadan Kaw Kaw Set Poster', 'Seasonal Promotions', 'https://example.com/assets/ramadan.pdf', 'https://example.com/thumbs/ramadan.jpg', 'pdf'),
  ('IG Reel Template — Signature Rice', 'Social Media', 'https://example.com/assets/reel.zip', 'https://example.com/thumbs/reel.jpg', 'zip'),
  ('A1 Menu Board — 2025', 'Menu Boards', 'https://example.com/assets/menu-a1.pdf', 'https://example.com/thumbs/menu.jpg', 'pdf'),
  ('Counter Tent Card — Combo', 'In-Store POS', 'https://example.com/assets/tent.pdf', 'https://example.com/thumbs/tent.jpg', 'pdf'),
  ('Merdeka Facebook Cover', 'Social Media', 'https://example.com/assets/merdeka.jpg', 'https://example.com/thumbs/merdeka.jpg', 'jpg');

-- Announcements
insert into public.announcements (title, body, pinned) values
  ('Welcome to the Coco Chick Portal', 'Your new home for sales reporting, training, royalties, and support. Pinned forever — check the weekly section below.', true),
  ('May Marketing Drop: Mother''s Day Bundle', 'Creative assets are live in the Marketing tab. Use them on your Instagram before May 10.', false),
  ('Food Safety Refresher Audit — Q2', 'Upcoming audit window 1 May – 30 May 2026. Please make sure your temperature logs are up to date.', false);
