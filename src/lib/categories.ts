import {
  Code, Languages, Music, Palette, Briefcase, FlaskConical, Brush, Sparkles,
  BookOpen, Camera, Dumbbell, Film, Gamepad2, Globe, Heart, Lightbulb,
  Rocket, Star, Trophy, Wrench,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  color: string;
  /** True for built-in categories that cannot be removed. */
  builtin?: boolean;
}

export const BUILTIN_CATEGORIES: Category[] = [
  { id: "programming", name: "Programação",  icon: Code,         color: "text-sky-500",     builtin: true },
  { id: "languages",   name: "Idiomas",      icon: Languages,    color: "text-emerald-500", builtin: true },
  { id: "music",       name: "Música",       icon: Music,        color: "text-violet-500",  builtin: true },
  { id: "design",      name: "Design",       icon: Palette,      color: "text-pink-500",    builtin: true },
  { id: "business",    name: "Negócios",     icon: Briefcase,    color: "text-amber-500",   builtin: true },
  { id: "science",     name: "Ciência",      icon: FlaskConical, color: "text-cyan-500",    builtin: true },
  { id: "art",         name: "Arte",         icon: Brush,        color: "text-rose-500",    builtin: true },
  { id: "other",       name: "Outros",       icon: Sparkles,     color: "text-slate-500",   builtin: true },
];

/** Icons available for user-created categories. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Code, Languages, Music, Palette, Briefcase, FlaskConical, Brush, Sparkles,
  BookOpen, Camera, Dumbbell, Film, Gamepad2, Globe, Heart, Lightbulb,
  Rocket, Star, Trophy, Wrench,
};

export const CATEGORY_COLORS: { name: string; value: string }[] = [
  { name: "Sky",     value: "text-sky-500" },
  { name: "Emerald", value: "text-emerald-500" },
  { name: "Violet",  value: "text-violet-500" },
  { name: "Pink",    value: "text-pink-500" },
  { name: "Amber",   value: "text-amber-500" },
  { name: "Cyan",    value: "text-cyan-500" },
  { name: "Rose",    value: "text-rose-500" },
  { name: "Slate",   value: "text-slate-500" },
  { name: "Lime",    value: "text-lime-500" },
  { name: "Indigo",  value: "text-indigo-500" },
  { name: "Orange",  value: "text-orange-500" },
  { name: "Teal",    value: "text-teal-500" },
];

const STORAGE_KEY = "course-vault.customCategories";

interface StoredCategory {
  id: string;
  name: string;
  iconName: string;
  color: string;
}

function loadCustom(): Category[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredCategory[];
    return arr
      .map((s) => {
        const icon = CATEGORY_ICONS[s.iconName] ?? Sparkles;
        return { id: s.id, name: s.name, icon, color: s.color };
      });
  } catch {
    return [];
  }
}

function saveCustom(cats: Category[]) {
  if (typeof window === "undefined") return;
  const stored: StoredCategory[] = cats.map((c) => {
    const iconName = Object.keys(CATEGORY_ICONS).find((k) => CATEGORY_ICONS[k] === c.icon) ?? "Sparkles";
    return { id: c.id, name: c.name, iconName, color: c.color };
  });
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
}

let _custom: Category[] = loadCustom();
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }

export function getAllCategories(): Category[] {
  return [...BUILTIN_CATEGORIES, ..._custom];
}

export function getCustomCategories(): Category[] {
  return [..._custom];
}

export function addCustomCategory(input: { name: string; iconName: string; color: string }): Category {
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const icon = CATEGORY_ICONS[input.iconName] ?? Sparkles;
  const cat: Category = { id, name: input.name.trim(), icon, color: input.color };
  _custom = [..._custom, cat];
  saveCustom(_custom);
  notify();
  return cat;
}

export function removeCustomCategory(id: string) {
  _custom = _custom.filter((c) => c.id !== id);
  saveCustom(_custom);
  notify();
}

export function subscribeCategories(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** @deprecated use getAllCategories() */
export const CATEGORIES = new Proxy([] as Category[], {
  get(_t, prop) {
    const arr = getAllCategories();
    return Reflect.get(arr, prop);
  },
});

export function getCategory(id?: string | null): Category | undefined {
  if (!id) return undefined;
  return getAllCategories().find((c) => c.id === id);
}