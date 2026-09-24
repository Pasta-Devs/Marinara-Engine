# LTX Storyboard imagen a video

Estado: seguimiento de simplificación en revisión local.

## Problema

La primera integración de LTX Director Storyboard (storyboard, "secuencia de viñetas") en Marinara dividía cada toma planificada en un prompt (instrucciones enviadas a la IA) global y estable y varios prompts locales separados por barras verticales. Luego la ruta de Storyboard reconocía los ID de plantilla integrados y saltaba el contrato normal de prompt de video para armar una carga útil específica de LTX.

Ese diseño hacía que personalizar el prompt fuera confuso: copiar o editar una plantilla integrada cambiaba su ID y desactivaba en silencio el traspaso especial. También animaba al planificador a repartir demasiadas acciones en un clip corto. Cuando la planificación fallaba, el storyboard genérico de reserva podía pasar un fragmento grande de narración cruda a la generación de video, lo que producía los prompts sobrecargados que se ven en los registros de ejecución.

El flujo de trabajo local de ComfyUI que funciona no necesita esa capa de prompts temporales. LTX 2.3 puede animar el primer fotograma suministrado a partir de un solo prompt directo de imagen a video.

## Decisión de producto

Conserva los ID de plantilla opcionales existentes y los controles de configuración por compatibilidad con los chats guardados, pero simplifica su contrato:

- **LTX Director Storyboard** planifica el primer fotograma y un prompt completo de imagen a video de LTX 2.3 por toma.
- **Storyboard First Frame** da formato a la ilustración exacta de T=0 que se usa como imagen de referencia.
- **Narration Passthrough** es solo `${narrationSummary}` y por eso pasa el prompt completo del planificador por la misma ruta universal de plantilla de video que usa cualquier otro flujo de trabajo.

La ruta de Storyboard no debe inspeccionar esos ID de plantilla, fabricar segmentos locales ni adjuntar una carga útil de prompt específica de LTX. La plantilla de video seleccionada sigue siendo totalmente personalizable.

## Contrato del planificador

Conserva la forma JSON de Storyboard existente:

- `imagePrompt` describe únicamente el primer fotograma exacto en T=0.
- `narrationBeat` es el prompt completo que se envía al modelo de video junto con esa imagen.
- los anclajes de sección y `characters` conservan sus significados actuales.

Para cada `narrationBeat`, sigue la [guía oficial de imagen a video de LTX](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) y la [guía de prompting](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide):

- escribe un párrafo fluido en tiempo presente, con unas 2-4 frases cortas para 1-6 segundos, 3-5 para 7-10 segundos y 4-8 para 11-15 segundos solo cuando la acción admita ese detalle;
- parte del estado que muestra `imagePrompt` y describe lo que ocurre a continuación;
- usa una acción principal y una configuración de cámara para 1-6 segundos, hasta dos fases y configuraciones conectadas para 7-10 segundos, y hasta tres para 11-15 segundos;
- describe cada comportamiento de la cámara en relación con el sujeto y varía el ángulo solo cuando la duración pueda mostrar la transición con claridad;
- expresa las reacciones mediante rostro, mirada, postura, respiración o gestos visibles;
- incluye movimiento ambiental contenido y audio relevante o un breve diálogo entre comillas;
- termina con la acción completándose, asentándose o manteniéndose;
- confía en la imagen de origen para la apariencia estática, la composición, el entorno, la iluminación, la paleta, la textura y el estilo;
- evita cambios de escena, sujetos nuevos, acción sobrecargada, física compleja, texto legible, UI, eventos inventados y cualquier corte o cambio de cámara que no quepa con claridad dentro de la duración.

Empieza simple. Cuatro frases bastan cuando dirigen por completo la toma; el planificador no debe rellenar una acción simple solo para añadir movimiento.

Ejemplo:

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Flujo de datos

1. El planificador devuelve un `imagePrompt` en T=0 y un `narrationBeat` completo por cada toma.
2. La generación de imágenes de Storyboard crea la ilustración de referencia del primer fotograma.
3. La plantilla Narration Passthrough resuelve `${narrationSummary}` al `narrationBeat` de esa toma.
4. La solicitud normal de generación de video lleva el resultado en su campo `prompt` existente.
5. El adaptador de ComfyUI reemplaza `%prompt%` en el flujo de trabajo guardado y suministra la imagen de referencia, las dimensiones, la duración, el número de fotogramas, la semilla y los valores de modelo existentes.

En este flujo no hay ninguna rama de ruta de Storyboard exclusiva de LTX.

## Contrato de ComfyUI

Usa el flujo de trabajo de imagen a video de LTX 2.3 que se sabe que funciona, con los marcadores de posición normales de Marinara. Sus entradas de Director deberían ser:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Mantén `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%` y `%model%` donde el flujo de trabajo ya los espera. Una solicitud de seis segundos sigue siendo de 96 fotogramas bajo el contrato existente de 16 FPS de Marinara.

Los flujos de trabajo guardados más antiguos que usan `%global_prompt%`, `%local_prompts%` y `%segment_lengths%` siguen siendo compatibles: el adaptador asigna un prompt de solicitud ordinario al valor global y deja vacíos los prompts locales y las longitudes de segmento. Esos marcadores de posición son un soporte de compatibilidad, no la configuración de Storyboard recomendada.

## Comportamiento ante fallos

- Si el cliente se desconecta o el planificador se aborta, propaga la cancelación. No sigas generando medios de reserva.
- Si el planificador falla de verdad, el planificador de reserva existente puede conservar el comportamiento de imagen fija, pero omite la generación de video para esa solicitud. La narración cruda no es un prompt de imagen a video seguro.
- Un storyboard suministrado por el cliente y ya revisado sigue siendo apto para la generación de video, porque su prompt ya se revisó aguas arriba.

## Alcance

Este cambio no añade una segunda pasada de modelo de visión sobre la imagen de referencia generada. El planificador ya dirige tanto el primer fotograma como su movimiento inmediato, mientras que la propia imagen condiciona a LTX en el momento de la generación. Una reescritura futura que tenga en cuenta la imagen puede evaluarse por separado si la desviación del primer fotograma resulta significativa.

No se requiere ningún trabajo de UI del cliente, localización, esquema de almacenamiento, migración, versión, reinicio de servicio ni de Marinara-Agents.

## Criterios de aceptación

- El planificador de LTX Storyboard solicita un prompt completo de imagen a video que tenga en cuenta la duración, con fases de acción legibles, dirección de cámara relativa y audio o diálogo opcionales.
- La plantilla Narration Passthrough es exactamente `${narrationSummary}`.
- La ruta de Storyboard no tiene ningún salto por ID de plantilla exacto, saneador de prompts locales ni traspaso específico de LTX.
- Un flujo de trabajo con `global_prompt: "%prompt%"` recibe el prompt completo del planificador; `local_prompts` y `segment_lengths` quedan vacíos.
- Los flujos de trabajo con `%global_prompt%` existentes aún reciben el prompt de solicitud normal como reserva de compatibilidad.
- La cancelación del planificador detiene la operación, y la planificación de reserva genuina omite la generación de video.
- `pnpm regression:prompt`, `pnpm check` y `git diff --check` cubren el parche final.
