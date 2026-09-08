"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const CONFIRM_PHRASE = "Saya Mengerti";

interface DeleteAccountModalProps {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({ onCancel, onConfirm }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const isMatch = confirmText.trim() === CONFIRM_PHRASE;

  const handleConfirm = async () => {
    if (!isMatch || deleting) return;
    setDeleting(true);
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="font-bold text-lg">Hapus Akun</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        <div className="text-sm text-gray-600 space-y-2">
          <p>Tindakan ini permanen. Setelah dihapus, data berikut akan hilang:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profil & foto profil Anda</li>
            <li>Keanggotaan di semua circle yang Anda ikuti</li>
            <li>Komentar yang pernah Anda buat</li>
          </ul>
          <p>
            Circle yang pernah Anda buat sebagai host <b>tidak ikut terhapus</b>, hanya statusnya jadi tanpa host.
          </p>
          <p className="text-gray-500">
            Anda tetap bisa login lagi dengan akun yang sama — sistem akan mengarahkan Anda mengisi ulang data dari awal, seperti daftar baru.
          </p>
        </div>

        <div>
          <label className="text-sm text-gray-500 block mb-1">
            Ketik <b>{CONFIRM_PHRASE}</b> untuk melanjutkan
          </label>
          <input
            className="w-full border rounded-xl px-4 py-2"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={deleting}
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 border rounded-xl py-3 font-medium text-gray-500"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isMatch || deleting}
            className="flex-1 bg-red-600 disabled:bg-red-300 text-white rounded-xl py-3 font-medium"
          >
            {deleting ? "Menghapus..." : "Hapus Akun"}
          </button>
        </div>
      </div>
    </div>
  );
}
