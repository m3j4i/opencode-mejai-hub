import { t } from "/language.js";
export function createRequests(context) {
  function renderRequests(snapshot) {
    const signature = JSON.stringify([snapshot.permissions, snapshot.questions]);
    if (signature === context.state.requestRevision) return;
    context.state.requestRevision = signature;
    const box = context.find("#chat-requests");
    box.replaceChildren();
    for (const part of snapshot.permissions || []) {
      const section = context.element(box, "section");
      context.element(section, "p", part.permission + ": " + JSON.stringify(part.patterns));
      for (const [label, reply] of [
        ["Allow once", "once"],
        ["Deny", "reject"],
      ])
        context.action(
          section,
          label,
          reply === "once"
            ? "Allow only this pending operation."
            : "Reject this pending operation.",
          () =>
            context
              .api("chat/respond", {
                sessionID: context.state.selected,
                kind: "permission",
                id: part.id,
                reply,
              })
              .then(() => context.refresh(true)),
        );
    }
    for (const questionRequest of snapshot.questions || []) {
      const section = context.element(box, "section");
      const fields = questionRequest.questions.map((question) => {
        const group = context.element(section, "fieldset");
        context.element(group, "legend", question.question);
        const inputs = (question.options || []).map((option) => {
          const label = context.element(
            group,
            "label",
            option.label + " — " + (option.description || ""),
          );
          const input = context.element(label, "input");
          input.type = question.multiple ? "checkbox" : "radio";
          input.name = questionRequest.id + questionRequest.questions.indexOf(question);
          input.value = option.label;
          return input;
        });
        const free = context.element(group, "input");
        free.placeholder = t("Or enter your answer");
        free.setAttribute("aria-label", t("Your answer"));
        return { inputs, free };
      });
      context.action(section, "Answer", "Submit your answers to the agent.", async () => {
        const answers = fields.map((field) =>
          field.free.value.trim()
            ? [field.free.value.trim()]
            : field.inputs.filter((input) => input.checked).map((input) => input.value),
        );
        if (answers.some((attachment) => !attachment.length)) throw Error("Answer each question.");
        await context.api("chat/respond", {
          sessionID: context.state.selected,
          kind: "question",
          id: questionRequest.id,
          answers,
        });
        await context.refresh(true);
      });
    }
  }
  return { renderRequests };
}
