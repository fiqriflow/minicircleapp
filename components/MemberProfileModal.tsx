"use client";

import { MapPin, Instagram as InstagramIcon, X } from "lucide-react";

export default function MemberProfileModal({
  profile,
  onClose,
}: {
  profile: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>

        <div className="flex flex-col items-center gap-2 pt-2">
          <img
            src={profile.avatar_url || "https://ui-avatars.com/api/?name=" + (profile.full_name || "U")}
            alt=""
            className="w-20 h-20 rounded-full object-cover border"
          />
          <h3 className="font-bold text-lg">{profile.nickname || profile.full_name}</h3>
          {profile.full_name && profile.nickname && (
            <p className="text-sm text-gray-400">{profile.full_name}</p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2 justify-center">
            {profile.categories?.map((c: string) => (
              <span key={c} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{c}</span>
            ))}
          </div>
          {profile.location && (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <MapPin size={14} /> {profile.location}
            </div>
          )}
          {profile.instagram && (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <InstagramIcon size={14} /> {profile.instagram}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
