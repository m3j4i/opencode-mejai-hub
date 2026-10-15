import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const base =
  process.env.AGENTE_LOCAL_HOME ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const connection = JSON.parse(await fs.readFile(base + "/dados/hub-win32.json"));
const preferences = JSON.parse(await fs.readFile(base + "/navegador-config.json"));
const { chromium } = await import(
  pathToFileURL(base + "/runtime/browser/node_modules/playwright/index.mjs")
);
const headers = { "X-Mejai-Token": connection.token, "Content-Type": "application/json" };
async function api(route, body) {
  const response = await fetch(connection.url + "/api/" + route, {
    headers,
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert(response.ok, JSON.stringify(data));
  return data;
}
await fs.mkdir(path.join(base, "logs/validacao"), { recursive: true });
const fixture = await api("chat", {});
const languageFile = base + "/linguagens/test-ui.language";
const browser = await chromium.launch({
  executablePath: preferences.executablePath,
  headless: true,
});
let deleted = false;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(connection.url + "/#" + connection.token);
  await page.waitForFunction(() => document.querySelector("#hub-language")?.options.length > 0);
  assert.equal(await page.locator("[data-action=autonomy],[data-action=sessions]").count(), 0);
  await page.evaluate((id) => localStorage.setItem("mejai-chat-session", id), fixture.id);
  await page.locator("[data-action=chat]").click();
  await page.waitForFunction(
    (id) => document.querySelector("#chat-sessions")?.value === id,
    fixture.id,
  );
  await page.locator("#chat-state").filter({ hasText: "Ready" }).waitFor();
  assert.equal(await page.locator("input#chat-autonomy").count(), 0);
  await page.locator("#chat-autonomy").click();
  assert.equal(await page.locator("#chat-autonomy").getAttribute("aria-pressed"), "true");
  await page.locator("#chat-autonomy").click();
  assert.equal(await page.locator("#chat-autonomy").getAttribute("aria-pressed"), "false");
  await page.locator("#chat-file-input").setInputFiles([
    {
      name: "metadata.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"fixture":true}'),
    },
    {
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOUm2bEwMDAxAAGAAreAOoNGZ2hAAAAAElFTkSuQmCC",
        "base64",
      ),
    },
  ]);
  await page.locator("#chat-upload-state").filter({ hasText: "Attachments ready." }).waitFor();
  assert.equal(await page.locator("#chat-attachments .attachment").count(), 2);
  let submitted;
  await page.route("**/api/chat/send", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { sessionID: fixture.id } });
  });
  await page.locator("#chat-input").fill("Inspect test attachments");
  await page.locator("#chat-send").click();
  await page.waitForFunction(() => document.querySelector("#chat-input").value === "");
  assert.equal(submitted.attachments.length, 2);
  assert.equal(submitted.autonomy, false);
  const transcript = [
    {
      info: { id: "msg_one", role: "assistant", time: { created: 1 } },
      parts: [
        {
          id: "part_old",
          messageID: "msg_one",
          type: "reasoning",
          text: "Historical thinking remains available.",
        },
        { id: "text_old", type: "text", text: "An earlier result." },
      ],
    },
    {
      info: { id: "msg_two", role: "assistant", time: { created: 2 } },
      parts: [
        { id: "part_live", messageID: "msg_two", type: "reasoning", text: "New thought." },
        { id: "text_live", type: "text", text: "Latest response." },
      ],
    },
  ];
  await page.route("**/api/chat/snapshot?**", (route) =>
    route.fulfill({
      json: {
        sessionID: fixture.id,
        messages: transcript,
        todos: [],
        status: { type: "idle" },
        permissions: [],
        questions: [],
      },
    }),
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#chat-messages details[data-key=thinking]").length === 2,
  );
  await page
    .locator("#chat-messages details[data-key=thinking]")
    .first()
    .locator("summary")
    .click();
  assert(
    await page.getByText("Historical thinking remains available.", { exact: true }).isVisible(),
  );
  await page.waitForTimeout(5200);
  assert(
    (await page
      .locator("#chat-messages details[data-key=thinking]")
      .first()
      .getAttribute("open")) !== null,
  );
  const english = JSON.parse(await fs.readFile(base + "/linguagens/en.language"));
  english.name = "Test translation";
  english.strings["New conversation"] = "Nova conversa de teste";
  english.strings["Create a conversation without leaving the hub"] = "Explicação traduzida";
  await fs.writeFile(languageFile, JSON.stringify(english));
  await page.locator("#scan-languages").click();
  await page.locator("#hub-language").selectOption("test-ui");
  assert.equal(await page.locator("#chat-new").textContent(), "Nova conversa de teste");
  assert.equal(await page.locator("#chat-new").getAttribute("title"), "Explicação traduzida");
  assert(
    await page.getByText("Historical thinking remains available.", { exact: true }).isVisible(),
  );
  await page.locator("#hub-language").selectOption("en");
  await page.unroute("**/api/chat/snapshot?**");
  await page.screenshot({ path: path.join(base, "logs/validacao/hub-chat.png"), fullPage: true });
  await page.locator("#chat-delete").click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Delete chat", exact: true })
    .click();
  await page.waitForFunction(
    (id) => document.querySelector("#chat-sessions")?.value !== id,
    fixture.id,
  );
  deleted = true;
  assert(!(await api("activity")).sessions.some((session) => session.id === fixture.id));
  assert.deepEqual(errors, []);
  console.log(
    "PASS real isolated uploads and deletion; autonomy arm/disarm; historic thinking; preserved expanded history; language scan and translated button/help. Message send intercepted: no model inference.",
  );
} finally {
  await browser.close();
  const uploadRoot = path.resolve(base, "tarefas/anexos");
  const fixtureDirectory = path.resolve(uploadRoot, fixture.id);
  if (path.dirname(fixtureDirectory) === uploadRoot && /^ses_[\w-]+$/.test(fixture.id))
    await fs.rm(fixtureDirectory, { recursive: true, force: true });
  await fs.unlink(languageFile).catch(() => {});
  if (!deleted)
    await api("chat/delete", { sessionID: fixture.id, confirm: "DELETE" }).catch(() => {});
}
