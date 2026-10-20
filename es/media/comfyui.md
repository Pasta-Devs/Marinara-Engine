# Configuración del flujo de trabajo de ComfyUI

Marinara Engine puede enviar solicitudes de generación de imágenes y de video a un servidor local de ComfyUI, y solicitudes de imágenes a un endpoint de RunPod Serverless que ejecuta ComfyUI. Una conexión de imagen local puede usar el flujo de trabajo básico integrado de Marinara, mientras que las conexiones de video y las configuraciones avanzadas de imágenes usan un flujo de trabajo personalizado en formato API.

El JSON del flujo de trabajo que pegas en Marinara es una instantánea. Marinara no mantiene un enlace en vivo con el flujo de trabajo abierto en ComfyUI. Cada vez que cambies el flujo de trabajo en ComfyUI, pruébalo de nuevo, expórtalo de nuevo y reemplaza el JSON guardado en la conexión de Marinara.

## Antes de empezar

Instala ComfyUI, agrega los checkpoints y los nodos personalizados que tu flujo de trabajo necesite, e inicia su servidor. La dirección local habitual es `http://127.0.0.1:8188`.

Si ComfyUI se ejecuta en otra computadora de tu red doméstica, su servidor debe escuchar en una dirección que Marinara pueda alcanzar. Las conexiones de imagen también requieren `IMAGE_LOCAL_URLS_ENABLED=true` en el `.env` de Marinara; consulta la [Referencia de configuración del servidor](../CONFIGURATION.md). Revisa el firewall de la otra computadora si la conexión sigue fallando.

Puede que un modelo de lenguaje local y un modelo de imagen no quepan al mismo tiempo en la memoria de la GPU, sobre todo en una tarjeta de 8 GB. La cola de imágenes de Marinara evita que varios trabajos de imagen se ejecuten juntos, pero no puede hacer que dos modelos cargados quepan en la misma VRAM. Si te quedas sin memoria, usa un modelo de lenguaje en la nube o alojado por separado, ejecuta ComfyUI en otro dispositivo, o descarga un modelo antes de usar el otro.

## Crear la conexión de Marinara

1. Abre **Connections** (Conexiones) y crea una nueva conexión de **Image Generation** (Generación de imágenes).
2. Elige **ComfyUI** para un servidor local o **RunPod Serverless (ComfyUI)** para un endpoint de RunPod.
3. Para ComfyUI local, ingresa su Base URL. No se requiere API key (clave de API). Si el campo **ComfyUI Workflow** (Flujo de trabajo de ComfyUI) está vacío, Marinara usa un flujo de trabajo básico integrado de texto a imagen.
4. Para RunPod, ingresa tu API key y tu Endpoint ID. Se requiere un flujo de trabajo personalizado.
5. Configura **Local Image Defaults** (Valores predeterminados de imagen local). Estos valores reemplazan los marcadores de posición correspondientes en tu flujo de trabajo.
6. Guarda la conexión y usa **Test Image** (Probar imagen) después de agregar el flujo de trabajo.

## Construir y exportar un flujo de trabajo

1. Crea un flujo de trabajo aparte en ComfyUI para Marinara.
2. Configura y conecta tu checkpoint, LoRAs, VAE, codificadores de prompt, nodos de imagen latente o de entrada de imagen, el sampler y los nodos de salida como de costumbre.
3. Encola el flujo de trabajo en ComfyUI y confirma que produce la imagen esperada.
4. Incluye un nodo de salida. **SaveImage** es la opción más segura porque Marinara lee las imágenes o animaciones terminadas desde el historial del flujo de trabajo de ComfyUI.
5. Guarda el flujo de trabajo editable con un nombre reconocible, como `Marinara_Workflow`.
6. Exporta el flujo de trabajo en formato API. Según la versión del frontend de ComfyUI, esta acción puede llamarse **Save (API Format)**, **Export (API)** o **Export to API**. Si está oculta, activa las opciones de desarrollador o de modo dev de ComfyUI.
7. Abre el archivo `.json` exportado en un editor de texto.

