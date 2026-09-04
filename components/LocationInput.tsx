"use client";

import { useEffect, useState } from "react";
import { INDONESIA_CITIES } from "@/lib/locations";

export default function LocationInput({
  id,
  value,
  onChange,
  placeholder = "Ketik nama kota...",
  className = "w-full border rounded-xl px-4 py-2",
  strict = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  // strict=true (default): dipakai buat nyimpen domisili -> harus pilih persis dari daftar kota,
  // teks bebas yang gak cocok bakal di-reject pas blur. Set strict=false buat kolom search/filter
  // bebas (mis. Explore) yang gak butuh validasi ketat.
  strict?: boolean;
}) {
  if (!strict) {
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

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = (
    query.trim()
      ? INDONESIA_CITIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
      : INDONESIA_CITIES
  ).slice(0, 30);

  const handleSelect = (city: string) => {
    onChange(city);
    setQuery(city);
    setOpen(false);
  };

  const handleBlur = () => {
    const exact = INDONESIA_CITIES.find((c) => c.toLowerCase() === query.trim().toLowerCase());
    if (exact) {
      onChange(exact);
      setQuery(exact);
    } else {
      // gak cocok persis sama daftar -> jangan simpan teks bebas, balik ke value valid terakhir
      const fallback = INDONESIA_CITIES.includes(value) ? value : "";
      onChange(fallback);
      setQuery(fallback);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border rounded-xl shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((city) => (
              <button
                key={city}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(city)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary/5"
              >
                {city}
              </button>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-gray-400">Kota tidak ditemukan.</p>
          )}
        </div>
      )}
    </div>
  );
}
