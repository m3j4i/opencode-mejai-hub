"""Restore portable venv links after smoke checks, before archiving."""
import os
import pathlib
import sys

stage = pathlib.Path(sys.argv[1]).resolve()
workspace = pathlib.Path(sys.argv[2]).resolve()
if workspace not in stage.parents or stage.name != "Agente-Local":
    raise ValueError("Unexpected staging path")
runtime = stage / "runtime/linux"
for group in ("python", "ocr", "serena"):
    folder = runtime / group
    for link in (folder / "bin").iterdir():
        if link.is_symlink() and os.path.isabs(os.readlink(link)):
            final = link.resolve()
            if stage not in final.parents:
                raise ValueError("Python link escaped kit")
            target = os.path.relpath(final, link.parent)
            link.unlink()
            link.symlink_to(target)
    config = folder / "pyvenv.cfg"
    config.write_text("\n".join(line for line in config.read_text().splitlines() if not line.startswith("home =")) + "\n")
print("Python links are relative; first launch will prepare their new location.")
