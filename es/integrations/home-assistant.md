# Integración con Home Assistant

Esta integración permite que tus personajes de IA controlen dispositivos reales de hogar inteligente desde un chat, como luces, clima, persianas y reproductores de medios. También permite que las automatizaciones de Home Assistant envíen mensajes hacia Marinara Engine. Home Assistant es una plataforma gratuita y de código abierto para dispositivos de hogar inteligente. Si no lo usas, no necesitas esta guía.

## Qué añade la integración

La integración es una pequeña pieza de software que se instala dentro de Home Assistant y lo conecta con tu servidor de Marinara. En la primera configuración crea lo siguiente por ti. Nunca copias direcciones de herramientas ni configuras herramientas a mano.

- Herramientas de hogar inteligente en la sección **Functions** del panel de Presets. Consulta [Herramientas personalizadas](../extending/custom-tools.md).
- Un agente llamado **Home Assistant**, un ayudante de IA que se ejecuta junto a tu chat. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).
- Entidades de Home Assistant (dispositivos, sensores y controles) para que puedas observar y controlar Marinara desde Home Assistant.

## Antes de empezar

- Home Assistant versión 2024.1.0 o más reciente.
- HACS instalado en Home Assistant. HACS es la Home Assistant Community Store, una herramienta para instalar integraciones personalizadas.
- Marinara en ejecución y accesible desde la máquina de Home Assistant. La dirección predeterminada es `localhost:7860`.
- `WEBHOOK_LOCAL_URLS_ENABLED=true` en el archivo `.env` de Marinara.

El archivo `.env` es el archivo de configuración en texto plano del servidor de Marinara. Consulta [Configuración del servidor](../CONFIGURATION.md) para saber dónde está. La integración usa un webhook, una dirección web que permite que una app envíe datos a otra. El webhook de Home Assistant es una dirección `http` local y plana, y Marinara bloquea esas direcciones de forma predeterminada por seguridad. Esta configuración las permite. Añade esta línea y guarda. Surte efecto sin reiniciar, normalmente en unos segundos (hasta unos 30 segundos):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Si Home Assistant se ejecuta en un dispositivo diferente

La integración se conecta sin usuario ni contraseña, y el formulario de configuración no tiene ningún lugar para introducirlos.

- Misma máquina: la conexión funciona sin más.
- Dispositivo diferente: Marinara la bloquea de forma predeterminada. Añade la dirección IP de ese dispositivo (su dirección numérica en tu red) a `IP_ALLOWLIST` en `.env`. En una red doméstica de plena confianza, puedes configurar `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` en su lugar.
- Si Marinara usa `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` (el inicio de sesión), la integración no puede iniciar sesión. Entonces solo funciona desde la misma máquina o desde un dispositivo que esté en `IP_ALLOWLIST`.

Consulta [Acceso remoto](../REMOTE_ACCESS.md) para saber qué opción elegir.

## Instalar la integración

### Añadirla a HACS

1. En Home Assistant, abre **HACS**.
2. Abre el menú de tres puntos y haz clic en **Custom repositories**.
3. En el cuadro del repositorio, introduce `https://github.com/Pasta-Devs/Marinara-Engine`.
4. Configura la categoría en **Integration** y haz clic en **Add**.
5. Busca **Marinara Engine** e instálalo.
6. Reinicia Home Assistant.

### Configurarla

1. Ve a **Settings → Devices & Services** (Configuración → Dispositivos y servicios) y haz clic en **Add Integration**.
2. Busca **Marinara Engine**.
3. Introduce el **Host** y el **Port** donde se ejecuta Marinara. Los valores predeterminados son `localhost` y `7860`.
4. Haz clic en **Submit**.

