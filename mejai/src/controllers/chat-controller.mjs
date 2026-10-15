import { editStoredMessage } from "../services/edit-workflow.mjs";
import * as chatService from "../services/chat-service.mjs";
function conversationID(value) {
  if (!/^ses_[\w-]+$/.test(value || "")) throw Error("Choose a conversation.");
  return value;
}
function inputObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid request.");
  return input;
}
export function snapshot(id, recent = false) {
  return chatService.snapshot(conversationID(id), recent === true);
}
export function send(input) {
  inputObject(input);
  if (input.sessionID) conversationID(input.sessionID);
  if (input.text !== undefined && typeof input.text !== "string")
    throw Error("Message must be text.");
  if (input.autonomy !== undefined && typeof input.autonomy !== "boolean")
    throw Error("Invalid autonomy value.");
  if (
    input.attachments !== undefined &&
    (!Array.isArray(input.attachments) ||
      input.attachments.length > 10 ||
      input.attachments.some((id) => typeof id !== "string"))
  )
    throw Error("Attach up to 10 files.");
  return chatService.send(input);
}
export function abort(input) {
  inputObject(input);
  conversationID(input.sessionID);
  return chatService.abort(input);
}
export function respond(input) {
  inputObject(input);
  conversationID(input.sessionID);
  return chatService.respond(input);
}
export function remove(input) {
  inputObject(input);
  conversationID(input.sessionID);
  return chatService.remove(input);
}
export function upload(sessionID, name, request) {
  conversationID(sessionID);
  if (typeof name !== "string" || !name.trim()) throw Error("Choose a file.");
  return chatService.upload(sessionID, name, request);
}

export function edit(input) {
  inputObject(input);
  conversationID(input.sessionID);
  if (!/^msg_[\w-]+$/.test(input.messageID || "")) throw Error("Invalid message.");
  if (typeof input.expectedText !== "string") throw Error("Invalid original message.");
  return editStoredMessage(input);
}
