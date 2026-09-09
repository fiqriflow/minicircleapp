"use client";

import { useEffect, useMemo, useState } from "react";
import CircleCard, { Circle } from "@/components/circle/CircleCard";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function UpcomingCirclesSection({
  circles,
  defaultCoverMap = {},
  joinedCounts = {},
  currentUserId = null,
}: {
  circles: Circle[];
  defaultCoverMap?: Record<string, string>;
  joinedCounts?: Record<string, number>;
  currentUserId?: string | null;
}) {
  // Cuma tanggal yang beneran ada circle-nya yang ditampilin (sisanya di-hide).
  const datesWithEvents = useMemo(() => {
    const map = new Map<string, Date>();
    circles.forEach((c) => {
      const d = new Date(c.event_date);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      if (!map.has(key)) map.set(key, d);
    });
    return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [circles]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (datesWithEvents.length === 0) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate((prev) => {
      if (prev && datesWithEvents.some((d) => isSameDay(d, prev))) return prev;
      return datesWithEvents[0];
    });
  }, [datesWithEvents]);

  const filteredCircles = useMemo(
    () => (selectedDate ? circles.filter((c) => isSameDay(new Date(c.event_date), selectedDate)) : []),
    [circles, selectedDate]
  );

  const monthLabel = selectedDate?.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Circle yang Akan Datang</h2>
        {monthLabel && <span className="text-sm text-gray-400">{monthLabel}</span>}
      </div>

      {datesWithEvents.length === 0 ? (
        <p className="text-gray-400 text-sm">Belum ada kegiatan yang akan datang.</p>
      ) : (
        <>
          {/* Date scroller - cuma nampilin tanggal yang ada circle-nya */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {datesWithEvents.map((date) => {
              const active = !!selectedDate && isSameDay(date, selectedDate);
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center shrink-0 w-14 h-16 rounded-xl border ${
                    active ? "bg-primary text-white border-primary" : "bg-white text-gray-600 hover:border-primary"
                  }`}
                >
                  <span className="text-[10px] opacity-80">{DAY_LABELS[date.getDay()]}</span>
                  <span className="text-lg font-semibold">{date.getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Card event pada tanggal terpilih */}
          <div className="grid grid-cols-1 gap-4">
            {filteredCircles.map((c) => (
              <CircleCard
                key={c.id}
                circle={c}
                defaultCoverMap={defaultCoverMap}
                joinedCount={joinedCounts[c.id]}
                currentUserId={currentUserId}
                isJoined
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
