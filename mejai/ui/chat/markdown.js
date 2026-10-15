const keyword =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|function|return|if|else|for|while|class|import|from|export|async|await|def|print|True|False|None|true|false|null)\b|\b\d+(?:\.\d+)?\b)/g;

function append(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

export function safeLink(address) {
  try {
    const url = new URL(address);
    return ["https:", "http:", "mailto:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function inline(parent, tokens = []) {
  for (const token of tokens) {
    if (["strong", "em", "del"].includes(token.type))
      inline(append(parent, token.type), token.tokens);
    else if (token.type === "codespan") append(parent, "code", token.text);
    else if (token.type === "br") append(parent, "br");
    else if (token.type === "link") {
      const address = safeLink(token.href);
      const node = append(parent, address ? "a" : "span");
      if (address) {
        node.href = address;
        node.target = "_blank";
        node.rel = "noopener noreferrer";
      }
      inline(node, token.tokens || [{ type: "text", text: token.text }]);
    } else if (token.type === "image") append(parent, "span", token.text || token.href);
    else if (token.tokens) inline(parent, token.tokens);
    else parent.append(document.createTextNode(token.text ?? token.raw ?? ""));
  }
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = append(document.body, "textarea", text);
  input.style.position = "fixed";
  input.style.opacity = "0";
  input.select();
  try {
    if (!document.execCommand("copy")) throw Error("Clipboard unavailable.");
  } finally {
    input.remove();
  }
}

function codeBlock(parent, token, translate) {
  const block = append(parent, "section", undefined, "code-block");
  const toolbar = append(block, "div", undefined, "code-toolbar");
  const language = (token.lang || "").split(/\s/)[0].slice(0, 32);
  append(toolbar, "span", language || translate("Code"));
  const button = append(toolbar, "button", translate("Copy code"));
  button.type = "button";
  button.title = translate("Copy the complete code block to the clipboard.");
  button.onclick = async () => {
    try {
      await copyText(token.text);
      button.textContent = translate("Copied");
    } catch {
      button.textContent = translate("Copy failed");
    }
    setTimeout(() => {
      if (button.isConnected) button.textContent = translate("Copy code");
    }, 1800);
  };
  const code = append(append(block, "pre"), "code");
  if (
    /^(js|javascript|ts|typescript|python|py|json)$/.test(language) &&
    token.text.length < 100000
  ) {
    let position = 0;
    for (const match of token.text.matchAll(keyword)) {
      code.append(document.createTextNode(token.text.slice(position, match.index)));
      append(
        code,
        "span",
        match[0],
        /^["']/.test(match[0])
          ? "syntax-string"
          : /^\d/.test(match[0])
            ? "syntax-number"
            : "syntax-keyword",
      );
      position = match.index + match[0].length;
    }
    code.append(document.createTextNode(token.text.slice(position)));
  } else code.textContent = token.text;
}

function blocks(parent, tokens, translate) {
  for (const token of tokens) {
    if (token.type === "space" || token.type === "def") continue;
    if (token.type === "code") codeBlock(parent, token, translate);
    else if (token.type === "heading")
      inline(append(parent, "h" + Math.min(6, Math.max(1, token.depth))), token.tokens);
    else if (token.type === "paragraph" || token.type === "text")
      inline(append(parent, "p"), token.tokens || [{ type: "text", text: token.text }]);
    else if (token.type === "hr") append(parent, "hr");
    else if (token.type === "blockquote")
      blocks(append(parent, "blockquote"), token.tokens, translate);
    else if (token.type === "list") {
      const list = append(parent, token.ordered ? "ol" : "ul");
      if (token.ordered && Number.isSafeInteger(token.start)) list.start = token.start;
      for (const item of token.items) {
        const entry = append(list, "li");
        if (item.task) append(entry, "span", item.checked ? "☑ " : "☐ ");
        blocks(entry, item.tokens, translate);
      }
    } else if (token.type === "table") {
      const container = append(parent, "div", undefined, "table-scroll");
      container.tabIndex = 0;
      const table = append(container, "table");
      const header = append(append(table, "thead"), "tr");
      token.header.forEach((cell, index) => {
        const node = append(header, "th");
        node.scope = "col";
        node.style.textAlign = token.align[index] || "left";
        inline(node, cell.tokens);
      });
      const body = append(table, "tbody");
      for (const row of token.rows) {
        const line = append(body, "tr");
        row.forEach((cell, index) => {
          const node = append(line, "td");
          node.style.textAlign = token.align[index] || "left";
          inline(node, cell.tokens);
        });
      }
    } else append(parent, "p", token.text ?? token.raw ?? "");
  }
}

export function renderMarkdown(parent, source, lexer, translate = (value) => value) {
  const body = append(parent, "div", undefined, "message-markdown");
  blocks(body, lexer(source, { gfm: true, breaks: true }), translate);
  return body;
}

export function renderScript(parent, text, language, translate = (value) => value) {
  codeBlock(parent, { text, lang: language }, translate);
}
