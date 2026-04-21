export type ThemeId = "cloud" | "dark" | "solar" | "forest" | "mocha" | "carbon" | "nord" | "dracula";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[]; // bg, card, primary
  isDark: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "cloud",  name: "Cloud White", description: "Claro, neutro e arejado",   swatches: ["#fcfcff", "#ffffff", "#5b6cf0"], isDark: false },
  { id: "solar",  name: "Solar",       description: "Areia quente e âmbar",      swatches: ["#fcf8f0", "#ffffff", "#d68a3c"], isDark: false },
  { id: "forest", name: "Forest",      description: "Sálvia e musgo",            swatches: ["#f7faf6", "#ffffff", "#3d8b5a"], isDark: false },
  { id: "dark",   name: "Midnight",    description: "Escuro profundo, índigo",   swatches: ["#1c1d2b", "#272a3a", "#8b9bff"], isDark: true  },
  { id: "mocha",  name: "Mocha",       description: "Escuro quente, café",       swatches: ["#211d18", "#2d2823", "#d6a76b"], isDark: true  },
  { id: "carbon", name: "Carbon",      description: "Quase preto, neutro",       swatches: ["#101012", "#1a1a1d", "#9aa4b2"], isDark: true  },
  { id: "nord",   name: "Nord",        description: "Frio nórdico, ciano",       swatches: ["#1f2430", "#2a313f", "#88c0d0"], isDark: true  },
  { id: "dracula",name: "Dracula",     description: "Vibrante, roxo & rosa",     swatches: ["#1f1d2c", "#2a2740", "#bd93f9"], isDark: true  },
];

const STORAGE_KEY = "course-vault.theme";

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
  root.dataset.theme = id;
  const isDark = THEMES.find((t) => t.id === id)?.isDark ?? false;
  root.classList.toggle("dark", isDark);
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}
