"use client";

import { useMemo, useState } from "react";
import CircleCard, { Circle } from "./CircleCard";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_SHOWN = 14;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function UpcomingCirclesSection({
  circles,
  defaultCoverMap = {},
  joinedCounts = {},
}: {
  circles: Circle[];
  defaultCoverMap?: Record<string, string>;
  joinedCounts?: Record<string, number>;
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const dateStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_SHOWN }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const hasEvent = circles.some((c) => isSameDay(new Date(c.event_date), d));
      return { date: d, hasEvent };
    });
  }, [circles]);

  const filteredCircles = useMemo(
    () => circles.filter((c) => isSameDay(new Date(c.event_date), selectedDate)),
    [circles, selectedDate]
  );

  const monthLabel = selectedDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Circle yang Akan Datang</h2>
        <span className="text-sm text-gray-400">{monthLabel}</span>
      </div>

      {/* Date scroller */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {dateStrip.map(({ date, hasEvent }) => {
          const active = isSameDay(date, selectedDate);
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
              <span
                className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  hasEvent ? (active ? "bg-white" : "bg-primary") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Card event pada tanggal terpilih */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCircles.length ? (
          filteredCircles.map((c) => (
            <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} />
          ))
        ) : (
          <p className="text-gray-400 text-sm">Tidak ada circle di tanggal ini.</p>
        )}
      </div>
    </section>
  );
}
