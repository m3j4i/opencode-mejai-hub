import { t } from "/language.js";
export function createDom(context) {
  function element(parent, tag, text, className) {
    const elementNode = document.createElement(tag);
    if (text !== undefined) elementNode.textContent = text;
    if (className) elementNode.className = className;
    parent.append(elementNode);
    return elementNode;
  }

  function action(parent, label, title, handler) {
    const button = context.element(parent, "button", t(label));
    button.type = "button";
    button.title = t(title);
    button.onclick = () => Promise.resolve().then(handler).catch(context.reportError);
    return button;
  }
  return { element, action };
}
