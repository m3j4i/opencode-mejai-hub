# Melhorias do chat e da navegação — 14/10/2026

## Chat

Markdown agora é renderizado por tokens: títulos, listas, links, tabelas com rolagem horizontal e blocos de código com linguagem, destaque básico para JS/TS/Python/JSON e botão de cópia do bloco completo. HTML recebido é apresentado como texto; links executáveis e URLs locais não são ativados. Imagens remotas no Markdown não são carregadas automaticamente.

Enter envia; Shift+Enter insere uma nova linha. Composição IME, repetição de tecla e envios em andamento não disparam envios adicionais. Erros preservam o rascunho.

Editar e reenviar está disponível nas mensagens humanas de texto. A confirmação cria uma nova conversa com as mensagens anteriores àquela mensagem e envia o texto corrigido, mantendo seus anexos e a escolha original de agente/modelo. A conversa original continua disponível. Arquivos já produzidos não são revertidos. Edição é bloqueada durante execução ou autonomia ativa e verifica se o texto original mudou. Quando há falha no envio, a nova conversa é preservada e não ocorre repetição automática.

Os controllers validam entradas; o serviço de edição organiza a bifurcação; o repositório acessa as APIs do motor. A troca de conversa fica bloqueada durante o carregamento para evitar divergência entre a seleção e o histórico.

## Navegação

Camoufox e Chromium usam modo sem janela por padrão. `AGENTE_BROWSER_HEADLESS=0` permite modo visível explícito; `navegador-config.json` também aceita `headless: false`.

Tor usa SOCKS local e perfil separado por motor, DNS remoto e WebRTC bloqueado. Corrigido no adaptador o defeito do cliente Camoufox instalado que convertia a origem da URL SOCKS em `null`. Não foram modificados pacotes de terceiros. Sites `.onion` são bloqueados no perfil sem proxy. A ferramenta de download direto encaminha downloads Tor ao navegador; retomada direta continua bloqueada nesse perfil.

O armazenamento do perfil Camoufox foi separado em repositório. A inicialização, as regras de proxy e o modo de exibição ficam em serviços; o arquivo antigo é apenas um ponto de entrada compatível.

O Camoufox oferece automação sem janela, proxy e controle de WebRTC segundo sua [documentação oficial](https://camoufox.com/python/usage/). Um navegador automatizado por SOCKS não oferece necessariamente todas as proteções do Tor Browser, conforme a [orientação do Tor Project sobre outros navegadores](https://support.torproject.org/tor-browser/security/using-tor-with-other-browsers/). Nenhuma promessa de anonimato completo foi acrescentada ao produto.

## Verificações

- 26 grupos de regressão passaram; os 6 casos novos cobrem teclado, links, edição, falhas e política do navegador.
- Sintaxe, ESLint, Prettier e limites de módulos passaram.
- Navegador: tabela, cópia exata de código (com normalização das quebras de linha do Windows), bloqueio de HTML/links executáveis, Enter/Shift+Enter, diálogo de edição e seleção da nova conversa passaram.
- Motor nativo: bifurcação antes da mensagem-alvo preservou o histórico anterior e manteve a conversa original. Mensagens de teste foram armazenadas com `noReply=true`; edição desatualizada foi recusada antes de criar uma nova conversa.
- Camoufox real: navegação sem janela em página local passou. Proxy SOCKS controlado recebeu o hostname `.onion` sem resolução local; WebRTC estava indisponível no contexto protegido.
- Rede real: Tor completou a inicialização; `check.torproject.org/api/ip` confirmou `IsTor: true` no Camoufox; a ferramenta Tor fetch obteve HTTP 200 e conteúdo do blog oficial por seu endereço onion, confirmado na [lista oficial de serviços](https://onion.torproject.org/). Resultado em `tor-live-validation.json`; nenhum IP foi gravado no relatório.
- Os catálogos inglês, português brasileiro e russo mantêm 345 chaves e os mesmos placeholders. A biblioteca Marked 18.0.7 foi reutilizada localmente com sua licença, fora dos módulos próprios.

Conversas, perfis e processos de teste foram isolados e removidos. Nenhum prompt de teste foi enviado ao Ollama. Os testes da interface interceptaram o envio e não medem a qualidade da resposta de um modelo real. A validação de rede confirma o percurso observado, não a ausência absoluta de todas as formas de identificação de um navegador.
