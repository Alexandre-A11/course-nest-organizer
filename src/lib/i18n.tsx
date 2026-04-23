import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "pt" | "en";

const STORAGE_KEY = "course-vault.lang";

type Dict = Record<string, string>;

const PT: Dict = {
  // Header / nav
  "nav.myCourses": "Meus cursos",
  "nav.language": "Idioma",
  "nav.theme": "Tema",

  // Home
  "home.title": "Meus cursos",
  "home.countOf": "{shown} de {total} curso{plural}",
  "home.in": "em",
  "home.viewGrid": "Grade",
  "home.viewList": "Lista",
  "home.viewCompact": "Compacto",
  "home.categories": "Categorias",
  "home.all": "Todas",
  "home.clearFilter": "Limpar filtro",
  "home.noneInCategory": "Nenhum curso nesta categoria.",
  "home.continueTitle": "Continuar de onde parou",
  "home.continueAction": "Continuar",
  "home.lastSeen": "Última vez {when}",
  "home.missingFolder": "{count} curso{plural} {verb} que você reabra a pasta",
  "home.missingHint": "Clique no curso para reselecionar a pasta.",

  // Empty state
  "empty.title": "Sua biblioteca de cursos,",
  "empty.titleAccent": "organizada de verdade.",
  "empty.subtitle": "Aponte para uma pasta no seu computador. O Course Vault lê os vídeos e PDFs, guarda seu progresso, comentários e marca o que você já assistiu.",
  "empty.unsupported": "⚠ Use Chrome, Edge ou Brave atualizados para acessar pastas locais.",
  "feature.local.title": "100% local",
  "feature.local.desc": "Nada sai do seu PC. Sem nuvem, sem login.",
  "feature.progress.title": "Progresso visual",
  "feature.progress.desc": "Marca aulas assistidas e calcula o avanço.",
  "feature.player.title": "Tudo embutido",
  "feature.player.desc": "Player de vídeo e leitor de PDF dentro do app.",

  // Buttons
  "btn.add": "Adicionar curso",
  "btn.cancel": "Cancelar",
  "btn.save": "Salvar",
  "btn.create": "Criar curso",
  "btn.remove": "Remover",
  "btn.delete": "Remover",
  "btn.edit": "Editar curso",
  "btn.back": "Voltar",
  "btn.confirm": "Confirmar",

  // Course card
  "card.videos": "vídeo{plural}",
  "card.pdfs": "PDF{plural}",
  "card.progress": "Progresso",
  "card.continue": "Continuar",
  "card.files": "arquivo{plural}",

  // Course page
  "course.sync": "Sincronizar",
  "course.search": "Buscar arquivo...",
  "course.filterAll": "Todos",
  "course.filterVideos": "Vídeos",
  "course.filterPdfs": "PDFs",
  "course.filterPending": "Pendentes",
  "course.noFiles": "Nenhum arquivo encontrado",
  "course.selectFile": "Selecione um arquivo",
  "course.selectHint": "Escolha um vídeo, PDF ou material na lista ao lado para começar.",
  "course.permissionTitle": "Permissão necessária",
  "course.permissionBody": "Por segurança, o navegador precisa que você reautorize o acesso à pasta de {name} a cada sessão.",
  "course.reopenTitle": "Reabrir pasta do curso",
  "course.reopenBody": "Seu navegador precisa que você reselecione a pasta {name}. Seu progresso e comentários estão salvos.",
  "course.authorize": "Autorizar pasta",
  "course.selectFolder": "Selecionar pasta",

  // Add/Edit dialog
  "add.title": "Novo curso",
  "add.subtitle": "Selecione a pasta do curso. Tudo fica no seu dispositivo.",
  "edit.title": "Editar curso",
  "edit.subtitle": "Personalize título, categoria, banner e pasta.",
  "field.banner": "Banner",
  "field.bannerOpt": "Banner (opcional)",
  "field.bannerChange": "Trocar",
  "field.bannerAdd": "Adicionar imagem",
  "field.folder": "Pasta do curso",
  "field.folderPick": "Escolher pasta",
  "field.folderPickHint": "Clique para selecionar",
  "field.folderChange": "Alterar pasta",
  "field.folderChangeAgain": "Trocar novamente",
  "field.folderCancel": "Cancelar troca",
  "field.folderCurrent": "Atual:",
  "field.folderNew": "Nova pasta:",
  "field.scanning": "Escaneando...",
  "field.filesFound": "{n} arquivo{plural} encontrado{plural}",
  "field.name": "Nome do curso",
  "field.namePh": "Ex: React Avançado",
  "field.desc": "Descrição (opcional)",
  "field.descPh": "Anotações sobre o curso...",
  "field.category": "Categoria",
  "field.categoryNone": "Nenhuma",
  "field.color": "Cor de destaque",
  "field.manage": "Gerenciar",
  "field.fsHint": "Apenas referências leves serão salvas. A cada sessão você reabre a pasta uma vez (rápido) — nada é copiado para o navegador.",
  "field.fsCompat": "Seu navegador usa modo compatível: a cada sessão você reabre a pasta uma vez (instantâneo). Suas notas e progresso ficam salvos sempre.",

  // Delete dialog
  "delete.title": "Remover curso?",
  "delete.body": "Isso apaga \"{name}\" da biblioteca, junto com progresso e comentários. Os arquivos no seu computador não serão tocados.",
  "delete.removed": "Curso removido",

  // Reset progress
  "reset.section": "Zona de risco",
  "reset.button": "Resetar progresso do curso",
  "reset.hint": "Apaga tudo o que está marcado como assistido/lido e os comentários. Os arquivos não são tocados.",
  "reset.title": "Resetar progresso?",
  "reset.body": "Todo o progresso, marcações de \"assistido\" e comentários de \"{name}\" serão apagados. Esta ação não pode ser desfeita.",
  "reset.confirm": "Sim, resetar",
  "reset.done": "Progresso resetado",

  // Toasts
  "toast.added": "Curso \"{name}\" adicionado com {n} arquivos",
  "toast.updated": "Curso atualizado",
  "toast.synced": "{n} arquivos sincronizados",
  "toast.permDenied": "Permissão negada",
  "toast.openErr": "Não foi possível abrir a pasta",
  "toast.imgTooBig": "Imagem muito grande (máx. 2MB)",
  "toast.imgErr": "Não foi possível ler a imagem",

  // Time
  "time.justNow": "agora mesmo",
  "time.minutesAgo": "há {n} min",
  "time.hoursAgo": "há {n}h",
  "time.daysAgo": "há {n}d",
};

