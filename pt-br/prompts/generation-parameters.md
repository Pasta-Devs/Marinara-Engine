# Parâmetros de geração

Os parâmetros de geração são as configurações que controlam como o modelo escreve cada resposta, como **Temperature** (temperatura) e **Max Output Tokens** (máximo de tokens na resposta). Os presets e as contas fornecem os valores padrão, e a seção **Advanced Parameters** (parâmetros avançados) de **Chat Settings** (configurações do chat) os substitui em um chat. Os valores padrão funcionam bem para chat comum e para roleplay, então só mude essas configurações para resolver um problema específico.

## Onde encontrar

| O quê | Onde |
| --- | --- |
| Valores iniciais de um preset | **Presets**, abra um preset, aba **Parameters** (parâmetros) |
| Valores salvos em uma conta | **Connections** (Conexões), abra a conta, seção **Chat defaults** (padrões de chat) |
| Substituições para um chat | **Chat Settings**, seção **Advanced Parameters** |

Os presets não definem limites de tokens de contexto nem de saída. Defina a janela de contexto em **Connections** e os limites de saída em **Connections** ou em **Advanced Parameters**. Arquivos de preset antigos continuam carregando, mas os limites de tokens salvos neles são ignorados. O **Marinara's Universal Preset** integrado não fornece nenhum parâmetro de geração.

Para substituir os parâmetros em um chat:

