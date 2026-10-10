"use client";

import { useEffect, useState } from "react";
import { Heart, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDonationUrl } from "@/lib/appSettings";

export default function DonateRow() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    getDonationUrl(supabase).then(setUrl).catch(() => {});
  }, []);

  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
    >
      <Heart size={18} className="text-pink-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Dukung Developer</p>
        <p className="text-xs text-gray-400">Traktir kopi sebagai apresiasi untuk aplikasi ini</p>
      </div>
      <ExternalLink size={16} className="text-gray-300" />
    </a>
  );
}
