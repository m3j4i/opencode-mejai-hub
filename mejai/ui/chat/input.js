export function shouldSend(event) {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !event.repeat
  );
}

export function bindSendShortcut(input, form) {
  input.onkeydown = (event) => {
    if (!shouldSend(event)) return;
    event.preventDefault();
    form.requestSubmit();
  };
}
