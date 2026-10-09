# Perfis de estilo de imagem

Este guia explica os perfis de estilo de imagem do Marinara Engine. Um perfil de estilo é um "estilo da casa" reaproveitável que molda todo prompt de imagem (o texto que Marinara envia para a IA) antes que o Marinara mande o pedido para o provedor de imagens. Use o perfil para deixar avatares, retratos, selfies, planos de fundo, ilustrações e sprites com aparência coerente.

## O que é um perfil de estilo

Marinara Engine gera vários tipos de imagem: avatares de personagem e de persona, retratos, selfies do Conversation Mode, planos de fundo de cena, ilustrações dentro da cena e sprites de personagem (a imagem do personagem no palco). Toda imagem começa como um prompt de texto.

Um perfil de estilo é um conjunto salvo de regras que Marinara acrescenta a esse prompt de texto. Ele pode incluir palavras positivas (o que você quer), palavras negativas (o que você quer evitar) e uma gramática de prompt preferida. Com isso, todas as imagens ficam com a mesma cara e você não precisa redigitar as mesmas palavras de estilo toda vez.

Escolha um perfil como padrão do aplicativo inteiro. Esse padrão pode ser substituído em um chat específico ou em uma conexão de imagem específica. Tudo isso está explicado abaixo.

Para chegar ao editor, siga estes passos:

1. Abra a seção **Settings** (Configurações).
2. Abra a aba **Generations** (gerações).
3. Localize a seção **Image Generation** (geração de imagens).
4. Role até **Style Profiles** (perfis de estilo).

## Os perfis prontos

Marinara vem com 10 perfis de estilo prontos. O perfil **Auto** é o padrão. Qualquer um deles pode ser editado, e um perfil pronto volta aos valores originais quando você quiser.

Alguns termos usados abaixo:

- SDXL quer dizer Stable Diffusion XL. É um modelo de imagem aberto e popular, que roda no seu computador ou por meio de um serviço na nuvem.
- Um checkpoint é um arquivo de modelo de imagem já treinado. As pessoas baixam checkpoints diferentes para ter estilos de arte diferentes. Os exemplos citados nestes perfis são Illustrious, Pony e NovelAI.
- Danbooru é um site enorme de imagens de anime. As tags curtas separadas por vírgula do site (como "1girl, long hair, smile") viraram a forma mais comum de escrever prompts para modelos de imagem de anime.

Os perfis prontos são:

- **Off**: não acrescenta nenhum estilo da casa. O prompt vai quase igual ao que você escreveu.
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

O perfil padrão global vale para toda imagem gerada, a menos que um chat ou uma conexão o substitua. Para trocar esse padrão, siga estes passos:

1. Abra a seção **Settings**, depois a aba **Generations**, depois **Image Generation** e então **Style Profiles**.
2. Abra o menu suspenso **Default style** (estilo padrão).
3. Escolha o perfil que vale para o aplicativo inteiro.

A escolha é salva na hora. As imagens novas passam a usar o perfil escolhido.

## Clonar e personalizar um perfil

Um perfil pronto pode ser editado direto, mas o botão **Clone** (clonar) permite preservar o original e montar a sua própria versão. Para criar e personalizar um perfil, siga estes passos:

1. Abra o menu suspenso **Editing** (em edição) e escolha o perfil mais parecido com o que você quer.
2. Clique em **Clone**. Marinara faz uma cópia, seleciona a cópia para edição e a define na hora como estilo padrão do aplicativo inteiro.
3. Troque o campo **Name** (nome) por algo que você reconheça.
4. Escolha uma opção em **Prompt grammar** (gramática do prompt), explicada na próxima seção.
5. Preencha o campo **Style text** (texto de estilo) com uma descrição simples da aparência desejada. Quando uma IA escreve o prompt de imagem, como acontece com o Illustrator, as selfies e o Noodle, ela segue o seu Style text em vez de copiá-lo. Outras imagens, como os avatares, podem receber o Style text acrescentado tal como foi escrito.
6. Acrescente **Positive tags** (tags a incluir) e **Negative tags** (tags a evitar).
7. Abra a seção **Per-image tags** (tags por tipo de imagem) para acrescentar tags extras a cada tipo de imagem: avatar, retrato, selfie, plano de fundo, ilustração e sprite.
8. No passo 2, o clone virou o padrão do aplicativo inteiro. Para devolver esse papel a outro perfil, abra **Default style** e escolha o perfil que preferir.

