"""Read Colibri model metadata without loading weights or sending prompts."""
import json
import sys
sys.path.insert(0, sys.argv[1])
from family_registry import resolve_model
family = resolve_model(sys.argv[2]).descriptor
print(json.dumps({"family": family.id, "tools": family.capabilities.tools,
                  "modality": family.modality, "maxContext": family.limits.max_context}))
