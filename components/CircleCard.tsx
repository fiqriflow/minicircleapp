"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Tag } from "lucide-react";
import { getCircleDisplayStatus, STATUS_LABEL } from "@/lib/circleStatus";
import { resolveCircleCover } from "@/lib/appSettings";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  location: string;
  event_date: string;
  cover_url: string | null;
  status: string;
  max_participants?: number | null;
};

export default function CircleCard({
  circle,
  defaultCoverMap,
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
  const cover = resolveCircleCover(defaultCoverMap ?? {}, circle.category, circle.cover_url);
  const [coverError, setCoverError] = useState(false);

  const pct = max ? Math.min(100, Math.round((joined / max) * 100)) : 0;

  return (
    <Link
      href={`/circle/${circle.id}`}
      className="block bg-white rounded-2xl border overflow-hidden hover:shadow-md transition"
    >
      <div className="h-32 bg-gray-200 relative">
        {cover && !coverError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={circle.name}
            className="w-full h-full object-cover"
            onError={() => setCoverError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-400 text-xs font-medium">Cover belum diatur</span>
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-semibold">{circle.name}</h3>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Tag size={14} /> {circle.category}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <MapPin size={14} /> {circle.location}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Calendar size={14} /> {new Date(circle.event_date).toLocaleString("id-ID")}
        </div>

        {max && (
          <div className="pt-1 space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Slot Terisi</span>
              <span className="font-medium text-gray-600">{joined}/{max}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
