-- Kunci insert komentar kalau circle-nya sudah completed/cancelled (bukan cuma dikunci di client).
drop policy if exists "comments_insert_member" on circle_comments;
create policy "comments_insert_member" on circle_comments for insert with check (
  auth.uid() = user_id and
  exists (select 1 from circle_members m where m.circle_id = circle_comments.circle_id and m.user_id = auth.uid()) and
  exists (select 1 from circles c where c.id = circle_comments.circle_id and c.status = 'active')
);
