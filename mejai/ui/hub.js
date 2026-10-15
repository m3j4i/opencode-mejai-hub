import { createProvidersActions } from "./hub/providers.js";
import { createEditorActions } from "./hub/editor.js";
import { createMaintenanceActions } from "./hub/maintenance.js";
import { initLanguage } from "/language.js";

import { mountChat } from "/chat.js";
import { mountEditor } from "/editor.js";

const token =
  location.hash.slice(1) ||
  localStorage.getItem("mejai-token") ||
  sessionStorage.getItem("mejai-token");
if (token) {
  localStorage.setItem("mejai-token", token);
  sessionStorage.setItem("mejai-token", token);
}
history.replaceState(null, "", location.pathname);
const $ = (s) => document.querySelector(s);
const editorState = { value: null };
let panelTimer, panelCleanup;
async function api(route, body) {
  const r = await fetch("/api/" + route, {
    headers: { "X-Mejai-Token": token, "Content-Type": "application/json" },
    ...(body !== undefined ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : { ok: true };
  } catch {
    throw Error("The hub returned an invalid response. Reload the hub and try again.");
  }
  if (!r.ok) throw Error(data.error || "Request failed (" + r.status + ")");
  return data;
}
const display = (value) => JSON.stringify(value, null, 2);
function message(text) {
  $("#message").textContent = text;
  if ($("#modal").open) $("#dialog-message").textContent = text;
}
function show(title, html) {
  panelCleanup?.();
  panelCleanup = null;
  clearInterval(panelTimer);
  editorState.value?.destroy();
  editorState.value = null;
  $("#title").textContent = title;
  $("#dialog-message").textContent = "";
  $("#content").innerHTML = html;
  $("#modal").showModal();
}
function button(text, fn, parent = $("#content")) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = () => perform(fn);
  parent.append(b);
  return b;
}
async function perform(fn) {
  message("Working...");
  try {
    const result = await fn();
    message(typeof result === "string" ? result : "Done.");
  } catch (e) {
    message(e.message);
  } finally {
    status();
  }
}
$("#close").onclick = () => {
  clearInterval(panelTimer);
  $("#modal").close();
};
$("#modal").addEventListener("close", () => {
  clearInterval(panelTimer);
  panelCleanup?.();
  panelCleanup = null;
});
$("#stop").onclick = () =>
  perform(async () => {
    await api("stop", {});
    return "Agent stopped. Ollama was not changed.";
  });
let checkingStatus = false;
function paintRuntime(runtime) {
  for (const [key, action] of [
    ["agent", "chat"],
    ["autonomy", "autonomy"],
  ]) {
    const value = runtime?.[key] || {
      state: "unknown",
      label: "Status unavailable",
    };
    const light = $("#" + key + "-light");
    light.dataset.signal = value.state;
    light.textContent = (key === "agent" ? "Agent" : "Autonomy") + " · " + value.label;
    const target = document.querySelector('[data-action="' + action + '"]');
    if (target) target.dataset.signal = value.state;
  }
}
async function status() {
  if (checkingStatus) return;
  checkingStatus = true;
  try {
    const s = await api("status");
    paintRuntime(s.runtime);
    $("#status").textContent = !s.server
      ? "Agent stopped."
      : s.progress
        ? "Agent: " +
          s.progress.state +
          " — last recorded " +
          new Date(s.progress.updated).toLocaleString()
        : "Agent running. Read the chat for task status.";
    if (s.error) $("#status").textContent += " " + s.error;
    const p = s.preparation;
    $("#preparation").textContent =
      p?.status === "preparing"
        ? "Preparing tools and the selected model in the background…"
        : p?.status === "ready"
          ? "Last preparation completed for " + p.model + "."
          : p && ["partial", "unavailable"].includes(p.status)
            ? "Background preparation incomplete. " +
              (p.error ||
                Object.values(p.steps || {})
                  .filter((x) => x.error)
                  .map((x) => x.error)
                  .join(" "))
            : "";
  } catch (e) {
    paintRuntime(null);
    $("#status").textContent = e.message;
  } finally {
    checkingStatus = false;
  }
}
await initLanguage(api);
status();
setInterval(status, 5000);
api("warmup", {}).catch(() => {});
let chatView;
async function integratedChat(id) {
  $("#modal").close();
  if (!chatView || $("#integrated-chat").hidden) {
    chatView?.cleanup();
    $("#integrated-chat").hidden = false;
    chatView = mountChat({
      root: $("#integrated-chat"),
      api,
      onError: message,
      initialID: id,
    });
  } else if (id) await chatView.open(id);
  $("#integrated-chat").scrollIntoView({ behavior: "smooth" });
  return "Conversation open in the hub.";
}
async function openChatTab(route, body) {
  return integratedChat(body?.id);
}

const actionContext = {
  $,
  api,
  show,
  button,
  display,
  ask,
  confirmAction,
  openChatTab,
  mountEditor,
  editorState,
  perform,
};
const actions = {
  ...createProvidersActions(actionContext),
  ...createEditorActions(actionContext),
  ...createMaintenanceActions(actionContext),
  chat: () => openChatTab("chat", {}),
};
actionContext.actions = actions;
document
  .querySelectorAll("[data-action]")
  .forEach((b) => (b.onclick = () => perform(actions[b.dataset.action])));

function ask(title, description, word = "") {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    const h = document.createElement("h2");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = description;
    const label = document.createElement("label");
    label.textContent = word ? "Type " + word + " to confirm:" : "Enter your choice:";
    const input = document.createElement("input");
    input.setAttribute("aria-label", word ? "Confirmation" : "Your choice");
    input.autocomplete = "off";
    label.append(input);
    const row = document.createElement("div");
    row.className = "row";
    const ok = document.createElement("button");
    ok.textContent = word ? "Confirm " + title.toLowerCase() : "Continue";
    ok.title = "Apply this operation after checking your entry.";
    ok.disabled = !!word;
    input.oninput = () => (ok.disabled = !!word && input.value.trim() !== word);
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.title = "Close this confirmation without making changes.";
    let answer = null;
    ok.onclick = () => {
      answer = input.value.trim();
      d.close();
    };
    cancel.onclick = () => d.close();
    row.append(ok, cancel);
    d.append(h, p, label, row);
    document.body.append(d);
    d.onclose = () => {
      d.remove();
      resolve(answer);
    };
    d.showModal();
    input.focus();
  });
}
async function confirmAction(text) {
  return (await ask("Confirm maintenance", text, "CONFIRM")) === "CONFIRM";
}
const tips = {
  Close: "Close this panel; background work continues.",
  "Stop agent": "Stop an idle OpenCode server. Pause active autonomy first. Ollama keeps running.",
  "My files": "Browse task outputs and downloads.",
  "Task files": "Open the task output folder in your file manager.",
  Downloads: "Open the downloads folder in your file manager.",
  Help: "Read usage and portability instructions.",
  Save: "Validate and save this file. Restart an idle agent to load updated rules.",
  Reload: "Discard unsaved editor changes and read the file again.",
  "Use this model": "Select this provider and model for new conversations. The agent must be idle.",
  "Save model settings":
    "Save the Colibri model folder, backend and token limits. Does not download weights.",
  "Start Colibri": "Start the installed Colibri runtime using your configured model.",
  "Stop Colibri": "Stop only the Colibri runtime; an active agent must finish first.",
  Refresh: "Refresh provider availability and model status.",
  "Show logs": "Show the latest Colibri startup and runtime log.",
  "Delete selected":
    "Review a confirmation before permanently deleting the selected conversations and descendants.",
  "Progress and errors": "Show agent status, preparation and the latest recorded task progress.",
  "Installed tools": "Show the catalog of available tools and their prerequisites.",
  "Connect an account": "Select a service and open its authorization flow.",
  "Save code version": "Save a restorable snapshot of hub code and plugins.",
  "Restore code version":
    "Restore a selected code snapshot; preserves configuration and conversations.",
  Diagnostics: "Check bundled executables and Ollama availability without sending a model prompt.",
  "Run isolated tests":
    "Run regression tests with temporary data; no real conversations or Ollama prompts.",
  "Check GitHub release": "Check the latest official OpenCode release without installing it.",
  "Update OpenCode":
    "Back up existing data, verify the download and test compatibility before replacing OpenCode.",
  "Restore previous OpenCode":
    "Restore the previous executable. Data backups remain available for recovery.",
  "Reset kit data":
    "Preview and explicitly confirm deletion of conversations, work, downloads, logins and profiles. Tools and settings are kept.",
};
function annotate() {
  for (const b of document.querySelectorAll("button"))
    if (!b.title)
      b.title = tips[b.textContent.trim()] || b.getAttribute("aria-label") || b.textContent.trim();
}
new MutationObserver(annotate).observe(document.body, {
  childList: true,
  subtree: true,
});
annotate();
