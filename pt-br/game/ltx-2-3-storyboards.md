# Storyboards com LTX 2.3 no Game Mode

Neste guia você conecta um workflow local de imagem para vídeo do LTX 2.3 no ComfyUI aos storyboards do Game Mode do Marinara Engine. Alguns jogadores chamam isso de Story Mode; no Marinara, os controles se chamam **Game Mode** (modo de jogo) e **Storyboards**.

A configuração abaixo foi montada com a geração do primeiro quadro pelo **Krea 2** e com o Image Style em linguagem natural **Z-Image Turbo Narrative**. Outras conexões de imagem também devem funcionar, desde que aceitem prompts de cena descritivos em linguagem natural. A renderização do vídeo LTX roda localmente no ComfyUI; já a geração do primeiro quadro é local ou hospedada, de acordo com a conexão de imagem escolhida.

O caminho completo é este:

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

A ilustração gerada é o primeiro quadro do clipe. Assim, o LTX recebe ao mesmo tempo um ponto de partida visual e um prompt (o texto que Marinara envia para a IA) concentrado no que se move em seguida.

## Antes de começar

Você precisa de:

1. Uma instalação local do ComfyUI funcionando e acessível para Marinara.
2. O workflow editável `ltx-director-simple`, ou um grafo equivalente de imagem para vídeo do LTX 2.3 que conclua sem erros dentro do ComfyUI.
3. A exportação em formato de API `ltx-director-simple-api`, usada na conexão do Marinara.
4. Uma conexão de geração de imagens no Marinara para as ilustrações do primeiro quadro.
5. O agente **Storyboard** instalado em **Agents > Download Agents** e ativado para o Game em **Chat Settings > Agents**.

O workflow editável do ComfyUI e a exportação em formato de API são arquivos diferentes. Abra `ltx-director-simple` no ComfyUI, instale todos os nós personalizados que o ComfyUI Manager apontar como ausentes e teste o grafo por lá. Importe `ltx-director-simple-api` na conexão do Marinara. A cada mudança de nó ou de modelo, exporte o grafo de novo em formato de API e substitua o JSON guardado na conexão. Não cole no Marinara o workflow normal do editor visual.

Veja [Configuração de workflows do ComfyUI](../media/comfyui.md) para conhecer o processo geral de exportação e conexão.

## Escolha um modelo LTX 2.3

Escolha o formato do modelo de acordo com a arquitetura da GPU e com a memória que sobra depois que o ComfyUI carrega o codificador de texto, os VAEs e o upscaler. Trate os valores abaixo como ponto de partida, não como garantia de que todo workflow cabe em toda placa.

| Família de GPU | Ponto de partida prático | Observações |
| --- | --- | --- |
| RTX série 30 (Ampere) | INT8 ConvRot | O ponto de partida de baixa memória para placas das classes 3070, 3080 e 3090. |
| RTX série 40 com 16-24 GB | FP8 input-scaled | Usa o caminho FP8 acelerado disponível no hardware da geração Ada. |
| RTX série 40 com 8-12 GB | INT8 ConvRot quando o offloading FP8 fica lento demais | Compare os dois no workflow real; a VRAM disponível e o comportamento do offloading continuam pesando. |
| RTX série 50 (Blackwell) | Workflow dev NVFP4 | Exige um ComfyUI, um CUDA e um conjunto de nós compatíveis com NVFP4. |
| RTX série 50 usando o workflow distilled atual | FP8 input-scaled | Use esse caminho de compatibilidade até sair um checkpoint distilled NVFP4 oficial. |

O workflow testado na RTX 3080 usa:

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

Esses sufixos descrevem formatos de modelo quantizado e caminhos de execução diferentes, e não níveis de qualidade que possam ser trocados um pelo outro em qualquer situação:

- **INT8 ConvRot** é o caminho prático de baixa memória adotado pela comunidade para placas RTX série 30 e placas Ada menores.
- **FP8 input-scaled** usa operações matriciais FP8 aceleradas, mais ou menos a partir do hardware NVIDIA da série RTX 40.
- **NVFP4** é o caminho nativo de quatro bits do Blackwell, usado pelo workflow da série RTX 50.
- Os workflows **dev** e **distilled** partem de premissas de amostragem diferentes. Não coloque um checkpoint dev no grafo distilled anexado sem ajustar o workflow.

