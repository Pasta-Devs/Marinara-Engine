# Expressões animadas

Este guia explica as expressões animadas do Marinara Engine: pequenas animações em loop usadas como sprites de retrato do personagem. O sprite é a arte do personagem em pé que Marinara mostra durante o chat. Com as expressões animadas, esses retratos ganham movimento em vez de ficarem parados.

## O que são as expressões animadas

Um sprite de expressão comum é uma imagem parada, como um rosto feliz ou um rosto bravo. A expressão animada é uma animação curta em loop que aparece no lugar dessa imagem parada. Marinara salva cada uma como um sprite em GIF. GIF é um arquivo de imagem que roda sozinho uma animação curta em loop.

Marinara cria uma expressão animada em duas etapas. Primeiro, pede a uma conexão de **Video Generation** (geração de vídeos) que crie um videoclipe curto da expressão. Depois, converte esse clipe em um sprite GIF em loop na sua máquina.

Depois de salva, a expressão animada funciona como qualquer outro sprite. O agente **Expression Engine**, que você baixa, escolhe a expressão e a mostra quando a cena pede aquela emoção. Veja [Sprites de Personagem](../characters/sprites.md) para entender como os sprites aparecem, e [Referência dos Agentes para Download](../agents/built-in-agents.md) para conhecer o Expression Engine.

## Antes de começar

Duas coisas precisam estar prontas antes de gerar expressões animadas.

1. Uma conexão de **Video Generation**. É um vínculo salvo com um provedor capaz de criar vídeo. Veja [Geração de Vídeo de Cena](scene-video.md) para adicionar uma.
2. O ffmpeg instalado na máquina que roda Marinara. O ffmpeg é uma ferramenta de mídia gratuita que converte o videoclipe em um sprite GIF.

Se o ffmpeg não for encontrado, a geração falha na hora com esta mensagem:

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Para resolver, instale o ffmpeg e verifique se o sistema consegue encontrá-lo. Outra opção: defina a variável de ambiente `FFMPEG_PATH` com o caminho completo do programa ffmpeg. A variável de ambiente é uma configuração que você passa para o servidor antes de ele iniciar.

## Como ativar os retratos animados

As expressões animadas são geradas na mesma janela que você usa para os sprites parados.

1. Abra o **Character Editor** (editor de personagem) do seu personagem, ou o **Persona Editor** (editor de persona) de uma persona.
2. Vá até a aba **Sprites** e escolha a categoria **Facial Expressions**.
3. Clique em **Generate Sprite**. A janela **Generate Sprites** abre.
4. Marque a caixa de seleção **Generate animated portraits**. A janela muda para o modo animado:
   - O seletor de conexão passa de **Image Generation Connection** para **Video Generation Connection**.
   - Os controles de grade das folhas de sprites parados somem.
   - Marinara passa a gerar uma expressão por vez, em vez de uma folha inteira.
5. Escolha a **Video Generation Connection** no menu suspenso.
6. Preencha o campo **Appearance Description** para que o provedor saiba como o personagem é.
7. Escolha quais expressões quer gerar.
8. Clique em **Generate Animated Portrait** para uma expressão, ou em **Generate Animated Portraits** para várias.

Durante o processo, aparece a mensagem "Generating animated portrait GIFs...". Cada expressão vira primeiro um vídeo curto, e depois Marinara converte esse vídeo em um sprite GIF.

Ao terminar a geração, confira os resultados e clique no botão de salvar para adicioná-los ao personagem ou à persona. Se uma expressão falhar, Marinara mantém as que ficaram prontas. Os nomes das que falharam aparecem em uma lista, para você tentar de novo.

## Duração e formato

Toda expressão animada é um clipe de retrato na vertical. O formato é fixo em 9:16 (retrato) e não pode ser alterado.

A duração de cada clipe pode ser alterada. Abra **Settings** (Configurações) e procure a seção **Video Generation**. A configuração se chama **Animated expression length**. O padrão é 3 segundos, e o valor aceito vai de 1 a 8 segundos.

Marinara salva o resultado final como um GIF pequeno em loop, com 512 pixels de largura. Um clipe mais curto gera um arquivo menor e um loop mais rápido e fechado.

## Aviso sobre transparência

Nos sprites parados, o plano de fundo pode ser removido para o personagem flutuar sobre a cena. Com as expressões animadas é diferente: Marinara não faz essa limpeza do plano de fundo.

No modo animado, a caixa de seleção de plano de fundo transparente se chama **Prefer clean transparent-style background**. Ela apenas acrescenta uma dica ao prompt do vídeo. O texto de ajuda diz isso com todas as letras: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

A etapa de revisão confirma a mesma coisa, com este aviso: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." Ou seja, a expressão animada pode ficar com um plano de fundo visível. Peça um plano de fundo simples no campo **Appearance Description** se quiser um visual mais limpo.

## O que esperar

As expressões animadas demoram mais do que os sprites parados. Marinara gera uma expressão por vez, nunca em lote. Escolher muitas expressões de uma vez pode levar bastante tempo, então comece com poucas.

Se você ativou a opção **Expose media prompts before sending** (em **Settings**, na seção **Overall Generations**), Marinara faz uma pausa em uma etapa de revisão do prompt. Assim você lê e edita cada prompt antes que o Marinara o envie ao provedor. Deixe essa configuração desativada para pular a revisão.

## Solução de problemas

A geração falha com uma mensagem sobre o ffmpeg. Instale o ffmpeg e verifique se o servidor consegue encontrá-lo, ou defina a variável de ambiente `FFMPEG_PATH`. Veja a seção "Antes de começar", acima.

O menu suspenso diz que nenhuma conexão de geração de vídeos foi encontrada. Adicione antes uma conexão de **Video Generation**. Veja [Geração de Vídeo de Cena](scene-video.md).

O botão **Generate Sprite** está desativado. Em alguns dispositivos, Marinara não consegue carregar a biblioteca de imagens, o que desliga toda a geração de sprites, inclusive a das expressões animadas. Isso acontece em algumas instalações Android e Termux.

O GIF salvo continua mostrando um plano de fundo. Isso é esperado. As expressões animadas pulam a limpeza do plano de fundo. Veja a seção "Aviso sobre transparência", acima.

## Guias relacionados

- [Sprites de Personagem](../characters/sprites.md)
- [Geração de Vídeo de Cena](scene-video.md)
- [Referência dos Agentes para Download](../agents/built-in-agents.md)
