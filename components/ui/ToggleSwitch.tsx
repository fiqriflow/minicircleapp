"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}

export default function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-label={label}
      aria-pressed={checked}
      className={`relative inline-flex shrink-0 items-center w-14 h-8 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute left-0 top-0 h-8 w-8 flex items-center justify-center transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      >
        <span className="h-6 w-6 rounded-full bg-white shadow-md" />
      </span>
    </button>
  );
}
