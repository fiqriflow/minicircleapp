"use client";

import { X } from "lucide-react";

export default function PolicyModal({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>
        <iframe
          src={url + (url.includes("?") ? "&" : "?") + "embed=1"}
          className="flex-1 w-full"
        />
      </div>
    </div>
  );
}
