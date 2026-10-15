import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { engineVersion, releaseVersion } from "./release-documents.mjs";

const releaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(releaseDirectory, "..");
if (!process.argv[2]) throw Error("Pass a new output directory.");
const output = path.resolve(process.argv[2]);
await fs.mkdir(output, { recursive: true });
const files = {};
for (const name of ["mejai-controller.mjs", "src/services/startup-service.mjs", "release.json"]) {
  const content = await fs.readFile(path.join(source, name));
  const target = path.join(output, "payload", name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  files[name] = createHash("sha256").update(content).digest("hex");
}
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify({ version: releaseVersion, engineVersion, files }, null, 2) + "\n",
);
for (const name of ["apply-update.mjs", "Aplicar-atualizacao.ps1", "Aplicar-atualizacao.cmd"])
  await fs.copyFile(path.join(releaseDirectory, name), path.join(output, name));
await fs.writeFile(
  path.join(output, "LEIA-ME.txt"),
  `Mejai Hub ${releaseVersion} - atualizacao de manutencao Windows x64\n\nRequer a instalacao completa 1.18.35-mejai.1-hub.20261014. Nao e um pacote independente.\nExtraia este ZIP em uma pasta separada, abra Aplicar-atualizacao.cmd e selecione a pasta Agente-Local instalada. Termine ou pare qualquer tarefa em andamento antes de atualizar.\n\nO atualizador verifica os hashes, encerra apenas o Hub identificado e seu agente ocioso, salva os arquivos anteriores em dados/updates e aplica a correcao. Conversas, modelos, contas, configuracoes e executaveis permanecem preservados. O Hub sera reaberto.\n\nCorrecao: configuracao vazia de plugins nao remove mais as extensoes do Hub; consultas do chat nao reiniciam continuamente o motor. Pedidos simultaneos de inicializacao compartilham uma unica operacao.\n\nPara restaurar: encerre o Hub, copie de volta os arquivos da pasta de backup indicada pelo atualizador e abra Iniciar.cmd.\nValidacao: testes isolados e motor Windows real, sem prompts de inferencia. Linux nao foi revalidado para esta atualizacao.\n`,
);
console.log(output);
