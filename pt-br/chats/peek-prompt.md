# Peek Prompt: veja o que a IA recebeu

O Peek Prompt mostra o texto exato que Marinara Engine enviou ao modelo para uma resposta, ou uma prévia ao vivo da próxima. Use-o quando uma resposta não for o que você esperava e você quiser saber o que o modelo viu.

O prompt é o bloco completo de instruções e histórico do chat que Marinara monta e envia. O modelo lê esse bloco e escreve a resposta.

## Como abrir o Peek Prompt

Há duas formas de abrir a janela **Assembled Prompt** (prompt montado).

Por uma mensagem:

1. Toque na mensagem mais recente da IA para mostrar a barra de ações dela.
2. Clique em **Peek prompt** (espiar o prompt), uma lupa.

Ele só aparece na última mensagem da IA. As mensagens mais antigas não o mostram.

Pela caixa de entrada, o que também funciona antes de qualquer resposta da IA:

1. Digite exatamente este texto na caixa de mensagem: `{{prompt}}`
2. Pressione <kbd>Enter</kbd> ou clique em **Send** (enviar).

Marinara limpa a caixa e abre a janela em vez de enviar uma mensagem. `{{prompt_preview}}` e `{{preview_prompt}}` fazem a mesma coisa.

## O que a janela mostra

Um selo ao lado do título indica qual versão do prompt você está lendo.

| Selo | Significado |
| --- | --- |
| **Exact Text Model Request** | A requisição literal que foi enviada ao modelo. |
| **Live Preview** | Uma prévia montada neste momento. |
| **Raw Messages** | A lista bruta de mensagens. |
| **Prompt Preview** | Uma prévia geral. |
| **Decision test preview** | Um prompt montado com as respostas de um teste de decisões. Ele não foi enviado ao modelo de chat. |

Abaixo dele, um painel de informações pode mostrar o serviço e o modelo, uma contagem estimada de tokens e a contagem real de tokens do prompt depois que a resposta termina. Um token é um pedacinho de texto que os modelos contam no lugar das palavras. O painel também mostra tags com os valores usados, como **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** e **Assistant Prefill**, e valores de amostragem como **Top P**, **Top K** e **Min P**. Tags como **Service Tier** e **Assistant Prefill**, e os valores de amostragem, são configurações avançadas do modelo. No começo, você pode ignorá-las. Se o primeiro modelo falhou e o seu modelo de reserva escreveu a resposta, o painel mostra o modelo que falhou e um motivo curto, como "key rejected" ou "rate limited".

O resto é o prompt, em seções que abrem e fecham, cada uma com a sua própria estimativa aproximada de tokens. As mensagens do chat ficam agrupadas em **Chat History**. Em uma requisição salva exata, o serviço pode ter juntado vários turnos do chat em um só bloco, então abra cada bloco para ver todo o texto. Clique no cabeçalho de uma seção para abri-la ou fechá-la.

Uma **Exact Text Model Request** é a requisição do jeito que foi enviada para aquela resposta. Ela foi salva antes de tudo o que foi executado depois da resposta, como um resumo automático ou a ocultação de mensagens, então pode conter mensagens que a próxima resposta não vai receber. Clique em **Show current context** (mostrar o contexto atual) para montar o prompt a partir do chat como ele está agora, sem enviá-lo. Clique em **Show sent request** (mostrar a requisição enviada) para voltar.

### Copiar o prompt

Clique no botão de copiar ao lado do botão de fechar. Ele copia todas as seções e mensagens como texto simples, na ordem em que foram enviadas, inclusive as seções fechadas. Cada mensagem começa com uma linha que indica o papel dela, como `[system]`, `[user]` ou `[assistant]`. Em uma requisição salva exata, ele copia a requisição do jeito que foi enviada. Copiar não envia nada.

### Buscar texto no prompt

Use o campo **Find** (buscar) no topo, ou pressione <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> no Mac) dentro da janela. A busca não diferencia maiúsculas de minúsculas e procura no prompt inteiro, incluindo as seções fechadas e o histórico do chat. O contador mostra a correspondência atual, por exemplo "2 of 5". Use os botões para cima e para baixo, ou <kbd>Enter</kbd> e <kbd>Shift</kbd>+<kbd>Enter</kbd>, para passar de uma correspondência a outra. Ao chegar a uma das pontas, a busca continua pela outra. Enquanto **Find** tem texto, a janela mostra o texto completo das mensagens. Limpe o campo para voltar às seções.

## Verificar uma resposta com o Reply checkup

Quando Marinara identifica uma causa provável para uma resposta ruim, a janela mostra um painel **Reply checkup** (diagnóstico da resposta) acima do prompt. Ele pode dizer:

