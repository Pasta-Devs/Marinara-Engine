# Storyboards com LTX 2.3 no Game Mode

Este guia conecta um workflow local de imagem para vídeo do LTX 2.3 no ComfyUI aos Storyboards do Game Mode, para que cada quadro do storyboard vire um clipe de vídeo curto. É uma configuração avançada, para jogadores com uma GPU local e o ComfyUI. Alguns jogadores chamam isso de Story Mode. No Marinara, os controles se chamam **Game Mode** e **Storyboards**.

A configuração foi montada com imagens de primeiro quadro do **Krea 2** e com o Image Style **Z-Image Turbo Narrative**. Outras contas de imagem devem funcionar, desde que aceitem prompts de cena descritivos em linguagem natural. O vídeo LTX é renderizado localmente no ComfyUI. Já a imagem do primeiro quadro é local ou hospedada de acordo com a conta de imagem que você escolher.

O caminho completo tem estas etapas:

1. O GM escreve um turno de narração.
2. O Animation Planner devolve um `imagePrompt` e um `narrationBeat`.
3. O `imagePrompt` vai para a conta de imagem e vira a ilustração do primeiro quadro.
4. O `narrationBeat` passa pelo **Narration Passthrough** e vira `%prompt%`.
5. O primeiro quadro e o prompt vão para o workflow do LTX 2.3 no ComfyUI, que cria um clipe MP4.

A ilustração é o primeiro quadro do clipe. O LTX recebe ao mesmo tempo uma imagem de partida e um prompt sobre o que se move em seguida. Se funcionar, um clipe aparece na aba **Videos** (vídeos) da Gallery (galeria).

## Antes de começar

Você precisa de:

1. Um ComfyUI local funcionando e acessível para Marinara. Veja [Configuração de workflows do ComfyUI](../media/comfyui.md).
2. Uma GPU com VRAM suficiente (a memória da sua placa de vídeo). Uma placa de 8 GB pode servir para um primeiro teste em 480p com um quadro-chave.
3. O workflow editável `ltx-director-simple`, ou um grafo equivalente de imagem para vídeo do LTX 2.3 que conclua no ComfyUI, e a exportação dele em formato de API, `ltx-director-simple-api`.
4. Uma conta de imagem no Marinara para as ilustrações do primeiro quadro.
5. O agente **Storyboard**, baixado em **Agents → Agent Organizer** (agentes → Organizador de agentes) e ativado para a partida em **Chat Settings → Agents** (configurações do chat → agentes). Veja [Guia do agente Storyboard](storyboard.md).

O workflow editável e a exportação de API dele são arquivos diferentes. Abra `ltx-director-simple` no ComfyUI, instale todos os nós personalizados que o ComfyUI Manager apontar como ausentes e teste o grafo por lá. Importe `ltx-director-simple-api` no Marinara. A cada mudança de nó ou de modelo, exporte o grafo de novo em formato de API e substitua o JSON na conta do Marinara. Não cole no Marinara o workflow normal do editor visual.

## Prepare o workflow de API do ComfyUI

Primeiro, coloque o workflow editável na fila do ComfyUI com uma imagem de origem real e um prompt simples. Confirme que ele salva um MP4 com áudio.

O caminho simples do Marinara coloca um prompt completo na entrada de prompt global do LTX Director:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

O nó LTX Director continua podendo cuidar do condicionamento de imagem, dos dados de guia, do áudio e dos dois estágios de amostragem. "Simple" quer dizer que Marinara envia um parágrafo coerente de imagem para vídeo, em vez de uma linha do tempo do Prompt Relay.

### Marcadores

Na exportação de API, substitua os valores correspondentes por estes marcadores do Marinara, entre aspas:

| Marcador | Valor que Marinara fornece |
| --- | --- |
| `%prompt%` | O prompt completo vindo do Animation Planner e do template de vídeo |
| `%reference_image_name%` | A imagem do primeiro quadro enviada ao ComfyUI |
| `%duration_seconds%` | A duração do clipe, em segundos |
| `%length%` | A duração como contagem de quadros, no padrão de 16 FPS do Marinara |
| `%fps%` | A taxa de quadros que Marinara usa |
| `%width%`, `%height%` | As dimensões, a partir da resolução e da proporção de tela da conta de vídeo |
| `%seed%` | Uma nova semente aleatória a cada requisição |
| `%model%` | Valor opcional de modelo vindo da conta, quando o workflow não fixa o modelo do nó de carregamento |

Marinara também pode preencher `%length_s%`, `%global_prompt%`, `%local_prompts%` e `%segment_lengths%`. Esses quatro são opcionais. O caminho simples não precisa deles e envia o prompt por `%prompt%`.

