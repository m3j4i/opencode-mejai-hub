import { t } from "/language.js";
export function createSessions(context) {
  async function sessions(preferred) {
    await context.api("start", {});
    const snapshot = await context.api("activity");
    if (context.state.disposed) return;
    const select = context.find("#chat-sessions");
    select.replaceChildren();
    for (const session of snapshot.sessions || []) {
      const option = context.element(select, "option", session.title);
      option.value = session.id;
    }
    const id =
      (snapshot.sessions || []).find((session) => session.id === preferred)?.id ||
      snapshot.sessions?.[0]?.id;
    if (id) await context.choose(id);
    else await context.create();
  }

  async function choose(id) {
    if (context.state.changing || context.state.disposed) return;
    context.state.changing = true;
    context.renderState();
    try {
      context.saveDraft();
      context.state.stream?.abort();
      context.state.selected = id;
      context.state.armed = false;
      context.state.current = null;
      context.state.records.clear();
      context.state.scriptArtifacts.clear();
      context.state.views.clear();
      context.state.requestRevision = "";
      context.find("#chat-messages").replaceChildren();
      context.find("#chat-thinking").textContent = t("Loading conversation…");
      context.find("#chat-sessions").value = id;
      localStorage.setItem("mejai-chat-session", id);
      context.find("#chat-input").value = context.state.drafts[id] || "";
      context.state.attachments = context.state.fileDrafts[id] || [];
      context.renderFiles();
      await context.refresh(true);
      context.live(id);
    } finally {
      context.state.changing = false;
      if (!context.state.disposed) context.renderState();
    }
  }

  async function create() {
    if (context.state.uploading || context.state.submitting) return;
    const snapshot = await context.api("chat", {});
    await context.sessions(snapshot.id);
  }

  async function refresh(force = false) {
    if (context.state.disposed || !context.state.selected || (context.state.refreshing && !force))
      return;
    const id = context.state.selected;
    context.state.refreshing = true;
    try {
      const snapshot = await context.api(
        "chat/snapshot?session=" +
          encodeURIComponent(id) +
          (context.state.records.size ? "&recent=1" : ""),
      );
      if (context.state.disposed || context.state.selected !== id) return;
      context.state.current = snapshot;
      for (const message of snapshot.messages)
        context.state.scriptArtifacts.set(
          message.info.id,
          (snapshot.scriptArtifacts || []).filter(
            (artifact) => artifact.messageID === message.info.id,
          ),
        );
      for (const message of snapshot.messages) {
        const previous = context.state.records.get(message.info.id);
        if (previous)
          for (const part of message.parts || []) {
            const livePart = previous.parts.find((entry) => entry.id === part.id);
            if (
              livePart &&
              ["reasoning", "text"].includes(part.type) &&
              (livePart.text || "").startsWith(part.text || "") &&
              livePart.text.length > (part.text || "").length
            )
              part.text = livePart.text;
          }
        context.state.records.set(message.info.id, message);
      }
      context.renderState();
      context.renderMessages();
      context.find("#chat-todos").replaceChildren();
      for (const todo of snapshot.todos)
        context.element(
          context.find("#chat-todos"),
          "p",
          (todo.status === "completed" ? "✓ " : todo.status === "in_progress" ? "→ " : "○ ") +
            todo.content,
        );
      context.renderRequests(snapshot);
    } catch (error) {
      context.reportError(error);
    } finally {
      context.state.refreshing = false;
    }
  }
  return { sessions, choose, create, refresh };
}
