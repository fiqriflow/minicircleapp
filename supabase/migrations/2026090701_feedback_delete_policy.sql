-- Izinkan super admin hapus feedback/masukan
drop policy if exists "feedback_delete_admin" on feedback;
create policy "feedback_delete_admin" on feedback for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