Uma placa de 8 GB deve começar em 480p e com um quadro-chave no primeiro teste de integração. Caber o checkpoint não garante que um vídeo mais longo ou de resolução maior também caiba, porque os latentes de vídeo, o codificador de texto, os VAEs, o áudio e o upscaling também consomem memória.

O workflow oficial para iniciantes usa estes componentes:

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Workflows personalizados podem usar um checkpoint distilled v1.1, uma quantização de terceiros, nós de carregamento diferentes ou outras pastas de modelo. Os nomes de arquivo salvos no workflow de API precisam ser exatamente iguais aos arquivos visíveis para o ComfyUI.

Referências oficiais:

- [Guia de imagem para vídeo do LTX 2.3](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Guia de prompts do LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Model card do LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Model card do LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Exemplos oficiais do LTX 2.3 para ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Pesos FP8 e separados para ComfyUI da comunidade](https://huggingface.co/Kijai/LTX2.3_comfy)

## Prepare o workflow de API do ComfyUI

Antes de tudo, execute o workflow editável direto no ComfyUI, com uma imagem de origem real e um prompt simples. Confirme que ele salva um MP4 com áudio antes de adaptar a exportação de API para Marinara.

O caminho simples do Marinara usa um prompt completo na entrada de prompt global do LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

O nó LTX Director continua podendo cuidar do condicionamento de imagem, dos dados de guia, do áudio e dos dois estágios de amostragem. "Simples" se refere ao contrato do prompt: Marinara envia um parágrafo coerente de imagem para vídeo, em vez de uma linha do tempo do Prompt Relay.

### Marcadores obrigatórios

Substitua os valores correspondentes na exportação de API pelos marcadores do Marinara entre aspas:

| Marcador | Valor fornecido |
| --- | --- |
| `%prompt%` | O prompt completo produzido pelo Animation Planner do Storyboard e pelo template de vídeo selecionados |
| `%reference_image_name%` | A imagem do primeiro quadro enviada ao ComfyUI |
| `%duration_seconds%` | A duração do clipe do Storyboard, em segundos |
| `%length%` | A duração convertida para o contrato de 16 FPS do Marinara |
| `%fps%` | A taxa de quadros que Marinara usa no clipe |
| `%width%`, `%height%` | As dimensões escolhidas a partir da resolução e da proporção de tela da conexão de vídeo |
| `%seed%` | Uma nova semente aleatória para a requisição |
| `%model%` | Valor opcional de modelo vindo da conexão, quando o workflow não fixa o modelo no nó de carregamento |

A imagem de referência fica dentro do array `segments` do `timeline_data` do LTX Director. No workflow de API, `timeline_data` é uma string JSON serializada. O marcador `%length%` mantém a duração do clipe dinâmica por meio de `normalDurationFrames`. Já o segmento de imagem de referência no quadro zero mantém de propósito o próprio valor curto e fixo `"length":16`:

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

Não coloque o marcador `%reference_image_name%` ao lado de `timeline_data` nem em um campo de imagem separado no nível superior. Mantenha a contagem de quadros, os segundos e a taxa de quadros ligados às entradas externas do workflow, com `%length%`, `%duration_seconds%` e `%fps%`. Os valores numéricos que aparecem em um grafo editável do ComfyUI não são padrões do Marinara.

Mantenha entre aspas os marcadores de texto, como `%reference_image_name%`. Entradas numéricas exatas de nós podem colocar `%length%`, `%duration_seconds%` e `%fps%` entre aspas, porque Marinara converte esses valores em números. Dentro da string serializada de `timeline_data`, deixe o marcador `%length%` sem aspas, como no exemplo, para que o valor decodificado da linha do tempo seja numérico.

### Exporte a cada edição

1. Execute o workflow editável no ComfyUI.
2. Confirme que o grafo atual produz um MP4 que reproduz normalmente.
3. Selecione **Save (API Format)**, **Export (API)** ou **Export to API**.
4. Adicione ou confira os marcadores no novo JSON de API.
5. Substitua o workflow guardado na conexão do Marinara.

Se você excluir um nó e continuar usando uma exportação de API antiga, podem sobrar referências a um nó que não existe mais. Nesse caso, o ComfyUI recusa a requisição antes mesmo de a geração começar.

## Crie a conexão de vídeo no Marinara

1. Abra **Settings** (Configurações) e depois **Connections** (Conexões).
2. Adicione uma conexão do tipo **Video Generation** (geração de vídeos).
3. Escolha **ComfyUI**.
4. Informe a URL base do ComfyUI, normalmente `http://127.0.0.1:8188` quando ele roda no mesmo computador.
5. Cole o workflow completo em formato de API no campo **ComfyUI Workflow**.
6. Escolha seis segundos de duração padrão, **16:9** e 480p para o primeiro teste com pouca VRAM.
7. Salve a conexão.

Um teste de conexão apenas com texto não exercita `%reference_image_name%`. Valide o caminho de imagem para vídeo a partir de uma imagem da galeria ou de um Storyboard depois de salvar a conexão.

## Configure o chat de Game Mode

Abra o chat de Game Mode, depois abra **Chat Settings** (configurações do chat) e selecione **Agents**. Ative **Enable Agents** e **Enable Storyboards** antes de configurar as seções abaixo. A apresentação Storyboard Optimized do assistente de configuração do novo jogo não ativa o agente.

### Illustrator

| Configuração | Valor recomendado |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off para este workflow testado |

O Animation Planner já recebe o contexto de aparência dos personagens daquele turno do Storyboard. Por isso, esta configuração deixa **Attach Card Appearance** desativado, para não anexar a mesma informação de novo na formatação final da imagem. **Storyboard First Frame** também evita repetir a direção de arte da campanha em volta da cena T=0 já pronta do planner.

**Send Avatar References** controla as imagens de referência enviadas ao provedor de imagem do primeiro quadro; não controla a entrada de primeiro quadro do LTX. O LTX recebe a ilustração final do Storyboard por meio de `%reference_image_name%`. Deixe as referências de avatar desativadas nesta configuração testada com o Krea. Ative-as separadamente só depois de confirmar que a conexão de imagem escolhida tem suporte a elas e ganha algo com isso.

A imagem do primeiro quadro pesa muito na qualidade da animação. Ela deve mostrar exatamente o instante anterior ao movimento planejado, com o sujeito, o trajeto, as mãos, a porta, o objeto ou o alvo bem visíveis.

### Scene Videos

| Configuração | Valor recomendado |
| --- | --- |
| **Video Connection** | A conexão do LTX 2.3 no ComfyUI criada acima |
| **Game Video Prompt** | **Narration Passthrough** |

A configuração geral **Game Video Prompt** controla as animações manuais da galeria e do Game Assets. Os clipes do Storyboard podem escolher o próprio prompt sem mexer nessas outras ações de animação.

### Storyboards

Use este perfil de partida:

| Configuração | Valor inicial recomendado |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normalmente; comece com 1 no primeiro teste de 8 GB de VRAM |
| **Animation Clip Duration** | 5 segundos |
| **Viewer Display** | Floating durante os testes |
| **Illustration Planner** | **Still Keyframes**; fica como alternativa apenas para imagens estáticas |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

**LTX Simple Image-to-Video** é o padrão recomendado. Ele planeja um primeiro quadro pronto para animar e um prompt de movimento direto, de 4 a 8 frases. A preferência é por uma ação principal, um comportamento de câmera, movimento contido do ambiente e áudio relevante ou uma fala curta.

**LTX Director Storyboard** continua disponível como opção avançada. Ele entrega uma direção mais detalhada, atenta à duração, e regras de continuidade. Experimente depois que o caminho simples estiver estável, ou quando um clipe mais longo realmente precisar de mais fases encadeadas. Os dois planners usam o mesmo contrato de workflow com `%prompt%`.

**Illustration Planner: Still Keyframes** não cria o prompt do Krea enquanto as animações estão ativadas. No modo de animação, **LTX Simple Image-to-Video** cria as duas saídas: um `imagePrompt` em linguagem natural para o Krea e um `narrationBeat` para o LTX. Still Keyframes continua selecionado só para os turnos gerados sem vídeos.

**Storyboard First Frame** entrega ao Krea a cena T=0 completa, em linguagem natural, escrita pelo Animation Planner, sem acrescentar título de quadro-chave, rótulos de prompt, notas de aparência repetidas ou direção de arte da campanha. Mantenha **Use Storyboard Template** ativado para que esse formatador realmente seja aplicado.

**Narration Passthrough** é propositalmente enxuto. Ele passa o `narrationBeat` já pronto do Animation Planner pelo contrato universal de prompt de vídeo, sem cercá-lo de mais um resumo da cena.

Cada quadro-chave cria um trabalho de imagem no Krea e um trabalho de vídeo local no LTX. Três quadros-chave, portanto, disparam três renderizações de primeiro quadro e três renderizações de vídeo. Em uma GPU com 8 GB de VRAM, comece com um quadro-chave em 480p. Quando isso funcionar, avance para três quadros-chave e resoluções maiores.

## Faça o primeiro teste

Use um turno de GM já concluído com uma ação visual bem evidente, como abrir uma porta, olhar na direção de um som, dar alguns passos ou dizer uma frase curta.

1. Para a checagem mais rápida com pouca VRAM, coloque **Keyframes per Turn** temporariamente em 1 e mantenha **Animation Clip Duration** em 5 segundos. O perfil testado normal usa 3 quadros-chave.
2. Ative as duas configurações automáticas de Storyboard depois que o turno de GM atual já estiver concluído.
3. Abra a galeria e escolha **Create storyboard** para aquele turno de GM concluído. Isso inicia manualmente todo o caminho de ilustração e animação, sem esperar por outro turno.
4. Se a exibição do prompt estiver ativada, revise o prompt do primeiro quadro antes de enviá-lo.
5. Confirme que o primeiro quadro gerado traz uma pose inicial fisicamente útil.
6. Espere a renderização do primeiro quadro e, em seguida, a conclusão do clipe no ComfyUI.
7. Depois que o caminho manual funcionar, devolva **Keyframes per Turn** para 3 e deixe as duas configurações automáticas ativadas para os próximos turnos.

Use o modo de visualização **Floating** durante a configuração, porque assim fica mais fácil inspecionar cada imagem e cada clipe. Passe para **Background** quando o workflow estiver confiável, caso queira a mídia do storyboard integrada à cena do Game Mode.

## Como funciona a passagem do prompt

Para cada quadro-chave, o Animation Planner devolve:

- `imagePrompt`: só o primeiro quadro visível, no tempo T=0;
- `narrationBeat`: o prompt completo de imagem para vídeo do LTX, descrevendo o que acontece em seguida.

O Animation Planner selecionado escreve os dois campos. **Storyboard First Frame** formata o `imagePrompt` e envia essa cena T=0 em linguagem natural para o Krea 2. Depois que a imagem existe, **Narration Passthrough** resolve para `narrationBeat`. Marinara coloca esse texto no campo `prompt` da requisição de vídeo normal, substitui `%prompt%` no workflow do ComfyUI, envia o primeiro quadro e substitui `%reference_image_name%` pelo nome de arquivo dele no ComfyUI.

Não é necessário criar dois segmentos de prompt locais. Um único prompt global é o caminho normal para esses presets de Storyboard.

## O que faz um bom prompt de LTX

A imagem de origem já descreve a aparência dos personagens, a composição, o cenário, a iluminação, a paleta e a textura. O prompt de vídeo deve se concentrar no movimento:

- um parágrafo fluido no presente;
- uma ação bem definida que caiba na duração do clipe;
- movimento de câmera descrito em relação ao sujeito;
- reações visíveis pelo olhar, pelo rosto, pela postura, pela respiração ou por gestos;
- no máximo um movimento útil do ambiente;
- som ambiente, efeitos, música ou uma fala curta entre aspas, quando fizer sentido;
- uma conclusão natural, um movimento de acomodação ou uma breve pausa no fim.

Evite mudanças de cena, cortes, teletransporte, várias ações sem relação entre si, física complexa, coreografia com muita gente, texto exato legível e listas repetidas de detalhes que já aparecem no primeiro quadro.

Exemplo:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Registre uma configuração reproduzível

Um resultado "em 8 GB" depende de bem mais que o checkpoint. Ao compartilhar o workflow, registre:

- o modelo exato da GPU e a VRAM;
- a versão ou o commit do ComfyUI;
- as versões do driver NVIDIA, do CUDA, do PyTorch e do Python;
- os pacotes de nós personalizados necessários e as versões deles;
- os nomes exatos dos arquivos de modelo e as pastas do ComfyUI onde ficam;
- a resolução de saída, a duração, a quantidade de quadros-chave e o tempo aproximado de renderização;
- se o Krea 2 roda localmente ou por uma conexão de imagem hospedada naquela configuração.

O JSON de API anexado guarda um retrato dos IDs de nós, dos caminhos de modelo e dos nomes das entradas. Quem mantém os modelos em outra pasta, como `LTX2/`, precisa atualizar os valores dos nós de carregamento e exportar uma cópia nova em formato de API. Um workflow que roda na instalação do ComfyUI do autor ainda pode falhar em outro lugar quando um nó personalizado ou um caminho de modelo é diferente.

## Solução de problemas

### O ComfyUI devolve HTTP 400 ou "Prompt outputs failed validation"

O workflow de API não corresponde ao grafo instalado no momento. Procure por um nó excluído, um ID de nó órfão, um nó personalizado ausente, uma entrada renomeada por uma atualização de nó ou um nome de arquivo de modelo que não existe mais. Exporte um workflow de API novo a partir do grafo que funciona no ComfyUI.

### As imagens são criadas, mas os vídeos não

Verifique **Automatic Storyboard Animations** e a **Video Connection** do Game Mode. As animações precisam da ilustração do primeiro quadro e de uma conexão de vídeo selecionada.

### O LTX não recebe imagem inicial

Confirme que `%reference_image_name%` aparece no workflow de API salvo e alimenta o segmento de imagem do LTX Director. Marinara só envia o primeiro quadro quando esse marcador está presente.

### O clipe deforma, troca os personagens ou vira uma bagunça

Volte para **LTX Simple Image-to-Video**, use um quadro-chave e teste um turno com uma única ação. Uma imagem de origem não consegue virar, de forma limpa, vários lugares, poses e desfechos dentro de um clipe curto e contínuo. Confira também o primeiro quadro: uma pose inicial confusa cria um problema de animação mais difícil, mesmo com um bom prompt de movimento.

### Todas as gerações ficam parecidas demais

Troque qualquer semente de amostragem fixada no código por `%seed%`. Quando aparecer um resultado bom, fixe essa semente no workflow apenas de forma temporária, só para comparar mudanças de prompt ou de amostragem.

### A geração fica sem memória

Comece em 480p. Se precisar, reduza a duração em seguida. Mantenha um quadro-chave por turno durante os testes, feche outros aplicativos que usam a GPU e evite deixar um modelo de linguagem local carregado na mesma GPU de pouca VRAM. Um checkpoint quantizado reduz a memória do modelo, mas não remove a memória usada pelos latentes de vídeo, pelo codificador de texto, pelos VAEs, pelo áudio e pelo upscaling.

### Marinara para de esperar, mas o ComfyUI continua renderizando

Fechar a requisição do navegador ou perder a conexão do cliente pode interromper a consulta de status feita por Marinara sem cancelar um trabalho já na fila do ComfyUI. Confira a fila, o histórico e a pasta de saída do ComfyUI antes de iniciar a mesma renderização de novo.

### O workflow funciona no ComfyUI, mas falha a partir do Marinara

Compare o JSON salvo na conexão com a exportação de API mais recente. Verifique a URL base, a grafia dos marcadores, os nós personalizados necessários, os caminhos de modelo, o nó de saída, as dimensões e os campos de duração. O grafo editável pode estar funcionando enquanto Marinara ainda guarda um retrato exportado mais antigo.

Para rastreamentos detalhados no servidor, ative o log de depuração e procure por `[debug/game/storyboard-video]` e `[video-gen/comfyui]`. Uma requisição saudável mostra o prompt global concluído, o nome do arquivo de imagem de referência enviado, a duração, a contagem de quadros e um ID de prompt na fila do ComfyUI.

## Guias relacionados

- [Guia do agente Storyboard](storyboard.md)
- [Configuração de workflows do ComfyUI](../media/comfyui.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Game Mode: primeiros passos](getting-started.md)
