# Perfis de estilo de imagem

Um perfil de estilo é um "estilo da casa" reaproveitável que molda todo prompt de imagem antes que Marinara o envie para o seu serviço de imagens. Use o perfil para deixar avatares, retratos, selfies, planos de fundo, ilustrações e sprites com aparência coerente. Este guia mostra como escolher, editar e testar um perfil.

## O que é um perfil de estilo

Toda imagem gerada começa como um prompt de texto: avatares, retratos, selfies do Conversation, planos de fundo de cena, ilustrações e sprites. Um perfil de estilo é um conjunto salvo de regras que Marinara acrescenta a esse prompt. Ele pode acrescentar palavras positivas (o que você quer), palavras negativas (o que você quer evitar) e um estilo de prompt preferido. Você escolhe um perfil como padrão do aplicativo inteiro. Esse padrão pode ser substituído em um chat ou em um modelo de imagem.

Para chegar ao editor, abra **Settings → Generations → Image Generation** (Configurações → Gerações → Geração de imagens) e role até **Style Profiles** (perfis de estilo).

## Os perfis prontos

Marinara tem 10 perfis de estilo prontos. O perfil **Auto** é o padrão. Você pode editar qualquer um deles e devolver um perfil pronto aos valores originais quando quiser.

Termos usados abaixo:

- SDXL é o Stable Diffusion XL, um modelo de imagem aberto e popular, que roda no seu computador ou por meio de um serviço na nuvem.
- Um checkpoint é um arquivo de modelo de imagem já treinado. Illustrious, Pony e NovelAI são os exemplos citados aqui.
- Danbooru é um site enorme de imagens de anime. As tags curtas separadas por vírgula do site, como "1girl, long hair, smile", viraram uma forma comum de escrever prompts para modelos de imagem de anime.

Os perfis prontos são:

- **Off**: não acrescenta nenhum estilo da casa e usa por padrão a gramática **Desativada**, que preserva o texto montado do prompt sem limpeza. Se você tem uma versão salva deste perfil, selecione **Desativada** em **Gramática do prompt** ou use **Redefinir** para obter o novo padrão.
- **Auto**: deduz uma aparência coerente a partir do personagem, do jogo, da cena e do modelo de imagem selecionado. Este é o perfil padrão.
- **Anime**: tags gerais de estilo anime, para arte de personagem limpa.
- **Danbooru / Illustrious**: tags no estilo Danbooru, voltadas para checkpoints SDXL de anime como Illustrious, Pony e NovelAI.
- **Realistic SDXL**: realismo em linguagem natural para modelos SDXL.
- **Photorealistic**: prompts em estilo de fotografia, com pele, iluminação e materiais convincentes.
- **Cinematic**: iluminação dramática e composição forte, para arte de destaque.
- **Digital Painting**: pinceladas de concept art e iluminação planejada.
- **Painterly Fantasy**: ilustração de fantasia com pintura suave.
- **Z-Image Turbo Narrative**: prosa compacta para os modelos Z-Image Turbo, que leem bem frases simples.

## Mudar o estilo global

O perfil padrão vale para toda imagem, a menos que um chat ou um modelo de imagem o substitua.

1. Abra **Settings → Generations → Image Generation → Style Profiles**.
2. Abra a lista **Default style** (estilo padrão).
3. Escolha um perfil.

A escolha é salva na hora, e as imagens novas passam a usá-la.

## Clonar e personalizar um perfil

Você pode editar um perfil pronto direto ou usar **Clone** (clonar) para preservar o original e montar o seu próprio perfil.

