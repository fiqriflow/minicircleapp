export function getCircleDisplayStatus(circle: { status: string; event_date: string }): "active" | "completed" | "cancelled" {
  if (circle.status === "cancelled") return "cancelled";
  if (circle.status === "completed") return "completed";
  return new Date(circle.event_date) < new Date() ? "completed" : "active";
}