A imagem de referência fica dentro do array `segments` do `timeline_data` do LTX Director, que no workflow de API é uma string JSON serializada. `%length%` mantém a duração do clipe dinâmica por meio de `normalDurationFrames`. O segmento de imagem de referência no quadro zero mantém o próprio valor fixo `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- Não coloque `%reference_image_name%` ao lado de `timeline_data` nem em um campo de imagem separado no nível superior.
- Mantenha entre aspas os marcadores de texto, como `%reference_image_name%`.
- Entradas numéricas de nós podem colocar `%length%`, `%duration_seconds%` e `%fps%` entre aspas, porque Marinara converte esses valores em números. Dentro da string serializada de `timeline_data`, deixe `%length%` sem aspas, como no exemplo, para que o valor decodificado seja um número.
- Mantenha a contagem de quadros, os segundos e a taxa de quadros ligados a esses marcadores. Os números que um grafo editável do ComfyUI mostra não são padrões do Marinara.

### Exporte a cada edição

1. Coloque o workflow editável na fila do ComfyUI e confirme que ele cria um MP4 que reproduz normalmente.
2. Selecione **Save (API Format)**, **Export (API)** ou **Export to API**, de acordo com a sua versão do ComfyUI.
3. Adicione ou confira os marcadores no novo JSON de API.
4. Substitua o workflow guardado na conta do Marinara.

Se você excluir um nó e continuar usando uma exportação antiga, sobram referências a um nó que não existe mais. O ComfyUI então recusa a requisição.

## Crie a conta de vídeo

1. Abra **Settings → Connections** (Configurações → Conexões).
2. Clique em **Add account** (adicionar conta) e escolha uma conta **Video Generation** (geração de vídeo).
3. Escolha **ComfyUI**.
4. Informe a **Base URL** (URL base), normalmente `http://127.0.0.1:8188` quando o ComfyUI roda no mesmo computador.
5. Cole o workflow completo em formato de API em **ComfyUI workflow**.
6. Para o primeiro teste com pouca VRAM, escolha seis segundos de duração padrão, **16:9** e 480p.
7. Salve a conta.

Um teste de conexão só com texto não exercita `%reference_image_name%`. Depois de salvar, teste a geração de imagem para vídeo a partir de uma imagem da Gallery ou de um Storyboard.

## Configure o chat de Game Mode

Abra o chat de Game Mode e depois **Chat Settings → Agents**. Ative primeiro **Enable Agents** e **Enable Storyboards**. A apresentação Storyboard Optimized do assistente de configuração não ativa o agente.

### Illustrator

| Configuração | Valor recomendado |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off para este workflow testado |

O Animation Planner já recebe o contexto de aparência dos personagens do turno, por isso **Attach Card Appearance** fica desativado, para não acrescentar essa informação duas vezes. **Storyboard First Frame** também evita repetir a direção de arte da campanha em volta da cena de primeiro quadro já pronta do planner.

**Send Avatar References** controla as imagens de referência enviadas ao serviço de imagem do primeiro quadro. Ele não controla a entrada de primeiro quadro do LTX: o LTX recebe a ilustração pronta por meio de `%reference_image_name%`. Só ative as referências de avatar depois de confirmar que a sua conta de imagem tem suporte a elas e que elas ajudam.

O primeiro quadro pesa muito na qualidade da animação. Ele deve mostrar exatamente o instante anterior ao movimento planejado, com o sujeito, o trajeto, as mãos, a porta, o objeto ou o alvo bem visíveis.

### Scene Videos

| Configuração | Valor recomendado |
| --- | --- |
| **Video model** | A conta do LTX 2.3 no ComfyUI que você criou |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** controla as animações manuais da Gallery e do Game Assets. Os clipes do Storyboard podem usar o próprio prompt sem mudar essas animações.

### Storyboards

| Configuração | Valor inicial recomendado |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normalmente. Comece com 1 no primeiro teste com 8 GB de VRAM. |
| **Animation Clip Duration** | 5 segundos |
| **Viewer Display** | Floating durante os testes |
| **Illustration Planner** | **Still Keyframes** (a alternativa para os turnos sem vídeo) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** é o planner recomendado. Ele planeja um primeiro quadro pronto para animar e um prompt de movimento direto, de 4 a 8 frases, com uma ação principal, um comportamento de câmera, movimento contido em volta dela e áudio relevante ou uma fala curta.
- **LTX Director Storyboard** é uma opção avançada, com uma direção mais detalhada e atenta à duração, e regras de continuidade. Experimente quando o caminho simples estiver estável, ou quando um clipe mais longo precisar de mais fases encadeadas. Os dois usam o mesmo contrato com `%prompt%`.
- Com as animações ativadas, **LTX Simple Image-to-Video** escreve as duas saídas: um `imagePrompt` para o Krea e um `narrationBeat` para o LTX. **Still Keyframes** só é usado nos turnos sem vídeos.
- **Storyboard First Frame** envia ao Krea a cena de primeiro quadro completa, em linguagem natural, escrita pelo planner, sem título de quadro-chave, rótulos de prompt, notas de aparência repetidas ou direção de arte da campanha. Mantenha **Use Storyboard Template** ativado para que ele seja aplicado.
- **Narration Passthrough** passa o `narrationBeat` já pronto do planner pelo contrato de prompt de vídeo, sem mais um resumo da cena.

