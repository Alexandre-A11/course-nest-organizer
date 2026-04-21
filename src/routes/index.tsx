import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AddCourseDialog } from "@/components/AddCourseDialog";
import { CourseCard, type CourseViewMode } from "@/components/CourseCard";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { listCourses, listFiles, deleteCourse, type Course, type CourseFileMeta } from "@/lib/db";
import { isFsAccessSupported } from "@/lib/fs";
import { GraduationCap, Sparkles, ShieldCheck, Cpu, LayoutGrid, List, Rows3, X } from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Meus cursos — Course Vault" },
      { name: "description", content: "Lista de cursos locais organizados com progresso e comentários." },
    ],
  }),
});

function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filesByCourse, setFilesByCourse] = useState<Record<string, CourseFileMeta[]>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [view, setView] = usePref<CourseViewMode>("home.view", "grid");

  const load = useCallback(async () => {
    setLoading(true);
    const all = await listCourses();
    setCourses(all);
    const map: Record<string, CourseFileMeta[]> = {};
    await Promise.all(all.map(async (c) => { map[c.id] = await listFiles(c.id); }));
    setFilesByCourse(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCourse(confirmDelete.id);
    setConfirmDelete(null);
    toast.success("Curso removido");
    load();
  };

  const supported = isFsAccessSupported();

  // Build the list of categories actually used by the user's courses, so
  // we only show filters that lead somewhere.
  const usedCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) if (c.category) set.add(c.category);
    return set;
  }, [courses]);
  const visibleCategories = CATEGORIES.filter((c) => usedCategoryIds.has(c.id));

  const filteredCourses = useMemo(() => {
    if (!categoryFilter) return courses;
    return courses.filter((c) => c.category === categoryFilter);
  }, [courses, categoryFilter]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {courses.length === 0 && !loading ? (
          <EmptyState supported={supported} onAdded={load} />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Meus cursos
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {filteredCourses.length} de {courses.length} curso{courses.length !== 1 ? "s" : ""}
                  {categoryFilter && getCategory(categoryFilter) ? ` em ${getCategory(categoryFilter)!.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(v) => v && setView(v as CourseViewMode)}
                  className="rounded-xl border border-border bg-card p-0.5"
                >
                  <ToggleGroupItem value="grid" size="sm" className="h-8 w-8 rounded-lg p-0" title="Grade">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" size="sm" className="h-8 w-8 rounded-lg p-0" title="Lista">
                    <List className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="compact" size="sm" className="h-8 w-8 rounded-lg p-0" title="Compacto">
                    <Rows3 className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
                <AddCourseDialog onAdded={load} />
              </div>
            </div>

            {visibleCategories.length > 0 && (
              <div className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    "shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    !categoryFilter
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                {visibleCategories.map((cat) => {
                  const Icon = cat.icon;
                  const active = categoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(active ? null : cat.id)}
                      title={cat.name}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary/40 bg-primary-soft text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", !active && cat.color)} />
                      <span className="hidden sm:inline">{cat.name}</span>
                    </button>
                  );
                })}
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                    title="Limpar filtro"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0,1,2].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-secondary" />
                ))}
              </div>
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                    : view === "compact"
                      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      : "flex flex-col gap-3"
                }
              >
                {filteredCourses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    files={filesByCourse[c.id] ?? []}
                    onDelete={() => setConfirmDelete(c)}
                    onEdit={() => setEditing(c)}
                    view={view}
                  />
                ))}
                {filteredCourses.length === 0 && (
                  <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    Nenhum curso nesta categoria.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <EditCourseDialog
        course={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => { load(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Remover curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga "{confirmDelete?.name}" da biblioteca, junto com progresso e comentários.
              Os arquivos no seu computador <strong>não serão tocados</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ supported, onAdded }: { supported: boolean; onAdded: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 shadow-soft sm:p-16">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-hero opacity-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary opacity-5 blur-3xl" />

      <div className="relative max-w-2xl">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elevated">
          <GraduationCap className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Sua biblioteca de cursos,<br />
          <span className="bg-gradient-hero bg-clip-text text-transparent">organizada de verdade.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Aponte para uma pasta no seu computador. O Course Vault lê os vídeos e PDFs,
          guarda seu progresso, comentários e marca o que você já assistiu.
        </p>

        <div className="mt-7">
          <AddCourseDialog onAdded={onAdded} />
          {!supported && (
            <p className="mt-3 text-sm text-destructive">
              ⚠ Use Chrome, Edge ou Brave atualizados para acessar pastas locais.
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Feature icon={ShieldCheck} title="100% local" desc="Nada sai do seu PC. Sem nuvem, sem login." />
          <Feature icon={Sparkles} title="Progresso visual" desc="Marca aulas assistidas e calcula o avanço." />
          <Feature icon={Cpu} title="Tudo embutido" desc="Player de vídeo e leitor de PDF dentro do app." />
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Sparkles; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-2 font-display text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}