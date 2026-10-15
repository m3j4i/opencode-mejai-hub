"""Start the bundled Serena with relocatable language-server paths."""
import os
import sys
from pathlib import Path
from ruamel.yaml import YAML

base = Path(__file__).resolve().parent
runtime = base / 'runtime' if os.name == 'nt' else base / 'runtime/linux'
home = base / 'dados' / 'serena'
home.mkdir(parents=True, exist_ok=True)
os.environ['SERENA_HOME'] = str(home)
yaml = YAML()
config_path = home / 'serena_config.yml'
config = yaml.load(config_path) if config_path.exists() else {
    'base_modes': ['editing'],
    'default_modes': [],
    'default_max_tool_answer_chars': 16000,
    'ignored_paths': ['**/node_modules/**', '**/.venv/**', '**/__pycache__/**'],
}
config.setdefault('projects', [])
settings = config.setdefault('ls_specific_settings', {})
for language, entry in [('python', 'pyright/langserver.index.js'), ('typescript', 'typescript-language-server/lib/cli.mjs')]:
    settings.setdefault(language, {}).update({
        'ls_base_cmd': [str(runtime / ('node/node.exe' if os.name == 'nt' else 'node/bin/node')), str(base / 'runtime/serena-lsp/node_modules' / entry)],
        'ls_args': ['--stdio'],
    })
temporary = config_path.with_suffix('.tmp')
with temporary.open('w', encoding='utf-8') as stream:
    yaml.dump(config, stream)
temporary.replace(config_path)

from serena.cli import top_level
sys.argv = ['serena', 'start-mcp-server', '--context', 'codex', '--transport', 'stdio',
            '--enable-web-dashboard', 'false', '--open-web-dashboard', 'false',
            '--enable-gui-log-window', 'false', '--tool-timeout', '100', '--log-level', 'WARNING']
top_level()
