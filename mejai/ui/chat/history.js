import { renderScriptArtifacts } from "./script-artifacts.js";
import { marked } from "/vendor/marked.js";
import { renderMarkdown } from "./markdown.js";
import { t } from "/language.js";
export function createHistory(context) {
  function renderMessages() {
    if (context.state.disposed) return;
    const log = context.find("#chat-messages"),
      bottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    let automatic = 0,
      latestThinking = "";
    for (const message of context.state.records.values()) {
      const parts = message.parts || [];
      const texts = parts.filter(
          (part) =>
            part.type === "text" && !part.synthetic && !/^\[MEJAI autonomy\]/.test(part.text || ""),
        ),
        tools = parts.filter((part) => part.type === "tool"),
        reasoning = parts.filter((part) => part.type === "reasoning"),
        files = parts.filter((part) => part.type === "file");
      if (reasoning.length) latestThinking = reasoning.map((part) => part.text || "").join("\n\n");
      if (message.info.role === "user" && !texts.length && !files.length) {
        automatic++;
        continue;
      }
      if (
        !texts.length &&
        !tools.length &&
        !reasoning.length &&
        !files.length &&
        !message.info.error
      )
        continue;
      const artifacts = context.state.scriptArtifacts.get(message.info.id) || [];
      const signature = JSON.stringify([message.info.error, parts, artifacts]);
      let view = context.state.views.get(message.info.id);
      if (view?.signature === signature) continue;
      const opened = new Set(
        view
          ? Array.from(view.node.querySelectorAll("details[open]")).map(
              (entry) => entry.dataset.key,
            )
          : [],
      );
      const article = document.createElement("article");
      article.className = message.info.role;
      article.dataset.message = message.info.id;
      context.element(article, "strong", t(message.info.role === "user" ? "You" : "opencode"));
      const stamp = message.info.time?.created;
      if (stamp) context.element(article, "time", new Date(stamp).toLocaleString());
      if (reasoning.length) {
        const detail = context.element(article, "details");
        detail.dataset.key = "thinking";
        detail.open = opened.has("thinking");
        context.element(detail, "summary", t("Thinking"));
        context.element(detail, "pre", reasoning.map((part) => part.text || "").join("\n\n"));
      }
      if (message.info.role === "user" && texts.some((part) => !part.metadata?.mejaiAttachment)) {
        const button = context.action(
          article,
          "Edit message",
          "Edit this message and resend it in a new conversation.",
          () => context.editMessage(message),
        );
        button.className = "edit-message";
        button.disabled =
          ["busy", "retry"].includes(context.state.current?.status?.type) ||
          !!context.state.current?.autonomy?.enabled;
      }
      for (const part of texts) {
        if (part.metadata?.mejaiAttachment) {
          context.element(
            article,
            "p",
            t("Attached file: {name}", {
              name: part.metadata.mejaiAttachment.name,
            }),
            "attachment",
          );
          continue;
        }
        renderMarkdown(
          article,
          (part.text || "")
            .split("[MEJAI autonomy]")[0]
            .replace(/\[MEJAI autonomy: (?:complete|blocked)\]/g, ""),
          marked.lexer,
          t,
        );
      }
      renderScriptArtifacts(context, article, artifacts);
      for (const part of files)
        context.element(
          article,
          "p",
          t("Attached file: {name}", { name: part.filename || part.mime }),
          "attachment",
        );
      for (const part of tools) {
        const detail = context.element(article, "details");
        detail.dataset.key = part.id || part.callID;
        detail.open = opened.has(detail.dataset.key);
        context.element(detail, "summary", part.tool + " · " + t(part.state?.status || ""));
        context.element(
          detail,
          "pre",
          String(part.state?.error || part.state?.output || part.state?.title || ""),
        );
      }
      if (message.info.error)
        context.element(
          article,
          "pre",
          message.info.error.data?.message ||
            message.info.error.message ||
            JSON.stringify(message.info.error),
          "chat-error",
        );
      if (view) view.node.replaceWith(article);
      else log.append(article);
      context.state.views.set(message.info.id, { signature, node: article });
    }
    context.find("#chat-thinking").textContent =
      latestThinking || t("Thinking appears only when the selected model supplies it.");
    context.find("#chat-automation").textContent = t(
      "{count} automatic continuation messages hidden. Full history is preserved.",
      { count: automatic },
    );
    if (bottom) log.scrollTop = log.scrollHeight;
  }
  return { renderMessages };
}
