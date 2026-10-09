"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  canPromptInstall,
  initPwaInstall,
  isIOS,
  isStandalone,
  promptInstall,
  subscribePwaInstall,
} from "@/lib/pwaInstall";

type Status = "loading" | "installed" | "ready" | "ios" | "manual";

export default function InstallPwaRow() {
  const [status, setStatus] = useState<Status>("loading");
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initPwaInstall();
    const sync = () => {
      if (isStandalone()) setStatus("installed");
      else if (canPromptInstall()) setStatus("ready");
      else if (isIOS()) setStatus("ios");
      else setStatus("manual");
    };
    sync();
    return subscribePwaInstall(sync);
  }, []);

  if (status === "loading") return null;

  const handleClick = async () => {
    if (status === "installed" || busy) return;
    if (status === "ready") {
      setBusy(true);
      try {
        const res = await promptInstall();
        if (res === "accepted") toast.success("Aplikasi sedang dipasang");
      } finally {
        setBusy(false);
      }
      return;
    }
    setShowHelp((v) => !v);
  };

  const hint =
    status === "installed"
      ? "Sudah terpasang di perangkat ini"
      : status === "ready"
      ? "Pasang ke layar utama, buka lebih cepat"
      : "Lihat cara memasang aplikasi";

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "installed" || busy}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:hover:bg-transparent"
      >
        <Download size={18} className="text-gray-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install Aplikasi</p>
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
        {status !== "installed" && (
          <span className="text-xs font-semibold text-primary">{status === "ready" ? "Install" : "Cara"}</span>
        )}
      </button>
      {showHelp && (
        <div className="px-4 pb-3 text-xs text-gray-500 space-y-1">
          {status === "ios" ? (
            <>
              <p>1. Buka lewat Safari.</p>
              <p>2. Ketuk tombol Bagikan (ikon kotak dengan panah).</p>
              <p>3. Pilih &quot;Tambah ke Layar Utama&quot;.</p>
            </>
          ) : (
            <>
              <p>1. Buka menu browser (titik tiga).</p>
              <p>2. Pilih &quot;Install app&quot; atau &quot;Tambahkan ke layar utama&quot;.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
