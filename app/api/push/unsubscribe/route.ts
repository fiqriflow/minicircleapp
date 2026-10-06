import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Anti-CSRF: request lintas-origin ditolak.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  }

  const { endpoint } = await request.json().catch(() => ({}));

  if (!endpoint || typeof endpoint !== "string" || endpoint.length > 2048) {
    return NextResponse.json({ error: "endpoint wajib diisi" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  // RLS sudah jamin cuma bisa hapus milik sendiri (auth.uid() = user_id)
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
