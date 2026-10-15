export function createStream(context) {
  function applyStreamEvent(event) {
    const payload = event.properties || event.data || {};
    if (event.type === "message.updated") {
      const old = context.state.records.get(payload.info.id);
      context.state.records.set(payload.info.id, {
        info: payload.info,
        parts: old?.parts || [],
      });
    } else if (event.type === "message.part.updated") {
      const message = context.state.records.get(payload.part.messageID);
      if (!message) {
        context.refresh();
        return;
      }
      const index = message.parts.findIndex((entry) => entry.id === payload.part.id);
      if (index < 0) message.parts.push(payload.part);
      else message.parts[index] = payload.part;
    } else if (event.type === "message.part.delta") {
      for (const message of context.state.records.values()) {
        const part = message.parts.find((entry) => entry.id === payload.partID);
        if (part && payload.field === "text") {
          part.text = (part.text || "") + payload.delta;
          break;
        }
      }
    } else if (
      event.type === "session.status" ||
      event.type === "session.idle" ||
      event.type === "session.error" ||
      event.type === "permission.asked" ||
      event.type === "question.asked"
    ) {
      context.refresh();
    }
    if (!context.state.drawTimer)
      context.state.drawTimer = setTimeout(() => {
        context.state.drawTimer = null;
        context.renderMessages();
      }, 100);
  }

  async function live(id) {
    const controller = new AbortController();
    context.state.stream = controller;
    while (!context.state.disposed && !controller.signal.aborted) {
      try {
        const response = await fetch("/api/activity/stream?session=" + encodeURIComponent(id), {
          headers: { "X-Mejai-Token": localStorage.getItem("mejai-token") },
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Stream unavailable");
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const next = await reader.read();
          if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");
          let at;
          while ((at = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer
              .slice(0, at)
              .split("\n")
              .filter((entry) => entry.startsWith("data:"))
              .map((entry) => entry.slice(5))
              .join("\n");
            buffer = buffer.slice(at + 2);
            if (raw) context.applyStreamEvent(JSON.parse(raw));
          }
          if (buffer.length > 2000000) throw Error("Stream frame too large.");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
      }
      if (!controller.signal.aborted) await new Promise((response) => setTimeout(response, 2000));
    }
  }
  return { applyStreamEvent, live };
}
