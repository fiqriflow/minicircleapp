import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { endpoint } = await request.json().catch(() => ({}));

  if (!endpoint || typeof endpoint !== "string") {
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
