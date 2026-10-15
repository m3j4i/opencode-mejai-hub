import fs from "node:fs/promises";
import path from "node:path";
export async function scanLanguages(base) {
  const folder = path.join(base, "linguagens");
  await fs.mkdir(folder, { recursive: true });
  const languages = [],
    errors = [];
  for (const name of (await fs.readdir(folder)).sort()) {
    if (!/^[\w-]+\.language$/.test(name)) continue;
    try {
      const f = path.join(folder, name);
      const stat = await fs.lstat(f);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2e6)
        throw Error("Invalid language file.");
      const d = JSON.parse(await fs.readFile(f, "utf8"));
      if (
        !d.name ||
        typeof d.name !== "string" ||
        !d.strings ||
        typeof d.strings !== "object" ||
        Array.isArray(d.strings) ||
        Object.values(d.strings).some((v) => typeof v !== "string")
      )
        throw Error("Expected name and a dictionary of strings.");
      languages.push({
        id: name.slice(0, -9),
        name: d.name,
        strings: d.strings,
      });
    } catch (e) {
      errors.push({ file: name, error: e.message });
    }
  }
  return { languages, errors };
}