- O card de personagem é grande e ocupa uma boa parte do orçamento do prompt (**Large character card**).
- A resposta atingiu o limite de tokens e parou no meio de uma frase (**Cut off**).
- O modelo não devolveu nenhum texto visível (**Empty reply**).
- As mensagens mais antigas não foram enviadas porque o prompt não cabia (**N older messages not sent**).
- Entradas de lorebook corresponderam, mas não couberam no orçamento (**N lorebook entries left out**).
- O limite da resposta foi reduzido para abrir espaço para o prompt (**Reply limit cut**).

Quando ajuda, um link leva direto à configuração que deve ser mudada, como **Max output tokens** ou **Lorebook token budget**.

## Investigar uma resposta inesperada

Abra **Assembled Prompt** e verifique:

- **Informações ausentes.** Se uma entrada de lorebook, uma memória ou um detalhe da persona não está em nenhuma seção, o modelo nunca viu esse conteúdo.
- **Tags de parâmetros.** Um valor alto de **Temperature** pode deixar as respostas aleatórias, e um valor baixo de **Max Output Tokens** pode cortá-las no meio.
- **Chat History.** Confirme se as mensagens que você espera estão lá, na ordem certa.
- **Contagem de tokens.** Um prompt grande pode empurrar as mensagens mais antigas para fora do limite do modelo.

Depois, corrija a causa: edite um card de personagem, ajuste uma entrada de lorebook ou mude uma configuração de geração. Veja [Parâmetros de geração](../prompts/generation-parameters.md).

Para ler a direção por trás de uma resposta guiada, use **Stored guidance** (orientação salva) na mensagem. Veja [Geração guiada e Impersonate](guided-and-impersonate.md#read-stored-guidance).

<a id="testing-decision-statements"></a>

## Como testar declarações de decisão

Um [modelo de decisão](../connections/decision-models.md) responde a perguntas de sim ou não para recursos como os lorebooks. O **Decision diagnostics** (diagnóstico de decisões), dentro do Peek Prompt, permite inspecionar e testar essas perguntas para o chat atual.

1. Abra o Peek Prompt e encontre **Decision diagnostics**.
2. Abrir o painel, ou clicar em **Preview inputs** (prévia das entradas), prepara os corpos das requisições sem consultar nenhum modelo. Expanda **Prepared request bodies** (corpos das requisições preparados) para ver as mensagens recentes, as declarações resolvidas, as opções e o formato da requisição.
3. Clique em **Test decisions** (testar decisões) para enviar as perguntas elegíveis ao seu modelo de decisão.

**Test decisions** faz requisições reais, então um modelo hospedado pode cobrar por elas. Ele não escreve uma resposta no chat, não executa agentes, não muda o estado do jogo nem salva as respostas ou os temporizadores no chat. Declarações de lorebook posteriores podem ficar acessíveis só depois que uma anterior é respondida. Um teste explícito pode esperar por um modelo local de raciocínio mesmo quando as decisões normais anteriores à resposta são adiadas. Isso não muda a sua configuração para as respostas ao vivo.

Cada resultado mostra a pontuação, quando há uma, o limiar de uma declaração de sim ou não e a resposta. Um modelo que só devolve "yes" ou "no" é identificado assim, e a resposta dele não aparece como probabilidade. Os resultados de escolha mostram a opção selecionada. Decisões mantidas, adiadas, acima do limite, indisponíveis e com falha têm cada uma a sua própria explicação.

Depois de um teste, o prompt abaixo usa as respostas do teste. Clique em **Show original prompt** (mostrar o prompt original) para voltar ao que você abriu, ou em **Show tested prompt** (mostrar o prompt testado) para voltar ao teste. **Requests sent and results** (requisições enviadas e resultados) mostra os corpos reais das requisições e os resultados, sem os cabeçalhos de autenticação.

Se não funcionou: **Could not prepare the decision test. Check the chat connection and try again.** Confira se o chat tem um modelo que funciona e tente de novo.

Os testes usam o chat e as configurações atuais, mesmo quando você abriu o Peek Prompt a partir de uma resposta antiga. Eles não reconstroem as requisições de decisão originais. Eles cobrem as declarações do prompt e as decisões de lorebook, não a ativação de agentes nem as decisões posteriores à resposta.

Quando **Use Decision model** (usar modelo de decisão) está ativado no Advanced Memory (o recurso de memória de longo prazo do Marinara, veja [Memory Recall e resumos do chat](../agents/memory.md)), o painel também mostra **Advanced Memory activity** (atividade do Advanced Memory). Esses relatórios salvos mostram a recuperação e a verificação de fim de cena mais recentes, com o modelo, o tempo, as pontuações, as seleções e o estado do fallback. Eles descrevem chamadas anteriores, não a prévia atual, e podem aparecer mesmo quando o prompt não tem declarações de decisão. Swipes compatíveis podem reutilizar um relatório de recuperação anterior. Cada relatório guarda até 128 resultados, com os selecionados primeiro, e conta os restantes. Novos relatórios aparecem depois da próxima chamada elegível ao modelo de decisão. Consultá-los não faz nenhuma requisição ao modelo.
