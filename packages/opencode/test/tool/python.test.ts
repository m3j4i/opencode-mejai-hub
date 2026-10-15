import { expect, test } from "bun:test"
import { PythonTool } from "../../src/tool/python"
import { tmpdir } from "../fixture/fixture"

test("Python accepts multiline source and shell-sensitive quotes", async () => {
  await using tmp = await tmpdir()
  const requested: string[] = []
  const result = await PythonTool.execute({ source: `import pathlib\nprint('ação "quoted" $HOME')\npathlib.Path('result.txt').write_text('verified', encoding='utf-8')`, timeout: 15 }, {
    sessionID: "test", messageID: "test", agent: "build", directory: tmp.path, worktree: tmp.path,
    abort: new AbortController().signal, metadata() {}, async ask(input) { requested.push(input.permission) },
  })
  expect(requested).toEqual(["bash"])
  if (typeof result === "string") throw Error("Expected structured result")
  expect(result.metadata?.exit).toBe(0)
  expect(result.output).toContain('ação "quoted" $HOME')
  expect(await Bun.file(tmp.path + "/result.txt").text()).toBe("verified")
})

test("Python preserves nonzero exit and honors denied permission", async () => {
  await using tmp = await tmpdir()
  const context = { sessionID: "test", messageID: "test", agent: "build", directory: tmp.path, worktree: tmp.path,
    abort: new AbortController().signal, metadata() {}, async ask() {} }
  const result = await PythonTool.execute({ source: "raise RuntimeError('failure evidence')", timeout: 15 }, context)
  if (typeof result === "string") throw Error("Expected structured result")
  expect(result.metadata?.exit).not.toBe(0)
  expect(result.output).toContain("failure evidence")
  await expect(PythonTool.execute({ source: "print('should not run')", timeout: 15 }, { ...context, async ask() { throw Error("denied") } })).rejects.toThrow("denied")
})
