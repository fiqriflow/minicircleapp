"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const GENDER_COLORS: Record<string, string> = {
  Pria: "#3b82f6",
  Wanita: "#ec4899",
  "Tidak diketahui": "#9ca3af",
};

export function UserGrowthChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <h3 className="font-semibold text-gray-700 mb-4">Pertumbuhan User</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="total" name="Total User" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GenderPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <h3 className="font-semibold text-gray-700 mb-4">Gender</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {data.map((entry) => (
              <Cell key={entry.name} fill={GENDER_COLORS[entry.name] ?? "#9ca3af"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const CIRCLE_STATUS_COLORS: Record<string, string> = {
  Dibuka: "#3b82f6",
  Berlangsung: "#eab308",
  Selesai: "#22c55e",
  Batal: "#ef4444",
};

export function CircleStatusDonutChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <h3 className="font-semibold text-gray-700 mb-4">Status Circle</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={CIRCLE_STATUS_COLORS[entry.name] ?? "#9ca3af"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
