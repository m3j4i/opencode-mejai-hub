# Catálogo de ferramentas do Mejai Hub

O [catálogo executável](../mejai/mcp-catalogo.json) contém **39 entradas**. Há adapters locais, aliases e conectores de serviços externos. A lista não significa 39 serviços autenticados nem 39 ferramentas individuais: cada servidor pode expor várias operações, e algumas entradas exigem recursos adicionais.

## Descoberta sob demanda

O roteador habilidades apresenta status, search, details e call. Primeiro consulte status e procure a capacidade; depois leia o schema completo da ferramenta retornada. Os conectores são inicializados conforme o uso, com caches de conexão e controle de chamadas concorrentes. O catálogo usa descrições em inglês para sua pesquisa interna.

| Entrada | Disponibilidade | Capacidade | Requisito |
| --- | --- | --- | --- |
| github | Conector externo | Repositórios, issues, pull requests e código remoto. [Fonte](https://github.com/github/github-mcp-server). | Token de acesso GitHub. |
| git | Local/incluído | Histórico, status, diffs, branches e commits de Git local. [Fonte](https://github.com/modelcontextprotocol/servers/tree/main/src/git). | Repositório Git; Git do sistema no Linux. |
| puppeteer | Alias | Alias para Chrome DevTools; não é uma instalação separada de Puppeteer. [Fonte](https://github.com/ChromeDevTools/chrome-devtools-mcp). | Mesmo backend de chrome-devtools. |
| shadcn | Local/incluído | Consulta de componentes e registries shadcn. [Fonte](https://ui.shadcn.com/docs/mcp). | Registro acessível; projeto para instalar componentes. |
| brave | Local/incluído | Busca web, notícias e imagens pela API Brave. [Fonte](https://github.com/brave/brave-search-mcp-server). | BRAVE_API_KEY. |
| obsidian | Local/incluído | Notas Markdown locais: listar, ler, criar e pesquisar; não exige o app Obsidian. [Fonte](https://help.obsidian.md/Files+and+folders/Manage+vaults). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| notion | Conector externo | Páginas, documentos e bancos do Notion. [Fonte](https://developers.notion.com/guides/mcp/get-started-with-mcp). | OAuth e conta. |
| linear | Conector externo | Projetos, tarefas e issues do Linear. [Fonte](https://linear.app/docs/mcp). | OAuth e conta. |
| slack | Conector externo | Busca e interação com canais e mensagens autorizados. [Fonte](https://docs.slack.dev/ai/slack-mcp-server). | OAuth e acesso ao workspace. |
| figma | Conector externo | Designs, componentes e layouts de Figma. [Fonte](https://developers.figma.com/docs/figma-mcp-server/). | OAuth, conta e plano/cliente compatível. |
| reddit | Local/incluído | Posts, comentários e busca; RSS possui limitações. [Fonte](https://github.com/jordanburke/reddit-mcp-server). | RSS limitado ou credenciais OAuth opcionais. |
| tor | Local/incluído | Iniciar/parar cliente Tor, acompanhar bootstrap e ler páginas via proxy. [Fonte](https://download.torproject.org/tor/). | Conexão à rede Tor; só pronto após 100% de bootstrap. |
| tor-browser | Local/incluído | Perfil separado e proxied do navegador para Torch, onion, abas e downloads; não substitui Tor Browser. [Fonte](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-proxy). | Cliente Tor pronto e serviço Torch/onion disponível. |
| filesystem | Local/incluído | Leitura, escrita, edição, listagem e pesquisa de arquivos. [Fonte](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| chrome-devtools | Local/incluído | DOM, console, rede, desempenho e screenshots de Chromium. [Fonte](https://github.com/ChromeDevTools/chrome-devtools-mcp). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| ast-grep | Local/incluído | Busca estrutural em JavaScript, TypeScript, TSX, HTML e CSS. [Fonte](https://github.com/ast-grep/ast-grep). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| debugmcp | Local/incluído | Breakpoints, variáveis e execução passo a passo pelo Debug Adapter Protocol. [Fonte](https://github.com/microsoft/DebugMCP). | Adaptador da linguagem; Python/debugpy incluído. |
| 21st | Conector externo | Componentes e design de interfaces do 21st.dev. [Fonte](https://github.com/21st-dev/magic-mcp/blob/main/llms-install.md). | API_KEY_21ST. |
| desktop-commander | Local/incluído | Terminal, arquivos e gerenciamento de processos. [Fonte](https://github.com/wonderwhy-er/DesktopCommanderMCP). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| docker | Local/incluído | Listar/inspecionar containers, logs, iniciar e parar. [Fonte](https://docs.docker.com/reference/api/engine/). | Engine Docker externo em execução. |
| sequential-thinking | Local/incluído | Ferramenta de planejamento estruturado e revisão de hipóteses; não revela pensamento privado do modelo. [Fonte](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| searxng | Local/incluído | Busca por uma instância SearXNG configurada. [Fonte](https://docs.searxng.org/). | Instância externa com respostas JSON. |
| fetch | Local/incluído | Extrair texto legível e links de páginas públicas simples. [Fonte](https://github.com/mozilla/readability). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| apify | Conector externo | Descobrir e executar Actors de scraping autorizados. [Fonte](https://docs.apify.com/integrations/mcp). | Descoberta anônima limitada; token para execução. |
| postgres | Local/incluído | SQL parametrizado em PostgreSQL. [Fonte](https://node-postgres.com/). | POSTGRES_URL e servidor. |
| mysql | Local/incluído | SQL parametrizado em MySQL. [Fonte](https://sidorares.github.io/node-mysql2/docs). | MYSQL_URL e servidor. |
| sqlite | Local/incluído | Tabelas e SQL parametrizado em SQLite local. [Fonte](https://nodejs.org/api/sqlite.html). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| 1password | Conector externo | Integração com credenciais via aplicação 1Password. [Fonte](https://github.com/1Password/1password-codex-plugin). | App, conta e caminho ONEPASSWORD_MCP. |
| alpha-vantage | Conector externo | Dados financeiros e de criptomoedas via API. [Fonte](https://mcp.alphavantage.co/). | ALPHAVANTAGE_API_KEY. |
| atlassian | Conector externo | Jira e Confluence. [Fonte](https://atlassian.github.io/atlassian-mcp-server/). | Endpoint e autorização configurados. |
| ego-lite | Indisponível | Entrada de catálogo sem adapter instalado ou verificado nesta versão. [Fonte](https://lite.ego.app/). | Indisponível; usar navegador ou chrome-devtools. |
| aisa | Conector externo | Descoberta de ferramentas externas de busca, SEO, social e finanças; chamadas podem ser cobradas. [Fonte](https://aisa.one/pt-br/mcp). | AISA_API_KEY; chamadas pagas desativadas até configurar limite. |
| documentos | Local/incluído | Leitura/criação básica de documentos, planilhas, slides, PDFs e imagens. [Fonte](https://pypi.org/). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| serena | Local/incluído | Navegação semântica, referências e refatoração no projeto solicitado. [Fonte](https://github.com/oraios/serena). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| ocr | Local/incluído | OCR local em CPU para imagens e PDFs digitalizados. [Fonte](https://github.com/RapidAI/RapidOCR). | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| memory | Local/incluído | Grafo de conhecimento persistente entre conversas. | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |
| deepwiki | Conector externo | Documentação e arquitetura de repositórios GitHub. | Serviço remoto e internet. |
| context7 | Conector externo | Documentação de bibliotecas e frameworks. | Serviço remoto e internet. |
| navegador | Local/incluído | Navegador principal Camoufox/Chromium: páginas, buscas, formulários, screenshots e downloads. | Componentes locais incluídos; internet quando a tarefa envolve sites ou serviços. |

## Operações locais de documentos e OCR

| Operação | Comportamento e limites |
| --- | --- |
| read_document | Leitura paginada de PDF digital, DOCX, XLSX e PPTX; não faz OCR nem recalcula fórmulas. |
| create_document | DOCX ou PDF básico com título e parágrafos, preservando arquivos existentes. Layout avançado usa Python e fontes adequadas. |
| create_spreadsheet | XLSX com linhas, cabeçalhos e filtros; texto literal. Fórmulas e gráficos podem ser produzidos com openpyxl. |
| create_slides | PPTX básico a partir de títulos e textos; design avançado pode usar python-pptx. |
| merge_pdf | Junta PDFs na ordem solicitada e preserva os originais. |
| audit_pdf | Conta páginas/texto, verifica rótulos solicitados e gera prévias representativas. A cobertura e a aparência ainda devem ser conferidas. |
| image_info | Formato, dimensões, frames e integridade estrutural da imagem. |
| convert_image | PNG, JPEG e WEBP, com redução opcional e preservação da proporção; JPEG aplica fundo branco à transparência. |
| read_ocr | OCR local por CPU, até três páginas por chamada, com paginação para continuar. Valores importantes devem ser comparados com a imagem. |

Bibliotecas Python incluídas: python-docx, openpyxl, python-pptx, pypdf, PyMuPDF e Pillow; o OCR utiliza RapidOCR/ONNX Runtime. Essas bibliotecas permitem scripts além das operações básicas do adapter, mas não equivalem a uma aplicação Office nem garantem renderização idêntica ao Word, Excel ou PowerPoint.

## Regras e preparação

- Python nativo trabalha no diretório da sessão, usa o interpretador do pacote, respeita permissão, timeout e cancelamento, e retorna saída e exit status.
- Serena ativa o projeto solicitado; servidores de linguagem Python e JavaScript/TypeScript acompanham o runtime. Outras linguagens podem precisar de dependências.
- SQL usa parâmetros e leitura como padrão; escrita precisa ser solicitada explicitamente.
- FFmpeg, ffprobe e 7-Zip/7zz são utilitários de terminal incluídos, não servidores MCP independentes.
- APIs remotas recebem as consultas enviadas a elas. Instalação local dos modelos não torna serviços externos offline.
- Conta conectada não autoriza mensagens, publicação, compras ou alterações fora do pedido humano.
- Tor e tor-browser são os caminhos Tor. Brave, Exa e o navegador comum não passam automaticamente por Tor.
- Serviços pagos precisam de configuração e limites próprios; a distribuição não inclui créditos.
- Nenhuma credencial pessoal vem nos pacotes; confira a disponibilidade pelo status do roteador.

## Skills e regras

Sete skills acompanham [mejai/skills/](../mejai/skills/): browser-downloads, debug-live, ferramentas-sob-demanda, find-skills, systematic-debugging, tor-navegacao e verification-before-completion. Seus arquivos documentam o fluxo; nomes e schemas de ferramentas são obtidos do servidor em uso.

As regras gerais de execução ficam em [INSTRUCOES.md](../mejai/INSTRUCOES.md), [RECUPERACAO.md](../mejai/RECUPERACAO.md), [WEB-E-MCP.md](../mejai/WEB-E-MCP.md) e [LANGUAGE.md](../mejai/LANGUAGE.md).

[Voltar ao README](../README.md)
