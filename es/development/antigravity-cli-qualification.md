# Evaluación de la integración de suscripciones con Antigravity CLI

Esta nota de investigación para desarrolladores sobre [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143) se revisó el 2026-10-23 y de nuevo el 2026-11-19 con las versiones oficiales de `agy` 1.5.11 y 1.5.12 para Windows. Marinara Engine **no** implementa una conexión mediante suscripción a Antigravity. La incidencia sigue cerrada como no planificada. Las exclusiones del agente personalizado impidieron ejecutar los hooks probados, pero el subproceso MCP de un plugin detectado globalmente siguió iniciándose en ambas versiones. El aislamiento de ejecución sigue sin verificarse.

## Interfaces oficiales confirmadas

La CLI oficial `agy` admite el inicio de sesión con credenciales guardadas y la generación de texto sin interfaz interactiva. El protocolo documenta los eventos `init`, `step_update` y `result`. La entrada en streaming recibe mensajes de usuario JSON por stdin. En la comprobación de Windows, `agy models` enumeró `gemini-4-neon-high` y las solicitudes acotadas a ese modelo se completaron con la sesión de Google AI Pro que ya estaba abierta. Consulta en la CLI instalada qué modelos están disponibles para la cuenta. Este ejemplo por sí solo no los determina. `--print-timeout 0` espera hasta que termine la operación y `--disable-slash-commands` desactiva la expansión de comandos en modo print. Consulta el [modo sin interfaz interactiva](https://antigravity.google/docs/cli/headless/) y la [referencia de opciones de la CLI](https://antigravity.google/docs/cli/reference/).

El inicio de sesión de la CLI utiliza el almacén de credenciales del sistema operativo. Su modo independiente con clave de API de Gemini requiere `modelProvider: "gemini"` y `GEMINI_API_KEY`; un adaptador de suscripción no debe elegir esa vía de facturación sin avisar. Los métodos documentados de autenticación programática del SDK de Python son las claves de API de Gemini, las credenciales de Vertex/Google Cloud y los modelos locales. Esos métodos no acreditan una autenticación mediante suscripción de consumo para una alternativa basada en el SDK. Consulta [Autenticación](https://antigravity.google/docs/install/#programmatic-authentication) y la [descripción general del SDK](https://antigravity.google/docs/sdk/overview/).

## Resultado actual del aislamiento de ejecución

Las definiciones oficiales de agentes personalizados ofrecen controles de herramientas, MCP y personalización. La guía de plugins explica que `inheritCustomizations` controla la herencia de skills, reglas y hooks y que `inheritMcp` controla la de servidores MCP del espacio de trabajo. El anuncio original de `excludeDefaultComponents: true` conserva los hooks posteriores a la invocación, así que esa opción por sí sola no demuestra el aislamiento. En 1.5.11, la configuración combinada de abajo suprimió los hooks de prueba, aunque algunos subprocesos MCP siguieron iniciándose. Consulta los [subagentes personalizados](https://antigravity.google/docs/subagents/), la [creación de plugins](https://antigravity.google/docs/build-plugins/) y el [registro de cambios de la CLI](https://antigravity.google/docs/changelog).

Los hooks pueden proceder de un espacio de trabajo, del archivo global `~/.gemini/config/hooks.json` y de plugins instalados. Incluyen eventos de sesión, invocación del modelo, herramientas y detención. La documentación actual de ajustes y el [esquema oficial de ajustes](https://antigravity.google/schemas/v1/settings.json) indican expresamente que no se carga una entrada `hooks` de `settings.json`. Escribir ahí una entrada vacía no desactivaría las fuentes reales de hooks. Consulta [Hooks](https://antigravity.google/docs/hooks) y los [ajustes de la CLI](https://antigravity.google/docs/settings?tab=cli).

La ayuda de la versión 1.5.11 instalada documenta `--settings` como forma de cambiar claves de `settings.json` solo para la sesión, en línea o desde un archivo. Así puedes cambiar temporalmente la confianza y los permisos del espacio de trabajo sin reescribir los ajustes guardados. No crea un perfil de configuración separado: `--settings '{"hooks":{}}'` termina con código 1 y `unknown setting "hooks"`. La ayuda instalada no mostró ninguna opción para desactivar hooks ni usar un perfil aislado con autenticación de cuenta.

La documentación actual de ajustes indica que `/hooks` puede añadir, editar y activar o desactivar hooks. Los cambios se guardan en archivos de configuración. En la comprobación, `-p "/hooks" --output-format json` devolvió un inventario estructurado sin interfaz interactiva. El inventario y los estados guardados no garantizan que una invocación posterior excluya personalizaciones ejecutables. Cambiar de directorio, dejar vacía la lista `tools`, pedir que no se usen herramientas o abortar después del inicio no basta para demostrar el aislamiento de ejecución.

Los informes de integraciones de terceros sirven como pistas para investigar. Sus afirmaciones sobre herramientas inertes, registros de resolución de agentes o herencia de personalizaciones deben reproducirse con la versión oficial antes de convertirse en garantías para Engine.

## Comprobación de la versión de octubre de 2026

Se inspeccionaron el [instalador oficial](https://antigravity.google/cli/install.sh) y su [manifiesto de versiones para Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) sin ejecutar el instalador. El manifiesto seleccionó el [archivo versionado de `agy` 1.4.6 para Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) con este SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

La suma de comprobación del archivo coincidió. Su binario se extrajo en un directorio temporal exclusivo de la tarea. Solo se ejecutaron `--version` y `--help`, dentro de un entorno aislado de macOS que denegaba el acceso a la red, la lectura/escritura del directorio personal y el acceso al servicio del llavero. Ambos terminaron correctamente. La ayuda no enumeró ninguna opción para desactivar hooks, aislar perfiles o cambiar el directorio de configuración.

Esta comprobación **no** instaló ni autenticó la CLI, ni inspeccionó credenciales, ni invocó un modelo, ni enumeró los modelos de una cuenta con sesión iniciada, ni probó la ejecución de hooks. Corrobora el inventario público de opciones; no demuestra que el aislamiento sea imposible ni valida la generación mediante suscripción.

## Comprobación en Windows de noviembre de 2026

La versión instalada de `agy` indicó 1.5.11. Su SHA-512 coincidió con la suma observada en el [manifiesto oficial de Windows AMD64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json). La respuesta original del manifiesto no se conservó y el manifiesto vigente pasó después a 1.5.12. Durante la revisión se descargó el [ejecutable versionado de Windows 1.5.11](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) de forma independiente y se calculó su suma sin ejecutarlo. Sus 234 827 416 bytes produjeron el mismo SHA-512 que el ejecutable instalado:

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Las pruebas se hicieron en un espacio de trabajo temporal propio de la tarea, con este encabezado en `.agents/agents/me-isolation-probe.md`:

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

La [referencia oficial del encabezado de agentes personalizados](https://antigravity.google/docs/subagents/) documenta `mainAgent`, `subagent`, `tools` y `commandExecutionPolicy`. Los controles de herencia y exclusión se describen en la guía de plugins y en el registro de cambios citados arriba. La configuración de prueba se usó en conjunto. Que se seleccionara el agente correctamente no demuestra que cada campo se aplicara por separado.

Para generar texto se usó `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`, con un límite independiente de 55 segundos para el subproceso. Los ajustes JSON en línea marcaron el espacio temporal como confiable, seleccionaron el modo de agente predeterminado y el modo de permisos que se indica abajo, y desactivaron los scripts personalizados de estado y título. No se omitió ningún permiso.

El objeto de ajustes tenía esta forma. Se sustituyó `<temporary-workspace>` por el directorio de la prueba y se asignó a `toolPermission` el modo de permisos de cada fila:

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

Las variables de entorno para la clave de API y ADC se quitaron del entorno del subproceso de prueba. No se extrajeron ni copiaron credenciales.

Los hooks de prueba añadían los nombres de los eventos `SessionStart`, `PreInvocation`, `PostInvocation` y `Stop` a archivos indicadores separados. Los servidores MCP locales de prueba en Python escribían un marcador de inicio antes de responder a `initialize` y `tools/list` por stdio. El espacio de trabajo usó `.agents/mcp_config.json`. Los plugins contenían `plugin.json`, `hooks.json` y `mcp_config.json`. Se detectaban mediante un manifiesto `entries` en `.agents/plugins.json` o `~/.gemini/config/plugins.json`, según la [detección de personalizaciones](https://antigravity.google/docs/customization-discovery/). Los controles de hooks, MCP y lectura de archivos omitieron `--agent` y mantuvieron los mismos datos de prueba y ajustes de sesión. La prueba del nombre inexistente comparó el nombre válido `--agent me-isolation-probe` con uno que no se pudo resolver.

| Prueba | Control | Agente personalizado |
| --- | --- | --- |
| Hooks del espacio de trabajo, globales y de plugins detectados en el espacio de trabajo (permisos `strict`) | Los cuatro eventos escribieron marcadores en cada fuente | Ningún marcador de hooks |
| MCP del espacio de trabajo y de plugins detectados en él (permisos `strict`) | Ambos subprocesos escribieron marcadores de inicio | Ningún marcador de inicio |
| Hooks de un plugin detectado globalmente (permisos `request-review`) | Los cuatro eventos escribieron marcadores | Ningún marcador de hooks |
| MCP de un plugin detectado globalmente (permisos `request-review`) | El subproceso escribió su marcador de inicio | El subproceso volvió a escribir su marcador de inicio |
| Solicitud explícita de `view_file` para un valor de prueba impredecible (permisos `request-review`) | Devolvió el valor de prueba | Devolvió `FILE_UNAVAILABLE` y no devolvió el valor de prueba |
| Nombre inexistente para `--agent` (permisos `strict`) | `--agent me-isolation-probe` completó la generación | El nombre no válido terminó con código 1, un resultado de error, consumo cero y ningún marcador de hook ni MCP |

El resultado de MCP del plugin detectado globalmente se repitió dos veces con permisos `strict` y una ruta nueva para el marcador de inicio en cada invocación. Las dos solicitudes con agente personalizado terminaron con código 0, y los dos subprocesos escribieron su marcador. Una escritura tardía del control anterior no habría podido apuntar a esas rutas nuevas. El inicio del subproceso sigue impidiendo validar el aislamiento, aunque la respuesta generada no usó una herramienta MCP.

El prompt de lectura fue `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`, con la ruta absoluta del archivo de prueba temporal. El cuerpo Markdown del agente personalizado le indicaba responder `FILE_UNAVAILABLE` si no podía leer el archivo.

Cuando el manifiesto oficial cambió durante la investigación, se descargó el [ejecutable de Windows 1.5.12](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) en el directorio de pruebas de la tarea sin reemplazar la CLI instalada. El SHA-512 se verificó con esta respuesta del manifiesto, que sí se conservó:

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

La comparación entre el control y el agente personalizado para el plugin detectado globalmente y la lectura de archivos se repitió en 1.5.12 con la misma sesión abierta y los permisos `request-review`. El control ejecutó todos los eventos de hooks del plugin, inició el subproceso MCP y devolvió el valor de prueba. El agente personalizado devolvió `FILE_UNAVAILABLE` y suprimió esos hooks, aunque el subproceso MCP siguió iniciándose. Ambas solicitudes de generación terminaron con código 0. Las demás filas de la tabla solo se probaron en 1.5.11.

`init.agent` en el flujo identificó al agente personalizado. Una solicitud aparte en 1.5.11 devolvió un marcador que solo figuraba en el cuerpo Markdown del agente. Sin embargo, `init.tools` enumeró las mismas herramientas integradas para el control y el agente personalizado, entre ellas `run_command` y `view_file`. Ese inventario no permite concluir qué herramientas están realmente disponibles. La prueba de lectura muestra el comportamiento observado de una sola herramienta. Las demás necesitan verificarse.

Los archivos globales de prueba se crearon de forma exclusiva solo donde antes no había hooks ni manifiestos. Se comprobó su contenido antes de borrarlos. Se eliminaron ambos archivos globales temporales y los ajustes persistentes de la CLI coincidieron con sus sumas anteriores a la prueba. La CLI conservó el estado normal de sus conversaciones. No se reemplazó la configuración global existente.

Las pruebas no inspeccionaron el contenido de las credenciales. La autenticación quedó dentro de la CLI oficial.

Estas pruebas en Windows demuestran que la generación funciona con autenticación por suscripción y acotan el problema inicial de los hooks. El adaptador sigue sin verificarse porque aún se inician subprocesos MCP de plugins detectados globalmente. Quedan por probar los servidores MCP globales independientes, las skills, reglas y subagentes heredados, todas las herramientas capaces de actuar, la cancelación, los periodos largos sin salida y la ejecución real en Linux y macOS. Las correcciones más recientes de la política de plugins y del entorno aislado en el registro de cambios no demuestran que una solicitud normal con una suscripción de consumo excluya todas las personalizaciones ejecutables.

## Pruebas necesarias antes de publicar un adaptador

1. Establece un mecanismo admitido que excluya los hooks globales y del espacio de trabajo, plugins, skills, reglas, subagentes, servidores MCP y herramientas capaces de actuar antes de que cualquier solicitud pueda ejecutarlos. Mantén el inicio de sesión normal dentro de la CLI oficial; no extraigas ni copies tokens.
2. Prueba ese mecanismo con la CLI oficial real y simulaciones locales controladas de modelos. Configura marcadores observables en hooks globales y del espacio de trabajo, así como en plugins/MCP, junto con reglas y solicitudes de herramientas. Verifica tanto la ejecución aislada como controles negativos que demuestren que los marcadores son observables cuando no hay aislamiento.
3. Demuestra que el agente personalizado seleccionado se resuelve antes de ejecutarlo. Rechaza versiones no admitidas, nombres de agentes sin resolver, formatos de inventario desconocidos y comprobaciones de aislamiento no concluyentes; no dependas de textos internos del registro ni de una lista de herramientas aparentemente vacía al iniciar.
4. Añade límites a la entrada/salida del subproceso, archivos temporales privados y su limpieza, cancelación, manejo de códigos de salida distintos de cero y errores de resultado, y cobertura de tiempos de espera sensibles a la actividad, incluido un razonamiento largo sin texto visible. Consulta los modelos de cada cuenta con el comando oficial y conserva el modelo seleccionado y el esfuerzo admitido.
5. Reutiliza los contratos existentes de conexiones/proveedores. Las opciones del SDK de Claude, como `settingSources: []`, son específicas de ese proveedor, no opciones transferibles a `agy`. Explicita cualquier validación pendiente de autenticación real, facturación de suscripciones y plataformas físicas.

Los resultados de Windows con 1.5.11 y 1.5.12 cumplen parte de estas comprobaciones. El inicio no deseado del subproceso sigue siendo reproducible. #8143 sigue cerrado como no planificado. Esta revisión no lo reabre ni autoriza trabajo en tiempo de ejecución. Para añadir un proveedor en tiempo de ejecución, hace falta una decisión de mantenimiento y completar la evaluación.
