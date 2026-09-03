const EVENT_DURATION_HOURS = 3; // asumsi durasi kegiatan, dipakai untuk status "Berlangsung"

export type CircleDisplayStatus = "open" | "full" | "ongoing" | "completed" | "cancelled";

export function getCircleDisplayStatus(
  circle: { status: string; event_date: string },
  capacity?: { joined: number; max: number | null | undefined }
): CircleDisplayStatus {
  if (circle.status === "cancelled") return "cancelled";
  if (circle.status === "completed") return "completed";

  const start = new Date(circle.event_date);
  const end = new Date(start.getTime() + EVENT_DURATION_HOURS * 60 * 60 * 1000);
  const now = new Date();

  if (now < start) {
    if (capacity?.max && capacity.joined >= capacity.max) return "full";
    return "open";
  }
  if (now >= start && now <= end) return "ongoing";
  return "completed"; // sudah lewat, otomatis dianggap selesai
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
