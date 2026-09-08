import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

// Endpoint ini DIPANGGIL SUPABASE (Database Webhook), bukan dari browser.
// Diproteksi pakai shared secret di header, bukan session login.
// Setup: Supabase Dashboard > Database > Webhooks > tabel `notifications`,
// event INSERT, kirim ke URL ini dengan header:
//   x-webhook-secret: <PUSH_WEBHOOK_SECRET>

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Pesan singkat buat judul notif berdasarkan tipe (isi lengkap tetap pakai message dari DB)
const TITLE_BY_TYPE: Record<string, string> = {
  member_joined: "Anggota baru",
  join_request: "Ada yang mau join",
  new_comment: "Komentar baru",
  circle_completed: "Circle selesai",
  circle_cancelled: "Circle dibatalkan",
  slot_available: "Slot kosong tersedia",
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID key belum di-setup" }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const record = payload?.record;

  if (!record?.user_id || !record?.message) {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const url = record.circle_id ? `/circle/${record.circle_id}` : "/";
  const notifPayload = JSON.stringify({
    title: TITLE_BY_TYPE[record.type] || "Mincle",
    body: record.message,
    url,
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notifPayload
        );
        sent += 1;
      } catch (err: any) {
        // 404/410 = subscription udah gak valid (uninstall, clear data, dll) -> bersihkan
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return NextResponse.json({ sent, cleaned: staleIds.length });
}