Un flujo de trabajo en formato API es diferente del flujo de trabajo normal del editor visual. Sus claves de nivel superior son IDs de nodo, y cada nodo normalmente contiene `class_type` e `inputs`. Exporta la versión API; no pegues el archivo del flujo de trabajo normal que contiene el diseño visual del editor.

<a id="comfyui-video-workflows"></a>

## Flujos de trabajo de video de ComfyUI

Crea una conexión de **Video Generation** (Generación de video), elige **ComfyUI** y pega un flujo de trabajo en formato API en el campo obligatorio **ComfyUI Workflow**. WAN 2.2 y otros grafos de video locales son compatibles siempre que el mismo flujo de trabajo se ejecute en ComfyUI y guarde un MP4 mediante una salida como el nodo central **SaveVideo**.

Los flujos de trabajo de video pueden usar estos marcadores de posición entre comillas:

| Marcador de posición     | Valor proporcionado por Marinara                                    |
| ------------------------ | ------------------------------------------------------------------- |
| `%prompt%`               | El prompt compilado de la escena o de la animación.                 |
| `%width%`, `%height%`    | `832×480` para 480p o `1280×720` para 720p, invertidos para 9:16.   |
| `%seed%`                 | Una nueva semilla aleatoria de 32 bits.                             |
| `%length%`               | Duración del clip como número de fotogramas a 16 fps.               |
| `%model%`                | El valor Model de la conexión, cuando hay uno definido.             |
| `%reference_image_name%` | El nombre de archivo del primer fotograma subido para un nodo **LoadImage** de ComfyUI. |

Marinara encola el flujo de trabajo mediante `/prompt`, consulta `/history` y descarga el MP4 nombrado en una salida `gifs` o `images`. Las acciones de imagen a video proporcionan `%reference_image_name%`; las pruebas de conexión solo de texto no lo hacen, así que mantén esa entrada opcional cuando el mismo flujo de trabajo deba admitir ambas.

Los renderizados locales de WAN pueden superar los 30 minutos en GPUs de gama media. Los trabajos de video de ComfyUI usan `VIDEO_GEN_TIMEOUT_MS`, no el `COMFYUI_GEN_TIMEOUT` que es solo para imágenes; aumenta el tiempo de espera de video y reinicia Marinara si un flujo de trabajo válido se corta antes de tiempo.

## Agregar marcadores de posición de Marinara

Reemplaza los valores que Marinara debe controlar con los marcadores de posición de abajo.

Para una conexión de **ComfyUI local**, mantén cada marcador de posición dentro de las comillas del JSON. Marinara primero analiza el flujo de trabajo y luego convierte un marcador de posición numérico exacto como `"%width%"` en un número real. Por eso sigue siendo válido para los nodos que requieren una entrada numérica.

Para una conexión de **RunPod Serverless (ComfyUI)**, mantén entre comillas los marcadores de posición de texto como `"%prompt%"`, `"%model%"` y `"%sampler%"`, pero deja sin comillas los marcadores de posición numéricos como `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%` y `%clip_skip%`. La sustitución de RunPod ocurre antes de que Marinara analice el flujo de trabajo, así que el número insertado hace que el JSON enviado sea válido. El editor de conexiones puede marcar temporalmente esta plantilla como JSON no válido porque el token sin comillas no se reemplaza hasta el momento de la generación; esta advertencia no impide que se guarde.

Las partes relevantes de un flujo de trabajo API **local** básico pueden verse así:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

Esto es solo un fragmento: conserva los enlaces de nodo y las demás entradas de tu flujo de trabajo exportado. Puedes incrustar marcadores de posición de prompt dentro de una cadena más larga para anteponer o añadir etiquetas fijas. Un marcador de posición numérico normalmente debería ser el valor completo. En una copia RunPod del flujo de trabajo, quita las comillas alrededor de esos tokens numéricos. También puedes dejar cualquier ajuste fijo en el código cuando no quieras que los valores predeterminados de la conexión de Marinara lo cambien.

