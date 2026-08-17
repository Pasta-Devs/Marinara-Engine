# Parâmetros de geração

Este guia explica os parâmetros de geração do Marinara Engine. São as configurações que controlam como a IA escreve cada resposta, como **Temperature** (temperatura) e **Max Output Tokens** (máximo de tokens na resposta). Você ajusta esses valores em cada chat, no painel **Advanced Parameters** (parâmetros avançados).

## Para que servem os parâmetros de geração

Um parâmetro de geração é uma configuração de amostragem. Ele molda a forma como o modelo transforma o prompt em texto. O prompt é o texto que Marinara envia para a IA. O parâmetro não muda o que você diz para a IA; muda o jeito como a IA responde.

Um parâmetro, por exemplo, deixa as respostas mais aleatórias e criativas. Outro define o tamanho máximo da resposta. A maioria das pessoas nunca precisa mexer nisso. Os valores padrão funcionam bem para chat comum e para roleplay.

Só mude essas configurações quando quiser resolver um problema específico. Perto do fim, este guia lista problemas comuns e qual parâmetro tentar em cada caso.

## Onde encontrar

Os parâmetros de geração ficam dentro de cada chat, não em um menu global.

1. Abra o chat que você quer mudar.
2. Abra **Chat Settings** (configurações do chat, no ícone de engrenagem do chat ativo).
3. Localize a seção **Advanced Parameters** e clique nela para expandir.

Você vai ver um aviso de ajuda com este texto: "Override generation parameters for this chat. Only change these if you know what you're doing." Todas as configurações descritas abaixo ficam dentro da seção **Advanced Parameters**.

A seção **Advanced Parameters** existe em todos os modos de chat (Conversation, Roleplay e Game).

## Cada parâmetro em linguagem simples

Cada parâmetro numérico tem uma caixa de valor e um botão liga/desliga próprio. Esse botão decide se o parâmetro é enviado ao modelo. A próxima seção explica como ele funciona.

**Temperature** controla a aleatoriedade. A faixa vai de 0 a 2. Valores baixos deixam as respostas mais focadas e previsíveis. Valores altos deixam as respostas mais criativas e variadas. Um valor perto de 1 é o meio-termo mais usado.

**Max Output Tokens** define o tamanho máximo da resposta que o modelo pode escrever em um turno. Um token é um pedacinho de texto, mais ou menos uma palavra curta ou parte de uma palavra. Aumente esse valor se as respostas ficarem cortadas. A caixa não tem limite máximo fixo.

**Top P** é a chamada amostragem por núcleo. A faixa vai de 0 a 1. O modelo escolhe apenas entre as palavras mais prováveis cuja chance somada alcança esse valor. Valores baixos deixam as respostas mais focadas. O valor 1 permite que o modelo considere tudo.

**Top K** limita o modelo às poucas palavras mais prováveis em cada etapa. A faixa vai de 0 a 500. O valor 0 desliga esse limite. Muitos provedores ignoram essa configuração.

**Frequency** penaliza uma palavra quanto mais ela já apareceu. A faixa vai de -2 a 2. Um valor positivo reduz a repetição de palavras. É a penalidade de frequência, mostrada no aplicativo como **Frequency**.

**Presence** penaliza qualquer palavra que já tenha aparecido, não importa quantas vezes. A faixa vai de -2 a 2. Um valor positivo empurra o modelo para assuntos novos. É a penalidade de presença, mostrada no aplicativo como **Presence**.

Juntos, **Frequency** e **Presence** formam as penalidades de repetição.

**Reasoning Effort** informa a um modelo com raciocínio quanto ele deve raciocinar antes de responder. Um modelo com raciocínio é aquele que primeiro resolve o problema em etapas ocultas. As opções são **None**, **Low**, **Medium**, **High**, **Xhigh** e **Maximum**. Se o modelo não aceitar o nível escolhido, Marinara reduz para o nível mais alto que aquele modelo permite.

Com o botão do parâmetro ativado, a opção **None** pede explicitamente ao provedor que desative o raciocínio, em vez de apenas omitir a configuração de esforço. Marinara envia o controle de desligamento específico do provedor apenas para modelos que reconhecidamente aceitam esse controle. Alguns modelos exigem raciocínio, não conseguem desligá-lo e ainda podem devolver raciocínio; escolha um modelo sem raciocínio quando isso não puder aparecer. Desativar o próprio botão do parâmetro é diferente: nada é enviado sobre raciocínio e o comportamento padrão do provedor continua igual.

**Verbosity** controla o tamanho e o nível de detalhe das respostas. As opções são **None**, **Low**, **Medium** e **High**. **Low** mantém as respostas curtas. **High** incentiva respostas mais longas e descritivas. Só alguns modelos usam essa configuração.

