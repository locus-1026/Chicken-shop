-- Admins need to see every row in announcement_reads so the "Read receipts"
-- modal on /admin/announcements actually shows opened vs pending status.
-- Without this, the existing self-only policy filters admins' SELECT down
-- to their own reads and the page always reads "pending".
--
-- Safe to run multiple times.

drop policy if exists "admin read announcement_reads" on public.announcement_reads;
create policy "admin read announcement_reads"
  on public.announcement_reads
  for select
  using (public.is_admin());
