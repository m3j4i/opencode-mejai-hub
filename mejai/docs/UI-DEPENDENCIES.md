# UI dependencies

Markdown uses Marked 18.0.7 from the existing fork dependency lock. Its ESM runtime and MIT license are in runtime/ui/lib, served only at the explicit /vendor/marked.js route. Source snapshots exclude runtimes; recreating a kit requires copying marked/lib/marked.esm.js and LICENSE from that pinned package into runtime/ui/lib. The application renders tokens using textContent and never injects model HTML.
