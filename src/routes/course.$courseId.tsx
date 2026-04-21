import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getCourse, listFiles, upsertFiles, type Course, type CourseFileMeta, type FileKind } from "@/lib/db";
import { ensurePermission, scanDirectory, mergeScanWithMeta } from "@/lib/fs";
import { ArrowLeft, Search, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/course/$courseId")({
  component: CoursePage,
  head: () => ({
    meta: [
      { title: "Curso — Course Vault" },
      { name: "description", content: "Reproduza vídeos, leia PDFs e marque seu progresso." },
    ],
  }),
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [files, setFiles] = useState<CourseFileMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unwatched" | FileKind>("all");
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCourse(courseId);
      if (!c) {
        navigate({ to: "/" });
        return;
      }
      setCourse(c);
      const granted = await ensurePermission(c.handle);
      if (!granted) {
        setPermError(true);
        setLoading(false);
        return;
      }
      const fs = await listFiles(courseId);
      setFiles(fs);
      setLoading(false);
    })();
  }, [courseId, navigate]);

  const requestPermission = async () => {
    if (!course) return;
    const granted = await ensurePermission(course.handle);
    if (granted) {
      setPermError(false);
      setLoading(true);
      const fs = await listFiles(courseId);
      setFiles(fs);
      setLoading(false);
    } else {
      toast.error("Permissão negada");
    }
  };

  const rescan = async () => {
    if (!course) return;
    setRescanning(true);
    try {
      const granted = await ensurePermission(course.handle);
      if (!granted) { setPermError(true); return; }
      const scanned = await scanDirectory(course.handle);
      const existing = await listFiles(courseId);
      const merged = mergeScanWithMeta(courseId, scanned, existing);
      await upsertFiles(merged);
      setFiles(merged);
      toast.success(`${merged.length} arquivos sincronizados`);
    } finally {
      setRescanning(false);
    }
  };

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.path.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "unwatched") return !f.watched;
      return f.kind === filter;
    });
  }, [files, search, filter]);

  const selected = files.find((f) => f.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const videos = files.filter((f) => f.kind === "video");
    const watched = videos.filter((v) => v.watched).length;
    return {
      total: files.length,
      videos: videos.length,
      watched,
      progress: videos.length ? Math.round((watched / videos.length) * 100) : 0,
    };
  }, [files]);

  const handleUpdated = (f: CourseFileMeta) => {
    setFiles((prev) => prev.map((x) => (x.id === f.id ? f : x)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (permError && course) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">Permissão necessária</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Por segurança, o navegador precisa que você reautorize o acesso à pasta de
              <strong className="text-foreground"> {course.name}</strong> a cada sessão.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/"><Button variant="outline" className="rounded-xl">Voltar</Button></Link>
              <Button onClick={requestPermission} className="rounded-xl">Autorizar pasta</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />

      {/* Course bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">{course?.name}</h1>
              {course?.description && <p className="text-xs text-muted-foreground">{course.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-1.5">
              <div className="text-xs">
                <span className="font-display text-base font-bold text-foreground">{stats.progress}%</span>
                <span className="ml-1 text-muted-foreground">({stats.watched}/{stats.videos})</span>
              </div>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-hero transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={rescan} disabled={rescanning} className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${rescanning ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col overflow-hidden border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar arquivo..."
                className="rounded-xl pl-9 text-sm"
              />
            </div>
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as typeof filter)}
              className="justify-start gap-1"
            >
              <ToggleGroupItem value="all" size="sm" className="h-7 rounded-lg px-2.5 text-xs">Todos</ToggleGroupItem>
              <ToggleGroupItem value="video" size="sm" className="h-7 rounded-lg px-2.5 text-xs">Vídeos</ToggleGroupItem>
              <ToggleGroupItem value="pdf" size="sm" className="h-7 rounded-lg px-2.5 text-xs">PDFs</ToggleGroupItem>
              <ToggleGroupItem value="unwatched" size="sm" className="h-7 rounded-lg px-2.5 text-xs">Pendentes</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum arquivo encontrado</p>
            ) : (
              <FileTree files={filtered} selectedId={selectedId} onSelect={(f) => setSelectedId(f.id)} />
            )}
          </div>
        </aside>

        {/* Viewer */}
        <section className="overflow-hidden">
          {selected && course ? (
            <FileViewer course={course} file={selected} onUpdated={handleUpdated} />
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">Selecione um arquivo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha um vídeo, PDF ou material na lista ao lado para começar.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}