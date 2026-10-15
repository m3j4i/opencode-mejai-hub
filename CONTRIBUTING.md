# Contribuir com OpenCode (mejai hub)

Abra uma issue para mudanças maiores. Descreva o problema, o comportamento esperado e as evidências antes de implementar.

Siga mejai/AGENTS.md: planeje, modularize por responsabilidade, escreva testes para mudanças comportamentais e execute os checks relevantes. Preserve compatibilidade de sessões e caminhos Windows/Linux. Use linguagens/*.language para textos da interface.

Não use prompts reais do Ollama em regressões automáticas. Não inclua credenciais, chats, dados pessoais, dependências instaladas ou pesos de modelos em commits.

A compilação e os checks estão documentados em docs/BUILD-MEJAI.md. O código upstream mantém suas próprias regras, preservadas em docs/upstream-metadata/CONTRIBUTING.md.
