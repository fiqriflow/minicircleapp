export type NotificationType =
  | "member_joined"
  | "join_request"
  | "new_comment"
  | "circle_completed"
  | "circle_cancelled"
  | "slot_available";

export type AppNotification = {
  id: string;
  user_id: string;
  circle_id: string | null;
  actor_id: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(supabase: any, userId: string): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function markAllAsRead(supabase: any, userId: string) {
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
}

export async function markAsRead(supabase: any, notificationId: string) {
  await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
}

// Dipakai host saat membuka tab "Komen Grup" biar notif "komen baru" circle itu ke-reset
// (supaya trigger di DB bisa bikin notif baru lagi utk komen berikutnya).
export async function markCommentNotifRead(supabase: any, userId: string, circleId: string) {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("circle_id", circleId)
    .eq("type", "new_comment")
    .eq("is_read", false);
}

export async function clearAllNotifications(supabase: any, userId: string) {
  await supabase.from("notifications").delete().eq("user_id", userId);
}

export async function deleteNotification(supabase: any, notificationId: string) {
  await supabase.from("notifications").delete().eq("id", notificationId);
}

// Panggil ini tiap kali komponen notif dibuka/mount: nutup circle yg waktunya udah lewat + bikin notif "selesai" ke host.
// Aman dipanggil berkali-kali (idempotent di sisi DB).
export async function refreshCompletedCircles(supabase: any) {
  await supabase.rpc("mark_completed_circles");
}
