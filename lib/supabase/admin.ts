import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// PENTING: file ini cuma boleh dipakai di server (route handler / server
// action), TIDAK PERNAH di-import dari komponen client. Service role key
// bisa bypass semua RLS.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
