export type ConcreteThemeId =
  | "cloud"
  | "solar"
  | "forest"
  | "sepia"
  | "dark"
  | "mocha"
  | "carbon"
  | "nord"
  | "tokyo-night"
  | "cappuccino"
  | "dracula";

export type ThemeId = ConcreteThemeId | "auto" | "smart-random";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[]; // bg, card, primary
  isDark: boolean;
  isSpecial?: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "auto",         name: "Automático",        description: "Claro de dia, escuro à noite",      swatches: ["#fcfcff", "#d7defc", "#2a324b"], isDark: false, isSpecial: true },
  { id: "smart-random", name: "Aleatório Inteligente", description: "Novo tema a cada carregamento", swatches: ["#fcf8f0", "#ffffff", "#8b9bff"], isDark: false, isSpecial: true },
  { id: "cloud",  name: "Cloud White", description: "Claro, neutro e arejado",   swatches: ["#fcfcff", "#ffffff", "#5b6cf0"], isDark: false },
  { id: "solar",  name: "Solar",       description: "Areia quente e âmbar",      swatches: ["#fcf8f0", "#ffffff", "#d68a3c"], isDark: false },
  { id: "forest", name: "Forest",      description: "Sálvia e musgo",            swatches: ["#f7faf6", "#ffffff", "#3d8b5a"], isDark: false },
  { id: "sepia",  name: "Sepia",       description: "Papel quente e editorial",  swatches: ["#f6efe4", "#fffaf2", "#8f5c3b"], isDark: false },
  { id: "dark",   name: "Midnight",    description: "Escuro profundo, índigo",   swatches: ["#1c1d2b", "#272a3a", "#8b9bff"], isDark: true  },
  { id: "mocha",  name: "Mocha",       description: "Escuro quente, café",       swatches: ["#211d18", "#2d2823", "#d6a76b"], isDark: true  },
  { id: "carbon", name: "Carbon",      description: "Quase preto, neutro",       swatches: ["#101012", "#1a1a1d", "#9aa4b2"], isDark: true  },
  { id: "nord",   name: "Nord",        description: "Frio nórdico, ciano",       swatches: ["#1f2430", "#2a313f", "#88c0d0"], isDark: true  },
  { id: "tokyo-night", name: "Tokyo Night", description: "Azul-noite neon suave", swatches: ["#171b2e", "#1f2540", "#7aa2f7"], isDark: true },
  { id: "cappuccino",  name: "Cappuccino",  description: "Espresso cremoso e bronze", swatches: ["#241b17", "#30241f", "#d8b08c"], isDark: true },
  { id: "dracula",name: "Dracula",     description: "Vibrante, roxo & rosa",     swatches: ["#1f1d2c", "#2a2740", "#bd93f9"], isDark: true  },
];

const STORAGE_KEY = "course-vault.theme";
const DAY_THEMES: ConcreteThemeId[] = ["cloud", "solar", "forest", "sepia"];
const NIGHT_THEMES: ConcreteThemeId[] = ["dark", "mocha", "carbon", "nord", "tokyo-night", "cappuccino", "dracula"];

function isConcreteTheme(id: string): id is ConcreteThemeId {
  return THEMES.some((t) => t.id === id && !t.isSpecial);
}

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour < 6 || hour >= 18;
}

function concreteTheme(id: ConcreteThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id)!;
}

export function getAutoThemeForTime(): ConcreteThemeId {
  return isNightTime() ? "tokyo-night" : "cloud";
}

export function resolveThemeSelection(id: ThemeId): ThemeDef {
  if (id === "auto") return concreteTheme(getAutoThemeForTime());
  if (id === "smart-random") {
    if (typeof document !== "undefined") {
      const current = document.documentElement.dataset.theme;
      if (current && isConcreteTheme(current)) return concreteTheme(current);
    }
    return concreteTheme(pickRandomThemeForTime());
  }
  return concreteTheme(id);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "cloud";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && THEMES.some((t) => t.id === raw)) return raw as ThemeId;
  // default by system preference
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "cloud";
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = id === "auto"
    ? getAutoThemeForTime()
    : id === "smart-random"
      ? pickRandomThemeForTime(isConcreteTheme(root.dataset.theme ?? "") ? root.dataset.theme as ConcreteThemeId : undefined)
      : id;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", concreteTheme(resolved).isDark);
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

/**
 * Pick a random theme respecting the time of day.
 * Daytime (06:00–18:00) → only light themes.
 * Night (18:00–06:00)   → only dark themes.
 * Avoids returning the same theme that's already active when possible.
 */
export function pickRandomThemeForTime(currentId?: ThemeId): ThemeId {
  const pool = isNightTime() ? NIGHT_THEMES : DAY_THEMES;
  const candidates = pool.length > 1 && currentId
    ? pool.filter((t) => t.id !== currentId)
    : pool;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick;
}
