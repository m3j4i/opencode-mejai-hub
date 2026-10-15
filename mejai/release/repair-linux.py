"""Prepare staged Linux links and modes without touching the original kit."""
import json
import os
import pathlib
import sys

stage = pathlib.Path(sys.argv[1]).resolve()
workspace = pathlib.Path(sys.argv[2]).resolve()
if workspace not in stage.parents or stage.name != "Agente-Local":
    raise ValueError("Unexpected staging path")
links = json.loads((stage / "release-links.json").read_text())
source_prefix = str(pathlib.Path(sys.argv[3]).resolve()) + "/"
for link in links:
    relative = pathlib.PurePosixPath(link["path"])
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid link path")
    target = link["target"]
    if target.startswith(source_prefix):
        target = os.path.relpath(stage / target[len(source_prefix):], (stage / relative).parent)
    final = ((stage / relative).parent / target).resolve()
    if final != stage and stage not in final.parents:
        raise ValueError(f"Link escapes release: {relative}")
    (stage / relative).symlink_to(target)
for folder, _, files in os.walk(stage):
    for name in files:
        file = pathlib.Path(folder) / name
        if file.is_symlink():
            continue
        with file.open("rb") as stream:
            header = stream.read(4)
        file.chmod(0o755 if header == b"\x7fELF" or header.startswith(b"#!") or name.endswith(".sh") else 0o644)
for group in ("python", "ocr", "serena"):
    config = stage / "runtime/linux" / group / "pyvenv.cfg"
    lines = config.read_text().splitlines()
    config.write_text("\n".join(line for line in lines if not line.startswith("home =")) + "\n")
(stage / "release-links.json").unlink()
print(f"Prepared {len(links)} portable links")
