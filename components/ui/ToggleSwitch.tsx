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
      className={`relative inline-flex shrink-0 items-center w-14 h-8 rounded-full border-2 transition-colors duration-150 disabled:opacity-50 ${
        checked ? "bg-primary border-primary-edge" : "bg-gray-200 border-gray-300"
      }`}
    >
      <span
        className={`absolute left-0 top-[-2px] h-8 w-8 flex items-center justify-center transition-transform duration-150 ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      >
        <span className="h-6 w-6 rounded-full bg-white border-b-2 border-gray-300 shadow-sm" />
      </span>
    </button>
  );
}
