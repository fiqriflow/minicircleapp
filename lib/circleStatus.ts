export type CircleDisplayStatus = "open" | "full" | "ongoing" | "completed" | "cancelled";

export function getCircleDisplayStatus(
  circle: { status: string; event_date: string; started_at?: string | null },
  capacity?: { joined: number; max: number | null | undefined }
): CircleDisplayStatus {
  if (circle.status === "cancelled") return "cancelled";
  if (circle.status === "completed") return "completed";

  const start = new Date(circle.event_date);
  const now = new Date();

  // host menandai mulai lebih awal -> langsung "Berlangsung"
  if (now < start && circle.started_at) return "ongoing";

  if (now < start) {
    if (capacity?.max && capacity.joined >= capacity.max) return "full";
    return "open";
  }
  // Sudah lewat jam mulai: tetap "Berlangsung" sampai host menekan "Tandai Selesai"
  // (tidak ada auto-selesai; kalau host lupa, DB kirim notif pengingat esok harinya).
  return "ongoing";
}

export function isCircleFull(joined: number, max: number | null | undefined): boolean {
  return !!max && joined >= max;
}

export const STATUS_LABEL: Record<CircleDisplayStatus, { label: string; className: string }> = {
  open: { label: "Dibuka", className: "bg-blue-100 text-blue-700" },
  full: { label: "Penuh", className: "bg-orange-100 text-orange-700" },
  ongoing: { label: "Berlangsung", className: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Selesai", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Dibatalkan", className: "bg-red-100 text-red-600" },
};
