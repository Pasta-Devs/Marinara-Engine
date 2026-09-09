# Localización de la interfaz

Marinara Engine localiza el texto de la interfaz de la aplicación, pero deja sin cambios los prompts (instrucciones enviadas a la IA) del modelo, el contenido del usuario, el contenido del chat generado, los identificadores, los valores de protocolo, las rutas de archivo y los valores de máquina persistidos.

El inglés es la configuración regional canónica y la de respaldo en tiempo de ejecución. Por eso, cuando falta una traducción de la comunidad, se muestra el texto en inglés en lugar de una clave de traducción o un control vacío.

Eliges tu idioma de interfaz en **Settings > General > App Behavior > Language** (Configuración > General > Comportamiento de la app > Idioma). La selección cambia los controles y las indicaciones de Marinara, no los prompts del modelo, el contenido creado ni los mensajes del chat.

Al seleccionar un idioma distinto del inglés se descarga su paquete si hace falta. **Refresh language pack** (actualizar el paquete de idioma) obtiene traducciones nuevas. Los paquetes descargados se guardan en `DATA_DIR/ui-packs` y funcionan sin conexión. Si falla una descarga, se conservan el idioma actual y el paquete instalado. Los paquetes nunca se descargan automáticamente al iniciar o actualizar.

En la primera actualización desde una versión que incluía las traducciones, un idioma distinto del inglés seleccionado previamente vuelve al inglés. Selecciona el idioma de nuevo para descargarlo. No cambia el contenido del usuario ni ningún otro ajuste.

## Idiomas de interfaz admitidos

| Idioma | Archivo de idioma | Dirección |
| --- | --- | --- |
| Árabe | `ar.json` | De derecha a izquierda |
| Chino simplificado | `zh-Hans.json` | De izquierda a derecha |
| Inglés | `en.json` | De izquierda a derecha |
| Francés | `fr.json` | De izquierda a derecha |
| Alemán | `de.json` | De izquierda a derecha |
| Hindi | `hi.json` | De izquierda a derecha |
| Japonés | `ja.json` | De izquierda a derecha |
| Coreano | `ko.json` | De izquierda a derecha |
| Polaco | `pl.json` | De izquierda a derecha |
| Portugués de Brasil | `pt-BR.json` | De izquierda a derecha |
| Ruso | `ru.json` | De izquierda a derecha |
| Español | `es.json` | De izquierda a derecha |

El inglés se mantiene como catálogo de origen. Los catálogos de la comunidad comenzaron como traducciones asistidas por máquinas y aceptan correcciones de personas que dominen el idioma. La extracción de textos de la interfaz sigue en curso, por lo que el texto sin clave de traducción continúa en inglés.

## Archivos de idioma

El catálogo canónico en inglés permanece en:

```text
packages/client/src/localization/locales/en.json
```

Los paquetes de la comunidad están en [`ui/` de `docs-i18n`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui), separados de las carpetas de idiomas de la documentación. Cada idioma BCP-47 usa un archivo JSON, como `ui/pl.json`, `ui/ko.json` o `ui/pt-BR.json`, y comparte el archivo generado `ui/manifest.json` con tamaños de archivo y hashes SHA-256. Respeta exactamente las mayúsculas y minúsculas del código de idioma. La interfaz en árabe funciona incluso sin un paquete de documentación en árabe. El inglés se carga con la aplicación; los paquetes de la comunidad se descargan explícitamente y se leen desde el servidor local.

```json
{
  "_meta": {
    "locale": "pl",
    "direction": "ltr"
  },
  "chat.input.placeholder": "Napisz odpowiedź…",
  "common.actions.save": "Zapisz"
}
```

Usa claves semánticas organizadas por área de la interfaz. No uses una frase en inglés como clave, porque una edición corriente del texto invalidaría entonces todas las traducciones.

## Reglas de traducción

- Traduce solo los valores. No cambies el nombre de las claves semánticas.
- Conserva los tokens de interpolación como `{{name}}` y las etiquetas de texto enriquecido como `<strong>`.
- Mantén las claves de traducción ordenadas alfabéticamente.
- Deja sin cambios los nombres de producto como Marinara Engine, a menos que el proyecto adopte un nombre localizado oficial.
- Iguala el significado y el tono de `en.json`; evita agregar comportamientos o promesas que el origen en inglés no hace.
- Comprueba que las etiquetas traducidas quepan en computadora y en el teléfono.

Los paquetes de la comunidad pueden omitir claves temporalmente mientras se prepara la traducción de un área. Las claves que faltan usan el inglés. El validador de paquetes informa de la cobertura y de las claves obsoletas, que Engine ignora. Las traducciones vacías (salvo las excepciones existentes de sufijos vacíos intencionados), los metadatos incorrectos y los cambios en tokens de interpolación o texto enriquecido no pasan la validación. Los cambios de nombre y las eliminaciones de claves deben reflejarse en los paquetes o seguirse en una incidencia `[ui-i18n]`.

Los PR de funcionalidades deben añadir o actualizar la clave canónica en inglés, pero no necesitan modificar los paquetes de la comunidad. Traduce un valor de la comunidad solo si puedes aportar una traducción útil. No copies el valor inglés en todos los archivos para igualar sus listas de claves: el mecanismo de respaldo ya ofrece ese texto, y dejar la clave ausente evita conflictos de fusión innecesarios a quienes traducen.

