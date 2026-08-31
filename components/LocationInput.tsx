"use client";

import { INDONESIA_CITIES } from "@/lib/locations";

export default function LocationInput({
  id,
  value,
  onChange,
  placeholder = "Ketik nama kota...",
  className = "w-full border rounded-xl px-4 py-2",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <>
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={id}>
        {INDONESIA_CITIES.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </>
  );
}
