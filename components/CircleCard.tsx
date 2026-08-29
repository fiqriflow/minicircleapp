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

export default function CircleCard({ circle }: { circle: Circle }) {
  return (
    <Link
      href={`/circle/${circle.id}`}
      className="block bg-white rounded-2xl border overflow-hidden hover:shadow-md transition"
    >
      <div className="h-32 bg-gray-200">
        {circle.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={circle.cover_url} alt={circle.name} className="w-full h-full object-cover" />
        )}
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
