import { Link } from "@tanstack/react-router";
import { GraduationCap, DatabaseBackup, ServerCog, Loader2, AlertTriangle, CheckCircle2, NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BackupDialog } from "@/components/BackupDialog";
import { ServerSettingsDialog } from "@/components/ServerSettingsDialog";
import { subscribeSync, type SyncStatus } from "@/lib/syncClient";
import { useI18n } from "@/lib/i18n";

export function AppHeader() {
  const { t } = useI18n();
  const [backupOpen, setBackupOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [sync, setSync] = useState<{ status: SyncStatus; url: string | null }>({
    status: "disabled", url: null,
  });
  useEffect(() => subscribeSync((status, info) => {
    setSync({ status, url: info.url });
  }), []);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated transition-transform group-hover:scale-105">
            <GraduationCap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              Course Vault
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              local studio
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <Link
            to="/notes"
            title={t("nav.notes")}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "text-foreground bg-secondary" }}
          >
            <NotebookPen className="h-[18px] w-[18px]" />
            <span className="hidden md:inline">{t("nav.notes")}</span>
          </Link>
          <Link
            to="/notes"
            title={t("nav.notes")}
            className="sm:hidden rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <NotebookPen className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => setServerOpen(true)}
            title={sync.url ? t("nav.serverConnected") : t("nav.server")}
            className="relative rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ServerCog className="h-[18px] w-[18px]" />
            {sync.url && (
              <span className="absolute -bottom-0.5 -right-0.5">
                {sync.status === "online" && <CheckCircle2 className="h-3 w-3 text-success" />}
                {sync.status === "syncing" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {sync.status === "offline" && <AlertTriangle className="h-3 w-3 text-amber-500" />}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setBackupOpen(true)}
            title={t("nav.backup")}
            className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <DatabaseBackup className="h-[18px] w-[18px]" />
          </button>
          <LanguageToggle />
          <ThemeToggle />
        </nav>
      </div>
      <BackupDialog
        open={backupOpen}
        onOpenChange={setBackupOpen}
        onImported={() => {
          // Soft reload so all routes pick up the new IDB content.
          if (typeof window !== "undefined") window.location.reload();
        }}
      />
      <ServerSettingsDialog open={serverOpen} onOpenChange={setServerOpen} />
    </header>
  );
}