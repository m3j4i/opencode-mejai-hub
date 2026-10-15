import { bindSendShortcut } from "./chat/input.js";
import { createEditing } from "./chat/edit.js";
import { chatMarkup } from "./chat/template.js";
import { t } from "/language.js";
import { createHistory } from "./chat/history.js";
import { createRequests } from "./chat/requests.js";
import { createUploads } from "./chat/uploads.js";
import { createStream } from "./chat/stream.js";
import { createControls } from "./chat/controls.js";
import { createSessions } from "./chat/sessions.js";
import { createStorage } from "./chat/storage.js";
import { createDom } from "./chat/dom.js";
export function mountChat({ root, api, onError, initialID }) {
  const context = {
    root,
    api,
    onError,
    initialID,
    find: (selector) => root.querySelector(selector),
    state: {
      selected: "",
      disposed: false,
      stream: null,
      poll: null,
      drawTimer: null,
      refreshing: false,
      submitting: false,
      uploading: false,
      armed: false,
      current: null,
      requestRevision: "",
      changing: false,
      attachments: [],
      minutes: 480,
      maxTurns: 100,
      scriptArtifacts: new Map(),
      records: new Map(),
      views: new Map(),
      drafts: {},
      fileDrafts: {},
    },
  };
  Object.assign(context, createEditing(context));
  Object.assign(context, createHistory(context));
  Object.assign(context, createRequests(context));
  Object.assign(context, createUploads(context));
  Object.assign(context, createStream(context));
  Object.assign(context, createControls(context));
  Object.assign(context, createSessions(context));
  Object.assign(context, createStorage(context));
  Object.assign(context, createDom(context));
  function reportError(event) {
    if (!context.state.disposed) context.onError(t(event.message || String(event)));
  }
  function translated() {
    for (const view of context.state.views.values()) view.signature = "";
    context.state.requestRevision = "";
    context.renderState();
    context.renderMessages();
    context.renderFiles();
    if (context.state.current) context.renderRequests(context.state.current);
  }
  function cleanup() {
    context.state.disposed = true;
    context.saveDraft();
    clearInterval(context.state.poll);
    clearTimeout(context.state.drawTimer);
    context.state.stream?.abort();
    window.removeEventListener("mejai-language", context.translated);
    context.root.ondragover = null;
    context.root.ondrop = null;
  }
  Object.assign(context, { reportError, translated, cleanup });
  context.state.drafts = context.saved("mejai-chat-drafts", {});
  context.state.fileDrafts = context.saved("mejai-chat-files", {});

  context.root.innerHTML = chatMarkup;
  const limits = context.saved("mejai-chat-limits", {});
  context.state.minutes = limits.minutes || context.state.minutes;
  context.state.maxTurns = limits.maxTurns || context.state.maxTurns;
  bindSendShortcut(context.find("#chat-input"), context.find("#chat-form"));
  context.find("#chat-input").oninput = context.saveDraft;
  context.find("#chat-new").onclick = () => context.create().catch(context.reportError);
  context.find("#chat-sessions").onchange = () =>
    context.choose(context.find("#chat-sessions").value).catch(context.reportError);
  context.find("#chat-close").onclick = () => {
    context.cleanup();
    context.root.hidden = true;
  };
  context.find("#chat-limits").onclick = () => {
    const dialog = document.createElement("dialog");
    const field = context.element(dialog, "form");
    field.method = "dialog";
    context.element(field, "h2", t("Autonomy limits"));
    const duration = context.element(context.element(field, "label", t("Minutes")), "input");
    duration.type = "number";
    duration.min = "5";
    duration.max = "1440";
    duration.value = context.state.minutes;
    const count = context.element(context.element(field, "label", t("Continuations")), "input");
    count.type = "number";
    count.min = "1";
    count.max = "1000";
    count.value = context.state.maxTurns;
    context.action(field, "Save", "Apply these limits to the next autonomous run.", () => {
      const message = Number(duration.value),
        n = Number(count.value);
      if (
        !Number.isInteger(message) ||
        message < 5 ||
        message > 1440 ||
        !Number.isInteger(n) ||
        n < 1 ||
        n > 1000
      ) {
        duration.reportValidity();
        count.reportValidity();
        return;
      }
      context.state.minutes = message;
      context.state.maxTurns = n;
      localStorage.setItem(
        "mejai-chat-limits",
        JSON.stringify({
          minutes: context.state.minutes,
          maxTurns: context.state.maxTurns,
        }),
      );
      dialog.close();
    });
    context.action(field, "Cancel", "Close without making changes.", () => dialog.close());
    dialog.onclose = () => dialog.remove();
    document.body.append(dialog);
    dialog.showModal();
  };
  context.find("#chat-delete").onclick = () => context.confirmDelete().catch(context.reportError);
  context.find("#chat-autonomy").onclick = async () => {
    const button = context.find("#chat-autonomy");
    button.disabled = true;
    try {
      if (context.state.current?.autonomy?.enabled) {
        await context.api("autonomy/pause", {
          sessionID: context.state.selected,
        });
        context.state.armed = false;
        await context.refresh(true);
      } else if (context.state.armed) {
        context.state.armed = false;
      } else if (
        context.find("#chat-input").value.trim() ||
        context.state.attachments.length ||
        !Array.from(context.state.records.values()).some((message) => message.info.role === "user")
      ) {
        context.state.armed = true;
      } else {
        await context.api("autonomy/start", {
          sessionID: context.state.selected,
          objective: "",
          minutes: context.state.minutes,
          maxTurns: context.state.maxTurns,
        });
        await context.refresh(true);
      }
      context.renderState();
    } catch (error) {
      context.reportError(error);
    } finally {
      button.disabled = false;
    }
  };
  context.find("#chat-stop").onclick = async () => {
    try {
      await context.api("chat/stop", { sessionID: context.state.selected });
      context.state.armed = false;
      await context.refresh(true);
    } catch (error) {
      context.reportError(error);
    }
  };
  context.find("#chat-form").onsubmit = async (event) => {
    event.preventDefault();
    if (
      context.state.submitting ||
      context.state.uploading ||
      context.state.changing ||
      context.state.editing
    )
      return;
    const text = context.find("#chat-input").value.trim();
    if (!text && !context.state.attachments.length) return;
    context.state.submitting = true;
    context.renderState();
    context.find("#chat-send").disabled = true;
    try {
      await context.api("chat/send", {
        sessionID: context.state.selected,
        text,
        attachments: context.state.attachments.map((attachment) => attachment.id),
        autonomy: context.state.armed || !!context.state.current?.autonomy?.enabled,
        minutes: context.state.minutes,
        maxTurns: context.state.maxTurns,
      });
      context.find("#chat-input").value = "";
      context.state.attachments = [];
      context.state.armed = false;
      context.saveDraft();
      context.renderFiles();
      await context.refresh(true);
    } catch (error) {
      context.reportError(error);
    } finally {
      context.state.submitting = false;
      context.renderState();
      context.find("#chat-send").disabled = false;
    }
  };
  context.find("#chat-attach").onclick = () => context.find("#chat-file-input").click();
  context.find("#chat-file-input").onchange = (event) => {
    context.upload(event.target.files).catch(context.reportError);
    event.target.value = "";
  };
  context.root.ondragover = (event) => {
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  };
  context.root.ondrop = (event) => {
    if (event.dataTransfer.files.length) {
      event.preventDefault();
      context.upload(event.dataTransfer.files).catch(context.reportError);
    }
  };
  context.find("#chat-input").onpaste = (event) => {
    if (event.clipboardData.files.length) {
      event.preventDefault();
      context.upload(event.clipboardData.files).catch(context.reportError);
    }
  };
  window.addEventListener("mejai-language", context.translated);
  context.state.poll = setInterval(() => {
    if (!document.hidden) context.refresh();
  }, 5000);
  context
    .sessions(context.initialID || localStorage.getItem("mejai-chat-session"))
    .catch(context.reportError);
  return {
    cleanup: context.cleanup,
    open: async (id) => {
      if (id) await context.sessions(id);
    },
  };
}
