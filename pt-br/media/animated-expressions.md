# Expressões animadas

As expressões animadas são pequenas animações em loop usadas como sprites de retrato de um personagem. O sprite é a arte do personagem em pé que Marinara mostra durante um chat. Um sprite de expressão comum é uma imagem parada, como um rosto feliz. A expressão animada aparece no lugar dele e é salva como GIF, um arquivo de imagem que roda sozinho uma animação curta em loop.

Marinara cria uma em duas etapas. Ele pede a uma conta de **Video Generation** (geração de vídeo) um clipe curto da expressão e depois converte o clipe em um GIF em loop no seu computador. Depois de salva, ela funciona como qualquer outro sprite. O agente **Expression Engine**, que você baixa, a mostra quando a cena pede aquela emoção. Veja [Sprites de personagem (expressões e corpo inteiro)](../characters/sprites.md) e [Referência dos agentes para download](../agents/built-in-agents.md).

<a id="before-you-start"></a>

## Antes de começar

Você precisa de duas coisas.

1. Uma conta de vídeo. Veja [Geração de vídeo de cena](scene-video.md) para adicionar uma.
2. O ffmpeg no computador que roda Marinara. O ffmpeg é uma ferramenta de mídia gratuita que converte o clipe em GIF.

Se o ffmpeg estiver faltando, a geração falha na hora com esta mensagem:

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Instale o ffmpeg de um jeito que o sistema consiga encontrá-lo, ou defina a variável de ambiente `FFMPEG_PATH` com o caminho completo do programa ffmpeg. A variável de ambiente é uma configuração que você passa para o servidor antes de ele iniciar.

## Gere expressões animadas

Você usa a mesma janela dos sprites parados.

1. Abra o **Character Editor** (editor de personagem) de um personagem, ou o **Persona Editor** (editor de persona) de uma persona.
2. Abra a aba **Sprites** e depois a categoria **Facial Expressions** (expressões faciais).
3. Clique em **Generate Sprite**. A janela **Generate Sprites** abre.
4. Marque **Generate animated portraits** (gerar retratos animados). A janela muda para o modo animado. O seletor de imagem vira um seletor de vídeo, os controles de grade das folhas de sprites somem e Marinara cria uma expressão por vez.
5. Escolha a sua conta de vídeo.
6. Preencha **Appearance Description** (descrição da aparência) para que o serviço saiba como o personagem é.
7. Escolha as expressões que quer gerar.
8. Clique em **Generate Animated Portrait** para uma expressão, ou em **Generate Animated Portraits** para várias.

Durante o processo, aparece "Generating animated portrait GIFs...". Ao terminar, confira os resultados e clique no botão de salvar para adicioná-los ao personagem ou à persona. Se uma expressão falhar, Marinara mantém as que ficaram prontas e lista os nomes das que falharam, para você tentar de novo.

As expressões animadas demoram mais do que os sprites parados, porque são criadas uma por vez. Comece com poucas.

Com **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar) ativado em **Settings → Generations → Overall Generations** (Configurações → Gerações → Gerações em geral), Marinara faz uma pausa para você ler e editar cada prompt antes que ele vá para o serviço.

## Duração e formato

Toda expressão animada é um clipe de retrato na vertical, em 9:16, e isso não pode ser alterado. Para mudar a duração de cada clipe, abra **Settings → Generations**, encontre **Video Generation** e defina **Animated expression length** (duração da expressão animada). O padrão é 3 segundos. O intervalo vai de 1 a 8 segundos. Marinara salva um GIF pequeno em loop, com 512 pixels de largura. Um clipe mais curto gera um arquivo menor e um loop mais fechado.

<a id="backgrounds-are-not-removed"></a>

## O plano de fundo não é removido

Nos sprites parados, o plano de fundo pode ser removido para o personagem flutuar sobre a cena. As expressões animadas pulam essa limpeza. No modo animado, a caixa de seleção **Prefer clean transparent-style background** apenas acrescenta uma dica ao prompt do vídeo. O texto de ajuda dela diz "GIF transparency is not guaranteed." A etapa de revisão avisa que a limpeza do plano de fundo, o corte da folha e o recorte dos quadros são pulados na saída em GIF. Uma expressão animada pode ficar com um plano de fundo visível. Peça um plano de fundo simples em **Appearance Description** para um visual mais limpo.

## Solução de problemas

- **A geração falha com uma mensagem sobre o ffmpeg**: instale o ffmpeg ou defina `FFMPEG_PATH`. Veja [Antes de começar](#before-you-start).
- **O seletor diz que nenhuma conta de vídeo foi encontrada**: adicione uma antes. Veja [Geração de vídeo de cena](scene-video.md).
- **O botão Generate Sprite está desativado**: em alguns dispositivos, como algumas instalações Android e Termux, Marinara não consegue carregar a biblioteca de imagens. Isso desliga toda a geração de sprites, inclusive a das expressões animadas.
- **O GIF salvo continua mostrando um plano de fundo**: isso é esperado. Veja [O plano de fundo não é removido](#backgrounds-are-not-removed).

## Guias relacionados

- [Sprites de personagem (expressões e corpo inteiro)](../characters/sprites.md)
- [Geração de vídeo de cena](scene-video.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
