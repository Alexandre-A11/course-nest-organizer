# Course Vault — Self-hosted (single container)

Optional self-hosted **single-container** deployment that ships both the web
app (frontend) and the LAN sync + media-streaming backend in one Docker
image. Multiple browsers / devices on your local network share the same
library — progress, notes, categories, watched flags **and the actual course
files** (videos, PDFs, audio…) — without any cloud, per-browser folder
reselection, or separate frontend deploy.

The web app continues to work 100% offline against IndexedDB; the server is
the single source of truth when you open the bundled URL.

---

## 1. Requirements

- A computer that stays on (a desktop, a NAS, a Raspberry Pi 4+, …) reachable on
  your LAN.
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2.
- A folder on that machine that will hold all your courses, e.g. `~/courses/`.

## 2. Layout your courses

Put one folder per course inside the `courses/` directory next to
`docker-compose.yml`. Subfolders are scanned recursively.

```
server/
├── docker-compose.yml
├── courses/
│   ├── React Avançado/
│   │   ├── 01 - Intro.mp4
│   │   ├── 02 - Hooks.mp4
│   │   └── slides.pdf
│   └── Direito Constitucional/
│       └── …
└── data/         (auto-created — SQLite database lives here)
```

## 3. Run it

The Docker build context must be the **repo root** (so the frontend sources
are visible to the build). The compose file already handles that:

```bash
cd server
docker compose up -d --build
```

First build takes 2–3 minutes (Vite frontend build + native `better-sqlite3`
compilation). After that:

```
[course-vault-server] v1.0.0 listening on :8787
```

Find the LAN IP of the host (e.g. `192.168.1.50`) and open it in any browser:

```
http://192.168.1.50:8787
```

The web app loads instantly — **no separate frontend deploy needed**. The
browser auto-detects that it was served from the Course Vault server and
starts syncing automatically.

API health check:

```
http://192.168.1.50:8787/health
→ { "ok": true, "version": "1.0.0", "coursesDir": "/courses" }
```

## 4. Open it from any device

On any browser/device on the same network, open `http://<host-ip>:8787`. The
frontend served by the container automatically uses the same origin as its
sync server — no manual configuration needed.

If you'd rather run the frontend somewhere else (e.g. Vercel) and only point
to this container as the API, use the **server icon** in the top bar to enter
`http://192.168.1.50:8787` manually.

- The app pulls the server library on connect.
- Local changes (mark watched, notes, progress…) sync to the server every few
  seconds and on every visibility change.
- When the server is unreachable, the app falls back to local IndexedDB and
  resyncs as soon as it's back.

## 5. Adding a course

On the home page choose **Adicionar curso → Do servidor** and browse the
folder tree the server detected inside `/courses`. **Subfolders are
supported** — click the `›` chevron to drill into a subfolder, or click the
folder name to pick it as a course. The folder scan happens on the server;
videos and PDFs are streamed via HTTP `Range` requests, so seeking works the
same as a local file.

## 6. Endpoints (for reference)

| Method | Path                          | Purpose                              |
|--------|-------------------------------|--------------------------------------|
| GET    | `/health`                     | Liveness check                       |
| GET    | `/library`                    | Full snapshot (courses, files, …)    |
| POST   | `/sync`                       | Last-write-wins merge of a snapshot  |
| GET    | `/folders[?parent=Foo/Bar]`   | List folders (drill-down with parent)|
| GET    | `/folders-scan/<folder-path>` | Recursive listing of a folder        |
| GET    | `/stream/<folder>/<rel-path>` | Stream a file (Range supported)      |

## 7. Security note

This server has **no authentication** — anyone on your LAN who knows its
address can read the library and stream files. That matches the "LAN
confiável" tier you picked. If you ever want to expose it to the internet,
put a reverse proxy with auth in front of it (Caddy + basic auth, Tailscale,
Cloudflare Tunnel, etc.) — do **not** open port 8787 on your router as-is.

## 8. Updating

```bash
cd server
git pull   # or just edit src/index.js
docker compose up -d --build
```

Your `data/library.db` and `courses/` folder are mounted as volumes, so they
are preserved across rebuilds.