export function createStorage(context) {
  function saved(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function saveDraft() {
    if (!context.state.selected) return;
    context.state.drafts[context.state.selected] = context.find("#chat-input").value;
    context.state.fileDrafts[context.state.selected] = context.state.attachments;
    localStorage.setItem("mejai-chat-drafts", JSON.stringify(context.state.drafts));
    localStorage.setItem("mejai-chat-files", JSON.stringify(context.state.fileDrafts));
  }
  return { saved, saveDraft };
}
