"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCirclePlusEnabled } from "@/lib/appSettings";
import ChooseCircleTypeModal from "./ChooseCircleTypeModal";
import CreateCircleModal from "./CreateCircleModal";
import CircleCreatedDialog from "./CircleCreatedDialog";

export default function CreateCircleBanner() {
  const supabase = createClient();
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [showChooser, setShowChooser] = useState(false);
  const [createType, setCreateType] = useState<"regular" | "plus" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    getCirclePlusEnabled(supabase).then(setCirclePlusEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="bg-gray-800 rounded-2xl p-5 flex items-center justify-between gap-4">
      <p className="text-white font-semibold text-lg leading-snug">
        Buat Circlemu sekarang juga
      </p>
      <button
        onClick={() => setShowChooser(true)}
        className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2.5 font-medium whitespace-nowrap shrink-0"
      >
        <Plus size={18} />
        Buat Circle
      </button>

      {showChooser && (
        <ChooseCircleTypeModal
          circlePlusEnabled={circlePlusEnabled}
          onClose={() => setShowChooser(false)}
          onChoose={(type) => {
            setCreateType(type);
            setShowChooser(false);
          }}
        />
      )}

      {createType && (
        <CreateCircleModal
          circleType={createType}
          onClose={() => setCreateType(null)}
          onCreated={() => setShowSuccess(true)}
        />
      )}

      {showSuccess && <CircleCreatedDialog onClose={() => setShowSuccess(false)} />}
    </section>
  );
}
