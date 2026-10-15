# Scripts completos no chat — 14/10/2026

O agente recebeu uma regra persistente para entregar scripts pedidos em blocos Markdown completos com linguagem, nome e uso. O caminho do arquivo é informação complementar. Pedidos explícitos para omitir código continuam sendo respeitados. A regra integra a mensagem de sistema existente; não gera mensagens extras de continuação.

Quando uma resposta final apresenta somente o caminho, o Hub pode exibir o script cuja gravação ou edição bem-sucedida esteja registrada no mesmo turno da conversa. Para gravações, usa o conteúdo preservado no histórico da ferramenta; para edições, lê o arquivo atual validado. A resposta original do modelo não é modificada. O bloco usa o botão Copiar código existente e permanece no histórico da conversa.

Não existe endpoint de leitura livre por caminho. Referências sem uma operação de gravação/edição comprovada, arquivos de outros turnos e nomes parecidos não são usados. Código completo já presente na resposta não é duplicado. Scripts não são executados para exibição.

O fallback visual mostra até três scripts referenciados por resposta, com limite de 256 KB por script. Conteúdo acima desse limite é sinalizado sem truncamento silencioso. Arquivos ausentes ou ilegíveis não impedem a abertura do chat. Esse fallback não cobre scripts produzidos por ferramentas que não registrem a gravação/edição; nesses casos, a regra do agente exige entregar o código na própria resposta. Não foi feita inferência real para medir a adesão de um modelo à regra.

Os testes verificaram resposta só com caminho, cópia integral, crases dentro do script, ausência de duplicação após atualização, controles em português, referência exata, isolamento entre pedidos, respeito à omissão explícita, arquivos grandes e falhas de leitura. A suíte de regressão e os padrões de qualidade também foram executados. Nenhum prompt de teste foi enviado ao Ollama.
