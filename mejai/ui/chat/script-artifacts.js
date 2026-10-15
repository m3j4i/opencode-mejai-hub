import { t } from "/language.js";
import { renderScript } from "./markdown.js";

export function renderScriptArtifacts(context, article, artifacts) {
  for (const artifact of artifacts) {
    const section = context.element(article, "section", undefined, "script-artifact");
    context.element(
      section,
      "h4",
      t(
        artifact.source === "recorded-write"
          ? "Generated script: {name}"
          : "Current saved script: {name}",
        { name: artifact.name },
      ),
    );
    context.element(section, "p", artifact.path, "script-path");
    if (artifact.status === "ready") renderScript(section, artifact.text, artifact.language, t);
    else
      context.element(
        section,
        "p",
        t(
          artifact.status === "too_large"
            ? "This script exceeds the inline size limit. Its full contents have not been truncated."
            : "The script contents are unavailable. The original response is preserved.",
        ),
      );
  }
}
