import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "pt" | "en";

const STORAGE_KEY = "course-vault.lang";

type Dict = Record<string, string>;

const PT: Dict = {
  // Header / nav
  "nav.myCourses": "Meus cursos",
  "nav.language": "Idioma",
  "nav.theme": "Tema",
  "nav.backup": "Backup",
  "nav.export": "Exportar biblioteca",
  "nav.import": "Importar biblioteca",
  "nav.server": "Servidor de sincronização",
  "nav.serverConnected": "Conectado ao servidor",

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
  "card.watchedVideo": "Assistido",
  "card.markVideo": "Marcar assistido",
  "card.watchedAudio": "Ouvido",
  "card.markAudio": "Marcar ouvido",
  "card.watchedDoc": "Lido",
  "card.markDoc": "Marcar como lido",
  "card.watchedOther": "Concluído",
  "card.markOther": "Marcar concluído",

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
  "course.editTitle": "Editar curso",
  "course.permDenied": "Permissão negada",
  "course.expectedFolder": "Pasta esperada: \"{expected}\". Você selecionou \"{got}\". Continuando mesmo assim.",
  "course.foldersFlat": "Mostrar pastas",
  "course.foldersTree": "Ocultar pastas (lista plana)",
  "course.toggleFolders": "Alternar pastas",
  "course.clearFocus": "Limpar foco",
  "course.focusFolder": "Focar nessa pasta",
  "course.showingOnly": "Mostrando apenas:",

  // Add/Edit dialog
  "add.title": "Novo curso",
  "add.subtitle": "Selecione a pasta do curso. Tudo fica no seu dispositivo.",
  "add.cacheToggle": "Manter disponível offline",
  "add.cacheHint": "Copia os arquivos para o navegador (IndexedDB). Não precisa reabrir a pasta a cada sessão, mas ocupa espaço em disco.",
  "add.cacheCopying": "Copiando arquivos para o cache offline…",
  "add.cachedDone": "{n} arquivos disponíveis offline",
  "add.modeLocal": "Pasta local",
  "add.modeRemote": "Do servidor",
  "add.remoteLabel": "Pastas no servidor",
  "add.remoteLoading": "Carregando pastas do servidor…",
  "add.remoteEmpty": "Nenhuma pasta encontrada em /courses no servidor.",
  "add.remoteHint": "Os arquivos ficam no servidor e são transmitidos via HTTP — sem ocupar espaço no navegador.",
  "add.remoteEmptySub": "Esta pasta não tem subpastas. Use o botão acima para usá-la como curso.",
  "add.remotePickCurrent": "Usar esta pasta como curso",
  "add.remotePickCurrentShort": "Usar esta pasta",
  "add.remotePickFolder": "Usar como curso",
  "add.remoteOpenFolder": "Abrir subpastas",
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
  "field.colorAria": "Cor {c}",

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
  "toast.copied": "Caminho copiado",
  "toast.copyErr": "Não foi possível copiar",
  "toast.lessonDone": "Aula concluída ✓",
  "toast.notesExported": "Notas exportadas ({format})",
  "toast.markedWatched": "Marcado como assistido",
  "toast.markedListened": "Marcado como ouvido",
  "toast.markedRead": "Marcado como lido",
  "toast.markedDone": "Marcado como concluído",
  "toast.unmarked": "Desmarcado",
  "toast.exportOk": "Biblioteca exportada",
  "toast.importOk": "{n} cursos importados",
  "toast.importErr": "Arquivo inválido",
  "toast.catCreated": "Categoria criada",
  "toast.catRemoved": "\"{name}\" removida",
  "toast.catRestored": "\"{name}\" restaurada",

  // Time
  "time.justNow": "agora mesmo",
  "time.minutesAgo": "há {n} min",
  "time.hoursAgo": "há {n}h",
  "time.daysAgo": "há {n}d",

  // Notes editor
  "notes.title": "Anotações",
  "notes.saving": "salvando…",
  "notes.saved": "salvo",
  "notes.export": "Baixar",
  "notes.placeholder": "Suas anotações...",
  "notes.placeholderMedia": "Suas notas sobre essa aula… use 'Marcar tempo' para inserir [mm:ss] clicáveis.",
  "notes.placeholderOther": "Suas notas sobre esse material…",
  "notes.markTime": "Marcar tempo",
  "notes.insertTime": "Inserir tempo atual do vídeo",
  "notes.bold": "Negrito (Ctrl+B)",
  "notes.italic": "Itálico (Ctrl+I)",
  "notes.underline": "Sublinhado (Ctrl+U)",
  "notes.strike": "Tachado",
  "notes.highlight": "Destaque",
  "notes.color": "Cor do texto",
  "notes.h1": "Título 1",
  "notes.h2": "Título 2",
  "notes.list": "Lista",
  "notes.olist": "Lista numerada",
  "notes.quote": "Citação",
  "notes.code": "Código",
  "notes.clear": "Limpar formatação",
  "color.default": "Padrão",
  "color.red": "Vermelho",
  "color.orange": "Laranja",
  "color.amber": "Âmbar",
  "color.green": "Verde",
  "color.cyan": "Ciano",
  "color.blue": "Azul",
  "color.purple": "Roxo",
  "color.pink": "Rosa",

  // FileViewer
  "viewer.folderShow": "Mostrar pasta na lista",
  "viewer.copyPath": "Copiar caminho",
  "viewer.pauseOn": "Pausar enquanto digita: ATIVO",
  "viewer.pauseOff": "Pausar enquanto digita: desligado",
  "viewer.pauseLabelOn": "Pausa ao digitar",
  "viewer.pauseLabelOff": "Sem pausa",
  "viewer.notesHide": "Ocultar anotações",
  "viewer.notesShow": "Mostrar anotações",
  "viewer.notesLabelHide": "Ocultar notas",
  "viewer.notesLabelShow": "Mostrar notas",
  "viewer.download": "Baixar",
  "viewer.dragResize": "Arraste para redimensionar",
  "viewer.permExpired": "Permissão de pasta expirada — recarregue a página e autorize de novo.",
  "viewer.openErr": "Erro ao abrir arquivo",
  "viewer.previewUnavail": "Pré-visualização indisponível",
  "viewer.previewOfficeMsg": "Formatos do Office (.doc, .docx, .ppt, .pptx, .xls, .xlsx) não podem ser renderizados no navegador. Use \"Baixar\" para abrir no aplicativo nativo.",
  "viewer.empty": "({name} está vazio)",
  "viewer.theaterOn": "Modo teatro (T)",
  "viewer.theaterOff": "Sair do modo teatro (T)",
  "viewer.theaterLabel": "Teatro",
  "viewer.fullscreenEnter": "Tela cheia (F)",
  "viewer.fullscreenExit": "Sair da tela cheia (F)",
  "viewer.fullscreenLabel": "Tela cheia",

  // Categories dialog
  "cat.dialogTitle": "Gerenciar categorias",
  "cat.dialogSubtitle": "Crie e remova categorias personalizadas.",
  "cat.new": "Nova categoria",
  "cat.name": "Nome",
  "cat.namePh": "Ex: Marketing",
  "cat.icon": "Ícone",
  "cat.color": "Cor do ícone",
  "cat.add": "Adicionar categoria",
  "cat.yours": "Suas categorias ({n})",
  "cat.empty": "Nenhuma categoria. Crie uma acima.",
  "cat.removed": "Padrão removidas ({n})",
  "cat.restore": "Restaurar",
  "cat.remove": "Remover",
  "cat.close": "Fechar",
  "cat.noneInCat": "Nenhum curso nesta categoria.",
  "home.clearFilterTitle": "Limpar filtro",

  // Backup dialog
  "backup.title": "Backup da biblioteca",
  "backup.subtitle": "Mova suas anotações, progresso e categorias entre navegadores ou dispositivos.",
  "backup.exportSection": "Exportar",
  "backup.exportDesc": "Baixe um arquivo .json com todos os cursos, arquivos, progresso, anotações e categorias. Os arquivos de mídia não são incluídos — apenas as referências.",
  "backup.exportBtn": "Baixar JSON",
  "backup.importSection": "Importar",
  "backup.importDesc": "Carregue um .json gerado por outro navegador. Cursos com o mesmo ID serão atualizados; novos serão adicionados.",
  "backup.importBtn": "Selecionar arquivo .json",
  "backup.note": "Pastas (handles) e cache offline não viajam pelo backup — você precisará reapontar a pasta neste navegador.",

  // Server sync dialog
  "server.title": "Servidor de sincronização",
  "server.subtitle": "Conecte-se ao seu servidor Course Vault na rede local para compartilhar biblioteca e arquivos entre dispositivos.",
  "server.urlLabel": "URL do servidor",
  "server.urlHint": "Ex.: http://192.168.1.50:8787 — execute 'docker compose up' na pasta server/.",
  "server.connect": "Conectar",
  "server.disconnect": "Desconectar",
  "server.syncNow": "Sincronizar agora",
  "server.notConnected": "Não conectado",
  "server.statusOnline": "Conectado e sincronizado",
  "server.statusSyncing": "Sincronizando…",
  "server.statusOffline": "Servidor inacessível — usando dados locais",
  "server.statusDisabled": "Sync desativada",
  "server.lastSync": "Última sincronização: {when}",
  "server.connOk": "Conectado (servidor v{v})",
  "server.connErr": "Falha ao conectar: {msg}",
  "server.disconnected": "Desconectado do servidor",
};

