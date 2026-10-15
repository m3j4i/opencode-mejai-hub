import { t } from "/language.js";
export function createUploads(context) {
  function renderFiles() {
    const box = context.find("#chat-attachments");
    box.replaceChildren();
    for (const attachment of context.state.attachments) {
      const row = context.element(box, "div", "", "attachment");
      context.element(
        row,
        "span",
        attachment.name + " · " + (attachment.size / 1024).toFixed(1) + " KB",
      );
      context.action(
        row,
        "Remove",
        "Remove this attachment from the draft. The uploaded file stays in task files.",
        () => {
          context.state.attachments = context.state.attachments.filter(
            (entry) => entry.id !== attachment.id,
          );
          context.saveDraft();
          context.renderFiles();
        },
      );
    }
  }

  async function upload(files) {
    if (context.state.uploading || context.state.submitting || !context.state.selected) return;
    const list = Array.from(files);
    if (list.length + context.state.attachments.length > 10) throw Error("Attach up to 10 files.");
    if (list.some((field) => field.size > 50 * 1024 * 1024))
      throw Error("Each attachment must be 50 MB or smaller.");
    context.state.uploading = true;
    context.renderState();
    context.find("#chat-send").disabled = true;
    try {
      for (const file of list) {
        context.find("#chat-upload-state").textContent = t("Uploading {name}…", {
          name: file.name,
        });
        const response = await fetch(
          "/api/chat/upload?session=" +
            encodeURIComponent(context.state.selected) +
            "&name=" +
            encodeURIComponent(file.name),
          {
            method: "POST",
            headers: {
              "X-Mejai-Token": localStorage.getItem("mejai-token"),
              "Content-Type": "application/octet-stream",
            },
            body: file,
          },
        );
        const snapshot = await response.json();
        if (!response.ok) throw Error(snapshot.error);
        context.state.attachments.push(snapshot);
        context.saveDraft();
        context.renderFiles();
      }
      context.find("#chat-upload-state").textContent = t("Attachments ready.");
    } finally {
      context.state.uploading = false;
      context.find("#chat-send").disabled = false;
      context.renderState();
    }
  }
  return { renderFiles, upload };
}
