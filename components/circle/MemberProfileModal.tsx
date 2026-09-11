"use client";

import { useEffect, useState } from "react";
import { X, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCircleDisplayStatus } from "@/lib/circleStatus";

const GENDER_LABEL: Record<string, string> = { male: "Pria", female: "Wanita" };

export default function MemberProfileModal({
  profile,
  onClose,
  onReport,
}: {
  profile: any;
  onClose: () => void;
  onReport?: () => void;
}) {
  const supabase = createClient();
  const [circleStats, setCircleStats] = useState<{ hostCircle: number; joinCircle: number } | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;

    const load = async () => {
      // Host Circle = circle yang dia buat, SUDAH SELESAI & SUKSES (>80% peserta check-in)
      const { data: hostedCircles } = await supabase
        .from("circles")
        .select("id, status, event_date")
        .eq("created_by", profile.id);

      const completedIds = (hostedCircles ?? [])
        .filter((c: any) => getCircleDisplayStatus(c) === "completed")
        .map((c: any) => c.id);

      let hostCircle = 0;
      if (completedIds.length) {
        const { data: attendanceRows } = await supabase
          .from("circle_members")
          .select("circle_id, checked_in")
          .in("circle_id", completedIds)
          .eq("status", "joined");

        const byCircle: Record<string, { total: number; checked: number }> = {};
        (attendanceRows ?? []).forEach((r: any) => {
          if (!byCircle[r.circle_id]) byCircle[r.circle_id] = { total: 0, checked: 0 };
          byCircle[r.circle_id].total += 1;
          if (r.checked_in) byCircle[r.circle_id].checked += 1;
        });
        hostCircle = Object.values(byCircle).filter((v) => v.total > 0 && v.checked / v.total > 0.8).length;
      }

      // Join Circle = circle ORANG LAIN yang dia join, SUDAH SELESAI & dia HADIR (checked-in)
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("checked_in, circle:circles(id, created_by, status, event_date)")
        .eq("user_id", profile.id)
        .eq("status", "joined");

      const joinCircle = (memberships ?? []).filter((m: any) => {
        if (!m.circle) return false;
        if (m.circle.created_by === profile.id) return false;
        if (!m.checked_in) return false;
        return getCircleDisplayStatus(m.circle) === "completed";
      }).length;

      if (active) setCircleStats({ hostCircle, joinCircle });
    };
    load();
    return () => {
      active = false;
    };
  }, [profile?.id]);

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

        {circleStats && (
          <div className="flex items-center justify-center gap-6 py-1">
            <div className="text-center">
              <p className="text-sm text-gray-600 leading-tight">
                Host
                <br />
                Circle
              </p>
              <p className="font-bold text-lg">{circleStats.hostCircle}</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <p className="text-sm text-gray-600 leading-tight">
                Join
                <br />
                Circle
              </p>
              <p className="font-bold text-lg">{circleStats.joinCircle}</p>
            </div>
          </div>
        )}

        <div className="border rounded-2xl p-4 space-y-4 text-sm">
          {profile.location && (
            <div>
              <p className="text-gray-400">Kota/Domisili</p>
              <p className="font-semibold text-gray-900">{profile.location}</p>
            </div>
          )}
          {GENDER_LABEL[profile.gender] && (
            <div>
              <p className="text-gray-400">Gender</p>
              <p className="font-semibold text-gray-900">{GENDER_LABEL[profile.gender]}</p>
            </div>
          )}
          {profile.instagram && (
            <div>
              <p className="text-gray-400">Akun Instagram</p>
              <p className="font-semibold text-gray-900">{profile.instagram}</p>
            </div>
          )}
          {profile.categories?.length > 0 && (
            <div>
              <p className="text-gray-400 mb-2">Aktivitas Disukai</p>
              <div className="flex flex-wrap gap-2">
                {profile.categories.map((c: string) => (
                  <span key={c} className="text-xs font-semibold bg-orange-50 text-orange-500 px-3 py-1.5 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {onReport && (
          <button
            onClick={onReport}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-red-500 pt-1"
          >
            <Flag size={14} /> Laporkan Pengguna
          </button>
        )}
      </div>
    </div>
  );
}

