# Peek Prompt: veja o que a IA recebeu

O recurso **Peek Prompt** (espiar o prompt) mostra o texto exato que Marinara Engine enviou ao modelo de IA para gerar uma resposta. Ele também exibe uma prévia ao vivo do prompt antes de qualquer envio. Neste guia você aprende o que o visualizador mostra, como abri-lo, como ler a direção armazenada e como usar tudo isso para investigar respostas estranhas.

O prompt é o bloco completo de instruções e histórico do chat que Marinara monta e envia ao modelo. O modelo lê esse bloco e escreve a resposta. Com o Peek Prompt, você vê o bloco já montado, e nada na resposta continua sendo um mistério.

## O que o Peek Prompt mostra

Ao abrir o Peek Prompt, aparece uma janela chamada **Assembled Prompt** (prompt montado). Ela tem três partes.

No topo, ao lado do título, fica um selo de origem. Ele indica qual versão do prompt está na tela:

- **Exact Text Model Request**: a requisição literal enviada ao modelo.
- **Live Preview**: uma prévia montada neste momento.
- **Raw Messages**: a lista bruta de mensagens.
- **Prompt Preview**: uma prévia geral.
- **Decision test preview**: um prompt montado com as respostas de um teste explícito de decisões. Ele não foi enviado ao modelo de chat.

Abaixo do selo fica o painel de informações da geração. Ele pode mostrar o nome do provedor e do modelo, uma contagem estimada de tokens e a contagem real de tokens do prompt assim que a resposta termina. O token é um pedacinho de texto que os modelos contam no lugar das palavras. Esse painel também traz pequenas tags com os valores usados, como **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** e **Assistant Prefill**. Valores de amostragem como **Top P**, **Top K** e **Min P** também podem aparecer aqui. Se a conexão para a qual a resposta se destinava falhou e a sua conexão de reserva escreveu a resposta no lugar dela, o painel também mostra a conexão que falhou, o modelo dela e um motivo curto, como "key rejected" ou "rate limited".

O resto da janela é o prompt em si, dividido em seções que abrem e fecham. Cada seção tem um rótulo e sua própria estimativa aproximada de tokens. As mensagens do chat ficam agrupadas em uma única seção **Chat History**. Em uma requisição salva exata, o provedor pode ter juntado vários turnos do chat em um só bloco. Abra cada bloco para inspecionar todo o texto visível ao modelo lá dentro. Clique no cabeçalho de uma seção para abri-la ou fechá-la.

Para levar o prompt inteiro para outro lugar, clique no botão de copiar ao lado do botão de fechar, no topo da janela. Ele copia todas as seções e mensagens do chat como texto simples, na ordem em que foram enviadas, inclusive as seções que você não abriu. Cada mensagem começa com uma linha que indica o papel dela, como `[system]`, `[user]` ou `[assistant]`. Em uma requisição salva exata, ele copia essa requisição salva do jeito que foi enviada. Copiar não envia nada ao modelo nem muda o prompt.

## Como abrir o Peek Prompt

Há duas formas de abrir o visualizador.

A primeira é pela barra de ações da mensagem. Siga estes passos:

1. Passe o mouse sobre a mensagem de IA mais recente do chat.
2. Localize a ação **Peek prompt**. O ícone dela é uma lupa.
3. Clique nela. A janela **Assembled Prompt** abre.

A ação **Peek prompt** só aparece na última mensagem de IA do chat. Nas mensagens antigas, ela não aparece.

A segunda forma é um atalho digitado. Ele funciona mesmo antes de existir qualquer resposta da IA, então você consegue ver a prévia do prompt primeiro. Siga estes passos:

1. Clique na caixa de mensagem.
2. Digite exatamente este texto:

```
{{prompt}}
```

3. Pressione Enter ou clique em Send.

Em vez de enviar uma mensagem, Marinara limpa a caixa e abre o visualizador do Peek Prompt. Os atalhos `{{prompt_preview}}` e `{{preview_prompt}}` fazem a mesma coisa.

## Como ler a direção armazenada

A geração guiada permite conduzir uma resposta com uma instrução fora do personagem. Quando a mensagem foi criada com uma direção armazenada, ela ganha a ação **Stored guidance** (direção armazenada). O ícone dela é um pergaminho pequeno. Essa ação também aparece nas mensagens criadas com o comando `/impersonate`.

Clique em **Stored guidance** para abrir uma janela com a direção usada naquela mensagem. Em uma mensagem guiada, a janela identifica a direção pela origem:

- **/guided**: você usou o comando de barra `/guided`.
- **Guided regenerate**: você regenerou a mensagem com uma direção digitada.
- **Game start**: a direção veio da configuração do Game Mode.

O botão **Copy /guided** aparece apenas nas direções **/guided** e **Guided regenerate**. Ele copia a direção de volta no formato de um comando `/guided`. Depois, é só colar esse comando para reaproveitar a mesma condução. Nas direções **Game start**, o botão não aparece.

