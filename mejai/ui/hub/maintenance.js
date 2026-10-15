export function createMaintenanceActions(context) {
  const { $, api, show, button, display, ask, confirmAction } = context;
  return {
    files: async () => {
      show("My files", '<div class="row" id="folders"></div>');
      for (const name of ["tarefas", "downloads"])
        button(
          name === "tarefas" ? "Task files" : "Downloads",
          () => api("folder", { name }),
          $("#folders"),
        );
    },
    help: async () => {
      show(
        "Help",
        "<p>Windows: open Iniciar.cmd. Linux: run bash start.sh. The same browser-based hub and editor work on both platforms. Linux setup keeps runtimes inside the kit; external accounts, Ollama, browser system libraries and external services still have their own requirements.</p><p>Internal rules are written in English. The assistant follows the language of your latest substantive request. A task is complete only after its requested scope and output are checked. Idle does not mean successful.</p><p>Keep the whole kit folder together. Stop the agent before moving it. Do not use the same data directory simultaneously from Windows and Linux. Configuration edits detect concurrent changes.</p>",
      );
    },
    maintenance: async () => {
      show(
        "Maintenance",
        '<div class="row" id="tools"></div><pre id="result">Choose an operation. This kit uses the mejai hub fork. Official replacement updates are disabled.</pre>',
      );
      const output = async (fn) => {
        $("#result").textContent = "Working...";
        const r = await fn();
        $("#result").textContent = display(r);
        return "Finished.";
      };
      button("My files", context.actions.files, $("#tools"));
      button("Help", context.actions.help, $("#tools"));
      for (const [label, fn] of [
        ["Progress and errors", () => api("status")],
        ["Installed tools", () => api("catalog")],
        [
          "Connect an account",
          async () => {
            const c = await api("catalog");
            const choices = Object.keys(c).filter((id) => c[id].oauth);
            const id = await ask("Connect an account", "Choose a service: " + choices.join(", "));
            if (!id) return "No changes made.";
            return api("connect", { id });
          },
        ],
        ["Save code version", () => api("code/snapshot", {})],
        [
          "Restore code version",
          async () => {
            const list = await api("code/versions");
            const id = await ask("Restore code", "Choose an exact version ID:\n" + list.join("\n"));
            if (!id) return "Cancelled";
            if (
              !(await confirmAction(
                "Restore code only? Configuration and conversations will be preserved. Restart the hub afterward.",
              ))
            )
              return "Cancelled";
            return api("code/restore", { id, confirm: "RESTORE" });
          },
        ],
        ["Diagnostics", () => api("diagnostics")],
        ["Run isolated tests", () => api("tests", {})],
        [
          "Reset kit data",
          async () => {
            const p = await api("reset");
            if (
              (await ask(
                "Reset kit data",
                "Delete " +
                  p.files +
                  " items (" +
                  (p.bytes / 1024 / 1024).toFixed(1) +
                  " MB), including conversations, work, downloads, logins and browser profiles. Ollama, installed tools and configuration are preserved.",
                "RESET",
              )) !== "RESET"
            )
              return "Cancelled";
            return api("reset", { confirm: "RESET" });
          },
        ],
      ])
        button(label, () => output(fn), $("#tools"));
    },
  };
}
