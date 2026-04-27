import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Palette, Check, Sun, Moon, Shuffle } from "lucide-react";
import { pickRandomThemeForTime } from "@/lib/theme";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const current = themes.find((t) => t.id === theme);
  const { t } = useI18n();

  const handleRandom = () => {
    const next = pickRandomThemeForTime(theme);
    setTheme(next);
    const picked = themes.find((th) => th.id === next);
    if (picked) toast.success(`${t("theme.randomPicked")}: ${picked.name}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-xl px-2.5">
          {current?.isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleRandom}
          className="flex items-center gap-3 rounded-lg py-2"
        >
          <div className="flex h-8 w-12 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 via-primary/10 to-secondary ring-1 ring-border">
            <Shuffle className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium text-foreground">{t("theme.random")}</div>
            <div className="text-[11px] text-muted-foreground">{t("theme.randomHint")}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {themes.map((t) => {
          const active = t.id === theme;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="flex items-center gap-3 rounded-lg py-2"
            >
              <div className="flex h-8 w-12 overflow-hidden rounded-md ring-1 ring-border">
                {t.swatches.map((c, i) => (
                  <div key={i} style={{ background: c }} className="flex-1" />
                ))}
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">{t.description}</div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