1. Abra o menu suspenso **Editing** (em edição) e escolha o perfil mais parecido com o que você quer.
2. Clique em **Clone**. Marinara faz uma cópia, seleciona a cópia para edição e a define na hora como estilo padrão do aplicativo inteiro.
3. Troque o campo **Name** (nome) por algo que você reconheça.
4. Escolha uma opção em **Prompt grammar** (gramática do prompt), explicada na próxima seção.
5. Preencha o campo **Style text** (texto de estilo) com uma descrição simples da aparência desejada. Quando uma IA escreve o prompt de imagem, como acontece com o Illustrator, as selfies e o Noodle, ela segue o seu Style text em vez de copiá-lo. Outras imagens, como os avatares, podem receber o Style text acrescentado tal como foi escrito.
6. Acrescente **Positive tags** (tags a incluir) e **Negative tags** (tags a evitar).
7. Abra a seção **Per-image tags** (tags por tipo de imagem) para acrescentar tags extras a cada tipo de imagem (avatar, retrato, selfie, plano de fundo, ilustração, sprite).
8. No passo 2, o clone virou o padrão do aplicativo inteiro. Para devolver esse papel a outro perfil, abra **Default style** e escolha o perfil que preferir.

Dois botões ajudam a organizar os perfis:

- **Reset** (restaurar) funciona só em perfis prontos. Ele devolve aquele perfil pronto aos valores originais.
- **Delete** (excluir) funciona só nos perfis criados por você, e apenas enquanto existir mais de um perfil.

## Modos de gramática do prompt

**Prompt grammar** informa a Marinara como o modelo de imagem prefere ler um prompt. Escolha o modo que combina com o seu modelo.

- **Hybrid**: mistura de frases e tags. Uma escolha geral segura.
- **Danbooru tags**: tags curtas no estilo Danbooru, separadas por vírgula. Melhor opção para checkpoints SDXL de anime, como Illustrious, Pony e NovelAI.
- **Tags**: palavras-chave curtas separadas por vírgula, sem a convenção do Danbooru.
- **Natural language**: frases simples. Melhor opção para modelos que leem prosa, como DALL-E e os modelos Z-Image Turbo.
- **Desativada**: mantém o texto montado do prompt na ordem original, inclusive as tags repetidas. Escolha esta opção quando o modelo de imagem precisar de sequências exatas de tags.

### Gramática do prompt: Desativada

Escolha **Desativada** para desativar o processamento de gramática e a limpeza do prompt em qualquer perfil de estilo. Marinara não divide nem reescreve o texto fornecido, não remove duplicatas, não concilia tags de gênero nem move expressões como `no watermark` para o prompt negativo. Espaços, quebras de linha e pontuação dentro de cada fonte ficam como foram fornecidos.

Por exemplo, esta sequência mantém cada marcador de participante ao lado da respectiva descrição:

```text
2boys, 3girls, 1boy, black hair, 1boy, brown hair, 1girl, long hair, 1girl, short hair, 1girl, red hair
```

Marinara continua reunindo as fontes configuradas, como prefixos da conexão, tags do perfil, texto gerado e as suas substituições de aparência. Ele acrescenta uma vírgula e um espaço entre as fontes. **Desativada** também desativa a remoção de orientações de estilo copiadas pelos escritores de prompts de imagem. A opção não controla o que o modelo que escreve o prompt gera.

Com **Desativada**, o Illustrator mantém as tags de **Ilustração** que você configurou mesmo quando o modelo de prompt menciona quadros ou layouts de quadrinhos. Ele também mantém o prompt negativo montado sem alterações, em vez de remover negativos repetidos ou acrescentar proibições de texto padrão.

Você pode selecionar a gramática **Desativada** em um perfil que acrescenta tags de estilo. O perfil integrado **Off** também deixa os campos de estilo vazios. Os seus perfis salvos mantêm a gramática existente até você alterá-la.

## A bancada de testes

A **Test bench** (bancada de testes), dentro do editor de Style Profiles, mostra exatamente o que Marinara enviaria, sem gerar uma imagem de verdade.

1. Escolha um **Image kind** (tipo de imagem), por exemplo retrato ou plano de fundo.
2. Digite um prompt aproximado no campo **Sample input** (entrada de exemplo).
3. Leia as caixas **Final positive prompt** (prompt positivo final) e **Final negative prompt** (prompt negativo final).

