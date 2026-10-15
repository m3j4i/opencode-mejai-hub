import fs from "node:fs/promises";
import path from "node:path";

export async function readCamoufoxProfile(profile, engineDirectory) {
  const [properties, version] = await Promise.all([
    fs.readFile(path.join(engineDirectory, "properties.json"), "utf8"),
    fs.readFile(path.join(engineDirectory, "version.json"), "utf8"),
  ]);
  const known = new Set(JSON.parse(properties).map((property) => property.property));
  await fs.mkdir(profile, { recursive: true });
  const configPath = path.join(profile, "agente-fingerprint.json");
  let saved = {};
  try {
    const data = JSON.parse(await fs.readFile(configPath, "utf8"));
    if (data.version === version) saved = data.config;
  } catch (error) {
    if (error.code !== "ENOENT")
      console.error("Camoufox profile: configuration will be regenerated.");
  }
  return { known, version, saved, configPath };
}

export async function saveCamoufoxProfile(configPath, version, config) {
  await fs.writeFile(configPath, JSON.stringify({ version, config }, null, 2));
}
