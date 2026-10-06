import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAllowedPushEndpoint } from "@/lib/pushEndpoint";

export async function POST(request: Request) {
  // Anti-CSRF: request lintas-origin ditolak.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
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

  // upsert biar aman kalau endpoint yang sama register ulang
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