| Marcador de posición  | Valor proporcionado por Marinara                                                            |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | Prompt positivo de imagen. El editor de conexiones advierte si falta.                       |
| `%negative_prompt%`   | Prompt negativo de imagen.                                                                  |
| `%width%`, `%height%` | Dimensiones de imagen solicitadas.                                                          |
| `%seed%`              | Semilla de la conexión; `-1` produce una nueva semilla aleatoria.                           |
| `%model%`             | Modelo guardado en la conexión. Usa el valor de checkpoint exacto que espera tu nodo cargador. |
| `%steps%`             | Pasos de sampling.                                                                          |
| `%cfg%`               | Escala CFG. También se aceptan `%cfg_scale%` y `%scale%`.                                   |
| `%sampler%`           | Nombre del sampler.                                                                         |
| `%scheduler%`         | Nombre del scheduler.                                                                       |
| `%denoise%`           | Fuerza de eliminación de ruido. También se acepta `%denoising_strength%`.                   |
| `%clip_skip%`         | Valor de Clip Skip para un nodo compatible.                                                 |

Después de editar, guarda el JSON, copia todo el archivo, pégalo en **ComfyUI Workflow** en la conexión de imagen, guarda la conexión y haz clic en **Test Image**.

## Usar imágenes de referencia

Marinara puede proporcionar hasta cuatro imágenes de referencia cuando la función que inicia la generación tiene imágenes para enviar. Un flujo de trabajo personalizado debe contener nodos de entrada y marcadores de posición compatibles; agregar un marcador de posición no crea ni conecta esos nodos automáticamente.

### ComfyUI local: subir nombres de archivo para LoadImage

Para un nodo **LoadImage** estándar de ComfyUI, usa un marcador de posición de nombre de archivo:

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara sube la referencia al directorio de entrada de ComfyUI y reemplaza el marcador de posición con el nombre de archivo que devuelve ComfyUI. `%reference_image_name%` significa la primera imagen. Los flujos de trabajo con varias entradas de referencia pueden usar desde `%reference_image_name_01%` hasta `%reference_image_name_04%`.

Si el flujo de trabajo siempre requiere una entrada de imagen, activa **Upload a 1x1 placeholder when no reference image is provided** (Subir un marcador de posición de 1x1 cuando no se proporciona ninguna imagen de referencia) en **Local Image Defaults**. Marinara entonces proporciona una imagen de marcador de posición diminuta cuando la solicitud no tiene una referencia real.

### Datos de imagen en base64 sin procesar

Usa `%reference_image%` para la primera imagen en base64 sin procesar, o desde `%reference_image_01%` hasta `%reference_image_04%` para entradas numeradas. Estos valores contienen datos en base64 sin un prefijo `data:image/...` y solo funcionan con nodos personalizados que aceptan ese formato directamente.

Los flujos de trabajo de RunPod admiten los marcadores de posición de base64 sin procesar. Los marcadores de posición de subida de nombre de archivo son para ComfyUI local y no están disponibles a través del gestor de RunPod.

## Mantener flujos de trabajo específicos por personaje

Puedes crear un flujo de trabajo exportado aparte y una conexión de imagen de Marinara para cada personaje que necesite un checkpoint concreto, una pila de LoRA, una configuración de ControlNet o un diseño de imagen de referencia particular. Selecciona la conexión de imagen adecuada donde ese personaje o función de imagen te permita elegir una.

Esto puede producir resultados más consistentes que un solo flujo de trabajo genérico, pero cada conexión sigue teniendo su propio JSON copiado. Después de cambiar el flujo de trabajo de un personaje en ComfyUI, repite los pasos de exportar, editar, copiar y pegar para esa conexión.

## Solución de problemas

