"use client";

import { useState } from "react";

export default function JoinQuestionModal({
  question,
  onCancel,
  onSubmit,
}: {
  question: string;
  onCancel: () => void;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="font-bold">Sebelum Join...</h2>
        <p className="text-sm text-gray-600">{question}</p>
        <textarea
          className="w-full border rounded-xl px-3 py-2"
          rows={3}
          placeholder="Jawaban kamu..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 text-gray-500">Batal</button>
          <button
            onClick={() => onSubmit(answer)}
            disabled={!answer.trim()}
            className="flex-1 bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            Kirim & Join
          </button>
        </div>
      </div>
    </div>
  );
}
