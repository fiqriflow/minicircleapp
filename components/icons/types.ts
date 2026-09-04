export interface DualToneIconProps {
  /** Ukuran icon (px). Default 22. */
  size?: number;
  /** Warna cincin/garis luar saat aktif. */
  activeTone1?: string;
  /** Warna isian dalam saat aktif. */
  activeTone2?: string;
  /** Warna cincin/garis luar saat tidak aktif. */
  inactiveTone1?: string;
  /** Warna isian dalam saat tidak aktif. */
  inactiveTone2?: string;
  active?: boolean;
  className?: string;
}

export const DEFAULT_ACTIVE_TONE_1 = "#F36012";
export const DEFAULT_ACTIVE_TONE_2 = "#F3925F";
export const DEFAULT_INACTIVE_TONE_1 = "#9CA3AF"; // gray-400
export const DEFAULT_INACTIVE_TONE_2 = "#D1D5DB"; // gray-300

export function toneStyle({
  active,
  activeTone1 = DEFAULT_ACTIVE_TONE_1,
  activeTone2 = DEFAULT_ACTIVE_TONE_2,
  inactiveTone1 = DEFAULT_INACTIVE_TONE_1,
  inactiveTone2 = DEFAULT_INACTIVE_TONE_2,
}: DualToneIconProps): React.CSSProperties {
  return {
    ["--icon-tone-1" as string]: active ? activeTone1 : inactiveTone1,
    ["--icon-tone-2" as string]: active ? activeTone2 : inactiveTone2,
  } as React.CSSProperties;
}