| Problema                                          | Qué revisar                                                                                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara reporta un JSON de flujo de trabajo no válido | Para ComfyUI local, revisa las comillas, las comas y los corchetes después de agregar los marcadores de posición. Para RunPod, solo los marcadores de posición numéricos deben ir sin comillas; todos los marcadores de posición de texto y el resto de la plantilla aún necesitan una sintaxis JSON correcta. |
| El prompt o el marcador de posición literal llega a un nodo | Confirma que el token esté escrito exactamente como se indica y que el flujo de trabajo pegado sea la versión API recién exportada.                                                                                          |
| La imagen ignora las dimensiones solicitadas       | Pon `%width%` y `%height%` en el nodo de imagen latente o el nodo de tamaño equivalente que realmente alimenta el sampler.                                                                                                    |
| ComfyUI no encuentra el modelo                    | Usa el nombre de checkpoint exacto que espera el cargador, o deja el checkpoint fijo en el código del flujo de trabajo en lugar de usar `%model%`.                                                                            |
| ComfyUI reporta un nodo o una entrada que falta   | Instala los mismos paquetes de nodos personalizados usados cuando se construyó el flujo de trabajo y confirma que los nombres de sus entradas no han cambiado.                                                                |
| El trabajo se completa pero Marinara no recibe ninguna imagen | Agrega una salida **SaveImage** conectada y prueba de nuevo el flujo de trabajo directamente en ComfyUI.                                                                                                                     |
| Un nodo de imagen de referencia falla             | Para un nodo **LoadImage** local normal, usa un marcador de posición `%reference_image_name...%`. Usa base64 sin procesar solo con un nodo diseñado para ello, y confirma que la función de Marinara realmente proporcionó una referencia. |
| Una URL de ComfyUI remota o de LAN está bloqueada | Para las conexiones de imagen, activa `IMAGE_LOCAL_URLS_ENABLED`. Haz que ComfyUI escuche en la interfaz de red y revisa el firewall del host. No expongas un servidor de ComfyUI sin autenticación a la internet pública.    |
| Error: `Outbound response exceeded N bytes`      | La respuesta superó el límite configurado, que es de 30 MiB de forma predeterminada. Los metadatos incrustados del flujo de trabajo o de las imágenes de referencia pueden causarlo. Desactiva los metadatos en ComfyUI, o sube `IMAGE_GEN_MAX_RESPONSE_BYTES` en el `.env` de Marinara y reinicia Marinara. |
| Una generación de imagen larga agota el tiempo de espera | Aumenta `COMFYUI_GEN_TIMEOUT` en el `.env` de Marinara. El valor se mide en segundos y es `2400` de forma predeterminada.                                                                                                     |
| Una generación de video larga agota el tiempo de espera | Aumenta `VIDEO_GEN_TIMEOUT_MS` en el `.env` de Marinara. El valor se mide en milisegundos y es `1800000` (30 minutos) de forma predeterminada.                                                                                |
| La generación se queda sin memoria de GPU         | Reduce las dimensiones de la imagen o el tamaño del modelo, descarga el modelo de lenguaje local, usa un modelo de lenguaje remoto, o mueve ComfyUI a otro dispositivo.                                                       |

## Guías relacionadas

- [Proveedores y configuración de generación de imágenes](image-providers.md) cubre todos los servicios de imagen compatibles y los ajustes de imagen compartidos.
- [Generación de video de escena](scene-video.md) cubre las conexiones de video y todas las superficies de video de escena.
- [Storyboards de LTX 2.3 en Game Mode](../game/ltx-2-3-storyboards.md) cubre un flujo de trabajo de la API de LTX Director, los marcadores de posición y los ajustes de Game recomendados.
- [Perfiles de estilo de imagen](style-profiles.md) explica los estilos de prompt reutilizables de Marinara.
- [Illustrator Agent](illustrator-agent.md) cubre la ilustración automática de escenas.
- [Referencia de configuración del servidor](../CONFIGURATION.md) documenta el acceso a la red local y los tiempos de espera de ComfyUI.
- [Conceptos de flujos de trabajo de ComfyUI](https://docs.comfy.org/development/core-concepts/workflow) explica los flujos de trabajo en la documentación oficial de ComfyUI.
