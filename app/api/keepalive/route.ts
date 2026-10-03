import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Dipanggil Vercel Cron tiap hari -> ada query ke DB biar Supabase gak di-pause.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = Buffer.from(request.headers.get("authorization") ?? "");
    const want = Buffer.from(`Bearer ${secret}`);
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.from("app_settings").select("key").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
