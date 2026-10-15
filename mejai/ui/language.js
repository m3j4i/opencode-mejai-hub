let dictionary = {},
  catalog = [],
  current = "en",
  apiCall;
const sources = new WeakMap();
let observing = false,
  observer;
export function t(key, values = {}) {
  return (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (m, k) =>
    values[k] === undefined ? m : String(values[k]),
  );
}
function excluded(node) {
  return node.parentElement?.closest(
    "[data-no-translate],#chat-messages,#chat-thinking,#chat-todos,#chat-requests,#editor,script,style,pre.code",
  );
}
function apply(root = document.body) {
  if (!root) return;
  observer?.disconnect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (excluded(node)) continue;
    let source = sources.get(node);
    if (!source || node.nodeValue !== source.last)
      source = { text: node.nodeValue, last: node.nodeValue };
    const key = source.text.trim();
    if (dictionary[key] !== undefined) {
      const value = source.text.replace(key, t(key));
      node.nodeValue = value;
      source.last = value;
      sources.set(node, source);
    } else if (source.last !== source.text) {
      node.nodeValue = source.text;
      source.last = source.text;
      sources.set(node, source);
    }
  }
  for (const el of root.querySelectorAll("[title],[placeholder],[aria-label]")) {
    if (el.closest("[data-no-translate]")) continue;
    for (const attribute of ["title", "placeholder", "aria-label"]) {
      if (!el.hasAttribute(attribute)) continue;
      const sourceKey = "lang" + attribute.replaceAll("-", "");
      let source = el.dataset[sourceKey];
      if (!source) el.dataset[sourceKey] = source = el.getAttribute(attribute);
      el.setAttribute(attribute, t(source));
    }
  }
  if (observing)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
}
async function scan() {
  const d = await apiCall("languages");
  catalog = d.languages;
  const select = document.querySelector("#hub-language");
  select.replaceChildren();
  for (const l of catalog) {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.name;
    select.append(o);
  }
  select.value = catalog.some((l) => l.id === current) ? current : "en";
  await change(select.value);
  return d;
}
async function change(id) {
  current = id;
  dictionary = catalog.find((l) => l.id === id)?.strings || {};
  localStorage.setItem("mejai-language", id);
  document.documentElement.lang = id;
  apply();
  window.dispatchEvent(new CustomEvent("mejai-language"));
}
export async function initLanguage(api) {
  apiCall = api;
  current = localStorage.getItem("mejai-language") || "en";
  observer = new MutationObserver(() => apply());
  observing = true;
  await scan();
  document.querySelector("#hub-language").onchange = (e) => change(e.target.value);
  document.querySelector("#scan-languages").onclick = async () => {
    try {
      const d = await scan();
      document.querySelector("#language-status").textContent =
        t("Found {count} languages.", { count: d.languages.length }) +
        (d.errors.length
          ? " " +
            t("Invalid language files: {files}", {
              files: d.errors.map((x) => x.file).join(", "),
            })
          : "");
    } catch (e) {
      document.querySelector("#language-status").textContent = e.message;
    }
  };
}
