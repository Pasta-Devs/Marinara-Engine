# Prompt Overrides para imagen y video

Los Prompt Overrides (plantillas de prompt personalizadas) son editores para las plantillas que Marinara usa para escribir los prompts (las instrucciones enviadas a la IA) de los modelos de imagen y de video. Usa uno para cambiar cómo se describen al modelo los retratos, los selfies, los sprites, el arte de escena, los storyboards o los clips de video.

No cambian el prompt que se envía a tu modelo de chat. Para eso, usa un preset (ajuste guardado). Consulta [Editor de presets y gestor de prompts](presets.md) y [Parámetros de generación](generation-parameters.md).

Un sprite es una pieza de arte del personaje, como una expresión o una pose. Un storyboard es un conjunto de fotogramas ilustrados de un turno de Game Mode o de un episodio de Roleplay terminado.

Antes de empezar: los Prompt Overrides solo importan para las funciones que generan imágenes o video, y esas funciones necesitan primero una cuenta de generación de imágenes o de video. Sin una, la plantilla nunca se usa. Consulta [Proveedores de generación de imágenes y configuración](../media/image-providers.md) y [Generación de video de escena](../media/scene-video.md).

## Encontrar los editores

1. Abre **Settings** (Configuración).
2. Haz clic en la pestaña **Generations** (Generaciones).
3. Desplázate hasta **Prompt Overrides** ("Reusable image and video prompt templates", plantillas reutilizables de prompts de imagen y video).

Ahí hay dos editores. Haz clic en un título para expandirlo.

| Editor | Plantillas que cubre |
| --- | --- |
| **Video Generation Prompt Overrides** | Videos de escena de Game y de la galería, mensajes de video de Conversation, clips de personaje de Conversation Call, retratos animados de expresiones. |
| **Image Generation Prompt Overrides** | Selfies de Conversation, retratos de NPC (personaje no jugador) de Game, arte de escena, prompts de storyboard, la plantilla **Noodle Post Image** y otros constructores de imágenes. |

## Editar una plantilla

1. Abre un editor.
2. Elige una plantilla en **Registered prompt** (Prompt registrado). La lista depende del editor.
3. Revisa la etiqueta de estado que está a su lado y lee la descripción breve bajo el menú desplegable.
4. En **Available variables** (Variables disponibles), haz clic en un chip de variable para insertarla. Las variables se ven así: `${charName}`.
5. Edita el texto en el cuadro **Template** (Plantilla).
6. Revisa **Rendered preview** (Vista previa procesada). Rellena tu plantilla con valores de ejemplo.
7. Corrige cualquier aviso de **Unknown variables** (Variables desconocidas). Un nombre que no está en la lista **Available variables** no se rellena.
8. Haz clic en **Save** (Guardar).

Ves "Prompt override saved" (Anulación del prompt guardada), y la etiqueta cambia a **Custom active**.

| Etiqueta de estado | Significado |
| --- | --- |
| **Default** | No hay ninguna plantilla personalizada guardada. |
| **Custom active** | Tu plantilla guardada está en uso. |
| **Custom paused** | Tu plantilla está guardada pero desactivada. |

## Conservar una plantilla sin usarla

Desactiva **Apply this override** (Aplicar esta anulación), debajo de la vista previa. Su ayuda dice "Turn this off to keep the template saved without using it" (Desactívalo para mantener la plantilla guardada sin usarla). Marinara sigue usando la plantilla integrada, y la etiqueta muestra **Custom paused**.

## Volver a la plantilla integrada

Haz clic en **Reset to Default** (Restablecer al predeterminado). Si hay un override guardado, Marinara te pide que confirmes. La etiqueta vuelve a **Default**.

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](../media/image-providers.md)
- [Generación de video de escena](../media/scene-video.md)
- [Perfiles de estilo de imagen](../media/style-profiles.md)
- [Ajustes de Noodle y traspaso del chat](../agents/noodle-settings.md)
- [Editor de presets y gestor de prompts](presets.md)
- [Parámetros de generación](generation-parameters.md)
