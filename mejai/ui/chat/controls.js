import { t } from "/language.js";
export function createControls(context) {
  async function confirmDelete() {
    const id = context.state.selected;
    const dialog = document.createElement("dialog");
    context.element(dialog, "h2", t("Delete chat?"));
    context.element(dialog, "p", context.find("#chat-sessions").selectedOptions[0]?.textContent);
    context.element(
      dialog,
      "p",
      t("Delete this conversation and its child conversations. Task files and backups are kept."),
    );
    context.action(
      dialog,
      "Delete chat",
      "Permanently remove the selected conversation from current history.",
      async () => {
        await context.api("chat/delete", { sessionID: id, confirm: "DELETE" });
        delete context.state.drafts[id];
        delete context.state.fileDrafts[id];
        localStorage.setItem("mejai-chat-drafts", JSON.stringify(context.state.drafts));
        localStorage.setItem("mejai-chat-files", JSON.stringify(context.state.fileDrafts));
        context.state.selected = "";
        localStorage.removeItem("mejai-chat-session");
        dialog.close();
        await context.sessions();
      },
    );
    context.action(dialog, "Cancel", "Close without making changes.", () => dialog.close());
    dialog.onclose = () => dialog.remove();
    document.body.append(dialog);
    dialog.showModal();
  }

  function renderState() {
    const busy =
      context.state.current?.status?.type === "busy" ||
      context.state.current?.status?.type === "retry";
    const active = !!context.state.current?.autonomy?.enabled;
    for (const button of context.root.querySelectorAll(".edit-message"))
      button.disabled = busy || active || context.state.submitting;
    const button = context.find("#chat-autonomy");
    button.textContent = t(
      active ? "Pause autonomy" : context.state.armed ? "Autonomy armed" : "Start autonomy",
    );
    button.setAttribute("aria-pressed", String(active || context.state.armed));
    button.dataset.signal = active
      ? busy
        ? "working"
        : "ready"
      : context.state.armed
        ? "ready"
        : "stopped";
    button.title = t(
      active
        ? "Pause automatic continuation and cancel the current turn."
        : context.state.armed
          ? "Autonomy will start when you send the next message. Click to disarm."
          : "Start autonomous work from this conversation or arm it for your next message.",
    );
    delete button.dataset.langtitle;
    context.find("#chat-state").textContent =
      t(busy ? "Working…" : "Ready") +
      " · " +
      t(
        context.state.armed
          ? "Waiting for your next message."
          : active
            ? "Autonomy enabled"
            : context.state.current?.autonomy?.status === "reported complete"
              ? "Completion reported; review the checks."
              : "Autonomy off",
      );
    context.find("#chat-delete").disabled =
      busy || context.state.submitting || context.state.uploading;
    context.find("#chat-sessions").disabled =
      context.state.uploading || context.state.submitting || context.state.changing;
    context.find("#chat-close").disabled = context.state.uploading;
    context.find("#chat-new").disabled =
      context.state.uploading || context.state.submitting || context.state.changing;
  }
  return { confirmDelete, renderState };
}