Las traducciones producidas por máquina son bienvenidas como un borrador inicial cuando el PR las identifica como tales. Un hablante fluido debería revisar la terminología, el tono, el recorte de texto y el diseño en el teléfono antes de que la configuración regional se describa como revisada.

## Enviar una corrección a una traducción existente

Para una pequeña corrección de redacción, el editor web de GitHub es suficiente:

1. Abre la configuración regional en
   [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui).
2. Selecciona el icono de lápiz para editar el archivo. GitHub te ofrecerá crear una bifurcación si hace falta.
3. Cambia solo el valor traducido. Conserva su clave, los tokens sensibles a la puntuación como `{{name}}` y la sintaxis JSON.
4. Confirma el cambio en una rama enfocada de tu bifurcación.
5. Actualiza el manifiesto y valida el paquete con el comando siguiente. Después abre un pull request contra **`docs-i18n`**, no contra `staging` ni `main`. ([`validate-packs.mjs`](#enviar-una-nueva-localizaci%C3%B3n))
6. En la descripción del PR, indica el idioma, explica el significado corregido y di si eres un hablante fluido o si usaste asistencia de máquina.

Usa un título como `Improve French UI translation`. Varias correcciones relacionadas de una misma configuración regional pueden compartir un PR. Mantén separados los cambios de código no relacionados.

## Enviar una nueva localización

Para un idioma nuevo, conserva una copia de trabajo de Engine en `staging` como fuente en inglés y trabaja en `docs-i18n`:

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

Luego:

1. Copia el `en.json` canónico de la copia de trabajo de Engine a `ui/<locale>.json`, por ejemplo `ui/it.json` o `ui/pt-PT.json`.
2. Mantén `_meta.locale` igual al nombre del archivo sin `.json`.
3. Ajusta `_meta.direction` a `ltr` o `rtl`.
4. Traduce los valores según las reglas de arriba. Copiar el catálogo completo en inglés es lo preferido para una configuración regional nueva, aunque un catálogo incompleto puede recurrir al inglés.
5. Genera el manifiesto y ejecuta el validador de paquetes (solo Node.js, sin dependencias). Informa de la cobertura respecto al catálogo inglés de tu copia de trabajo de Engine:

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. Los idiomas nuevos también necesitan un pequeño PR de Engine que añada su código a `UI_LANGUAGE_CODES` en `packages/shared/src/utils/ui-locales.ts`; actualizar un paquete existente no requiere cambios en Engine. Una vez publicado, selecciona el idioma en **Settings > General** y revísalo en escritorio y móvil. Comprueba las etiquetas largas, los textos de ayuda, los estados de carga y error y la dirección del texto.
7. Sube la rama a tu bifurcación y
   [abre un pull request](https://github.com/Pasta-Devs/Marinara-Engine/compare), seleccionando
   `Pasta-Devs/Marinara-Engine:docs-i18n` como base.

La descripción del PR debería identificar la configuración regional, el origen de la traducción, el nivel de fluidez o revisión, los comandos de validación y cualquier área que aún necesite la revisión de un hablante nativo. Completa la plantilla del PR con honestidad y marca solo los elementos manuales que verificaste personalmente.

## Usar traducciones en el código del cliente

Los componentes de React usan `useTranslation`:

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

Guarda claves de traducción en lugar de valores traducidos en la configuración de la interfaz a nivel de módulo. Así los cambios de idioma se mantienen en vivo sin recargar la página. Los ayudantes del cliente que no son de React pueden usar la función `translate` exportada desde `packages/client/src/localization/i18n.ts`.

Traduce el texto visible, incluidas las etiquetas, los marcadores de posición, los tooltips, los nombres de accesibilidad, el texto alternativo, los estados de carga y vacíos, los toasts, las confirmaciones y los tutoriales estáticos. No enrutes los prompts ni el contenido creado a través del traductor de la interfaz.

Las primitivas heredadas compartidas, como los controles de Settings, los tooltips de ayuda y los títulos de las ventanas, también reconocen valores exactos del catálogo canónico en inglés mientras se migran los puntos de llamada más antiguos. Esto es un puente de compatibilidad, no la API preferida: los componentes nuevos y los editados de forma sustancial deben seguir usando directamente claves semánticas `t("area.control.label")`. Una frase en inglés que no está presente en `en.json` no es traducible.

La comprobación de localización del repositorio también audita el TSX del cliente en busca de texto de interfaz sin traducir:

```bash
pnpm localization:ui-check
```

Cubre el JSX visible, las etiquetas y los avisos interpolados directamente, los nombres accesibles, los marcadores de posición, los estados de carga y vacíos, los toasts y las confirmaciones. El contenido literal dentro de los elementos `code`, `pre`, `script` y `style` se excluye a propósito para que los comandos, la configuración, las URLs, las macros y otros ejemplos orientados a la máquina se mantengan exactos. Los valores dinámicos creados por el usuario, generados, persistidos, de prompt y de protocolo deben mantenerse igualmente fuera del traductor de la interfaz.

## Interfaces de Agentes descargables

Las pantallas de agentes que pertenecen a Engine usan el inglés canónico y los paquetes descargados de `docs-i18n/ui`. Los clientes de capacidades descargables mantienen sus propias traducciones en el repositorio Marinara-Agents.

Cada elemento personalizado de capacidad recibe la configuración regional seleccionada a través de sus atributos `lang` y `dir`, y:

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

El evento existente `marinara-capability-props` se dispara cuando cambia la configuración regional. La interfaz del paquete debería seleccionar su configuración regional incluida, recurrir al inglés del paquete y volver a renderizar tras ese evento.