1. Abra o chat.
2. Abra **Chat Settings**.
3. Encontre **Advanced Parameters** e clique para expandir.
4. Encontre o parâmetro, por exemplo **Temperature**, e digite um novo valor.
5. Confira o pequeno botão liga/desliga ao lado do nome dele. Se estiver desligado, ligue-o. Um parâmetro com o botão desligado não é enviado, então a sua mudança não faz nada. **Temperature** começa com o botão desligado (veja [O botão de envio](#the-send-switch)).

Você vê um aviso: "Change generation settings for this chat only. Leave these alone unless you know what they do." **Advanced Parameters** está disponível nos chats de Conversation, Roleplay e Game.

## Cada parâmetro em linguagem simples

Cada parâmetro numérico tem uma caixa de valor e um botão de envio (veja abaixo).

| Parâmetro | O que faz | Faixa |
| --- | --- | --- |
| **Temperature** | Aleatoriedade. Mais baixo é mais focado e previsível. Mais alto é mais criativo. Perto de 1 é um meio-termo comum. | 0 a 2 |
| **Max Output Tokens** | A resposta mais longa que o modelo pode escrever em um turno. Tokens são pedacinhos de texto. Aumente se as respostas forem cortadas. | Sem limite máximo fixo |
| **Top P** | O modelo escolhe só entre as palavras mais prováveis cuja chance somada alcança esse valor. 1 considera tudo. | 0 a 1 |
| **Top K** | Limita o modelo às poucas palavras mais prováveis em cada etapa. 0 desliga esse limite. Muitos serviços ignoram essa configuração. | 0 a 500 |
| **Frequency** | Penaliza mais as palavras quanto mais vezes elas já apareceram. Valores positivos reduzem palavras repetidas. | -2 a 2 |
| **Presence** | Penaliza as palavras que já apareceram, não importa quantas vezes. Valores positivos empurram para assuntos novos. | -2 a 2 |

**Frequency** e **Presence** são as penalidades de repetição.

**Reasoning Effort** (esforço de raciocínio) informa a um modelo com raciocínio, que primeiro resolve o problema em etapas ocultas, quanto ele deve raciocinar antes de responder. As opções são **Off** (desativado), **Low**, **Medium**, **High**, **Extra high** e **Maximum**. Se o modelo não aceitar o seu nível, Marinara reduz para o nível mais forte que o modelo permite. Depois que você escolhe um modelo, os botões recebem o nome do nível que aquele modelo recebe, então **Maximum** pode aparecer como **Max**, **Extra high** ou **High**.

- Com o botão de envio ligado, **Off** pede ao serviço que desligue o raciocínio, quando se sabe que o modelo aceita isso. Alguns modelos não conseguem desligar o raciocínio e ainda podem devolver raciocínio. Escolha um modelo sem raciocínio quando o raciocínio não puder aparecer.
- Com o botão de envio desligado, nenhuma preferência de raciocínio é enviada, e o serviço usa o próprio padrão.

**Verbosity** (verbosidade) define o tamanho e o nível de detalhe das respostas: **None**, **Low**, **Medium** ou **High**. Só alguns modelos usam essa configuração.

## Dicas de ajuste

Mude uma configuração de cada vez, para saber o que ajudou. São regras práticas, e os modelos variam.

| Problema | Tente |
| --- | --- |
| Respostas duras ou repetitivas | Aumente um pouco **Temperature**, para um valor entre 1,1 e 1,3. |
| Respostas caóticas ou fora do assunto | Reduza **Temperature**, para um valor entre 0,7 e 0,9. |
| Respostas cortadas | Aumente **Max Output Tokens**. |
| Um personagem repete sempre as mesmas construções | Aumente um pouco **Frequency** ou **Presence**, para um valor entre 0,3 e 0,6. |

Para ver quais parâmetros foram enviados em uma mensagem, use **Peek Prompt**. Ele mostra o prompt montado, além do modelo, da temperatura, do máximo de tokens, do esforço de raciocínio e de outras informações.

<a id="the-send-switch"></a>

## O botão de envio

Todo parâmetro numérico, além de **Reasoning Effort** e **Verbosity**, tem um pequeno botão liga/desliga ao lado do nome. Ele não tem rótulo de texto. Passe o mouse sobre ele para ver "This parameter is sent to the model" ou "This parameter is not sent to the model."

- Ligado: Marinara inclui o parâmetro na requisição.
- Desligado: Marinara deixa o parâmetro de fora, e o serviço usa o próprio padrão. Isso é diferente de um valor como 0 ou 1, que ainda diz ao serviço o que usar.

Use o botão quando um serviço disser que duas configurações não podem ser usadas juntas (desligue uma delas), ou quando um erro disser que um parâmetro não é aceito (desligue-o) ou é obrigatório (ligue-o).

Na seção **Advanced Parameters** de um chat, só **Max Output Tokens** e **Reasoning Effort** são enviados por padrão.

## Valores padrão

Estes são os valores que o editor mostra, nem sempre o que é enviado. Sem um preset, a geração começa com 4096 tokens de saída antes das substituições da conta e do chat. Uma cena ativa pode usar 8192. A linha **Effective** (valor efetivo) mostra o valor resolvido.

| Parâmetro | Valor inicial | Enviado por padrão |
| --- | --- | --- |
| Temperature | 1 | Não |
| Max Output Tokens | 4096 em Conversation, 8192 em Roleplay; sem substituição por Game | Sim |
| Top P | 1 | Não |
| Top K | 0 (desligado) | Não |
| Frequency | 0 | Não |
| Presence | 0 | Não |
| Reasoning Effort | Maximum | Sim |
| Verbosity | High | Não |

Um valor continua aparecendo na caixa quando o botão de envio dele está desligado. Ele só é enviado depois que você liga o botão.

## Prefills e marcações de raciocínio

**Assistant Prefill** (preenchimento inicial do assistente) é um texto opcional acrescentado no começo da resposta da IA. Deixe vazio, a menos que o modelo aceite esse recurso.

- Ele é a última coisa enviada, depois da sua mensagem e de todas as instruções que vêm depois dela.
- Se o chat terminar em uma resposta da IA e **Post-Processing Messages** (pós-processamento de mensagens) estiver em **Apply** (aplicar), o prefill é acrescentado ao fim dessa resposta.
- Alguns modelos recusam um prompt que termina nas palavras da própria IA, incluindo **Claude (Subscription)** com qualquer modelo. Para eles, Marinara acrescenta o prefill ao começo da última resposta da IA, então a nova resposta não começa com ele.
- Em um chat que ainda não tem resposta da IA, o prefill é enviado como a sua mensagem, no fim.

**Assistant Reasoning Prefill** (preenchimento inicial do raciocínio do assistente) é um texto oculto opcional acrescentado no começo do raciocínio da IA, antes da resposta visível. Use só com modelos que aceitam um prefill de raciocínio separado, como o Kimi K3. Ele pode ser usado junto com **Assistant Prefill**.

**Thinking Tags** (marcações de raciocínio) informam a Marinara como um modelo marca o raciocínio oculto em texto comum, para que ele possa esconder esse raciocínio atrás de **View model thoughts** (ver o raciocínio do modelo). Escreva um invólucro por linha, com um espaço no meio para o texto oculto. Invólucros comuns, como think, thinking, thought, barra vertical, channel e pares de colchetes, já são reconhecidos. Você só precisa disso para um invólucro fora do comum.

## Custom Parameters

**Custom Parameters** (parâmetros personalizados) permite acrescentar configurações brutas para as quais Marinara não tem campo. Digite um objeto JSON, e Marinara o mescla na requisição.

- Quando salvos como padrões da conta, eles são enviados em toda geração de texto que usa a conta: Conversation, Roleplay, Game, Noodle, resumos, agentes e pacotes de agentes instalados. Isso inclui endpoints personalizados na sua própria máquina.
- Os Custom Parameters por chat são acrescentados àquele chat e substituem as chaves iguais da conta.
- Uma chave errada pode fazer o serviço rejeitar a requisição. Use `true`, `false` e `null` em minúsculas. Deixe vazio, a não ser que o guia de um serviço peça para acrescentar uma chave.

## Service Tier

**Service Tier** (nível de serviço) só aparece quando a conta do chat usa OpenRouter ou NanoGPT. Ele escolhe como o serviço encaminha a sua requisição. **Default** (padrão) não envia nível nenhum. **Flex** pode sair mais barato e mais lento. **Priority** pode ser mais rápido e custar mais.

## Limite de mensagens de contexto

**Limit Context Messages** (limitar mensagens de contexto; também aparece como **Context message limit**) envia só as últimas N mensagens em vez do chat inteiro. Vem desligado por padrão. Ao ligar, a contagem começa em 50, e você pode definir de 1 a 9999. Um número menor reduz o custo e acelera as coisas, e a IA lembra menos.

Em um chat de Roleplay com **Advanced Memory Recall** (recuperação avançada de memória) ativado, esse limite não é usado. Advanced Memory Recall define quanto histórico é enviado com **Maximum allowed context before compression (tokens)** (contexto máximo permitido antes da compressão, em tokens). Para enviar menos, diminua essa configuração em **Chat Settings → Memory Recall**. Veja [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

**Exclude Past Reasoning** (excluir o raciocínio anterior) vem ligado por padrão. Ele mantém o raciocínio salvo de turnos anteriores fora dos novos prompts. Deixe ligado, a não ser que você tenha um motivo claro para devolver o raciocínio antigo ao modelo.

Desligar essa opção mostra **Past reasoning blocks** (blocos de raciocínio anteriores). O padrão é 1, que mantém o bloco de raciocínio disponível mais recente. Um valor de 0 inclui todos os blocos disponíveis. Isso não exclui os pensamentos armazenados, e só o raciocínio que a conta atual aceita pode ser reenviado.

## Image captioning

**Image captioning** (descrição automática de imagens) faz Marinara descrever em palavras cada imagem anexada, usando outro modelo, em vez de enviar a imagem. Use com modelos que não enxergam imagens. Vem desligado por padrão.

1. Em **Advanced Parameters**, ligue **Image captioning**.
2. Escolha um modelo no menu suspenso **Captioning model** (modelo de descrição).
3. Se quiser, edite o **Captioning Prompt** (prompt de descrição), as instruções enviadas com cada imagem. O botão de redefinir, ou esvaziar a caixa, restaura o padrão. O prompt fica salvo só neste chat, e **Save as Connection Default** não o copia.

Se não funcionou: quando a descrição falha, porque a conta usada nas descrições está com defeito, foi excluída ou não devolve nada, a resposta é interrompida com o erro **Image captioning failed** (falha na descrição da imagem). Marinara não envia a imagem no lugar. Corrija ou troque o modelo de descrição, ou desligue **Image captioning**.

## Save as Connection Default

No fim de **Advanced Parameters**, **Save as Connection Default** (salvar como padrão da conexão) grava os seus valores atuais na conta. Os chats novos que usam aquela conta passam a partir deles. O botão só aparece para uma conta normal e salva. Ele fica escondido para o conjunto aleatório e para o modelo embutido.

**Reset to Defaults** (restaurar os padrões) desfaz toda mudança feita neste chat e devolve o chat às configurações herdadas. Os botões de envio herdados seguem a conta selecionada. Um botão de envio que você mesmo mudou continua como substituição do chat até você redefini-lo.

## Como os padrões se sobrepõem e se substituem

Marinara resolve cada parâmetro por esta lista. Os itens posteriores substituem os anteriores.

1. Os **Parameters** do preset, ou os padrões integrados quando nenhum preset é usado. A saída começa em 4096 tokens, porque os presets não podem definir limites de saída. Em Roleplay, o preset definido como substituição na conta tem prioridade sobre o preset selecionado no chat.
2. Os **Chat defaults** da conta.
3. Os **Advanced Parameters** deste chat.
4. Regras do modo. Um chat de cena ativo define a saída como 8192, o raciocínio como **Maximum** e a verbosidade como **High**. Game usa os parâmetros salvos da conta e do chat sem impor amostragem, raciocínio nem tamanho mínimo de saída.
5. Limites de saída. Game aplica o limite de saída conhecido do modelo, e **Max output tokens override** (substituição do máximo de tokens de saída) da conta limita as requisições em todos os modos. O contexto disponível pode reduzir ainda mais o orçamento.

A linha **Effective** ao lado de um parâmetro mostra o valor que prevalece e de qual camada ele veio, por exemplo **Effective: 16384 · this chat**, ou **Effective: 4096 · output token cap** quando um limite da conta se aplica. Um botão de envio desligado mostra **not sent**. Os serviços ainda podem exigir parâmetros ou ajustar valores não aceitos. Custom Parameters e o ajuste ao contexto podem mudar a requisição final. Redefinir os parâmetros do chat remove só a substituição deste chat (item 3). O valor passa então a vir dos **Chat defaults** da conta, se estiverem definidos, ou do preset. As regras do modo e os limites de saída (itens 4 e 5) continuam valendo depois disso.

<a id="parameters-for-agents"></a>

## Parâmetros para agentes

As chamadas dos agentes usam os **Chat defaults** salvos na conta em que eles rodam: a conta do próprio agente, ou a do chat quando o agente não tem uma. Os botões de envio e os limites dos modelos valem como em uma resposta do chat. Os presets e os **Advanced Parameters** de um chat não mudam as chamadas dos agentes, exceto pela regra de temperatura abaixo.

- **Enviados aos agentes:** Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, cabeçalhos personalizados e os parâmetros extras que você acrescenta em **Settings** (Configurações), depois **Advanced** (avançado), depois **Parameters** (como Top A ou uma seed). Um parâmetro com o botão de envio desligado não é enviado.
- **Não enviados aos agentes:** Max Output Tokens, sequências de parada, prefills, Thinking Tags e outras configurações de formato do prompt. Cada agente mantém o próprio **Max Output Tokens**.
- **Temperature:** um agente usa a temperatura da conta, ou 0,7 quando nenhuma está salva. Beholder sempre usa 0, e o escritor de prompts do Illustrator usa o próprio valor. Durante uma resposta do chat, os agentes na conta do chat recebem a temperatura e os botões de envio que o chat resolveu. As novas tentativas usam os valores salvos da conta.
- **Reasoning Effort:** um nível que você escolhe, ou **Off**, vale para todo agente daquela conta cujo modelo aceita a configuração. **Use custom defaults for this model** (usar padrões personalizados para este modelo) faz Reasoning Effort começar em **Maximum** na maioria das contas (**Default** no Codex), então os agentes pensam no nível mais alto, o que é mais lento e custa mais. Escolha um nível menor, ou desligue o botão de envio, para que eles pensem menos. Sem um nível salvo, os agentes que respondem em JSON pedem que o raciocínio seja desligado, e os outros mantêm o padrão do modelo. Gemini 4 Argon e Carbon não conseguem desligar o raciocínio, então no Google AI Studio e no Vertex os agentes deles enviam **Medium** no lugar.
- **Espaço para pensar:** quando a conta salva um Reasoning Effort, ou o modelo é Gemini 4 Argon ou Carbon, Marinara acrescenta espaço para raciocínio além do **Max Output Tokens** do agente, dentro do limite de saída da conta, do limite do modelo e do contexto livre. Um endpoint personalizado recebe esse espaço mesmo quando não envia o nível.

Os pacotes de agentes instalados seguem os mesmos valores da conta. Um valor que a conta salva e envia substitui o que o pacote pede, e o que fica sem definição mantém a configuração do próprio pacote. **Reasoning Effort** ou **Max Output Tokens** desligados na conta não são enviados, mesmo que o pacote peça. Temperature e Verbosity começam desligados, então o valor do próprio pacote se mantém.

## Alguns modelos ignoram alguns parâmetros

Nem todo modelo aceita todo parâmetro. Quando Marinara sabe que um modelo rejeita uma configuração, ele a deixa fora da requisição. O controle continua aparecendo, mas mudá-lo não tem efeito. Isso é comum em modelos de raciocínio, que recusam configurações de amostragem como a temperatura. Com um modelo de roteamento automático, que muda qual modelo responde a cada vez, os parâmetros podem se comportar de forma diferente de um turno para outro. Fixe um modelo para manter o comportamento estável.

## Guias relacionados

- [Editor de presets e gerenciador de prompts](presets.md)
- [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
