import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Palette, Check, Sun, Moon, Wand2, Clock } from "lucide-react";
import {
  pickRandomThemeForTime, applyTheme,
  LIGHT_THEMES, DARK_THEMES,
  getAutoLightPreference, getAutoDarkPreference,
  setAutoLightPreference, setAutoDarkPreference,
  type ConcreteThemeId,
} from "@/lib/theme";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const current = themes.find((t) => t.id === theme);
  const { t } = useI18n();
  const [autoLight, setAutoLight] = useState<ConcreteThemeId>("cloud");
  const [autoDark, setAutoDark]   = useState<ConcreteThemeId>("dark");

  useEffect(() => {
    setAutoLight(getAutoLightPreference());
    setAutoDark(getAutoDarkPreference());
  }, []);

  const updateAutoLight = (id: ConcreteThemeId) => {
    setAutoLightPreference(id);
    setAutoLight(id);
    if (theme === "auto") applyTheme("auto");
  };
  const updateAutoDark = (id: ConcreteThemeId) => {
    setAutoDarkPreference(id);
    setAutoDark(id);
    if (theme === "auto") applyTheme("auto");
  };

  const specials = themes.filter((th) => th.isSpecial);
  const visiblePresets = themes.filter((th) => !th.isSpecial && !HIDDEN_THEME_IDS.has(th.id));
  const visibleSpecials = specials.filter((th) => th.id !== "smart-random");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-xl px-2.5">
          {current?.isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[80vh] w-64 overflow-y-auto rounded-xl p-1.5">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visibleSpecials.map((th) => {
          const active = th.id === theme;
          const Icon = th.id === "auto" ? Clock : Wand2;
          return (
            <div key={th.id}>
              <DropdownMenuItem
                onClick={() => setTheme(th.id)}
                className="flex items-center gap-3 rounded-lg py-2"
              >
                <div className="flex h-8 w-12 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 via-secondary to-card ring-1 ring-border">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 leading-tight">
                  <div className="text-sm font-medium text-foreground">{th.name}</div>
                  <div className="text-[11px] text-muted-foreground">{th.description}</div>
                </div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              {th.id === "auto" && (
                <>
                  <AutoSlotSubMenu
                    label={t("theme.autoLight")}
                    icon={<Sun className="h-3.5 w-3.5" />}
                    pool={LIGHT_THEMES}
                    value={autoLight}
                    onChange={updateAutoLight}
                    themes={themes}
                  />
                  <AutoSlotSubMenu
                    label={t("theme.autoDark")}
                    icon={<Moon className="h-3.5 w-3.5" />}
                    pool={DARK_THEMES}
                    value={autoDark}
                    onChange={updateAutoDark}
                    themes={themes}
                  />
                </>
              )}
            </div>
          );
        })}
        <DropdownMenuSeparator />
        {visiblePresets.map((th) => {
          const active = th.id === theme;
          return (
            <DropdownMenuItem
              key={th.id}
              onClick={() => setTheme(th.id)}
              className="flex items-center gap-3 rounded-lg py-2"
            >
              <div className="flex h-8 w-12 overflow-hidden rounded-md ring-1 ring-border">
                {th.swatches.map((c, i) => (
                  <div key={i} style={{ background: c }} className="flex-1" />
                ))}
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-sm font-medium text-foreground">{th.name}</div>
                <div className="text-[11px] text-muted-foreground">{th.description}</div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const HIDDEN_THEME_IDS = new Set([
  "forest",
  "sepia",
  "mocha",
  "carbon",
  "nord",
  "tokyo-night",
  "cappuccino",
]);

function AutoSlotSubMenu({
  label, icon, pool, value, onChange, themes,
}: {
  label: string;
  icon: React.ReactNode;
  pool: ConcreteThemeId[];
  value: ConcreteThemeId;
  onChange: (id: ConcreteThemeId) => void;
  themes: { id: string; name: string; swatches: string[] }[];
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="ml-12 flex items-center gap-2 rounded-md py-1.5 text-xs text-muted-foreground">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-primary">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="truncate text-foreground/80">
          {themes.find((th) => th.id === value)?.name ?? value}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="max-h-[60vh] w-56 overflow-y-auto rounded-xl p-1">
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as ConcreteThemeId)}>
            {pool.map((id) => {
              const th = themes.find((x) => x.id === id);
              if (!th) return null;
              return (
                <DropdownMenuRadioItem key={id} value={id} className="gap-2 rounded-md py-1.5">
                  <span className="flex h-5 w-8 overflow-hidden rounded ring-1 ring-border">
                    {th.swatches.map((c, i) => (
                      <span key={i} style={{ background: c }} className="flex-1" />
                    ))}
                  </span>
                  <span className="text-xs">{th.name}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
