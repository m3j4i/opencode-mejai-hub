# Scripts completos no chat

1. Adicionar regra persistente para entregar scripts pedidos em blocos Markdown completos, com linguagem, instrução de uso e caminho como informação complementar. Respeitar pedidos explícitos de mostrar somente o arquivo; não enviar prompts extras de continuação.
2. Criar fallback visual para respostas que mencionem somente o caminho: mostrar no histórico o conteúdo de scripts comprovadamente gravados/ editados pelas ferramentas da própria conversa, sem modificar o texto original do modelo. Usar o renderizador existente e seu botão Copiar código.
3. Separar identificação de referências (serviço), leitura validada (repositório) e apresentação. Não criar endpoint de leitura livre por caminho. Não executar scripts para exibi-los. Limitar tamanho explicitamente sem apresentar código truncado como completo.
4. Testar referências, associação com a conversa/turno, ausência de duplicação quando já existe código, falhas de leitura e arquivos grandes. Validar a interface com uma conversa temporária, sem inferência real ao Ollama. Recarregar as regras apenas quando o agente estiver ocioso e sincronizar a fonte da fork.