const EN: Dict = {
  "nav.myCourses": "My courses",
  "nav.language": "Language",
  "nav.theme": "Theme",
  "nav.backup": "Backup",
  "nav.export": "Export library",
  "nav.import": "Import library",
  "nav.server": "Sync server",
  "nav.serverConnected": "Connected to server",

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
  "card.watchedVideo": "Watched",
  "card.markVideo": "Mark watched",
  "card.watchedAudio": "Listened",
  "card.markAudio": "Mark listened",
  "card.watchedDoc": "Read",
  "card.markDoc": "Mark as read",
  "card.watchedOther": "Completed",
  "card.markOther": "Mark complete",

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
  "course.editTitle": "Edit course",
  "course.permDenied": "Permission denied",
  "course.expectedFolder": "Expected folder: \"{expected}\". You picked \"{got}\". Continuing anyway.",
  "course.foldersFlat": "Show folders",
  "course.foldersTree": "Hide folders (flat list)",
  "course.toggleFolders": "Toggle folders",
  "course.clearFocus": "Clear focus",
  "course.focusFolder": "Focus this folder",
  "course.showingOnly": "Showing only:",

  "add.title": "New course",
  "add.subtitle": "Pick the course folder. Everything stays on your device.",
  "add.cacheToggle": "Keep available offline",
  "add.cacheHint": "Copies the files into the browser (IndexedDB). No need to reopen the folder each session, but it uses disk space.",
  "add.cacheCopying": "Copying files to offline cache…",
  "add.cachedDone": "{n} files available offline",
  "add.modeLocal": "Local folder",
  "add.modeRemote": "From server",
  "add.remoteLabel": "Folders on the server",
  "add.remoteLoading": "Loading server folders…",
  "add.remoteEmpty": "No folders found in /courses on the server.",
  "add.remoteHint": "Files stay on the server and are streamed over HTTP — no browser disk usage.",
  "add.remoteEmptySub": "This folder has no subfolders. Use the button above to pick it as a course.",
  "add.remotePickCurrent": "Use this folder as a course",
  "add.remotePickCurrentShort": "Use this folder",
  "add.remotePickFolder": "Use as a course",
  "add.remoteOpenFolder": "Open subfolders",
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
  "field.colorAria": "Color {c}",

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
  "toast.copied": "Path copied",
  "toast.copyErr": "Could not copy",
  "toast.lessonDone": "Lesson completed ✓",
  "toast.notesExported": "Notes exported ({format})",
  "toast.markedWatched": "Marked as watched",
  "toast.markedListened": "Marked as listened",
  "toast.markedRead": "Marked as read",
  "toast.markedDone": "Marked as completed",
  "toast.unmarked": "Unmarked",
  "toast.exportOk": "Library exported",
  "toast.importOk": "{n} courses imported",
  "toast.importErr": "Invalid file",
  "toast.catCreated": "Category created",
  "toast.catRemoved": "\"{name}\" removed",
  "toast.catRestored": "\"{name}\" restored",

  "time.justNow": "just now",
  "time.minutesAgo": "{n} min ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  "notes.title": "Notes",
  "notes.saving": "saving…",
  "notes.saved": "saved",
  "notes.export": "Download",
  "notes.placeholder": "Your notes...",
  "notes.placeholderMedia": "Notes about this lesson… use 'Mark time' to insert clickable [mm:ss] stamps.",
  "notes.placeholderOther": "Notes about this material…",
  "notes.markTime": "Mark time",
  "notes.insertTime": "Insert current video time",
  "notes.bold": "Bold (Ctrl+B)",
  "notes.italic": "Italic (Ctrl+I)",
  "notes.underline": "Underline (Ctrl+U)",
  "notes.strike": "Strikethrough",
  "notes.highlight": "Highlight",
  "notes.color": "Text color",
  "notes.h1": "Heading 1",
  "notes.h2": "Heading 2",
  "notes.list": "List",
  "notes.olist": "Numbered list",
  "notes.quote": "Quote",
  "notes.code": "Code",
  "notes.clear": "Clear formatting",
  "color.default": "Default",
  "color.red": "Red",
  "color.orange": "Orange",
  "color.amber": "Amber",
  "color.green": "Green",
  "color.cyan": "Cyan",
  "color.blue": "Blue",
  "color.purple": "Purple",
  "color.pink": "Pink",

  "viewer.folderShow": "Show folder in list",
  "viewer.copyPath": "Copy path",
  "viewer.pauseOn": "Pause while typing: ON",
  "viewer.pauseOff": "Pause while typing: off",
  "viewer.pauseLabelOn": "Pause on type",
  "viewer.pauseLabelOff": "No pause",
  "viewer.notesHide": "Hide notes",
  "viewer.notesShow": "Show notes",
  "viewer.notesLabelHide": "Hide notes",
  "viewer.notesLabelShow": "Show notes",
  "viewer.download": "Download",
  "viewer.dragResize": "Drag to resize",
  "viewer.permExpired": "Folder permission expired — reload the page and re-authorize.",
  "viewer.openErr": "Could not open file",
  "viewer.previewUnavail": "Preview unavailable",
  "viewer.previewOfficeMsg": "Office formats (.doc, .docx, .ppt, .pptx, .xls, .xlsx) cannot be rendered in the browser. Use \"Download\" to open in the native app.",
  "viewer.empty": "({name} is empty)",
  "viewer.theaterOn": "Theater mode (T)",
  "viewer.theaterOff": "Exit theater mode (T)",
  "viewer.theaterLabel": "Theater",
  "viewer.fullscreenEnter": "Fullscreen (F)",
  "viewer.fullscreenExit": "Exit fullscreen (F)",
  "viewer.fullscreenLabel": "Fullscreen",

  "cat.dialogTitle": "Manage categories",
  "cat.dialogSubtitle": "Create and remove custom categories.",
  "cat.new": "New category",
  "cat.name": "Name",
  "cat.namePh": "e.g. Marketing",
  "cat.icon": "Icon",
  "cat.color": "Icon color",
  "cat.add": "Add category",
  "cat.yours": "Your categories ({n})",
  "cat.empty": "No categories. Create one above.",
  "cat.removed": "Removed defaults ({n})",
  "cat.restore": "Restore",
  "cat.remove": "Remove",
  "cat.close": "Close",
  "cat.noneInCat": "No courses in this category.",
  "home.clearFilterTitle": "Clear filter",

  "backup.title": "Library backup",
  "backup.subtitle": "Move your notes, progress and categories between browsers or devices.",
  "backup.exportSection": "Export",
  "backup.exportDesc": "Download a .json file with every course, file, progress, note and category. Media files are not included — only the references.",
  "backup.exportBtn": "Download JSON",
  "backup.importSection": "Import",
  "backup.importDesc": "Load a .json generated on another browser. Courses with the same ID are updated; new ones are added.",
  "backup.importBtn": "Choose .json file",
  "backup.note": "Folder handles and offline cache do not travel with the backup — you'll need to point to the folder again on this browser.",

  // Server sync dialog
  "server.title": "Sync server",
  "server.subtitle": "Connect to your local Course Vault server to share library and files across devices on the LAN.",
  "server.urlLabel": "Server URL",
  "server.urlHint": "e.g. http://192.168.1.50:8787 — run 'docker compose up' inside the server/ folder.",
  "server.connect": "Connect",
  "server.disconnect": "Disconnect",
  "server.syncNow": "Sync now",
  "server.notConnected": "Not connected",
  "server.statusOnline": "Connected and synced",
  "server.statusSyncing": "Syncing…",
  "server.statusOffline": "Server unreachable — using local data",
  "server.statusDisabled": "Sync disabled",
  "server.lastSync": "Last sync: {when}",
  "server.connOk": "Connected (server v{v})",
  "server.connErr": "Connection failed: {msg}",
  "server.disconnected": "Disconnected from server",
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