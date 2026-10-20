# Interruptores de funciones

Algunos comportamientos del servidor son opcionales. Actívalos en **Settings > Advanced > Features** (configuración > avanzado > funciones). Todos empiezan desactivados, así que un servidor donde nadie abre esta sección funciona igual que antes.

Los cambios se aplican de inmediato. No hace falta reiniciar el servidor ni recargar la página.

<a id="overview"></a>

## Resumen

| Interruptor | Clave del ajuste | Valor inicial | Variable de entorno |
| --- | --- | --- | --- |
| **Stable lorebook picks** (selecciones estables del lorebook) | `stableLorebookGroupPicks` | Desactivado | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls** (reintentar llamadas fallidas al proveedor) | `providerRetry` | Desactivado | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats** (estadísticas de activación del lorebook) | `usageAndActivationStats` | Desactivado | ninguna |
| **Recover deleted chat messages** (recuperar mensajes de chat eliminados) | `messageTrash` | Desactivado | ninguna |

Buscar `features` en los ajustes lleva a esta sección.

<a id="where-the-settings-are-stored"></a>

## Dónde se guardan los ajustes

Todos los interruptores se guardan juntos en el ajuste de la app `features`, un objeto JSON de booleanos. Solo se guardan valores distintos del predeterminado. Una clave ausente, un objeto vacío o un valor ilegible significan el valor inicial: todos desactivados.

El servidor mantiene una copia en memoria, así que comprobarlos no añade lecturas en rutas frecuentes como llamadas a proveedores y escaneos de lorebooks. Guardar desde Settings, o cualquier otra escritura en la fila `features`, actualiza esa copia inmediatamente.

La API es `GET` y `PUT /api/app-settings/features`. `PUT` reemplaza el objeto completo y rechaza claves desconocidas y valores que no sean booleanos.

<a id="switches"></a>

## Interruptores

<a id="stable-lorebook-picks"></a>

### Selecciones estables del lorebook

Clave: `stableLorebookGroupPicks`. Variable de entorno: `LOREBOOK_STABLE_GROUP_WINNERS`.

Activado: un grupo de inclusión del lorebook conserva el mismo ganador en un chat mientras no cambien los candidatos coincidentes. Otros chats y otros conjuntos de candidatos pueden elegir de otra forma.

Desactivado: se vuelve a sortear el ganador en cada generación.

<a id="retry-failed-provider-calls"></a>

### Reintentar llamadas fallidas al proveedor

Clave: `providerRetry`. Variable de entorno: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

Activado: se reintenta una conexión rechazada o inaccesible, o un error de puerta de enlace 502/503, como máximo dos veces con una espera breve de variación aleatoria, y solo antes de recibir texto. Nunca se reintenta un 504 ni una conexión interrumpida. Si la conexión tiene fallback, se prueba inmediatamente ese fallback en su lugar.

Desactivado: como antes, solo se reintentan los límites de frecuencia.

<a id="lorebook-activation-stats"></a>

### Estadísticas de activación del lorebook

Clave: `usageAndActivationStats`. Sin variable de entorno.

Activado: después de que una respuesta se guarda correctamente, Marinara registra qué entradas del lorebook se activaron, para que puedas ordenar y filtrar las entradas por uso en el editor del lorebook. Las continuaciones de una respuesta no añaden registros de activación.

Desactivado: no se registra nada, y el editor del lorebook oculta sus estadísticas de activación.

<a id="recover-deleted-chat-messages"></a>

### Recuperar mensajes de chat eliminados

Clave: `messageTrash`. Sin variable de entorno.

Activado: los mensajes de chat eliminados van a la pestaña **Trash** (Papelera) de la búsqueda del chat. Usa **Restore** (Restaurar) allí dentro de un plazo de 30 días; después se eliminan para siempre. Los mensajes de Game y las eliminaciones por reversión siguen siendo permanentes.

Desactivado: los mensajes eliminados se borran de inmediato.

<a id="precedence"></a>

## Prioridad

1. **Variable de entorno.** Cuando está definida, prevalece sobre el interruptor guardado tanto para activarlo como para desactivarlo. Settings muestra el interruptor bloqueado con el nombre de la variable. Un valor vacío cuenta como no definido.
2. **Interruptor guardado.** El valor de Settings > Advanced > Features.
3. **Valor predeterminado.** Desactivado.

| Variable | Controla | Valores |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | Selecciones estables del lorebook | `true`, `1`, `yes` u `on` activan. Cualquier otro valor desactiva. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | Reintentos de llamadas fallidas al proveedor | `true`, `1`, `yes` u `on` activan. Cualquier otro valor desactiva. |

Las variables se leen en cada comprobación, por lo que los cambios de `.env` no requieren reinicio.

<a id="for-developers"></a>

## Para desarrolladores

El registro es `packages/shared/src/schemas/feature-settings.schema.ts`: nombres y valores predeterminados. Añade allí el interruptor en `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS` y `featureSettingsSchema`, dale etiqueta y ayuda bajo `settings.features.<key>` en el catálogo inglés y añádelo a `SERVER_SWITCHES` en `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx` para mostrarlo en Settings. En el servidor, compruébalo con `isFeatureEnabled("<key>")` de `packages/server/src/services/features/feature-settings.ts`. En el cliente, usa `useFeatureEnabled("<key>")` de `packages/client/src/hooks/use-feature-settings.ts`.
