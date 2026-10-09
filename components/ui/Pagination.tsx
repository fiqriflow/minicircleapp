"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
};

// resetKey: isi dengan search/filter -> halaman kembali ke 1 saat berubah.
export function usePagination<T>(items: T[], resetKey: string = "") {
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages); // aman kalau data berkurang (mis. setelah hapus)

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  const pagination: PaginationState = {
    page: current,
    pageSize,
    total: items.length,
    totalPages,
    setPage,
    setPageSize,
  };
  return { pageItems, pagination };
}

export default function Pagination({ page, pageSize, total, totalPages, setPage, setPageSize }: PaginationState) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-sm text-gray-500">
      <div className="flex items-center gap-2">
        <span>Tampilkan</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="border rounded-lg px-2 py-1 bg-white"
          aria-label="Jumlah data per halaman"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          per halaman · {from}–{to} dari {total}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="border rounded-lg p-1.5 bg-white disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className="border rounded-lg p-1.5 bg-white disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