## O botão de envio

Todo parâmetro numérico, além de **Reasoning Effort** e **Verbosity**, tem um pequeno botão liga/desliga ao lado do nome. Esse botão não tem texto no aplicativo; aqui ele é chamado de botão de envio. Passe o mouse sobre ele para ver "This parameter is sent to the model" ou "This parameter is not sent to the model."

Com o botão de envio ativado, Marinara inclui aquele parâmetro na requisição enviada ao provedor. Com ele desativado, Marinara deixa o parâmetro totalmente de fora. Aí o provedor usa o próprio padrão para aquela configuração.

Desativar o botão de envio é diferente de definir um valor como 1 ou 0. O valor 1 ainda diz ao provedor o que usar. Desativar o botão não diz nada ao provedor, então o modelo decide.

Use o botão de envio quando um provedor avisar que duas configurações não podem ser usadas juntas. Desative uma delas e tente de novo. Ele também serve quando um erro diz que um parâmetro não é aceito ou é obrigatório. Desative o botão daquele parâmetro se ele não for aceito, ou ative se ele for obrigatório.

Na seção **Advanced Parameters** de um chat, só **Max Output Tokens** e **Reasoning Effort** vêm com o botão de envio ativado. Os demais começam desativados.

## Valores padrão

Todo chat novo parte de uma base interna. A tabela abaixo mostra esses valores iniciais e se cada um é enviado por padrão.

| Parâmetro | Valor inicial | Enviado por padrão |
|---|---|---|
| Temperature | 1 | Não |
| Max Output Tokens | 4096 em Conversation, 8192 em Roleplay e Game | Sim |
| Top P | 1 | Não |
| Top K | 0 (desligado) | Não |
| Frequency | 0 | Não |
| Presence | 0 | Não |
| Reasoning Effort | Maximum | Sim |
| Verbosity | High | Não |

O valor continua visível na caixa mesmo com o **botão de envio** desativado. Ele só não é enviado até você ativar o botão.

## Assistant Prefill

**Assistant Prefill** é um texto opcional inserido bem no começo da resposta da IA, logo depois da sua mensagem. A maioria das pessoas deixa esse campo vazio.

Use só com modelos que aceitam um prefill ou uma marcação de abertura fixa. Você pode digitar, por exemplo, uma marcação de abertura como a que aparece no texto de exemplo do campo, para forçar o modelo a começar de um jeito específico. Na dúvida, deixe em branco.

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill** (preenchimento inicial do raciocínio do assistente) é um texto oculto opcional inserido bem no começo do raciocínio da IA, antes que ela escreva a resposta visível. A maioria das pessoas deixa esse campo vazio.

Use só com modelos que aceitam um prefill de raciocínio separado, como o Kimi K3. Você pode usá-lo junto com **Assistant Prefill**: um inicia o raciocínio oculto do modelo, enquanto o outro inicia a resposta visível. Se não souber se o modelo aceita esse recurso, deixe em branco.

## Thinking Tags

**Thinking Tags** informa a Marinara como um modelo marca o raciocínio oculto dentro do texto comum. Alguns modelos envolvem o raciocínio em marcações. Se Marinara conhece essas marcações, consegue esconder o raciocínio atrás da ação **View thoughts** em vez de mostrá-lo na resposta.

Escreva um invólucro por linha, com um espaço no meio para o texto oculto. Invólucros comuns como think, thinking, thought, barra vertical, channel e pares de colchetes já são reconhecidos. Você só precisa desse campo para modelos que usam um invólucro fora do comum.

## Custom Parameters

O campo **Custom Parameters** permite acrescentar configurações brutas que Marinara não mostra como campo próprio. Você digita um objeto JSON e Marinara mescla esse objeto na requisição enviada ao provedor.

Os valores de Custom Parameters salvos como padrão da conexão são enviados em toda geração de texto via API que usa aquela conexão, incluindo Conversation, Roleplay, Game, Noodle, resumos e agentes. Isso vale também para endpoints personalizados rodando na sua própria máquina. Os valores de Custom Parameters definidos por chat são acrescentados àquele chat e substituem as chaves iguais definidas na conexão.

Este é um campo avançado. Uma chave errada pode fazer o provedor rejeitar a requisição. O objeto precisa usar `true`, `false` e `null` em minúsculas. Deixe vazio, a não ser que o guia de um provedor peça uma chave específica.

## OpenRouter Service Tier

O campo **OpenRouter Service Tier** só aparece quando a conexão do chat usa o provedor OpenRouter. Ele escolhe como OpenRouter encaminha a requisição. As opções são **Default**, **Flex** e **Priority**. **Flex** pode sair mais barato e mais lento. **Priority** pode ser mais rápido e custar mais. **Default** não envia nível nenhum.

