/**
 * Lightweight, lazy code formatter used by the snapshot editor's
 * "Format Code" button. Loads only the Prettier plugins needed for the
 * requested language so the home bundle stays small.
 *
 * Languages without a Prettier plugin fall back to a minimal whitespace
 * normaliser so the user still gets a predictable result instead of an
 * error toast.
 */

type PrettierStandalone = typeof import("prettier/standalone");

let prettierMod: PrettierStandalone | null = null;
async function loadPrettier(): Promise<PrettierStandalone> {
  if (prettierMod) return prettierMod;
  const mod = await import("prettier/standalone");
  prettierMod = mod;
  return mod;
}

function langToParser(language: string): string | null {
  switch (language.toLowerCase()) {
    case "javascript":
    case "js":
    case "jsx":
      return "babel";
    case "typescript":
    case "ts":
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
    case "xml":
      return "html";
    case "yaml":
    case "yml":
      return "yaml";
    case "markdown":
    case "md":
      return "markdown";
    default:
      return null;
  }
}

async function pluginsForParser(parser: string): Promise<unknown[]> {
  switch (parser) {
    case "babel": {
      const [babel, estree] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);
      return [babel.default, estree.default];
    }
    case "typescript": {
      const [ts, estree] = await Promise.all([
        import("prettier/plugins/typescript"),
        import("prettier/plugins/estree"),
      ]);
      return [ts.default, estree.default];
    }
    case "json": {
      const [babel, estree] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);
      return [babel.default, estree.default];
    }
    case "css": {
      const post = await import("prettier/plugins/postcss");
      return [post.default];
    }
    case "html": {
      const html = await import("prettier/plugins/html");
      return [html.default];
    }
    case "yaml": {
      const yaml = await import("prettier/plugins/yaml");
      return [yaml.default];
    }
    case "markdown": {
      const md = await import("prettier/plugins/markdown");
      return [md.default];
    }
    default:
      return [];
  }
}

/**
 * Trim trailing whitespace, normalise tabs → 2 spaces, and ensure a single
 * trailing newline. Used as a fallback for languages without a Prettier
 * plugin (Python, Rust, Java, Bash, SQL, Dockerfile…).
 */
function basicTidy(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/g, "") + "\n";
}

export async function formatCode(code: string, language: string): Promise<string> {
  const parser = langToParser(language);
  if (!parser) return basicTidy(code);
  try {
    const prettier = await loadPrettier();
    const plugins = await pluginsForParser(parser);
    const out = await prettier.format(code, {
      parser,
      plugins,
      printWidth: 100,
      tabWidth: 2,
      semi: true,
      singleQuote: parser === "babel" || parser === "typescript",
      trailingComma: "all",
    });
    return out;
  } catch {
    // Prettier throws on syntax errors — fall back so the user gets *some*
    // tidy-up rather than a dead button.
    return basicTidy(code);
  }
}