A Test bench também mostra uma observação curta sobre a limpeza do prompt. Quando nada muda, ela diz "No cleanup needed for this sample." Quando o prompt é alterado, ela informa quantos trechos duplicados ou fora de lugar foram limpos.

## Como Marinara limpa o prompt

Antes de qualquer pedido de imagem sair do Marinara, o prompt é compilado com o perfil ativo. Com a gramática **Desativada**, ele reúne as fontes sem limpeza. Com os outros modos de gramática, o compilador:

- remove tags quase duplicadas, como uma tag de qualidade repetida;
- move frases negativas simples, como "avoid text" ou "no watermark", para o prompt negativo;
- preserva as suas palavras em imagens de plano de fundo, ilustração e selfie, mas destila o seu texto em tags visuais curtas que reconhece para imagens de retrato, avatar e sprite; e
- acrescenta as tags do perfil correspondentes ao tipo de imagem que está sendo criado.

## Exemplo de antes e depois

Suponha que você escolha o perfil **Danbooru / Illustrious**, defina **Image kind** como retrato e digite isto em **Sample input**:

```
masterpiece, masterpiece, red-haired knight, no watermark
```

A Test bench então mostra este **Final positive prompt**:

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Três coisas aconteceram:

- "no watermark" saiu do prompt positivo e foi para o **Final negative prompt**. A observação de limpeza contabiliza essa mudança.
- O perfil acrescentou as próprias tags de estilo, as tags de retrato e as tags de qualidade. O "masterpiece" do resultado vem das tags do perfil, não do que você digitou.
- O seu texto foi destilado. Em retratos, o compilador mantém apenas os trechos que reconhece como pistas visuais claras. "red-haired knight" não é um deles, por isso foi descartado.

Se as palavras do seu tema sumirem em um retrato, avatar ou sprite, experimente o tipo de imagem **illustration**. Esse tipo preserva o texto que você escreveu.

## Ordem de prioridade: chat, conexão e depois global

Marinara pode pegar o perfil de estilo em três lugares. Vence a escolha mais específica.

1. Um perfil escolhido para o chat ou o jogo atual.
2. O perfil de estilo definido no modelo de imagem, na seção **Local image defaults** (padrões de imagem local) do editor dele.
3. O **Default style** global em **Settings**.

A seção **Local image defaults** aparece somente para AUTOMATIC1111 / SD Web UI, ComfyUI e NovelAI. Em todos os outros serviços, a escolha recai sobre o **Default style** global. Para definir um perfil por modelo, abra o modelo de imagem, expanda **Local image defaults** e escolha um perfil na lista de perfis de estilo. Deixe a opção **Use global default** para seguir a escolha global. Quando Marinara consegue adivinhar um bom perfil pelo nome do modelo, ele mostra um botão "Use ..." que aplica esse perfil com um clique.

## Imagens que a Professor Mari cria

A Professor Mari escreve os próprios prompts de imagem, então o comando `mari images` os envia ao modelo de imagem exatamente como ela os escreveu. O comando não acrescenta perfil de estilo, tags específicas da imagem nem prefixo de prompt da conexão. Peça a ela para usar seu estilo e ela acrescenta `--style`, que aplica o perfil escolhido conforme as regras acima (primeiro o perfil do modelo de imagem, depois o **Default style** global), ou `--style <name>` para escolher um perfil específico. Ela pode listar seus perfis e ler um deles por completo antes de escolher.

Cada imagem que ela cria registra o prompt original, o perfil usado (se houver) e o prompt exato que foi enviado. Assim ela pode mostrar o que o estilo mudou.

Em um modelo NovelAI V4 ou mais recente, ela dá a cada personagem da imagem um prompt próprio, seguindo as mesmas regras do Illustrator, para que as aparências não se misturem. O tamanho que ela pede é mantido mesmo quando a configuração **Escolher a resolução pelo número de personagens** do modelo está ativada; essa configuração só escolhe um tamanho quando ela deixa a escolha para o modelo.

## Guias relacionados

- [Provedores de geração de imagens e configuração](image-providers.md)
- [Agente Illustrator](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
