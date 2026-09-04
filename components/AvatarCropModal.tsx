"use client";

import { useRef, useState } from "react";

export default function AvatarCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [offsetX, setOffsetX] = useState(50); // persen 0-100
  const [offsetY, setOffsetY] = useState(50);
  const [zoom, setZoom] = useState(1); // 1 = tanpa zoom, makin besar makin zoom in
  const imgRef = useRef<HTMLImageElement>(null);
  const imageUrl = useState(() => URL.createObjectURL(file))[0];

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    const baseSize = Math.min(img.naturalWidth, img.naturalHeight);
    const size = baseSize / zoom;
    const maxX = img.naturalWidth - size;
    const maxY = img.naturalHeight - size;
    const sx = (offsetX / 100) * maxX;
    const sy = (offsetY / 100) * maxY;

    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 500, 500);

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="font-bold text-center">Atur Posisi Foto</h2>

        <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-2 border-primary relative bg-gray-100">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="preview"
            className="absolute w-full h-full object-cover"
            style={{
              objectPosition: `${offsetX}% ${offsetY}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${offsetX}% ${offsetY}%`,
            }}
          />
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Zoom</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.1) * 10) / 10))}
                  className="w-6 h-6 flex items-center justify-center rounded-full border text-gray-500 leading-none"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
                  className="w-6 h-6 flex items-center justify-center rounded-full border text-gray-500 leading-none"
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Geser Horizontal</label>
            <input
              type="range"
              min={0}
              max={100}
              value={offsetX}
              onChange={(e) => setOffsetX(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Geser Vertikal</label>
            <input
              type="range"
              min={0}
              max={100}
              value={offsetY}
              onChange={(e) => setOffsetY(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 py-3 text-gray-500">Batal</button>
          <button onClick={handleConfirm} className="flex-1 bg-primary text-white rounded-xl py-3 font-medium">
            Gunakan Foto
          </button>
        </div>
      </div>
    </div>
  );
}
