import Link from "next/link";
import { MapPin, Calendar, Tag } from "lucide-react";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  location: string;
  event_date: string;
  cover_url: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Berlangsung", className: "bg-green-100 text-green-700" },
  completed: { label: "Selesai", className: "bg-gray-200 text-gray-600" },
  cancelled: { label: "Dibatalkan", className: "bg-red-100 text-red-600" },
};

export default function CircleCard({ circle }: { circle: Circle }) {
  const statusInfo = STATUS_LABEL[circle.status] ?? STATUS_LABEL.active;

  return (
    <Link
      href={`/circle/${circle.id}`}
      className="block bg-white rounded-2xl border overflow-hidden hover:shadow-md transition"
    >
      <div className="h-32 bg-gray-200 relative">
        {circle.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={circle.cover_url} alt={circle.name} className="w-full h-full object-cover" />
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
      </div>
    </Link>
  );
}
