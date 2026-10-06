import { BadgeCheck } from "lucide-react";

// Centang biru: akun sudah diverifikasi (kode di bio Instagram, dicek admin)
export default function VerifiedBadge({ show, size = 14, className = "" }: { show?: boolean | null; size?: number; className?: string }) {
  if (!show) return null;
  return (
    <BadgeCheck
      size={size}
      aria-label="Terverifikasi"
      className={`inline-block shrink-0 align-middle ml-1 fill-blue-500 text-white ${className}`}
    />
  );
}
