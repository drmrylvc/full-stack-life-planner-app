import type { AreaColor, LifeArea } from "@/lib/types";

export interface AreaTheme {
  gradient: string;
  ink: string;
  soft: string;
  dark?: boolean;
}

export const AREA_THEMES: Record<AreaColor, AreaTheme> = {
  lavender: { gradient: "linear-gradient(155deg,#6d4aff 0%,#9b7bff 58%,#c4b5fd 100%)", ink: "#fff", soft: "rgba(255,255,255,.82)" },
  rose: { gradient: "linear-gradient(160deg,#ffe7f1 0%,#ffc2d9 100%)", ink: "#3d2434", soft: "rgba(92,42,68,.72)", dark: true },
  mint: { gradient: "linear-gradient(155deg,#12b89a 0%,#3ee0b0 100%)", ink: "#fff", soft: "rgba(255,255,255,.85)" },
  peach: { gradient: "linear-gradient(155deg,#ff8a2a 0%,#ffb15e 100%)", ink: "#fff", soft: "rgba(255,255,255,.87)" },
  blue: { gradient: "linear-gradient(155deg,#2f6bff 0%,#60a5fa 100%)", ink: "#fff", soft: "rgba(255,255,255,.85)" },
  sand: { gradient: "linear-gradient(160deg,#243044 0%,#121826 100%)", ink: "#fff", soft: "rgba(255,255,255,.76)" },
};

export function areaTheme(area: Pick<LifeArea, "color">): AreaTheme {
  return AREA_THEMES[area.color] || AREA_THEMES.lavender;
}
