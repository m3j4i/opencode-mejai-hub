import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";
const base =
  process.env.AGENTE_LOCAL_HOME ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const connection = JSON.parse(await fs.readFile(path.join(base, "dados/hub-win32.json")));
const settings = JSON.parse(await fs.readFile(path.join(base, "navegador-config.json")));
const headers = { "X-Mejai-Token": connection.token, "Content-Type": "application/json" };
async function hub(route, body) {
  const response = await fetch(connection.url + "/api/" + route, {
    headers,
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert(response.ok, JSON.stringify(result));
  return result;
}
const fixture = await hub("chat", {});
const sessions = [fixture.id];
const server = JSON.parse(await fs.readFile(path.join(base, "dados/connection-win32.json")));
async function native(route, body) {
  const response = await fetch(
    "http://127.0.0.1:" +
      server.port +
      route +
      "?directory=" +
      encodeURIComponent(path.join(base, "tarefas")),
    {
      headers: { "Content-Type": "application/json" },
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const result = await response.json();
  assert(response.ok, JSON.stringify(result));
  return result;
}
const code = 'const answer = "hello";\nconsole.log(answer);';
const markdown =
  "# Render test\n\n| Model | Status |\n| --- | --- |\n| Local | Ready |\n\n```javascript\n" +
  code +
  '\n```\n\n[Unsafe](javascript:alert(1))\n\n<img src=x onerror="window.injected=true">';
const { chromium } = await import(
  pathToFileURL(path.join(base, "runtime/browser/node_modules/playwright/index.mjs"))
);
const browser = await chromium.launch({ executablePath: settings.executablePath, headless: true });
try {
  const first = await native("/session/" + fixture.id + "/message", {
    noReply: true,
    parts: [{ type: "text", text: "First message preserved" }],
  });
  const second = await native("/session/" + fixture.id + "/message", {
    noReply: true,
    parts: [{ type: "text", text: markdown }],
  });
  const branch = await native("/session/" + fixture.id + "/fork", { messageID: second.info.id });
  sessions.push(branch.id);
  const branchMessages = await native("/session/" + branch.id + "/message");
  assert.equal(branchMessages.length, 1);
  assert.equal(branchMessages[0].parts[0].text, first.parts[0].text);
  assert.equal((await native("/session/" + fixture.id + "/message")).length, 2);
  const stale = await fetch(connection.url + "/api/chat/edit", {
    headers,
    method: "POST",
    body: JSON.stringify({
      sessionID: fixture.id,
      messageID: second.info.id,
      expectedText: "stale",
      text: "Changed",
    }),
  });
  assert.equal(stale.status, 400);
  assert.match((await stale.json()).error, /changed/);
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(connection.url + "/#" + connection.token);
  await page.waitForFunction(() => document.querySelector("#hub-language")?.options.length > 0);
  await page.locator("#hub-language").selectOption("en");
  await page.evaluate((id) => localStorage.setItem("mejai-chat-session", id), fixture.id);
  await page.locator("[data-action=chat]").click();
  await page.waitForFunction(
    (id) => document.querySelector("#chat-sessions")?.value === id,
    fixture.id,
  );
  await page.locator("#chat-messages table").waitFor();
  assert.equal(await page.locator("#chat-messages tbody td").first().textContent(), "Local");
  assert.equal(await page.locator(".code-block pre code").textContent(), code);
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n"),
    code,
  );
  assert.equal(
    await page
      .locator("#chat-messages img, #chat-messages script, #chat-messages a[href^='javascript:']")
      .count(),
    0,
  );
  assert.equal(await page.evaluate(() => window.injected), undefined);
  let sent = 0;
  await page.route("**/api/chat/send", async (route) => {
    sent++;
    await route.fulfill({ json: { sessionID: fixture.id } });
  });
  await page.locator("#chat-input").fill("Keyboard test");
  await page.locator("#chat-input").press("Shift+Enter");
  assert.equal(await page.locator("#chat-input").inputValue(), "Keyboard test\n");
  assert.equal(sent, 0);
  await page.locator("#chat-input").press("Enter");
  await page.waitForFunction(() => document.querySelector("#chat-input").value === "");
  assert.equal(sent, 1);
  let edited;
  await page.route("**/api/chat/edit", async (route) => {
    edited = route.request().postDataJSON();
    await route.fulfill({ json: { sessionID: branch.id, sent: true } });
  });
  await page.locator(".edit-message").last().click();
  try {
    await page.locator("dialog[open] textarea").waitFor({ timeout: 3000 });
  } catch (error) {
    console.log(
      JSON.stringify({
        errors,
        dialogs: await page.locator("dialog").count(),
        message: await page.locator("#message").textContent(),
        buttons: await page
          .locator(".edit-message")
          .evaluateAll((buttons) =>
            buttons.map((button) => ({ disabled: button.disabled, text: button.textContent })),
          ),
      }),
    );
    throw error;
  }
  await page.locator("dialog[open] textarea").fill("Corrected request");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Edit and resend", exact: true })
    .click();
  await page.waitForFunction(
    (id) => document.querySelector("#chat-sessions").value === id,
    branch.id,
  );
  assert.equal(edited.messageID, second.info.id);
  assert.equal(edited.expectedText, markdown);
  assert.equal(edited.text, "Corrected request");
  assert.deepEqual(errors, []);
  await page.locator("#chat-sessions").selectOption(fixture.id);
  await page.locator("#chat-messages table").waitFor();
  await page.screenshot({
    path: path.join(base, "logs/validacao/hub-chat-rich.png"),
    fullPage: true,
  });
  console.log(
    "PASS Markdown tables, syntax/code copy, safe HTML/links, Enter/Shift+Enter, editing UI and native fork boundary; no inference.",
  );
} finally {
  await browser.close();
  for (const sessionID of sessions.reverse())
    await hub("chat/delete", { sessionID, confirm: "DELETE" });
}
