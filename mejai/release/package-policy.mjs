const sharedDirectories = new Set([
  "src",
  "ui",
  "lib",
  "plugins",
  "skills",
  "linguagens",
  "testes",
]);
const windowsRuntime = new Set([
  "node",
  "python",
  "ocr",
  "serena",
  "powershell",
  "git",
  "browser",
  "camoufox",
  "camoufox-engine",
  "essenciais",
  "serena-lsp",
  "tor",
  "devtools",
  "ui",
]);
const linuxRuntime = new Set([
  "node",
  "python",
  "python-managed",
  "ocr",
  "serena",
  "essenciais",
  "camoufox",
  "camoufox-engine",
  "browsers",
  "system-libs",
  "tools",
  "tor",
  "uv-download",
]);
const rootDocuments = new Set([
  "AGENTS.md",
  "INSTRUCOES.md",
  "RECUPERACAO.md",
  "WEB-E-MCP.md",
  "LANGUAGE.md",
]);
const configurations = new Set([
  "opencode.json",
  "colibri.json",
  "tor-search.json",
  "conexoes.exemplo.json",
  "mcp-catalogo.json",
  "navegador-preferencias.json",
  ".prettierrc.json",
]);
const privateSegments = new Set([
  ".git",
  ".cache",
  ".links",
  ".temp",
  "__pycache__",
  "dados",
  "logs",
  "downloads",
  "tarefas",
  "mejai-updates",
  "versoes-codigo",
  "installation_dir_layout",
  "desktop-launcher",
]);

export function safeRelativePath(relative) {
  return (
    typeof relative === "string" &&
    relative.length > 0 &&
    !relative.includes(":") &&
    !relative.startsWith("/") &&
    !relative.startsWith("\\") &&
    !relative.split(/[\\/]/).some((segment) => segment === ".." || segment === "." || !segment)
  );
}

export function includeRuntimeFile(relative, platform) {
  if (!safeRelativePath(relative)) return false;
  const parts = relative.replaceAll("\\", "/").split("/");
  if (parts.some((segment) => privateSegments.has(segment))) return false;
  const filename = parts.at(-1);
  const bundledWebglDatabase =
    /^runtime\/(?:linux\/)?camoufox\/node_modules\/camoufox-js\/dist\/data-files\/webgl_data\.db$/.test(
      parts.join("/"),
    );
  if (["ready.json", "extras-ready.json", "GeoLite2-City.mmdb"].includes(filename)) return false;
  if (filename === ".lock") return false;
  if (parts.includes("uv-download") && !["uv", "uvx", "entry.mjs"].includes(filename)) return false;
  if (platform === "linux" && /\.(?:exe|dll|pyd)$/i.test(filename)) return false;
  if (
    /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|cookies.*|credentials.*)$/i.test(filename) ||
    (!bundledWebglDatabase && /\.(?:pyc|pyo|sqlite|sqlite3|db|log)$/i.test(filename))
  )
    return false;
  if (parts[0] === "runtime") {
    if (platform === "windows") {
      if (parts[1] === "colibri") return parts[2] === "windows-x86_64";
      return windowsRuntime.has(parts[1]);
    }
    if (["browser", "serena-lsp", "devtools", "ui"].includes(parts[1])) return true;
    if (parts[1] === "colibri") return parts[2] === "linux-x86_64";
    return parts[1] === "linux" && linuxRuntime.has(parts[2]);
  }
  if (parts[0] === "ferramentas")
    return platform === "windows" && ["7zip", "ffmpeg"].includes(parts[1]);
  if (sharedDirectories.has(parts[0])) return !parts.includes("node_modules");
  if (parts.length !== 1) return false;
  if (rootDocuments.has(filename) || configurations.has(filename)) return true;
  if (/\.(?:mjs|py|sh)$/.test(filename))
    return !(platform === "windows" && filename === "start.sh");
  return platform === "windows" && /\.(?:ps1|cmd)$/.test(filename);
}

export function mayTraverse(relative, platform) {
  const normalized = relative.replaceAll("\\", "/");
  if (normalized === "runtime") return true;
  if (normalized === "runtime/linux") return platform === "linux";
  if (normalized === "runtime/colibri") return true;
  if (normalized === "ferramentas") return platform === "windows";
  return includeRuntimeFile(normalized + "/entry.mjs", platform);
}

export function cleanConfig(config) {
  const clean = {
    $schema: "https://opencode.ai/config.json",
    permission: structuredClone(
      config.permission || {
        "*": "allow",
        external_directory: "allow",
        doom_loop: "deny",
        task: "deny",
      },
    ),
  };
  delete clean.model;
  delete clean.small_model;
  clean.autoupdate = false;
  clean.share = "disabled";
  clean.enabled_providers = ["ollama", "colibri"];
  clean.provider = {
    ollama: {
      npm: "@ai-sdk/openai-compatible",
      name: "Local models (Ollama)",
      options: {
        baseURL: "http://127.0.0.1:11434/v1",
        timeout: false,
        headerTimeout: 1800000,
        chunkTimeout: 600000,
      },
      models: {},
    },
  };
  clean.instructions = ["INSTRUCOES.md", "RECUPERACAO.md", "WEB-E-MCP.md", "LANGUAGE.md"];
  clean.skills = { paths: ["skills"] };
  clean.mcp = {};
  return clean;
}
