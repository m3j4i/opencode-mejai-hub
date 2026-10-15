export function thinkingState() {
  return { parts: new Map(), latestMessage: null };
}
export function updateThinking(state, event) {
  const payload = event.properties || event.data || {};
  if (event.type === "message.updated" && payload.info?.role === "assistant")
    state.latestMessage = payload.info.id;
  if (event.type === "message.part.updated" && payload.part?.type === "reasoning") {
    state.parts.set(payload.part.id, { ...payload.part });
    state.latestMessage = payload.part.messageID;
  }
  if (event.type === "message.part.delta" && payload.field === "text") {
    const existingPart = state.parts.get(payload.partID);
    if (existingPart) existingPart.text = (existingPart.text || "") + payload.delta;
  }
  while (state.parts.size > 30) state.parts.delete(state.parts.keys().next().value);
  return [...state.parts.values()]
    .filter((part) => part.messageID === state.latestMessage)
    .map((part) => part.text || "")
    .join("\n\n");
}
