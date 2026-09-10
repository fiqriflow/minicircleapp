-- Fix: upsert ke push_subscriptions butuh policy UPDATE juga, kemarin kelewat.
-- Tanpa ini, subscribe ulang di endpoint yang sama (device yang sama) gagal
-- dengan error "new row violates row-level security policy".
create policy "push_subscriptions_update_own" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
