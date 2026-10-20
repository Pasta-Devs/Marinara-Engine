# Prompt Overrides para imagen y video

Esta guía cubre los **Prompt Overrides** (plantillas de prompt personalizadas), los editores que cambian las plantillas que Marinara Engine usa para escribir los prompts (instrucciones enviadas a la IA) de generación de imágenes y de video. Muestra dónde están, qué puedes editar y cómo guardar una plantilla propia de forma segura.

## Qué son los Prompt Overrides

Un **Prompt Override** es una plantilla reutilizable para un prompt de medios. Cuando Marinara genera una imagen o un video, primero construye un prompt de texto para el modelo de imagen o de video. Los Prompt Overrides te permiten editar esas plantillas.

Esta función trata solo de los prompts de imagen y de video. No cambia el prompt de texto que se envía a tu modelo de chat durante una conversación o un roleplay. Es una confusión común. Para cambiar el prompt que va a un modelo de chat, usa un Prompt Preset y los Generation Parameters (parámetros de generación) en su lugar. Consulta [Editor de presets y gestor de prompts](presets.md) y [Parámetros de generación](generation-parameters.md).

Algunos términos que se usan más abajo:

- Un **sprite** (imagen del personaje) es una pieza de arte del personaje, como una expresión facial o una pose de cuerpo entero.
- Un **storyboard** (secuencia de viñetas) es un conjunto de fotogramas ilustrados generados a partir de un turno de Game Mode o de un episodio de roleplay completado.

## Dónde encontrarlos

Los editores están en la configuración de la app.

1. Abre **Settings** (Configuración).
2. Haz clic en la pestaña **Generations**.
3. Desplázate hasta el área **Prompt Overrides**, descrita como "Reusable image and video prompt templates" (Plantillas reutilizables de prompt de imagen y video).

Deberías ver ahí dos editores plegables.

## Los dos editores

Haz clic en el título de un editor para expandirlo.

**Video Generation Prompt Overrides** edita plantillas reutilizables para los videos de escena de Game y de la galería, los mensajes de video de Conversation, los clips de personaje de Conversation Call y los retratos animados de expresiones. Cada plantilla de prompt de video controla cómo se describe un tipo de clip al modelo de video.

**Image Generation Prompt Overrides** edita las plantillas que usan los sistemas de imagen, sprite, Game y de construcción de prompts. Esto abarca los selfies de Conversation, los retratos de NPC (personaje no jugador) de Game, el arte de escena, los prompts de storyboard, la plantilla **Noodle Post Image** para las publicaciones de Noodle y otros constructores de imágenes registrados. Cada plantilla de prompt de imagen controla cómo se describe un tipo de imagen al modelo de imagen.

Así, entre los dos editores puedes ajustar los prompts de retratos, selfies, sprites, arte de escena, storyboards y clips de video.

## Editar una plantilla

Cada editor funciona igual. Sigue estos pasos.

1. Abre el editor que quieras.
2. Elige una plantilla en el menú desplegable **Registered prompt**. La lista depende del editor que abriste.
3. Revisa la etiqueta de estado junto al menú desplegable. Muestra **Default** cuando no hay ninguna plantilla personalizada guardada. Muestra **Custom active** cuando tu plantilla guardada está en uso. Muestra **Custom paused** cuando tu plantilla está guardada pero desactivada.
4. Lee la descripción breve bajo el menú desplegable para saber qué hace esta plantilla.
5. En **Available variables**, haz clic en cualquier chip de variable para insertarla en la plantilla. Las variables usan la forma `${name}`, por ejemplo `${charName}`.
6. Edita el texto en el cuadro **Template**.
7. Revisa el cuadro **Rendered preview** debajo. La vista previa rellena tu plantilla con valores de ejemplo para que veas el resultado.
8. Si la vista previa muestra un aviso de **Unknown variables**, corrige la variable mal escrita. Un nombre de variable que no esté en la lista **Available variables** no se rellenará.
9. Haz clic en **Save** (Guardar).

Deberías ver un mensaje "Prompt override saved" (Prompt override guardado) y la etiqueta de estado debería cambiar a **Custom active**.

## Conservar una plantilla sin usarla

El interruptor **Apply this override** está debajo de la vista previa. Su texto de ayuda dice "Turn this off to keep the template saved without using it" (Desactívalo para mantener la plantilla guardada sin usarla). Desactívalo para guardar tu borrador mientras la función sigue usando el valor predeterminado integrado. La etiqueta de estado muestra entonces **Custom paused**.

## Volver a la plantilla integrada

Haz clic en **Reset to Default** para descartar tu plantilla personalizada y usar de nuevo la integrada. Si existe un override guardado, la app te pide que confirmes primero. La etiqueta de estado vuelve a **Default**.

## Cuándo surten efecto los overrides

Un Prompt Override solo importa para las funciones que realmente generan imágenes o video, como los recursos de Game, los selfies y las llamadas de Conversation, los sprites y las imágenes de las publicaciones de Noodle. Esas funciones también necesitan una conexión de generación de imágenes o de video configurada primero. Sin una conexión de generación que funcione, no se ejecuta nada y la plantilla nunca se usa. Consulta [Proveedores de generación de imágenes y configuración](../media/image-providers.md) y [Generación de video de escena](../media/scene-video.md).

## Guías relacionadas

- [Proveedores de generación de imágenes y configuración](../media/image-providers.md)
- [Generación de video de escena](../media/scene-video.md)
- [Perfiles de estilo de imagen](../media/style-profiles.md)
- [Ajustes de Noodle y traspaso del chat](../noodle/settings.md)
- [Editor de presets y gestor de prompts](presets.md)
- [Parámetros de generación](generation-parameters.md)
