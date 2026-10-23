# Evaluación de la integración de suscripciones con Antigravity CLI

Esta es una nota de investigación para desarrolladores sobre [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), revisada el 2026-10-23. Marinara Engine **no** implementa una conexión de suscripción a Antigravity. El requisito pendiente es un mecanismo admitido y verificable que impida ejecutar las herramientas y personalizaciones globales de la CLI, incluidos los hooks del ciclo de vida, durante una solicitud de generación de texto de Engine.

## Interfaces oficiales confirmadas

La CLI oficial `agy` admite el inicio de sesión con credenciales guardadas y la generación de texto sin interfaz interactiva. Su protocolo documentado incluye eventos `init`, `step_update` y `result`, con mensajes de usuario JSON en stdin para la entrada en streaming. `agy models` enumera los modelos disponibles, incluidos los ejemplos documentados `gemini-4-argon-high` y `gemini-4-argon-medium`. Los modelos disponibles para una cuenta deben consultarse en la CLI instalada, no deducirse de esos ejemplos. `--print-timeout 0` espera hasta que termine la operación, y `--disable-slash-commands` desactiva la expansión de comandos en modo print. Consulta el [modo sin interfaz interactiva](https://www.antigravity.google/docs/cli/headless/) y la [referencia de opciones de la CLI](https://www.antigravity.google/docs/cli/reference/).

El inicio de sesión de la CLI utiliza el almacén de credenciales del sistema operativo. Su modo independiente con clave de API de Gemini requiere `modelProvider: "gemini"` y `GEMINI_API_KEY`; un adaptador de suscripción no debe elegir esa vía de facturación sin avisar. Los métodos documentados de autenticación programática del SDK de Python son las claves de API de Gemini, las credenciales de Vertex/Google Cloud y los modelos locales. Esos métodos no acreditan una autenticación mediante suscripción de consumo para una alternativa basada en el SDK. Consulta [Autenticación](https://www.antigravity.google/docs/install/#programmatic-authentication) y la [descripción general del SDK](https://www.antigravity.google/docs/sdk/overview/).

## Falta de garantías de aislamiento de ejecución

Las definiciones oficiales de agentes personalizados ofrecen controles de herramientas, MCP y personalización. El registro de cambios también documenta `inheritCustomizations`, `inheritMcp` y `excludeDefaultComponents`. Sin embargo, el anuncio de `excludeDefaultComponents: true` conserva expresamente los hooks posteriores a la invocación. Por tanto, esa opción no demuestra por sí sola que una solicitud de generación de texto excluya todos los hooks ejecutables. Consulta los [subagentes personalizados](https://www.antigravity.google/docs/subagents/) y el [registro de cambios de la CLI](https://www.antigravity.google/docs/changelog).

Los hooks pueden proceder de un espacio de trabajo, del archivo global `~/.gemini/config/hooks.json` y de plugins instalados. Incluyen eventos de sesión, invocación del modelo, herramientas y detención. La documentación actual de ajustes y el [esquema oficial de ajustes](https://antigravity.google/schemas/v1/settings.json) indican expresamente que no se carga una entrada `hooks` de `settings.json`. Escribir ahí una entrada vacía no desactivaría las fuentes reales de hooks. Consulta [Hooks](https://www.antigravity.google/docs/hooks) y los [ajustes de la CLI](https://www.antigravity.google/docs/settings?tab=cli).

Las opciones y los ajustes documentados de la CLI no ofrecen una opción para desactivar hooks por solicitud ni un directorio aislado de configuración/perfil que conserve la autenticación de la cuenta. El inventario de solo lectura `/hooks` aporta información útil, pero su documentación no garantiza que una invocación posterior del modelo use una configuración fija y sin hooks. Cambiar de directorio, dejar vacía la lista `tools`, pedir que no se usen herramientas o abortar después del inicio no basta para demostrar el aislamiento de ejecución.

Los informes de integraciones de terceros sirven como pistas para investigar. Sus afirmaciones sobre herramientas inertes, registros de resolución de agentes o herencia de personalizaciones deben reproducirse con la versión oficial antes de convertirse en garantías para Engine.

## Comprobación local de la versión

Se inspeccionaron el [instalador oficial](https://antigravity.google/cli/install.sh) y su [manifiesto de versiones para Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) sin ejecutar el instalador. El manifiesto seleccionó el [archivo versionado de `agy` 1.4.6 para Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) con este SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

La suma de comprobación del archivo coincidió. Su binario se extrajo en un directorio temporal exclusivo de la tarea. Solo se ejecutaron `--version` y `--help`, dentro de un entorno aislado de macOS que denegaba el acceso a la red, la lectura/escritura del directorio personal y el acceso al servicio del llavero. Ambos terminaron correctamente. La ayuda no enumeró ninguna opción para desactivar hooks, aislar perfiles o cambiar el directorio de configuración.

Esta comprobación **no** instaló ni autenticó la CLI, inspeccionó credenciales, invocó un modelo, enumeró los modelos de una cuenta con sesión iniciada ni probó la ejecución de hooks. Corrobora el inventario público de opciones; no demuestra que el aislamiento sea imposible ni valida la generación mediante suscripción.

## Pruebas necesarias antes de publicar un adaptador

1. Establece un mecanismo admitido que excluya los hooks globales y del espacio de trabajo, plugins, skills, reglas, subagentes, servidores MCP y herramientas capaces de actuar antes de que cualquier solicitud pueda ejecutarlos. Mantén el inicio de sesión normal dentro de la CLI oficial; no extraigas ni copies tokens.
2. Prueba ese mecanismo con la CLI oficial real y simulaciones locales controladas de modelos. Configura marcadores observables en hooks globales y del espacio de trabajo, así como en plugins/MCP, junto con reglas y solicitudes de herramientas. Verifica tanto la ejecución aislada como controles negativos que demuestren que los marcadores son observables cuando no hay aislamiento.
3. Demuestra que el agente personalizado seleccionado se resuelve antes de ejecutarlo. Rechaza versiones no admitidas, nombres de agentes sin resolver, formatos de inventario desconocidos y comprobaciones de aislamiento no concluyentes; no dependas de textos internos del registro ni de una lista de herramientas aparentemente vacía al iniciar.
4. Añade límites a la entrada/salida del subproceso, archivos temporales privados y su limpieza, cancelación, manejo de códigos de salida distintos de cero y errores de resultado, y cobertura de tiempos de espera sensibles a la actividad, incluido un razonamiento largo sin texto visible. Consulta los modelos de cada cuenta con el comando oficial y conserva el modelo seleccionado y el esfuerzo admitido.
5. Reutiliza los contratos existentes de conexiones/proveedores. Las opciones del SDK de Claude, como `settingSources: []`, son específicas de ese proveedor, no opciones transferibles a `agy`. Explicita cualquier validación pendiente de autenticación real, facturación de suscripciones y plataformas físicas.

Hasta que se establezca el límite de ejecución, #8143 seguirá abierto y no debe añadirse un proveedor en tiempo de ejecución.
