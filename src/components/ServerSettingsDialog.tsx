import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ServerCog, Plug, Unplug, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  connectServer, disconnectServer, getServerUrl, getStatus, getLastSyncAt,
  subscribeSync, syncOnce, testServer, type SyncStatus,
} from "@/lib/syncClient";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ServerSettingsDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(getStatus());
  const [lastSync, setLastSync] = useState<number | null>(getLastSyncAt());

  useEffect(() => {
    if (open) setUrl(getServerUrl() ?? "");
    return subscribeSync((s, info) => {
      setStatus(s);
      setLastSync(info.lastSyncAt);
    });
  }, [open]);

  const connected = !!getServerUrl();

  const handleConnect = async () => {
    if (!url.trim()) return;
    setBusy(true);
    const test = await testServer(url);
    if (!test.ok) {
      setBusy(false);
      toast.error(t("server.connErr", { msg: test.error }));
      return;
    }
    await connectServer(url);
    setBusy(false);
    toast.success(t("server.connOk", { v: test.version }));
  };

  const handleDisconnect = () => {
    disconnectServer();
    toast.success(t("server.disconnected"));
  };

  const handleResync = async () => {
    setBusy(true);
    await syncOnce();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" />
            {t("server.title")}
          </DialogTitle>
          <DialogDescription>{t("server.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="srv-url">{t("server.urlLabel")}</Label>
            <Input
              id="srv-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.50:8787"
              className="rounded-xl font-mono text-sm"
              disabled={connected}
            />
            <p className="text-xs text-muted-foreground">{t("server.urlHint")}</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm">
            <StatusBadge status={connected ? status : "disabled"} />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {connected ? statusLabel(status, t) : t("server.notConnected")}
              </p>
              {lastSync && (
                <p className="text-xs text-muted-foreground">
                  {t("server.lastSync", { when: new Date(lastSync).toLocaleTimeString() })}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {connected ? (
            <>
              <Button variant="outline" onClick={handleResync} disabled={busy} className="rounded-xl gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("server.syncNow")}
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} className="rounded-xl gap-2">
                <Unplug className="h-4 w-4" /> {t("server.disconnect")}
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={busy || !url.trim()} className="rounded-xl gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("server.connect")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: SyncStatus }) {
  if (status === "online") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "syncing") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "offline") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Unplug className="h-4 w-4 text-muted-foreground" />;
}

function statusLabel(s: SyncStatus, t: (k: string) => string): string {
  if (s === "online") return t("server.statusOnline");
  if (s === "syncing") return t("server.statusSyncing");
  if (s === "offline") return t("server.statusOffline");
  return t("server.statusDisabled");
}