import {
  Code, Languages, Music, Palette, Briefcase, FlaskConical, Brush, Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "programming", name: "Programação",  icon: Code,         color: "text-sky-500"     },
  { id: "languages",   name: "Idiomas",      icon: Languages,    color: "text-emerald-500" },
  { id: "music",       name: "Música",       icon: Music,        color: "text-violet-500"  },
  { id: "design",      name: "Design",       icon: Palette,      color: "text-pink-500"    },
  { id: "business",    name: "Negócios",     icon: Briefcase,    color: "text-amber-500"   },
  { id: "science",     name: "Ciência",      icon: FlaskConical, color: "text-cyan-500"    },
  { id: "art",         name: "Arte",         icon: Brush,        color: "text-rose-500"    },
  { id: "other",       name: "Outros",       icon: Sparkles,     color: "text-slate-500"   },
];

export function getCategory(id?: string | null): Category | undefined {
  if (!id) return undefined;
  return CATEGORIES.find((c) => c.id === id);
}