import { t } from "/language.js";

export function createEditing(context) {
  async function editMessage(message) {
    if (context.state.editing) return;
    const sessionID = context.state.selected;
    const expectedText = message.parts
      .filter((part) => part.type === "text" && !part.synthetic && !part.metadata?.mejaiAttachment)
      .map((part) => part.text || "")
      .join("\n\n");
    const dialog = document.createElement("dialog");
    dialog.className = "edit-message-dialog";
    context.element(dialog, "h2", t("Edit message"));
    context.element(
      dialog,
      "p",
      t(
        "Resending creates a new conversation from this point. The original chat and existing task files remain available.",
      ),
    );
    const input = context.element(dialog, "textarea");
    input.value = expectedText;
    input.rows = 8;
    input.maxLength = 100000;
    input.setAttribute("aria-label", t("Edited message"));
    const status = context.element(dialog, "p");
    status.setAttribute("role", "status");
    let sending = false;
    let cancel;
    const save = context.action(
      dialog,
      "Edit and resend",
      "Send the corrected message in a new conversation, preserving the original.",
      async () => {
        if (sending || !input.value.trim()) return;
        sending = true;
        save.disabled = cancel.disabled = input.disabled = true;
        try {
          const result = await context.api("chat/edit", {
            sessionID,
            messageID: message.info.id,
            expectedText,
            text: input.value,
          });
          dialog.close();
          if (!context.state.disposed) await context.sessions(result.sessionID);
          if (!result.sent)
            context.reportError(
              Error(
                t(
                  "The edited conversation was created. Check its history before retrying: {error}",
                  { error: result.error },
                ),
              ),
            );
        } catch (error) {
          status.textContent = t(error.message);
        } finally {
          sending = false;
          save.disabled = cancel.disabled = input.disabled = false;
        }
      },
    );
    cancel = context.action(dialog, "Cancel", "Close without making changes.", () =>
      dialog.close(),
    );
    dialog.oncancel = (event) => {
      if (sending) event.preventDefault();
    };
    dialog.onclose = () => {
      context.state.editing = false;
      dialog.remove();
    };
    context.state.editing = true;
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  }
  return { editMessage };
}
