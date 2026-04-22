-- Coco Chick — step 5.
-- Notification responses: let franchisees accept / acknowledge / propose /
-- mark on-it / mark done on each HQ notification. HQ sees these updates
-- live on the /admin/dashboard "Needs attention" list.

alter table public.notifications
  add column if not exists status text not null default 'open',
  add column if not exists response_note text,
  add column if not exists responded_at timestamptz;

-- Status values used by the UI:
--   'open'         — default, no response yet
--   'accepted'     — franchisee agreed (coaching call)
--   'proposed'     — franchisee proposed a different time (see response_note)
--   'acknowledged' — franchisee acknowledged a warning notice
--   'in_progress'  — franchisee is working on it (nudge)
--   'done'         — franchisee finished the action (nudge)
