import {
  Code, Languages, Music, Palette, Briefcase, FlaskConical, Brush, Sparkles,
  BookOpen, Camera, Dumbbell, Film, Gamepad2, Globe, Heart, Lightbulb,
  Rocket, Star, Trophy, Wrench,
  Atom, Beaker, Binary, Brain, Calculator, ChartBar, ChefHat, Coffee,
  Compass, CpuIcon as Cpu2, Database, Drama, Earth, Feather, Flame,
  GitBranch, Hammer, Headphones, Image as ImageIcon, Layers, Leaf, Map,
  MessageCircle, Mic, Monitor, Mountain, Newspaper, PenTool, Plane,
  Radio, Scissors, Server, Shield, ShoppingBag, Smile, Speaker, Stethoscope,
  Sun, Target, Telescope, Terminal, TreePine, TrendingUp, Tv, Type,
  Umbrella, Video, Wand2, Watch, Zap,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  color: string;
  /** True for built-in categories shipped by default. They can still be removed. */
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
  Atom, Beaker, Binary, Brain, Calculator, ChartBar, ChefHat, Coffee,
  Compass, Cpu2, Database, Drama, Earth, Feather, Flame, GitBranch, Hammer,
  Headphones, ImageIcon, Layers, Leaf, Map, MessageCircle, Mic, Monitor,
  Mountain, Newspaper, PenTool, Plane, Radio, Scissors, Server, Shield,
  ShoppingBag, Smile, Speaker, Stethoscope, Sun, Target, Telescope, Terminal,
  TreePine, TrendingUp, Tv, Type, Umbrella, Video, Wand2, Watch, Zap,
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
const REMOVED_BUILTIN_KEY = "course-vault.removedBuiltinCategories";

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

function loadRemovedBuiltins(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(REMOVED_BUILTIN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveRemovedBuiltins(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(REMOVED_BUILTIN_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

let _custom: Category[] = loadCustom();
let _removedBuiltins: Set<string> = loadRemovedBuiltins();
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }

export function getAllCategories(): Category[] {
  const builtins = BUILTIN_CATEGORIES.filter((c) => !_removedBuiltins.has(c.id));
  return [...builtins, ..._custom];
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
  // Built-in categories are tracked separately (so re-installing the app keeps
  // the user's choice). Custom ones live in their own list.
  if (BUILTIN_CATEGORIES.some((c) => c.id === id)) {
    _removedBuiltins = new Set([..._removedBuiltins, id]);
    saveRemovedBuiltins(_removedBuiltins);
  } else {
    _custom = _custom.filter((c) => c.id !== id);
    saveCustom(_custom);
  }
  notify();
}

/** Restore a built-in category that was previously removed. */
export function restoreBuiltinCategory(id: string) {
  if (!_removedBuiltins.has(id)) return;
  _removedBuiltins = new Set([..._removedBuiltins].filter((x) => x !== id));
  saveRemovedBuiltins(_removedBuiltins);
  notify();
}

/** List of built-in categories that the user has removed. */
export function getRemovedBuiltins(): Category[] {
  return BUILTIN_CATEGORIES.filter((c) => _removedBuiltins.has(c.id));
}

/** Raw serialized form of custom categories (for backup export). */
export function getCustomCategoriesRaw(): StoredCategory[] {
  return _custom.map((c) => {
    const iconName = Object.keys(CATEGORY_ICONS).find((k) => CATEGORY_ICONS[k] === c.icon) ?? "Sparkles";
    return { id: c.id, name: c.name, iconName, color: c.color };
  });
}

/** IDs of the built-in categories the user has removed. */
export function getRemovedBuiltinIds(): string[] {
  return [..._removedBuiltins];
}

/** Replace the local custom-categories list and removed-builtins set. */
export function importCategoryState(payload: {
  custom?: StoredCategory[];
  removedBuiltins?: string[];
}) {
  if (Array.isArray(payload.custom)) {
    _custom = payload.custom.map((s) => {
      const icon = CATEGORY_ICONS[s.iconName] ?? Sparkles;
      return { id: s.id, name: s.name, icon, color: s.color };
    });
    saveCustom(_custom);
  }
  if (Array.isArray(payload.removedBuiltins)) {
    _removedBuiltins = new Set(payload.removedBuiltins);
    saveRemovedBuiltins(_removedBuiltins);
  }
  notify();
}

export function subscribeCategories(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Snapshot of all categories (built-in + custom). For dynamic re-rendering use useCategories(). */
export const CATEGORIES = getAllCategories();

export function getCategory(id?: string | null): Category | undefined {
  if (!id) return undefined;
  return getAllCategories().find((c) => c.id === id);
}