export function createEditorActions(context) {
  const { $, api, show, mountEditor, editorState, perform } = context;
  return {
    settings: async () => {
      show(
        "Rules editor",
        '<p>Save applies validated changes. Restart an idle agent to reload its instructions. Connection keys stay inside this kit.</p><select id="file"></select><div class="row"><button id="save">Save</button><button id="reload">Reload</button></div><div id="editor"></div>',
      );
      const names = [
        "INSTRUCOES.md",
        "RECUPERACAO.md",
        "WEB-E-MCP.md",
        "LANGUAGE.md",
        "navegador-preferencias.json",
        "dados/conexoes.json",
      ];
      for (const name of names) {
        const o = document.createElement("option");
        o.textContent = name;
        $("#file").append(o);
      }
      let revision;
      async function load() {
        const file = await api("config?name=" + encodeURIComponent($("#file").value));
        revision = file.revision;
        editorState.value?.destroy();
        editorState.value = mountEditor($("#editor"), file.text, file.name);
      }
      $("#file").onchange = () => perform(load);
      $("#reload").onclick = () => perform(load);
      $("#save").onclick = () =>
        perform(async () => {
          const result = await api("config", {
            name: $("#file").value,
            text: editorState.value.state.doc.toString(),
            revision,
          });
          revision = result.revision;
          return "Saved and validated.";
        });
      await load();
    },
  };
}