const EN: Dict = {
  "nav.myCourses": "My courses",
  "nav.language": "Language",
  "nav.theme": "Theme",

  "home.title": "My courses",
  "home.countOf": "{shown} of {total} course{plural}",
  "home.in": "in",
  "home.viewGrid": "Grid",
  "home.viewList": "List",
  "home.viewCompact": "Compact",
  "home.categories": "Categories",
  "home.all": "All",
  "home.clearFilter": "Clear filter",
  "home.noneInCategory": "No courses in this category.",
  "home.continueTitle": "Continue where you left off",
  "home.continueAction": "Continue",
  "home.lastSeen": "Last opened {when}",
  "home.missingFolder": "{count} course{plural} {verb} you to reopen the folder",
  "home.missingHint": "Click the course to reselect the folder.",

  "empty.title": "Your course library,",
  "empty.titleAccent": "actually organized.",
  "empty.subtitle": "Point to a folder on your computer. Course Vault reads videos and PDFs, tracks your progress, comments and marks what you have watched.",
  "empty.unsupported": "⚠ Use an up-to-date Chrome, Edge or Brave to access local folders.",
  "feature.local.title": "100% local",
  "feature.local.desc": "Nothing leaves your PC. No cloud, no login.",
  "feature.progress.title": "Visual progress",
  "feature.progress.desc": "Marks watched lessons and computes overall progress.",
  "feature.player.title": "All built-in",
  "feature.player.desc": "Video player and PDF reader inside the app.",

  "btn.add": "Add course",
  "btn.cancel": "Cancel",
  "btn.save": "Save",
  "btn.create": "Create course",
  "btn.remove": "Remove",
  "btn.delete": "Remove",
  "btn.edit": "Edit course",
  "btn.back": "Back",
  "btn.confirm": "Confirm",

  "card.videos": "video{plural}",
  "card.pdfs": "PDF{plural}",
  "card.progress": "Progress",
  "card.continue": "Continue",
  "card.files": "file{plural}",

  "course.sync": "Sync",
  "course.search": "Search file...",
  "course.filterAll": "All",
  "course.filterVideos": "Videos",
  "course.filterPdfs": "PDFs",
  "course.filterPending": "Pending",
  "course.noFiles": "No files found",
  "course.selectFile": "Select a file",
  "course.selectHint": "Pick a video, PDF or document from the list to start.",
  "course.permissionTitle": "Permission required",
  "course.permissionBody": "For security, the browser needs you to re-authorize access to {name} every session.",
  "course.reopenTitle": "Reopen course folder",
  "course.reopenBody": "Your browser needs you to reselect the folder {name}. Your progress and comments are still saved.",
  "course.authorize": "Authorize folder",
  "course.selectFolder": "Select folder",

  "add.title": "New course",
  "add.subtitle": "Pick the course folder. Everything stays on your device.",
  "edit.title": "Edit course",
  "edit.subtitle": "Customize title, category, banner and folder.",
  "field.banner": "Banner",
  "field.bannerOpt": "Banner (optional)",
  "field.bannerChange": "Change",
  "field.bannerAdd": "Add image",
  "field.folder": "Course folder",
  "field.folderPick": "Choose folder",
  "field.folderPickHint": "Click to select",
  "field.folderChange": "Change folder",
  "field.folderChangeAgain": "Change again",
  "field.folderCancel": "Cancel change",
  "field.folderCurrent": "Current:",
  "field.folderNew": "New folder:",
  "field.scanning": "Scanning...",
  "field.filesFound": "{n} file{plural} found",
  "field.name": "Course name",
  "field.namePh": "e.g. Advanced React",
  "field.desc": "Description (optional)",
  "field.descPh": "Notes about the course...",
  "field.category": "Category",
  "field.categoryNone": "None",
  "field.color": "Accent color",
  "field.manage": "Manage",
  "field.fsHint": "Only lightweight references are saved. Each session you reopen the folder once (fast) — nothing is copied into the browser.",
  "field.fsCompat": "Your browser uses compatibility mode: each session you reopen the folder once (instant). Your notes and progress are always saved.",

  "delete.title": "Remove course?",
  "delete.body": "This deletes \"{name}\" from the library, along with progress and comments. Files on your computer will not be touched.",
  "delete.removed": "Course removed",

  "reset.section": "Danger zone",
  "reset.button": "Reset course progress",
  "reset.hint": "Wipes everything marked as watched/read and all comments. Files are not touched.",
  "reset.title": "Reset progress?",
  "reset.body": "All progress, watched marks and comments for \"{name}\" will be erased. This cannot be undone.",
  "reset.confirm": "Yes, reset",
  "reset.done": "Progress reset",

  "toast.added": "Course \"{name}\" added with {n} files",
  "toast.updated": "Course updated",
  "toast.synced": "{n} files synced",
  "toast.permDenied": "Permission denied",
  "toast.openErr": "Could not open the folder",
  "toast.imgTooBig": "Image too large (max 2MB)",
  "toast.imgErr": "Could not read the image",

  "time.justNow": "just now",
  "time.minutesAgo": "{n} min ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",
};

const DICTS: Record<Lang, Dict> = { pt: PT, en: EN };

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

function detectInitial(): Lang {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored === "pt" || stored === "en") return stored;
  const nav = (navigator.language ?? "pt").toLowerCase();
  return nav.startsWith("en") ? "en" : "pt";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    setLangState(detectInitial());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nCtx>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      t: (key, vars) => format(dict[key] ?? PT[key] ?? key, vars),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for SSR or accidental usage outside provider
    return {
      lang: "pt",
      setLang: () => {},
      t: (key, vars) => format(PT[key] ?? key, vars),
    };
  }
  return ctx;
}

export function plural(n: number, lang: Lang): string {
  // Both PT and EN use "s" for the plural in our copy.
  void lang;
  return n === 1 ? "" : "s";
}

export function relativeTime(ts: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minutesAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("time.hoursAgo", { n: h });
  const d = Math.floor(h / 24);
  return t("time.daysAgo", { n: d });
}