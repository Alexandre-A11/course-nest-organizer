import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AddCourseDialog } from "@/components/AddCourseDialog";
import { CourseCard, type CourseViewMode } from "@/components/CourseCard";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { getCategory } from "@/lib/categories";
import { useCategories } from "@/hooks/use-categories";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { listCourses, listFiles, deleteCourse, saveCourse, type Course, type CourseFileMeta } from "@/lib/db";
import { GraduationCap, Sparkles, ShieldCheck, Cpu, LayoutGrid, List, Rows3, X, Settings2, Play, ArrowDownUp, Star } from "lucide-react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { useI18n, relativeTime, plural } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
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

type HomeSort = "recent" | "newest" | "name" | "favorites";

function Home() {
  const { t, lang } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filesByCourse, setFilesByCourse] = useState<Record<string, CourseFileMeta[]>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [view, setView] = usePref<CourseViewMode>("home.view", "grid");
  const [sort, setSort] = usePref<HomeSort>("home.sort", "recent");
  const [favoritesOnly, setFavoritesOnly] = usePref<"on" | "off">("home.favoritesOnly", "off");
  const [manageCats, setManageCats] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const cats = useCategories();

  /**
   * Reload courses + files. When `silent` is true (used by background sync),
   * we don't toggle the loading skeleton and we only update state if the data
   * actually changed — avoiding the visible "page refresh" the user noticed
   * every 8 seconds and (more importantly) avoiding state churn that closes
   * open dialogs / discards form input.
   */
  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    const all = await listCourses();
    const map: Record<string, CourseFileMeta[]> = {};
    await Promise.all(all.map(async (c) => { map[c.id] = await listFiles(c.id); }));
    if (opts.silent) {
      // Cheap shallow-ish comparison on a small JSON payload: only re-render
      // if something meaningfully changed.
      setCourses((prev) => (sameCourses(prev, all) ? prev : all));
      setFilesByCourse((prev) => (sameFilesMap(prev, map) ? prev : map));
    } else {
      setCourses(all);
      setFilesByCourse(map);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Background sync only triggers a *silent* refresh — no skeletons, no
  // dialog reset, and no flicker if nothing changed.
  useEffect(() => {
    const onSync = () => { void load({ silent: true }); };
    window.addEventListener("course-vault:synced", onSync);
    return () => window.removeEventListener("course-vault:synced", onSync);
  }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCourse(confirmDelete.id);
    setConfirmDelete(null);
    toast.success(t("delete.removed"));
    load();
  };

  // Build the list of categories actually used by the user's courses, so
  // we only show filters that lead somewhere.
  const usedCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) if (c.category) set.add(c.category);
    return set;
  }, [courses]);
  const visibleCategories = cats.filter((c) => usedCategoryIds.has(c.id));

  // "Continue where you left off" — most recently opened course.
  const continueCourse = useMemo(() => {
    return [...courses]
      .filter((c) => c.lastFileId && c.lastAccessedAt)
      .sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0))[0];
  }, [courses]);
  const continueFile = useMemo(() => {
    if (!continueCourse) return null;
    const list = filesByCourse[continueCourse.id] ?? [];
    return list.find((f) => f.id === continueCourse.lastFileId) ?? null;
  }, [continueCourse, filesByCourse]);

  const filteredCourses = useMemo(() => {
    let list = courses;
    if (categoryFilter) list = list.filter((c) => c.category === categoryFilter);
    if (favoritesOnly === "on") list = list.filter((c) => c.favorite);

    const sorted = [...list];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, lang));
        break;
      case "newest":
        sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        break;
      case "recent":
        sorted.sort((a, b) => (b.lastAccessedAt ?? b.updatedAt ?? b.createdAt ?? 0)
                             - (a.lastAccessedAt ?? a.updatedAt ?? a.createdAt ?? 0));
        break;
      case "favorites":
        sorted.sort((a, b) => {
          const fa = a.favorite ? 1 : 0;
          const fb = b.favorite ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return (b.lastAccessedAt ?? b.createdAt ?? 0) - (a.lastAccessedAt ?? a.createdAt ?? 0);
        });
        break;
    }
    return sorted;
  }, [courses, categoryFilter, favoritesOnly, sort, lang]);

  const sortLabel = useMemo(() => {
    if (sort === "name") return t("home.sortName");
    if (sort === "newest") return t("home.sortNewest");
    if (sort === "favorites") return t("home.sortFavorites");
    return t("home.sortRecent");
  }, [sort, t]);

  const handleToggleFavorite = async (c: Course) => {
    const next: Course = { ...c, favorite: !c.favorite };
    await saveCourse(next);
    setCourses((prev) => prev.map((x) => (x.id === c.id ? next : x)));
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {courses.length === 0 && !loading ? (
          <EmptyState onAdded={load} />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {t("home.title")}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("home.countOf", { shown: filteredCourses.length, total: courses.length, plural: plural(courses.length, lang) })}
                  {categoryFilter && getCategory(categoryFilter) ? ` ${t("home.in")} ${getCategory(categoryFilter)!.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl" title={t("home.sortLabel")}>
                      <ArrowDownUp className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{sortLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("home.sortLabel")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSort("recent")} className={cn(sort === "recent" && "font-semibold text-primary")}>
                      {t("home.sortRecent")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort("newest")} className={cn(sort === "newest" && "font-semibold text-primary")}>
                      {t("home.sortNewest")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort("name")} className={cn(sort === "name" && "font-semibold text-primary")}>
                      {t("home.sortName")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort("favorites")} className={cn(sort === "favorites" && "font-semibold text-primary")}>
                      {t("home.sortFavorites")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setFavoritesOnly(favoritesOnly === "on" ? "off" : "on")}
                      className={cn(favoritesOnly === "on" && "font-semibold text-primary")}
                    >
                      <Star className={cn("mr-2 h-3.5 w-3.5", favoritesOnly === "on" && "fill-current")} />
                      {t("home.favoritesOnly")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(v) => v && setView(v as CourseViewMode)}
                  className="rounded-xl border border-border bg-card p-0.5"
                >
                  <ToggleGroupItem value="grid" size="sm" className="h-8 w-8 rounded-lg p-0" title={t("home.viewGrid")}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" size="sm" className="h-8 w-8 rounded-lg p-0" title={t("home.viewList")}>
                    <List className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="compact" size="sm" className="h-8 w-8 rounded-lg p-0" title={t("home.viewCompact")}>
                    <Rows3 className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="sm" onClick={() => setManageCats(true)} className="h-9 gap-1.5 rounded-xl" title={t("home.categories")}>
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("home.categories")}</span>
                </Button>
                <AddCourseDialog onAdded={load} />
              </div>
            </div>

            {continueCourse && continueFile && (
              <Link
                to="/course/$courseId"
                params={{ courseId: continueCourse.id }}
                className="mb-5 group flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary-soft/60 via-primary-soft/30 to-transparent p-4 transition-all hover:border-primary/50 hover:shadow-elevated"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-elevated">
                  <Play className="h-5 w-5 fill-current" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {t("home.continueTitle")}
                  </p>
                  <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
                    {continueCourse.name} — <span className="font-normal text-muted-foreground">{continueFile.name}</span>
                  </p>
                  {continueCourse.lastAccessedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("home.lastSeen", { when: relativeTime(continueCourse.lastAccessedAt, t) })}
                    </p>
                  )}
                </div>
                <Button size="sm" className="hidden h-9 shrink-0 gap-1.5 rounded-xl shadow-elevated sm:inline-flex">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {t("home.continueAction")}
                </Button>
              </Link>
            )}

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
                  {t("home.all")}
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
                    title={t("home.clearFilter")}
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
                    onToggleFavorite={() => void handleToggleFavorite(c)}
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

      <ManageCategoriesDialog open={manageCats} onOpenChange={setManageCats} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.body", { name: confirmDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("btn.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("btn.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onAdded }: { onAdded: () => void }) {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 shadow-soft sm:p-16">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-hero opacity-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary opacity-5 blur-3xl" />

      <div className="relative max-w-2xl">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elevated">
          <GraduationCap className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {t("empty.title")}<br />
          <span className="bg-gradient-hero bg-clip-text text-transparent">{t("empty.titleAccent")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("empty.subtitle")}
        </p>

        <div className="mt-7">
          <AddCourseDialog onAdded={onAdded} />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Feature icon={ShieldCheck} title={t("feature.local.title")} desc={t("feature.local.desc")} />
          <Feature icon={Sparkles} title={t("feature.progress.title")} desc={t("feature.progress.desc")} />
          <Feature icon={Cpu} title={t("feature.player.title")} desc={t("feature.player.desc")} />
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

// ---- Cheap structural equality so silent sync refreshes don't churn state ----

function courseFingerprint(c: Course): string {
  return [
    c.id, c.name, c.description ?? "", c.color, c.category ?? "",
    c.banner ? "B" : "-", c.lastFileId ?? "", c.lastAccessedAt ?? 0,
    c.updatedAt ?? c.createdAt ?? 0,
  ].join("|");
}

function sameCourses(a: Course[], b: Course[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (courseFingerprint(a[i]) !== courseFingerprint(b[i])) return false;
  }
  return true;
}

function fileFingerprint(f: CourseFileMeta): string {
  return [
    f.id, f.watched ? 1 : 0, f.watchedAt ?? 0,
    f.progress ?? 0, f.comment ? "C" : "-",
    f.updatedAt ?? 0,
  ].join("|");
}

function sameFilesMap(
  a: Record<string, CourseFileMeta[]>,
  b: Record<string, CourseFileMeta[]>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const av = a[k]; const bv = b[k];
    if (!bv || av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) {
      if (fileFingerprint(av[i]) !== fileFingerprint(bv[i])) return false;
    }
  }
  return true;
}