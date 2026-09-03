"use client";

import { useRouter } from "next/navigation";
import { Users, Sparkles } from "lucide-react";

export default function ChooseCircleTypeModal({
  circlePlusEnabled = true,
  onClose,
  onChoose,
}: {
  circlePlusEnabled?: boolean;
  onClose: () => void;
  onChoose: (type: "regular" | "plus") => void;
}) {
  const router = useRouter();

  const handleChoosePlus = () => {
    if (!circlePlusEnabled) {
      onClose();
      router.push("/coming-soon");
      return;
    }
    onChoose("plus");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="font-bold text-lg text-center">Pilih Jenis Circle</h2>

        <button
          onClick={() => onChoose("regular")}
          className="w-full flex items-start gap-3 border rounded-xl p-4 text-left hover:border-primary hover:bg-primary/5"
        >
          <Users className="text-primary shrink-0 mt-1" size={22} />
          <div>
            <p className="font-semibold">Circle</p>
            <p className="text-sm text-gray-500">3-6 orang, tampil publik di Explore.</p>
          </div>
        </button>

        <button
          onClick={handleChoosePlus}
          className="w-full flex items-start gap-3 border rounded-xl p-4 text-left hover:border-primary hover:bg-primary/5"
        >
          <Sparkles className="text-primary shrink-0 mt-1" size={22} />
          <div className="flex items-center gap-2">
            <div>
              <p className="font-semibold">
                Circle+ {!circlePlusEnabled && <span className="text-xs text-gray-400 font-normal">(Segera Hadir)</span>}
              </p>
              <p className="text-sm text-gray-500">
                Hingga 12 orang, custom cover, bisa privat/invite only, link undangan sendiri, dan pertanyaan saat join.
              </p>
            </div>
          </div>
        </button>

        <button onClick={onClose} className="w-full py-2 text-gray-400 text-sm">
          Batal
        </button>
      </div>
    </div>
  );
}