Si no funcionó: Home Assistant muestra un error cuando no puede llegar a Marinara. Consulta [Solución de problemas](#troubleshooting).

Si todo sale bien, la integración registra un webhook privado en Home Assistant, crea las herramientas en la sección **Functions** de Marinara apuntando a ese webhook, crea el agente **Home Assistant** con la lista de cada herramienta activada y crea las entidades descritas más abajo.

## Añadir el agente a un chat

Crear el agente no lo asocia a todos los chats. Añádelo a cada chat donde quieras control del hogar inteligente.

1. Abre el chat y haz clic en **Chat Settings** (Ajustes del chat).
2. Abre la sección **Agents**.
3. Añade el agente **Home Assistant**.

Funciona en chats de Roleplay, Conversation y Game. Una vez añadido, las herramientas quedan disponibles para la IA en ese chat. No hace falta activar nada más.

### Comprobar que funciona

1. En ese chat, escribe una petición sencilla, por ejemplo `Turn on the office lights`, y envíala.
2. La IA debería llamar a una herramienta como `ha_turn_on`, las luces deberían encenderse y la IA lo confirma.

Si no pasa nada, comprueba que `WEBHOOK_LOCAL_URLS_ENABLED=true` esté configurado y consulta [Solución de problemas](#troubleshooting).

## Elegir qué herramientas puede usar la IA

Las herramientas están agrupadas en ocho categorías. Para elegir cuáles puede usar Marinara, abre **Settings → Devices & Services**, haz clic en **Marinara Engine** y luego en **Configure**. Tiene dos opciones:

- **Primary Chat**: el chat predeterminado al que apuntan los servicios de Home Assistant.
- **Exposed Tool Categories**: las categorías que Marinara puede usar.

| Categoría | Predeterminado | Herramientas |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Advertencia:** **Generic Service Calls (Advanced)** permite que la IA llame a cualquier servicio de Home Assistant. **Locks** le permite bloquear y desbloquear puertas. Ambas están desactivadas de forma predeterminada. Actívalas solo si las quieres.

La mayoría de las herramientas aceptan un dispositivo o el nombre de una habitación. Con el nombre de una habitación, la herramienta actúa sobre cada dispositivo coincidente de esa habitación. Los cambios en las categorías surten efecto después de que pulses **Marinara Sync HA Tools** o reinicies Home Assistant.

## Entidades en Home Assistant

La integración crea estas entidades bajo un dispositivo llamado **Marinara Engine**.

| Entidad | Tipo | Qué hace |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Número total de chats de Marinara |
| Marinara Active Agent Count | Sensor | Cuántos agentes de Marinara están activados |
| Marinara Active Chat | Select | Elige a qué chat apuntan los servicios |
| Marinara Agent: (name) | Switch | Activa o desactiva un agente, un interruptor por agente |
| Marinara Abort Generation | Button | Cancela cualquier respuesta de IA que se esté generando |
| Marinara Sync HA Tools | Button | Reenvía todas las herramientas y reconstruye el agente Home Assistant |

La integración consulta a Marinara en busca de nuevos chats y agentes cada 30 segundos, así que algo que acabas de crear puede tardar hasta 30 segundos en aparecer.

### Sincronizar después de cambiar la configuración

Pulsa **Marinara Sync HA Tools** en la página del dispositivo **Marinara Engine**. Actualiza las herramientas existentes en el sitio, reconstruye el agente **Home Assistant** si lo eliminaste y desactiva (no elimina) las herramientas cuya categoría desactivaste. No edites a mano las herramientas de Home Assistant en Marinara. La siguiente sincronización sobrescribe tus ediciones y vuelve a activar las herramientas.

## Controlar Marinara desde automatizaciones

La integración añade dos servicios de Home Assistant para automatizaciones. Se ejecutan dentro de Home Assistant, no en Marinara. Ambos apuntan a tu **Primary Chat** de forma predeterminada.

### Send Message (marinara_engine.send_message)

- `message`: el texto del mensaje. Obligatorio.
- `chat_id`: a qué chat enviar. Si lo dejas en blanco, se usa el Primary Chat.
- `role`: `user`, `assistant`, `system` o `narrator`. El valor predeterminado es `user`.
- `trigger_generation`: cuando es true, la IA también responde. El valor predeterminado es false.

Esta automatización le avisa a la IA cuando se abre la puerta principal:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

Esto inicia una respuesta de IA sin un mensaje visible.

- `chat_id`: qué chat. Si lo dejas en blanco, se usa el Primary Chat.
- `user_message`: un mensaje opcional para incluir con el turno de respuesta.

<a id="troubleshooting"></a>

## Solución de problemas

### El formulario de configuración dice que no se puede conectar

Asegúrate de que Marinara esté en ejecución y de que el **Host** y el **Port** coincidan con donde escucha (de forma predeterminada, `localhost` y `7860`). Si Home Assistant está en un dispositivo diferente, Marinara lo bloquea a menos que el dispositivo esté en `IP_ALLOWLIST`. La integración no puede enviar una contraseña, así que un Marinara protegido con inicio de sesión también la rechaza. Consulta [Acceso remoto](../REMOTE_ACCESS.md). Estas reglas siguen aplicándose después de la configuración. Si Marinara más adelante bloquea el dispositivo, los sensores y la lista de chats dejan de actualizarse silenciosamente.

### La IA intenta usar una herramienta de dispositivo pero no pasa nada

Probablemente la llamada al webhook está bloqueada. Añade `WEBHOOK_LOCAL_URLS_ENABLED=true` a `.env` y guarda. Sin ello, las llamadas a herramientas pueden fallar con un mensaje sobre que `http` no está permitido o sobre que se rechaza una dirección privada. Si Marinara y Home Assistant están en la misma máquina, la integración usa la dirección interna automáticamente. Si Marinara está en un dispositivo diferente, asegúrate de que la dirección local de Home Assistant sea accesible desde él.

### Las herramientas no aparecen en Functions

Pulsa **Marinara Sync HA Tools** o reinicia Home Assistant, y luego comprueba **Functions** en el panel de Presets.

### El agente Home Assistant no está en mi chat

Comprueba que el agente existe en Marinara, en Agents. Si no está, pulsa **Marinara Sync HA Tools** para reconstruirlo. Luego añádelo en **Chat Settings → Agents**.

### Encontrar la dirección del webhook a mano

Rara vez la necesitas, ya que cada herramienta ya tiene la dirección. Abre **Settings → Devices & Services → Marinara Engine** en Home Assistant. El webhook usa este patrón, donde 8123 es el puerto predeterminado de Home Assistant:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Desinstalar

Borra la integración en **Settings → Devices & Services → Marinara Engine** en Home Assistant. Esto elimina las entidades. Las herramientas de la sección **Functions** de Marinara y el agente **Home Assistant** se quedan. Elimínalos a mano en Marinara si ya no los quieres.

## Guías relacionadas

- [Herramientas personalizadas](../extending/custom-tools.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Configuración del servidor](../CONFIGURATION.md)
- [Acceso remoto](../REMOTE_ACCESS.md)
