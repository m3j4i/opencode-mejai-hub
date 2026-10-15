import { tool } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const PythonTool = tool({
  description: "Execute Python source directly without shell quoting. Use this for multiline code, quotes, or data processing. Runs the kit Python in the session directory. Returns exit status and bounded output. Prefer saved project scripts for reusable programs.",
  args: {
    source: tool.schema.string().min(1).max(200000),
    timeout: tool.schema.number().int().min(1).max(600).default(120),
  },
  async execute(args, context) {
    await context.ask({ permission: "bash", patterns: ["python"], always: ["python"], metadata: { source: args.source } })
    context.abort.throwIfAborted()
    const folder = await mkdtemp(path.join(os.tmpdir(), "mejai-python-"))
    const file = path.join(folder, "program.py")
    try {
      await writeFile(file, args.source, "utf8")
      const root = process.env.AGENTE_LOCAL_HOME
      const executable = root
        ? path.join(root, "runtime", ...(process.platform === "win32" ? ["python", "python.exe"] : ["linux", "python", "bin", "python3"]))
        : process.platform === "win32" ? "python" : "python3"
      return await new Promise<{ title: string; output: string; metadata: { exit: number } }>((resolve) => {
        execFile(executable, [file], {
          cwd: context.directory, windowsHide: true, timeout: (args.timeout ?? 120) * 1000,
          signal: context.abort, maxBuffer: 1024 * 1024,
          env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
        }, (error, stdout, stderr) => resolve({
          title: "Python",
          output: (stdout + stderr + (error ? "\nPython execution failed: " + error.message : "")).slice(-40000),
          metadata: { exit: error ? (typeof error.code === "number" ? error.code : 1) : 0 },
        }))
      })
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  },
})