Cada quadro-chave cria uma tarefa de imagem no Krea e uma tarefa de vídeo local no LTX. Por isso, três quadros-chave disparam três renderizações de imagem e três renderizações de vídeo.

## Faça o primeiro teste

Use um turno de GM já concluído com uma ação visual bem evidente, como abrir uma porta, olhar na direção de um som ou dizer uma frase curta.

1. Para a checagem mais rápida com pouca VRAM, coloque **Keyframes per Turn** em 1 e deixe **Animation Clip Duration** em 5 segundos.
2. Ative as duas configurações automáticas de Storyboard depois que o turno de GM estiver concluído.
3. Abra **Chat Settings → Gallery** e selecione **Create storyboard** (criar storyboard). Isso inicia todo o caminho de ilustração e animação sem esperar por outro turno.
4. Se a revisão de prompt estiver ativada, confira o prompt do primeiro quadro antes de enviá-lo.
5. Confira se o primeiro quadro traz uma pose inicial fisicamente útil.
6. Espere a renderização do primeiro quadro e, depois, o clipe do ComfyUI.
7. Quando o caminho manual funcionar, volte **Keyframes per Turn** para 3 e deixe as duas configurações automáticas ativadas.

Use o visualizador **Floating** durante a configuração, para poder inspecionar cada imagem e cada clipe. Passe para **Background** depois, se quiser a mídia do Storyboard na cena do Game.

