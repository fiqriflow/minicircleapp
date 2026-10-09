import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isAllowedPushEndpoint } from "@/lib/pushEndpoint";

const MAX_SUBS_PER_USER = 10;

// Anti-CSRF: request lintas-origin ditolak. Origin aneh ("null"/rusak) juga ditolak (bukan 500).
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  }

  const { subscription } = await request.json().catch(() => ({}));

  if (
    !isAllowedPushEndpoint(subscription?.endpoint) ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth ||
    typeof subscription.keys.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string" ||
    subscription.keys.p256dh.length > 256 ||
    subscription.keys.auth.length > 64
  ) {
    return NextResponse.json({ error: "Subscription tidak valid" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  // Pakai service role: endpoint yang sama bisa masih tercatat milik user LAIN
  // (HP/browser bersama, logout tanpa unsubscribe, sesi habis). Upsert via RLS
  // akan ditolak -> user baru tidak pernah dapat push & user lama tetap
  // menerima notif di device itu. User ini sudah terautentikasi dan memegang
  // subscription-nya, jadi kepemilikan dipindah ke dia.
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      created_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan subscription" }, { status: 500 });
  }

  // Batasi jumlah device per user (cegah fan-out/spam kirim ke ribuan endpoint palsu).
  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (rows && rows.length > MAX_SUBS_PER_USER) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", rows.slice(MAX_SUBS_PER_USER).map((r) => r.id));
  }

  return NextResponse.json({ success: true });
}
