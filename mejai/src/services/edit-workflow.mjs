export function editableText(message) {
  return (message.parts || [])
    .filter((part) => part.type === "text" && !part.synthetic && !part.metadata?.mejaiAttachment)
    .map((part) => part.text || "")
    .join("\n\n");
}

export async function editMessage(repository, { sessionID, messageID, text, expectedText }) {
  if (typeof text !== "string" || !text.trim() || text.length > 100000)
    throw Error("Enter a message of up to 100,000 characters.");
  await repository.assertIdle(sessionID);
  const message = await repository.message(sessionID, messageID);
  if (message.info.role !== "user" || !editableText(message))
    throw Error("Only your text messages can be edited.");
  if (editableText(message) !== expectedText)
    throw Error("This message changed. Reload the conversation before editing.");
  const attachments = await repository.attachments(message);
  // The engine copies messages strictly BEFORE this messageID. The original is never mutated.
  const branch = await repository.fork(sessionID, messageID);
  try {
    await repository.submit(branch.id, message, text.trim(), attachments);
    return { sessionID: branch.id, sent: true };
  } catch (error) {
    // An async request can time out after admission. Retain the branch; never auto-resend.
    return {
      sessionID: branch.id,
      sent: false,
      error: error.message,
    };
  }
}

export async function editStoredMessage(input) {
  const { messageRepository } = await import("../repositories/message-repository.mjs");
  return editMessage(messageRepository, input);
}