Dois botões ajudam a organizar os perfis:

- **Reset** (restaurar) funciona só em perfis prontos. Ele devolve o perfil pronto aos valores originais.
- **Delete** (excluir) funciona só nos perfis criados por você, e apenas enquanto existir mais de um perfil.

## Modos de gramática do prompt

O menu suspenso **Prompt grammar** informa a Marinara como o modelo de imagem prefere ler um prompt. Escolha o modo que combina com o modelo de imagem. São quatro modos.

- **Hybrid**: mistura de frases e tags. Uma escolha geral segura.
- **Danbooru tags**: tags curtas no estilo Danbooru, separadas por vírgula. Melhor opção para checkpoints SDXL de anime, como Illustrious, Pony e NovelAI.
- **Tags**: palavras-chave curtas separadas por vírgula, sem a convenção do Danbooru.
- **Natural language**: frases simples. Melhor opção para modelos que leem prosa, como DALL-E e os modelos Z-Image Turbo.

## A bancada de testes

A seção **Test bench** (bancada de testes) mostra exatamente o que Marinara enviaria, sem gerar uma imagem de verdade. Abra essa seção dentro do editor de Style Profiles. Para usá-la, siga estes passos:

1. Escolha um **Image kind** (tipo de imagem), por exemplo retrato ou plano de fundo.
2. Digite um prompt aproximado no campo **Sample input** (entrada de exemplo).
3. Leia as caixas **Final positive prompt** (prompt positivo final) e **Final negative prompt** (prompt negativo final).

A Test bench também mostra uma observação curta sobre a limpeza do prompt. Quando nada muda, ela diz "No cleanup needed for this sample." Quando o prompt é alterado, ela informa quantos trechos duplicados ou fora de lugar foram limpos.

## Como Marinara limpa o prompt

Antes de qualquer pedido de imagem sair do Marinara, o prompt é compilado com o perfil ativo. O compilador faz algumas coisas:

- Remove tags quase duplicadas, como uma tag de qualidade repetida.
- Move frases negativas simples (como "avoid text" ou "no watermark") para o prompt negativo.
- Preserva as suas palavras em imagens de plano de fundo, ilustração e selfie. Em retratos, avatares e sprites, ele destila o seu texto até virar tags visuais curtas que ele reconhece.
- Acrescenta as tags do perfil correspondentes ao tipo de imagem que está sendo criado.

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
- O seu texto foi destilado. Em retratos, o compilador guarda apenas os trechos que reconhece como pistas visuais claras. "red-haired knight" não é um deles, por isso foi descartado.

Se as palavras do seu tema sumirem em um retrato, avatar ou sprite, experimente o tipo de imagem **illustration**. Esse tipo preserva o texto que você escreveu.

## Ordem de prioridade: chat, conexão e depois global

Marinara pode pegar o perfil de estilo em três lugares. Vence sempre a escolha mais específica. A ordem é:

1. Um perfil escolhido explicitamente para o chat ou o jogo atual.
2. O **Style Profile** definido na conexão de imagem, dentro da seção **Local Image Defaults** (padrões locais de imagem) no editor de conexões.
3. O **Default style** global que você definiu na seção **Settings**.

A seção **Local Image Defaults** aparece somente em conexões locais do Stable Diffusion: AUTOMATIC1111 / SD Web UI, ComfyUI e NovelAI. Em todos os outros provedores, a escolha recai direto sobre o **Default style** global. Para definir um perfil por conexão, abra a conexão, expanda a seção **Local Image Defaults** e escolha um perfil no menu suspenso **Style Profile**. Deixe a opção **Use global default** para seguir a escolha global. Quando Marinara consegue adivinhar um bom perfil pelo nome do modelo da conexão, ela mostra um botão "Use ..." que aplica esse perfil com um clique.

## Guias relacionados

- [Provedores de geração de imagens e configuração](image-providers.md)
- [Agente Illustrator](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
