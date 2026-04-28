import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { purgeLegacyLocalCourses } from "@/lib/db";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Course Vault — Organize seus cursos locais" },
      { name: "description", content: "Organize seus cursos armazenados localmente: assista vídeos, abra PDFs, marque progresso e adicione comentários." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Course Vault" },
      { property: "og:description", content: "Seu estúdio local para organizar cursos e marcar progresso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=localStorage.getItem('course-vault.theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=k||(d?'dark':'cloud');document.documentElement.dataset.theme=t;if(t==='dark'||t==='mocha')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    // One-shot: drop any legacy "handle"/"memory"/"cached" local courses
    // left from before the 100% remote migration.
    void purgeLegacyLocalCourses().catch(() => { /* ignore */ });
  }, []);
  return (
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider delayDuration={200}>
          <Outlet />
          <Toaster position="top-right" />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
