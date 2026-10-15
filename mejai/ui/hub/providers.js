export function createProvidersActions(context) {
  const { $, api, show, perform } = context;
  return {
    providers: async () => {
      show(
        "Models and providers",
        '<p>Choose the provider and model for new conversations. Switching waits for an idle agent. Existing conversations stay available.</p><div class="row"><label>Provider <select id="provider"><option value="ollama">Ollama</option><option value="colibri">Colibri</option></select></label><label>Model <select id="provider-model"></select></label><button id="choose-provider">Use this model</button></div><p id="provider-selection"></p><h3>Colibri</h3><p id="colibri-status">Checking installation...</p><p>No model is downloaded automatically. Use a compatible Colibri model folder inside this kit.</p><div class="row"><label>Model folder <input id="colibri-folder" placeholder="models/colibri/my-model" size="32"></label><label>Compute <select id="colibri-backend"><option value="cpu">CPU</option><option value="vulkan">GPU (Vulkan)</option></select></label></div><div class="row"><label>Context tokens <input id="colibri-context" type="number" min="4096" max="131072"></label><label>Output tokens <input id="colibri-output" type="number" min="512"></label></div><div class="row"><button id="colibri-save">Save model settings</button><button id="colibri-start">Start Colibri</button><button id="colibri-stop">Stop Colibri</button><button id="colibri-refresh">Refresh</button><button id="colibri-logs">Show logs</button></div><pre id="colibri-log" hidden></pre>',
      );
      let data;
      function models() {
        const p = $("#provider").value;
        const available = p === "ollama" ? data.ollama : data.colibri.models;
        const select = $("#provider-model");
        select.replaceChildren();
        for (const [id, entry] of Object.entries(available || {})) {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = entry.name || id;
          select.append(option);
          if (data.selected === p + "/" + id) select.value = id;
        }
        $("#choose-provider").disabled = !select.options.length;
      }
      async function refresh(initial = false) {
        data = await api("providers");
        if (initial)
          $("#provider").value = data.selected?.startsWith("colibri/") ? "colibri" : "ollama";
        models();
        $("#provider-selection").textContent = "Selected: " + (data.selected || "none");
        const c = data.colibri;
        $("#colibri-status").textContent = !c.installed
          ? "Colibri unavailable: " + c.error
          : c.modelPending
            ? "Colibri " + c.version + " installed. No model configured."
            : "Colibri " +
              c.version +
              ": " +
              (c.server?.state || "stopped") +
              (c.server?.model ? " — " + c.server.model : "") +
              (c.error ? " — " + c.error : "");
        if (initial) {
          $("#colibri-folder").value = c.config.modelDirectory;
          $("#colibri-backend").value = c.config.backend;
          $("#colibri-context").value = c.config.context;
          $("#colibri-output").value = c.config.output;
        }
      }
      $("#provider").onchange = models;
      $("#choose-provider").onclick = () =>
        perform(async () => {
          const selected = await api("providers/select", {
            provider: $("#provider").value,
            model: $("#provider-model").value,
          });
          await refresh();
          return "Selected " + selected.selected + ". Open chat to begin.";
        });
      $("#colibri-save").onclick = () =>
        perform(async () => {
          await api("colibri/config", {
            modelDirectory: $("#colibri-folder").value.trim(),
            backend: $("#colibri-backend").value,
            context: Number($("#colibri-context").value),
            output: Number($("#colibri-output").value),
          });
          await refresh();
          return "Colibri settings saved.";
        });
      for (const action of ["start", "stop"])
        $("#colibri-" + action).onclick = () =>
          perform(async () => {
            await api("colibri/" + action, {});
            await refresh();
            return action === "start"
              ? "Colibri start requested. Refresh to check model loading."
              : "Colibri stopped.";
          });
      $("#colibri-refresh").onclick = () => perform(() => refresh());
      $("#colibri-logs").onclick = () =>
        perform(async () => {
          const log = await api("colibri/logs");
          $("#colibri-log").hidden = false;
          $("#colibri-log").textContent = log.text;
        });
      await refresh(true);
    },
  };
}
