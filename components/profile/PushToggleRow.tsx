"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, setPushOptOut } from "@/lib/push";

type Status = "loading" | "unsupported" | "denied" | "on" | "off";

export default function PushToggleRow() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await isPushSupported()) || !("Notification" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      let active = false;
      if (Notification.permission === "granted") {
        const reg = await navigator.serviceWorker.getRegistration();
        active = !!(reg && (await reg.pushManager.getSubscription()));
      }
      if (!cancelled) setStatus(active ? "on" : "off");
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (status === "on") {
        setPushOptOut(true);
        await unsubscribeFromPush();
        setStatus("off");
        toast.success("Notifikasi dimatikan di perangkat ini");
        return;
      }
      // dipanggil dari tap user -> aman untuk iOS
      const res = await subscribeToPush();
      if (res.ok) {
        setPushOptOut(false);
        setStatus("on");
        toast.success("Notifikasi aktif");
        return;
      }
      if (res.reason === "permission_denied") {
        if (typeof Notification !== "undefined" && Notification.permission === "denied") setStatus("denied");
        toast.error("Izin notifikasi ditolak");
      } else if (res.reason === "not_supported") {
        setStatus("unsupported");
      } else {
        toast.error("Gagal mengaktifkan notifikasi, coba lagi");
      }
    } catch {
      toast.error("Terjadi kesalahan, coba lagi");
    } finally {
      setBusy(false);
    }
  };

  const hint =
    status === "denied"
      ? "Diblokir. Aktifkan lewat pengaturan notifikasi browser/HP."
      : status === "unsupported"
      ? "Tidak didukung. Di iPhone, tambahkan app ke Layar Utama dulu."
      : status === "on"
      ? "Aktif di perangkat ini"
      : "Dapat info anggota baru, komentar, dan pengumuman";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Bell size={18} className="text-gray-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Notifikasi</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
      <ToggleSwitch
        checked={status === "on"}
        onChange={handleToggle}
        disabled={busy || status === "loading" || status === "unsupported" || status === "denied"}
        label="Aktifkan notifikasi"
      />
    </div>
  );
}