Se não funcionou, veja [Solução de problemas](#troubleshooting).

## Como funciona a passagem do prompt

Para cada quadro-chave, o Animation Planner devolve `imagePrompt` (só o primeiro quadro visível, no tempo T=0) e `narrationBeat` (o prompt completo do LTX para o que acontece em seguida). **Storyboard First Frame** formata o `imagePrompt` e o envia ao Krea 2. Depois que a imagem existe, **Narration Passthrough** resolve para `narrationBeat`. Marinara coloca esse texto no campo `prompt` da requisição de vídeo, substitui `%prompt%` no workflow do ComfyUI, envia o primeiro quadro e substitui `%reference_image_name%` pelo nome de arquivo dele no ComfyUI. Você não precisa de dois segmentos de prompt locais. Um único prompt global é o caminho normal.

## Escreva um bom prompt de LTX

A imagem de origem já mostra a aparência, a composição, o cenário, a luz e o estilo. O prompt de vídeo deve tratar do movimento:

- Um parágrafo fluido, no presente.
- Uma ação bem definida que caiba na duração do clipe.
- Movimento de câmera descrito em relação ao sujeito.
- Reações visíveis pelo olhar, pelo rosto, pela postura, pela respiração ou por gestos.
- No máximo um movimento útil do ambiente.
- Som ambiente, efeitos, música ou uma fala curta entre aspas, quando fizer sentido.
- Uma conclusão natural, um movimento de acomodação ou uma breve pausa.

Evite mudanças de cena, cortes, teletransporte, várias ações sem relação entre si, física complexa, coreografia com muita gente, texto exato legível e repetição de detalhes que já aparecem no primeiro quadro.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## Solução de problemas

### O ComfyUI devolve HTTP 400 ou "Prompt outputs failed validation"

O workflow de API não corresponde ao grafo instalado. Procure um nó excluído, um ID de nó órfão, um nó personalizado ausente, uma entrada que uma atualização de nó renomeou ou um nome de arquivo de modelo que não existe mais. Exporte um workflow de API novo a partir do grafo que funciona.

### As imagens são criadas, mas os vídeos não

Verifique **Automatic Storyboard Animations** e o **Video model** do Game Mode. As animações precisam da ilustração do primeiro quadro e de uma conta de vídeo selecionada.

### O LTX não recebe imagem inicial

Confirme que `%reference_image_name%` aparece no workflow de API salvo e alimenta o segmento de imagem do LTX Director. Marinara só envia o primeiro quadro quando esse marcador está presente.

### O clipe deforma, troca os personagens ou vira uma bagunça

Volte para **LTX Simple Image-to-Video**, use um quadro-chave e teste um turno com uma única ação. Uma imagem não consegue virar, de forma limpa, vários lugares, poses e desfechos em um clipe curto. Confira também o primeiro quadro: uma pose inicial confusa torna a animação mais difícil.

### Todas as gerações ficam parecidas demais

Troque qualquer semente de amostragem fixada no código por `%seed%`. Quando tiver um resultado útil, fixe essa semente no workflow temporariamente, só enquanto compara mudanças de prompt ou de amostragem.

### A geração fica sem memória

Comece em 480p. Depois, reduza a duração. Mantenha um quadro-chave por turno durante os testes, feche outros aplicativos que usam a GPU e não deixe um modelo de linguagem local carregado na mesma GPU de pouca VRAM. Um checkpoint quantizado reduz a memória do modelo, mas não a memória usada pelos latentes de vídeo, pelo codificador de texto, pelos VAEs, pelo áudio e pelo upscaling.

### Marinara para de esperar, mas o ComfyUI continua renderizando

Fechar a requisição do navegador ou perder a conexão pode interromper a consulta de status do Marinara sem cancelar uma tarefa que já está na fila do ComfyUI. Confira a fila, o histórico e a pasta de saída do ComfyUI antes de iniciar a mesma renderização de novo.

### O workflow funciona no ComfyUI, mas falha a partir do Marinara

Compare o JSON salvo na conta com a sua exportação de API mais recente. Verifique a URL base, a grafia dos marcadores, os nós personalizados, os caminhos de modelo, o nó de saída, as dimensões e os campos de duração. O grafo editável pode funcionar enquanto Marinara ainda guarda um instantâneo exportado mais antigo.

Para rastreamentos no servidor, ative o log de depuração e procure por `[debug/game/storyboard-video]` e `[video-gen/comfyui]`. Uma requisição saudável mostra o prompt global concluído, o nome do arquivo de imagem de referência enviado, a duração, a contagem de quadros e um ID de prompt na fila do ComfyUI.

## Referência: modelos LTX 2.3

Escolha o formato do modelo de acordo com a família da sua GPU e com a memória que sobra depois que o ComfyUI carrega o codificador de texto, os VAEs e o upscaler. Estes são pontos de partida, não promessas.

| Família de GPU | Ponto de partida prático | Observações |
| --- | --- | --- |
| RTX série 30 (Ampere) | INT8 ConvRot | O ponto de partida de baixa memória para placas das classes 3070, 3080 e 3090. |
| RTX série 40, de 16 a 24 GB | FP8 input-scaled | Usa o caminho FP8 acelerado do hardware Ada. |
| RTX série 40, de 8 a 12 GB | INT8 ConvRot quando o offloading FP8 fica lento demais | Compare os dois no seu workflow. |
| RTX série 50 (Blackwell) | Workflow dev NVFP4 | Exige um ComfyUI, um CUDA e um conjunto de nós compatíveis com NVFP4. |
| RTX 50, workflow distilled existente | FP8 input-scaled | Use este até existir um checkpoint distilled NVFP4 oficial. |

O workflow testado na RTX 3080 usa `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. Esses sufixos são formatos quantizados e caminhos de execução diferentes, e não presets de qualidade que você possa trocar sempre. Os workflows **dev** e **distilled** partem de premissas de amostragem diferentes, então não coloque um checkpoint dev no grafo distilled sem mudar o workflow. Caber o checkpoint não garante que um vídeo mais longo ou de resolução maior também caiba.

O workflow oficial para iniciantes usa `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` e `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Workflows personalizados podem usar outros checkpoints, quantizações, nós de carregamento ou pastas. Os nomes de arquivo salvos no workflow de API precisam ser exatamente iguais aos arquivos que o ComfyUI enxerga. Se você mantém os modelos em outra pasta, como `LTX2/`, atualize os valores dos nós de carregamento e exporte uma cópia nova em formato de API.

Ao compartilhar um workflow, registre o modelo da sua GPU e a VRAM, a versão do ComfyUI, as versões do driver NVIDIA, do CUDA, do PyTorch e do Python, os nós personalizados e as versões deles, os nomes dos arquivos de modelo e as pastas, a resolução, a duração, a quantidade de quadros-chave e o tempo de renderização, e se o Krea 2 rodou localmente ou hospedado.

Referências oficiais:

- [Guia de imagem para vídeo do LTX 2.3](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [Guia de prompts do LTX](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [Model card do LTX 2.3](https://huggingface.co/Lightricks/LTX-2.3)
- [Model card do LTX 2.3 NVFP4](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Exemplos oficiais do LTX 2.3 para ComfyUI](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Pesos FP8 e separados para ComfyUI da comunidade](https://huggingface.co/Kijai/LTX2.3_comfy)

## Guias relacionados

- [Guia do agente Storyboard](storyboard.md)
- [Configuração de workflows do ComfyUI](../media/comfyui.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Game Mode: primeiros passos](getting-started.md)
