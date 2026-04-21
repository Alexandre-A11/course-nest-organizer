import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AddCourseDialog } from "@/components/AddCourseDialog";
import { CourseCard, type CourseViewMode } from "@/components/CourseCard";
import { listCourses, listFiles, deleteCourse, type Course, type CourseFileMeta } from "@/lib/db";
import { isFsAccessSupported } from "@/lib/fs";
import { GraduationCap, Sparkles, ShieldCheck, Cpu, LayoutGrid, List, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePref } from "@/lib/prefs";
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {courses.length === 0 && !loading ? (
          <EmptyState supported={supported} onAdded={load} />
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Meus cursos
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {courses.length} curso{courses.length !== 1 ? "s" : ""} na sua biblioteca local
                </p>
              </div>
              <AddCourseDialog onAdded={load} />
            </div>

            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0,1,2].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-secondary" />
                ))}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    files={filesByCourse[c.id] ?? []}
                    onDelete={() => setConfirmDelete(c)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

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