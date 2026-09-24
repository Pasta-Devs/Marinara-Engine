# Imagem para vídeo com o LTX Storyboard

Status: acompanhamento da simplificação em revisão local.

## Problema

A primeira integração do LTX Director Storyboard no Marinara dividia cada plano previsto em um prompt global fixo (o texto que Marinara envia para a IA) e vários prompts locais separados por barra vertical. A rota do Storyboard reconhecia os IDs dos templates internos (o template é o prompt-base que já vem no aplicativo e você pode editar), ignorava o contrato normal de prompt de vídeo e montava um payload específico do LTX.

Esse desenho tornava a personalização do prompt imprevisível: copiar ou editar um template interno mudava o ID e desativava a passagem especial sem avisar ninguém. Ele também incentivava o planejador a espalhar ações demais por um clipe curto. Quando o planejamento falhava, o storyboard genérico de reserva podia mandar um trecho grande de narração bruta para a geração de vídeos, o que produzia os prompts sobrecarregados vistos nos logs de execução.

O workflow local do ComfyUI que funciona não precisa dessa camada de prompts temporais. O LTX 2.3 anima o primeiro quadro fornecido a partir de um único prompt direto de imagem para vídeo.

## Decisão de produto

Os IDs de template e os controles de configuração que você precisa ativar continuam existindo, por compatibilidade com os chats salvos, mas o contrato deles fica mais simples:

- **LTX Director Storyboard** planeja o primeiro quadro e um prompt completo de imagem para vídeo do LTX 2.3 por plano.
- **Storyboard First Frame** formata a ilustração exata de T=0 usada como imagem de referência.
- **Narration Passthrough** contém apenas `${narrationSummary}` e, por isso, entrega o prompt já pronto do planejador pelo mesmo caminho universal de template de vídeo que todos os outros workflows usam.

A rota do Storyboard não pode inspecionar esses IDs de template, fabricar segmentos locais nem anexar um payload de prompt específico do LTX. O template de vídeo escolhido continua totalmente personalizável.

## Contrato do planejador

O formato JSON do Storyboard continua o mesmo:

- `imagePrompt` descreve apenas o primeiro quadro exato em T=0.
- `narrationBeat` é o prompt completo enviado ao modelo de vídeo junto com essa imagem.
- As âncoras de seção e `characters` mantêm o significado que já tinham.

Para cada `narrationBeat`, siga o [guia oficial de imagem para vídeo do LTX](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) e o [guia de prompts](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide):

- escreva um parágrafo corrido no presente, com cerca de 2-4 frases curtas para 1-6 segundos, 3-5 para 7-10 segundos e 4-8 para 11-15 segundos, apenas quando a ação sustentar esse nível de detalhe;
- parta do estado mostrado em `imagePrompt` e descreva o que acontece em seguida;
- use uma ação principal e uma configuração de câmera para 1-6 segundos, até duas fases e configurações encadeadas para 7-10 segundos e até três para 11-15 segundos;
- descreva cada comportamento de câmera em relação ao sujeito e varie o ângulo só quando a duração permitir mostrar a transição com clareza;
- expresse as reações pelo rosto visível, pelo olhar, pela postura, pela respiração ou pelos gestos;
- inclua movimento contido no ambiente e áudio relevante ou uma fala curta entre aspas;
- termine com a ação se completando, se acomodando ou se sustentando;
- deixe que a imagem de origem cuide da aparência estática, da composição, do cenário, da iluminação, da paleta, da textura e do estilo;
- evite mudanças de cena, sujeitos novos, ação sobrecarregada, física complexa, texto legível, interface, eventos inventados e qualquer corte ou troca de câmera que não caiba com clareza na duração.

Comece simples. Quatro frases bastam quando dirigem o plano por completo; o planejador não deve inflar uma ação simples só para acrescentar movimento.

Exemplo:

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Fluxo dos dados

1. O planejador devolve um `imagePrompt` de T=0 e um `narrationBeat` completo para cada plano.
2. A geração de imagens do Storyboard cria a ilustração de referência do primeiro quadro.
3. O template Narration Passthrough resolve `${narrationSummary}` para o `narrationBeat` daquele plano.
4. A requisição normal de geração de vídeos leva o resultado no campo `prompt` que já existe.
5. O adaptador do ComfyUI substitui `%prompt%` no workflow salvo e fornece a imagem de referência, as dimensões, a duração, a quantidade de quadros, a seed e os valores de modelo que já existiam.

Nesse fluxo não existe nenhum desvio de rota do Storyboard exclusivo do LTX.

## Contrato do ComfyUI

Use o workflow de imagem para vídeo do LTX 2.3 que se sabe funcionar, com os marcadores normais do Marinara. As entradas do Director devem ficar assim:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Mantenha `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%` e `%model%` onde o workflow já espera encontrá-los. Uma requisição de seis segundos continua com 96 quadros, de acordo com o contrato de 16 FPS que Marinara já usa.

Workflows salvos mais antigos, que usam `%global_prompt%`, `%local_prompts%` e `%segment_lengths%`, continuam compatíveis: o adaptador mapeia um prompt de requisição comum para o valor global e deixa os prompts locais e os tamanhos de segmento vazios. Esses marcadores existem por compatibilidade e não são a configuração recomendada do Storyboard.

## Comportamento em caso de falha

- Se o cliente se desconectar ou o planejador abortar, propague o cancelamento. Não continue gerando mídia de reserva.
- Se o planejador falhar de verdade, o planejador de reserva pode preservar o comportamento de imagem estática, mas a geração de vídeos daquela requisição deve ser pulada. Narração bruta não é um prompt seguro de imagem para vídeo.
- Um storyboard revisado e enviado pelo cliente continua elegível para a geração de vídeos, porque o prompt dele já passou por revisão antes.

## Escopo

Esta mudança não acrescenta uma segunda passagem de modelo de visão sobre a imagem de referência gerada. O planejador já dirige tanto o primeiro quadro quanto o movimento imediato dele, e a própria imagem condiciona o LTX na hora da geração. Uma reescrita futura com consciência da imagem pode ser avaliada à parte, caso o desvio do primeiro quadro se mostre relevante.

Não é preciso mexer na interface do cliente, na localização, no esquema de armazenamento, em migração, em versão, em reinício de serviço nem nos Marinara-Agents.

## Critérios de aceitação

- O planejador do LTX Storyboard pede um único prompt completo de imagem para vídeo, com consciência da duração, fases de ação legíveis, direção de câmera relativa e áudio ou fala opcionais.
- O template Narration Passthrough é exatamente `${narrationSummary}`.
- A rota do Storyboard não tem desvio por ID exato de template, nem sanitizador de prompt local, nem passagem específica do LTX.
- Um workflow com `global_prompt: "%prompt%"` recebe o prompt completo do planejador; `local_prompts` e `segment_lengths` ficam vazios.
- Workflows `%global_prompt%` já existentes continuam recebendo o prompt normal da requisição como reserva de compatibilidade.
- O cancelamento do planejador interrompe a operação, e o planejamento de reserva de verdade pula a geração de vídeos.
- `pnpm regression:prompt`, `pnpm check` e `git diff --check` cobrem o patch final.
