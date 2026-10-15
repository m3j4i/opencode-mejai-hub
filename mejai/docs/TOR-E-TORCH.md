# Conexão Tor e preferência Torch — 14/10/2026

O kit usa o cliente oficial Tor 0.4.9.13, executado em segundo plano em modo ClientOnly. Camoufox e a ferramenta tor.fetch enviam suas conexões para o SOCKS local desse cliente, com resolução de nomes pelo proxy.

O cliente Tor constrói os circuitos e obtém o consenso público assinado de relays das autoridades de diretório. O kit não mantém uma lista manual de proxies nem escolhe três IPs arbitrários. A seleção considera o papel do nó, capacidade, famílias e outras restrições. O guard é escolhido e mantido por mais tempo; essa persistência faz parte da proteção do Tor. Consulte a [seleção de caminhos](https://spec.torproject.org/path-spec/general-operation.html) e a [explicação dos guards](https://support.torproject.org/tor-browser/security/guard-relay/).

Para sites da internet comum, o caminho típico é cliente → guard → intermediário → saída → site. Para serviços onion, os circuitos do cliente e do serviço encontram-se em um ponto de rendezvous, sem uma saída para a internet comum. A [visão geral oficial](https://community.torproject.org/onion-services/overview/) descreve esse funcionamento.

A lista é renovada automaticamente pelo Tor durante sua execução. Os dados locais estão em dados/tor/cached-microdesc-consensus. Na verificação desta revisão, o consenso baixado era de 14/10/2026, com valid-after 09:00, fresh-until 10:00 e valid-until 12:00 UTC. Esses horários são definidos pelo próprio consenso; não representam uma promessa de atualização quando a máquina estiver desligada ou sem rede. O [formato oficial do consenso](https://spec.torproject.org/dir-spec/consensus-formats.html) documenta a validade e as assinaturas.

## Torch

Pedidos de pesquisa na deepweb, rede Tor ou onion agora têm Torch como preferência persistente. O adaptador tor-browser.browser_search usa Torch também quando engine=auto. A política do agente e a skill tor-navegacao orientam o uso de engine=torch e impedem substituição silenciosa por buscadores da rede comum.

O endereço está em tor-search.json, com a fonte publicada em [torch.cx/about](https://torch.cx/about/). O formulário público observado usa GET /search/ com parâmetro q. Os resultados do Torch usam links /search/redirect com redirect_url; o adaptador extrai somente destinos onion observados, valida protocolos, remove duplicatas e exclui publicidade identificada. Links de resultados não são visitados automaticamente.

Testes locais verificaram parâmetros, endpoints onion, ausência de busca direta, extração dos redirecionamentos e falha sem fallback. Uma consulta neutra real chegou ao Torch e a página indicou 484 correspondências; outras tentativas tiveram timeout. A integração informa a indisponibilidade real em vez de declarar sucesso sem links.

Não é necessária uma extensão para montar circuitos: o cliente Tor já fornece esse mecanismo. Camoufox por SOCKS continua sendo automação com Tor, com proteções diferentes das do Tor Browser. Quando uma solicitação falha, o kit não tenta o endereço onion por conexão direta.