Em uma mensagem de impersonação, a janela mostra os detalhes da impersonação em vez de uma direção única. O fluxo completo de geração guiada e impersonação está no guia indicado abaixo.

## Como usar o Peek Prompt para investigar respostas

O Peek Prompt é a melhor ferramenta para entender uma resposta inesperada. Use-o quando o personagem esquecer algo, ignorar uma regra ou sair do personagem.

Abra a janela **Assembled Prompt** e verifique estes pontos:

- Procure informações que ficaram de fora. Se uma entrada de lorebook, uma lembrança ou um detalhe da persona não estiver em nenhuma seção, o modelo nunca viu esse conteúdo.
- Confira as tags de parâmetros. Um valor muito alto em **Temperature** deixa as respostas aleatórias, e um valor baixo em **Max Output Tokens** corta as respostas no meio.
- Abra a seção **Chat History**. Confirme se as mensagens esperadas estão presentes e na ordem certa.
- Leia a contagem real de tokens depois da resposta. Um prompt muito grande empurra as mensagens antigas para fora do limite do modelo.

Sabendo o que o modelo realmente recebeu, você consegue corrigir a causa. Talvez seja editar um card de personagem, ajustar uma entrada de lorebook ou mudar um valor nos parâmetros de geração.

<a id="testing-decision-statements"></a>

## Como testar declarações de decisão

Abra **Decision diagnostics** (diagnóstico de decisões) no Peek Prompt para inspecionar as declarações do prompt e as decisões de lorebooks do chat atual. Abrir o painel ou escolher **Preview inputs** (prévia das entradas) prepara os corpos das requisições sem consultar o modelo de decisão nem iniciar um modelo local. Expanda **Prepared request bodies** (corpos das requisições preparados) para ver as mensagens recentes, as declarações resolvidas, as opções e o formato de requisição específico do modelo. Outras declarações de lorebooks podem se tornar acessíveis somente depois da resposta a uma decisão anterior.

Escolha **Test decisions** (testar decisões) para enviar as perguntas elegíveis ao modelo de decisão selecionado. Isso faz requisições reais de decisão, pelas quais um modelo hospedado pode cobrar. Não gera uma resposta de chat, executa agentes, altera o estado do jogo nem salva as respostas ou os temporizadores do teste no chat.

Um teste explícito pode esperar por um modelo local de raciocínio mesmo quando as decisões normais anteriores à resposta são adiadas. Isso não altera sua preferência para as respostas em andamento; a prévia das entradas continua sem enviar requisições ao modelo.

Cada resultado mostra sua pontuação, quando disponível, o limite usado para uma declaração de sim/não e a resposta resultante. Um modelo que só retorna uma palavra de sim/não é identificado como tal; sua resposta não é apresentada como probabilidade. Resultados Choice mostram a opção selecionada. Decisões mantidas, adiadas, acima do limite, indisponíveis e com falha têm explicações separadas, para que uma resposta ausente não seja confundida com uma pontuação baixa.

Depois de um teste, o prompt abaixo usa as respostas dele. Use **Show original prompt** (mostrar prompt original) para voltar ao conteúdo aberto inicialmente ou **Show tested prompt** (mostrar prompt testado) para retornar ao teste. **Requests sent and results** (requisições enviadas e resultados) mostra os corpos reais das requisições de decisão e os resultados recebidos, sem cabeçalhos de autenticação.

Os testes usam o chat e as configurações atuais, mesmo se você abriu Peek Prompt a partir de uma resposta antiga. Eles não reconstroem as requisições de decisão originais. Cobrem declarações do prompt e decisões de lorebooks; não executam a ativação de agentes nem decisões posteriores à resposta. O Peek Prompt comum permanece passivo até você escolher **Test decisions** explicitamente.

Quando **Use Decision model** (usar modelo de decisão) está ativado no Advanced Memory, o painel também mostra **Advanced Memory activity** (atividade do Advanced Memory). Esses relatórios salvos identificam a recuperação e a verificação de fim de cena mais recentes, com modelo, tempo, pontuações, seleções e estado do mecanismo alternativo. Eles podem aparecer mesmo sem declarações de decisão no prompt. Descrevem chamadas reais anteriores, não a prévia atual nem uma repetição da resposta histórica selecionada. Swipes compatíveis podem reutilizar um relatório de recuperação anterior. São salvos até 128 resultados por relatório, com os selecionados primeiro; os omitidos são contados. Novos relatórios aparecem depois da próxima chamada elegível ao modelo de decisão, e consultá-los não faz requisições ao modelo.

## Guias relacionados

- [Parâmetros de geração](../prompts/generation-parameters.md)
- [Editor de presets e gerenciador de prompts](../prompts/presets.md)
- [Modelos de decisão](../connections/decision-models.md)
- [Geração guiada e Impersonate](guided-and-impersonate.md)
- [Ações de mensagem: editar, excluir, swipe e regenerar](messages.md)
