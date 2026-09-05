"use client";

import Link from "next/link";
import { MapPin, Tag, Crosshair, CalendarDays } from "lucide-react";
import { getCircleDisplayStatus, STATUS_LABEL } from "@/lib/circleStatus";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  city?: string | null;
  location: string;
  event_date: string;
  cover_url: string | null;
  status: string;
  max_participants?: number | null;
};

export default function CircleCard({
  circle,
  joinedCount,
}: {
  circle: Circle;
  defaultCoverMap?: Record<string, string>;
  joinedCount?: number;
}) {
  const max = circle.max_participants ?? null;
  const joined = joinedCount ?? 0;
  const displayStatus = getCircleDisplayStatus(circle, { joined, max });
  const statusInfo = STATUS_LABEL[displayStatus];
  const isFull = !!max && joined >= max;

  const pct = max ? Math.min(100, Math.round((joined / max) * 100)) : 0;

  return (
    <Link
      href={`/circle/${circle.id}`}
      className="block bg-white rounded-2xl border p-4 space-y-2 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{circle.name}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Tag size={14} /> {circle.category}
        </span>
        {circle.city && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {circle.city}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-500">
        <Crosshair size={14} className="shrink-0" /> {circle.location}
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-500">
        <CalendarDays size={14} className="shrink-0" />
        {new Date(circle.event_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        {" • "}
        {new Date(circle.event_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
      </div>

      {max && (
        <div className="pt-1 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Slot Terisi</span>
            <span className="font-medium text-gray-600">{joined}/{max}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${isFull ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}
