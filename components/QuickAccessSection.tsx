"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, Footprints, PersonStanding, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCirclePlusEnabled } from "@/lib/appSettings";
import ChooseCircleTypeModal from "./ChooseCircleTypeModal";
import CreateCircleModal from "./CreateCircleModal";
import CircleCreatedDialog from "./CircleCreatedDialog";

const CATEGORY_BUTTONS = [
  { label: "Circle Lari", category: "Jogging", icon: Footprints },
  { label: "Circle Gowes", category: "Gowes", icon: Bike },
  { label: "Circle Jalan Santai", category: "Jalan Santai", icon: PersonStanding },
];

export default function QuickAccessSection() {
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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Quick Access</h2>
      <div className="grid grid-cols-4 gap-3">
        {CATEGORY_BUTTONS.map(({ label, category, icon: Icon }) => (
          <Link
            key={label}
            href={{ pathname: "/explore", query: { category } }}
            className="flex flex-col items-center gap-2 bg-white border rounded-2xl p-3 hover:border-primary hover:bg-primary/5 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Icon size={20} />
            </div>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </Link>
        ))}

        <button
          onClick={() => setShowChooser(true)}
          className="flex flex-col items-center gap-2 bg-white border rounded-2xl p-3 hover:border-primary hover:bg-primary/5 text-center"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Plus size={20} />
          </div>
          <span className="text-xs font-medium leading-tight">Buat Circle</span>
        </button>
      </div>

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