## Limite de mensagens de contexto

A opção **Limit Context Messages** controla quanto do histórico do chat é enviado ao modelo. Ative para enviar só as últimas N mensagens em vez do chat inteiro.

Ao ativar, a contagem começa em 50. Você pode escolher qualquer número de 1 a 9999. Um número menor envia menos histórico, o que pode reduzir o custo e acelerar as respostas. Também significa que a IA lembra menos da parte antiga da conversa. Essa configuração vem desativada por padrão.

## Exclude Past Reasoning

A opção **Exclude Past Reasoning** vem ativada por padrão. Ela mantém fora dos novos prompts o raciocínio salvo de turnos anteriores. Esse raciocínio não é enviado ao modelo de novo.

Deixe ativada, a não ser que você tenha um motivo claro para devolver o raciocínio antigo ao modelo.

## Image Captioning

A opção **Image Captioning** muda a forma como a IA lida com imagens anexadas. Quando está ativada, Marinara descreve em texto cada imagem anexada usando uma conexão escolhida por você, em vez de enviar a própria imagem.

Use isso com modelos que não enxergam imagens. Ao ativar, escolha uma conexão no menu suspenso **Captioning Connection**. Um endpoint que só aceita texto pode falhar se você apontar para a conexão errada. Essa configuração vem desativada por padrão.

## Save as Connection Default

No fim da seção **Advanced Parameters**, o botão **Save as Connection Default** salva os valores atuais dos parâmetros na própria conexão. Depois disso, todo chat novo que usar aquela conexão parte desses valores.

O botão só aparece para uma conexão normal e salva. Ele fica escondido para o conjunto de conexões aleatórias e para o modelo local embutido.

O botão **Reset to Defaults**, logo abaixo, apaga toda alteração de parâmetro feita naquele chat e devolve o chat à base do modo.

## Como os padrões se sobrepõem

Os parâmetros que valem na prática vêm de três camadas. Cada camada vence a anterior, uma configuração de cada vez.

1. A base do modo. É o ponto de partida embutido para o modo daquele chat.
2. Os padrões salvos na conexão. São os valores que você guardou com **Save as Connection Default**.
3. A seção **Advanced Parameters** daquele chat. São os valores definidos ali mesmo, e eles vencem.

Ou seja: um valor definido em **Advanced Parameters** sempre vence o padrão da conexão e a base do modo.

Game Mode é um caso à parte. Game Mode define alguns parâmetros por conta própria para manter os turnos estruturados funcionando. Em Game Mode, algumas mudanças feitas em **Advanced Parameters** podem não valer por completo. Isso é esperado.

## Alguns modelos ignoram alguns parâmetros

Nem todo modelo aceita todo parâmetro. Quando Marinara sabe que um modelo rejeita uma configuração, ela fica fora da requisição. O controle deslizante ou a caixa continua visível no aplicativo, mas mexer nele não tem efeito naquele modelo.

Isso é comum em certos modelos de raciocínio, que recusam configurações de amostragem como a temperatura. Se uma configuração parece não fazer nada, talvez o modelo não a aceite. O comportamento também depende muito do modelo escolhido, então o mesmo valor pode dar sensações diferentes de um modelo para outro.

Se você usa um modelo de roteamento automático, que pode mudar qual modelo responde a cada vez, os parâmetros podem se comportar de forma diferente a cada turno. Fixar um modelo específico deixa o comportamento estável.

## Dicas de ajuste por sintoma

A maioria das pessoas nunca mexe nisso. Se quiser experimentar, mude uma configuração de cada vez para saber o que ajudou.

- Respostas duras ou repetitivas: aumente um pouco **Temperature**, por exemplo de 1 para um valor entre 1.1 e 1.3.
- Respostas caóticas ou fora do assunto: reduza **Temperature**, por exemplo para um valor entre 0.7 e 0.9.
- Respostas cortadas no meio: aumente **Max Output Tokens**.
- Um personagem repete sempre as mesmas construções: aumente um pouco **Frequency** ou **Presence**, por exemplo para um valor entre 0.3 e 0.6.

São regras práticas, não recomendações testadas. Modelos diferentes reagem de formas diferentes, então um valor que funciona em uma conexão pode não funcionar em outra.

Para ver exatamente quais parâmetros foram enviados em uma mensagem, use **Peek Prompt**. Ele mostra o prompt montado, além do modelo, da temperatura, do máximo de tokens, do esforço de raciocínio e de outras informações.

## Guias relacionados

- [Editor de presets e gerenciador de prompts](presets.md)
- [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
