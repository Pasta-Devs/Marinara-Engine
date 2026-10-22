# Acceso remoto: inicio de sesión y lista de IP permitidas

Esta guía explica cómo llegar a Marinara Engine desde otro dispositivo, como tu teléfono, una laptop o un contenedor de Docker. Cubre la opción principal: un inicio de sesión. También cubre la lista de IP permitidas, los proxies de inicio de sesión, HTTPS, Admin Access y el mensaje CSRF de "save blocked" (guardado bloqueado). Casi todos los ajustes de aquí viven en el archivo `.env` del servidor, no en la app.

Una lista rápida de palabras que se usan en toda esta guía:

- archivo `.env`: un archivo de texto plano con ajustes, en la carpeta de Marinara Engine, junto a `package.json`.
- Loopback: la máquina que en realidad está ejecutando el servidor. Su dirección es `127.0.0.1` o `localhost`.
- Acceso remoto: abrir Marinara desde cualquier dispositivo que NO sea la máquina que ejecuta el servidor.

## Lo que Marinara bloquea de forma predeterminada

Para proteger tus datos, una instalación nueva de Marinara rechaza las conexiones de otros dispositivos hasta que configuras el control de acceso. De forma predeterminada, solo se confía en tres tipos de cliente:

1. Loopback (`127.0.0.1` o `::1`), la máquina que ejecuta el servidor. Los visitantes que reenvía un proxy inverso o un túnel en la misma máquina no cuentan; consulta [Proxies inversos y túneles en la misma computadora](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Dispositivos de Tailscale en tu tailnet. Tailscale es una herramienta de red privada, y sus direcciones usan el rango `100.64.0.0/10`.
3. Clientes de Docker en el mismo host. Marinara reconoce el rango de puente habitual `172.16.0.0/12` y la puerta de enlace predeterminada exacta del contenedor, lo que también cubre Docker Desktop y los grupos de direcciones personalizados.

Todo lo demás, como tu teléfono en la misma Wi-Fi o un cliente de internet público, queda bloqueado hasta que configures un inicio de sesión. Un dispositivo bloqueado que abre Marinara en un navegador ve una página de configuración oscura. Su título dice **This Marinara Engine install needs a login before remote devices can connect.** (Esta instalación de Marinara Engine necesita un inicio de sesión antes de que los dispositivos remotos puedan conectarse.) La página tiene un formulario para el código de configuración de un solo uso del registro del servidor, así que puedes configurar el inicio de sesión desde ese dispositivo.

Si no haces nada y nunca configuras una contraseña, Marinara sigue bloqueada a esas tres fuentes de confianza. Ese es el valor predeterminado seguro.

## Dónde vive el archivo .env

Todos los ajustes de acceso viven en tu archivo `.env` en la raíz del proyecto, junto a `package.json`. Si aún no tienes uno, copia el ejemplo:

```bash
cp .env.example .env
```

Abre `.env` con cualquier editor de texto. La mayoría de los ajustes de acceso, incluidos Basic Auth, la lista de IP permitidas, el secreto de admin y los orígenes CSRF, se aplican en un par de segundos sin reiniciar. Unos pocos ajustes de bajo nivel todavía necesitan reinicio, incluidos `PORT`, `HOST` y las rutas del certificado HTTPS.

Puede que otros dispositivos no logren llegar al servidor en absoluto, con un tiempo de espera en lugar de un 403. En ese caso, es posible que el servidor solo esté escuchando en la máquina local. Configura el servidor para que escuche en todas las interfaces de red:

```env
HOST=0.0.0.0
```

Dirección de vinculación predeterminada según cómo inicies Marinara:

| Forma de inicio | `HOST` predeterminado |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, instalador de Windows, `start-termux.sh` | `0.0.0.0` |
| Imagen de Docker | `0.0.0.0` dentro del contenedor |
| `docker-compose.yml` | Publica el puerto solo en `127.0.0.1` |

## Qué opción deberías elegir

Léelas en orden y detente en la primera que coincida contigo.

1. Solo te conectas por Tailscale, o solo desde contenedores de Docker en el mismo host. No necesitas hacer nada. Ya funciona.
2. Quieres llegar a Marinara desde un teléfono, una tableta o una laptop en la Wi-Fi de tu casa. Configura un inicio de sesión (Opción 1, abajo).
3. Estás exponiendo Marinara al internet público. Configura un inicio de sesión y usa HTTPS.
4. Un proxy de inicio de sesión en tu red, como tinyauth, Authelia o Authentik, ya hace iniciar sesión a cada visitante. Lee [Proxies de inicio de sesión (forward auth)](#login-proxies-forward-auth).

Un inicio de sesión es la opción más flexible. Funciona desde cualquier IP, no necesita configuración por dispositivo, y cada navegador sigue con la sesión iniciada.

<a id="option-1-login-recommended"></a>

## Opción 1: inicio de sesión (recomendado)

Un inicio de sesión es un nombre de usuario y una contraseña que necesita cada dispositivo remoto. Puedes configurarlo de tres maneras:

- **En Settings.** En un navegador que ya haya iniciado sesión, o en la computadora que ejecuta Marinara (abre `http://localhost:7860`), ve a **Settings** → **Advanced** → **Access**. Configura un nombre de usuario y una contraseña en **Remote login**. Mientras no exista un inicio de sesión, un dispositivo que Marinara rechaza, como el navegador de un host Docker, puede escribir el código de configuración del registro del servidor en ese mismo lugar.
- **Con el código de configuración, desde cualquier dispositivo.** Mientras no hay inicio de sesión y el servidor escucha más allá de loopback, imprime en su registro un código de configuración de un solo uso. La línea del registro empieza con `[login] One-time setup code:`. Encuéntrala en la terminal que ejecuta Marinara. En Docker, ejecuta `docker logs <container> 2>&1 | grep "setup code"`. La advertencia de rechazo del registro repite el código mientras no existe un inicio de sesión. Luego abre Marinara en cualquier dispositivo. La página que bloquea el dispositivo tiene un formulario para el código de configuración, un nombre de usuario y una contraseña. El código tiene el aspecto `XXXX-XXXX-XXXX-XXXX`. Las mayúsculas, los espacios y los guiones no importan. Cada código funciona una vez; un reinicio o un restablecimiento imprime uno nuevo. En Docker, la página también muestra cómo configurar el inicio de sesión en el archivo `.env` de la carpeta de datos (`/app/data/.env`) o en la lista `environment:` de tu archivo compose (luego ejecuta `docker compose up -d`). Usa esta vía para instalaciones de Docker y NAS sin navegador en el host. Marinara muestra un banner sobre el inicio de sesión que falta a los visitantes locales y a las sesiones iniciadas, como una tarjeta en la parte inferior de la pantalla.
- **En `.env`.** Agrega dos líneas:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Un inicio de sesión en `.env` prevalece sobre uno configurado en la app, y lo cambias solo en `.env`. Guarda `.env`; el cambio se aplica en un par de segundos, sin reiniciar.

Elige una contraseña fuerte y única. La app pide al menos 10 caracteres. Puedes generar una al azar:

```bash
openssl rand -base64 24
```

Luego sigue estos pasos desde el dispositivo remoto.

1. Abre Marinara en tu navegador usando la dirección del servidor, por ejemplo `http://192.168.1.50:7860`.
2. Inicia sesión en la página de inicio de sesión con tu nombre de usuario y tu contraseña.
3. Deberías ver la app cargarse. El navegador mantiene la sesión iniciada hasta por un año, hasta que cierres sesión. Los scripts y los clientes de API envían el nombre de usuario y la contraseña con cada solicitud (Basic Auth).

Para iniciar sesión en otro dispositivo sin escribir la contraseña, usa un código de emparejamiento. En un dispositivo que ya haya iniciado sesión, abre **Settings** → **Advanced** → **Access** y elige **Add a device**. Luego escribe el código en la página de inicio de sesión del dispositivo nuevo. El código funciona una vez, durante unos minutos. Un código vencido recibe su propio mensaje; crea uno nuevo. En **Signed-in devices** ves cada dispositivo con su método de inicio de sesión y la fecha en que inició sesión por primera vez. Puedes cerrar la sesión de cualquier dispositivo, incluido el que usas. También puedes cambiar o quitar la contraseña. Para eso, Marinara pide la contraseña actual, salvo que trabajes en la computadora que ejecuta Marinara o hayas configurado `ADMIN_SECRET`.

Si olvidas la contraseña, ejecuta `pnpm reset-login` en la computadora que ejecuta Marinara. En Docker, ejecuta `docker exec <container> node scripts/reset-login.mjs`. Elimina el inicio de sesión configurado en la app y cierra la sesión en todos los navegadores. Si el servidor escucha más allá de loopback, imprime entonces un código de configuración nuevo. Solo si ese comando no funciona, elimina `.remote-login.json` y `.remote-sessions.json` de la carpeta de datos. Con el valor predeterminado `/app/data`, ejecuta `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`; si cambiaste `DATA_DIR`, usa esa carpeta. Un inicio de sesión en `.env` lo cambias en `.env`.

**¿Servidor sin pantalla y sin navegador?** Una instalación nativa en un servidor sin pantalla escucha solo en loopback y no imprime ningún código de configuración. En tu propia computadora, ejecuta `ssh -L 7860:127.0.0.1:7860 user@server`. Luego abre `http://localhost:7860` allí y usa **Settings**.

Tras 10 contraseñas o códigos incorrectos distintos en 15 minutos, Marinara rechaza los inicios de sesión desde esa dirección con **429 Too Many Requests** (429 Demasiadas solicitudes) hasta que pasan los 15 minutos. Una contraseña correcta antes de ese momento borra el recuento. Los visitantes con un proxy inverso o un túnel en el host que reenvía comparten un recuento, y que uno de ellos inicie sesión no lo borra. Reiniciar el servidor también lo borra. Un navegador que ya inició sesión antes sigue entrando con la contraseña correcta, así que las contraseñas incorrectas de otras personas no pueden bloquearte el acceso desde un dispositivo que ya usas. La página de inicio de sesión te dice cuántos minutos esperar. Si olvidas la contraseña, la página de inicio de sesión tiene una pista **Forgot the password?** (¿Olvidaste la contraseña?).

De forma predeterminada, el aviso del navegador dice **Marinara Engine**. Puedes cambiar ese texto con `BASIC_AUTH_REALM`.

Algunos clientes se saltan la contraseña incluso con un inicio de sesión activado:

- Loopback (`127.0.0.1`, `::1`), así que nunca necesitas una contraseña en la propia máquina host. Los visitantes que reenvía un proxy inverso o un túnel en esa máquina sí la necesitan.
- Cualquier dirección en `IP_ALLOWLIST`. Cuidado: configurar una lista permitida también bloquea toda dirección que no esté en la lista (ver Opción 2).
- El tráfico directo de Tailscale (`100.64.0.0/10`), salvo que desactives su bypass.
- El tráfico de puente/puerta de enlace de Docker, solo mientras no haya inicio de sesión, lista permitida ni `TRUSTED_AUTH_PROXY` configurados (ver [Bypass de Tailscale y Docker](#tailscale-and-docker-bypass)).
- La dirección `/api/health`, para que los monitores de disponibilidad sigan funcionando. Quien no pueda abrir la app solo recibe `{"status": "ok"}`; los detalles de versión, sistema y modelos quedan en este equipo, las redes de confianza y los navegadores con sesión iniciada.

Importante: Basic Auth solo codifica la contraseña. No la cifra. Cualquiera que observe una conexión sin cifrar puede leerla. Si expones Marinara al internet público, combina Basic Auth con HTTPS (ver abajo).

## Opción 2: lista de IP permitidas

La lista de IP permitidas deja entrar direcciones específicas sin contraseña. Encaja bien cuando tus dispositivos tienen direcciones IP estables. Configura una lista de direcciones o rangos separados por comas:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

El `/24` del ejemplo es notación CIDR. CIDR es una forma corta de escribir todo un rango de direcciones en una sola entrada. Por ejemplo, `192.168.1.0/24` cubre todas las direcciones desde `192.168.1.0` hasta `192.168.1.255`. Una dirección sola, sin barra, como `203.0.113.42`, coincide solo con ese dispositivo.

Cómo se comporta la lista de IP permitidas:

- Toda dirección que no esté en la lista se rechaza con **403 Forbidden** (403 Prohibido).
- Loopback siempre está permitido, así que no puedes bloquearte a ti mismo el acceso local. Los visitantes que reenvía un proxy inverso o un túnel en la misma máquina no son loopback, así que la lista permitida los bloquea. Usa Basic Auth detrás de un proxy.
- En Docker Desktop, OrbStack y Docker sin root (rootless), todos los dispositivos llegan al contenedor desde la misma dirección de puerta de enlace, así que la lista permitida no puede distinguirlos. Usa Basic Auth en esos casos.
- El tráfico directo de Tailscale también se salta la lista. El tráfico de puente/puerta de enlace de Docker se la salta solo mientras no haya inicio de sesión, lista permitida ni `TRUSTED_AUTH_PROXY` válido configurados (ver [Bypass de Tailscale y Docker](#tailscale-and-docker-bypass)).
- Las entradas inválidas se ignoran y se registran. No hacen que el servidor se caiga.
- La lista permitida sigue siendo estricta incluso con Basic Auth activado. Las direcciones de la lista se saltan el aviso de contraseña. Toda otra dirección sigue bloqueada con **403 Forbidden** y nunca recibe un aviso de inicio de sesión.

La lista permitida no puede crear una configuración mixta en la que los dispositivos de la lista se salten la contraseña y todos los demás inicien sesión. Si quieres que otros dispositivos inicien sesión con una contraseña, deja `IP_ALLOWLIST` sin configurar y usa Basic Auth solo.

Puedes desactivar la aplicación de la regla por un rato sin borrar tu lista. Esto es útil al resolver problemas desde una IP nueva. Configura el indicador de activación en falso:

```env
IP_ALLOWLIST_ENABLED=false
```

## Bypass de red privada (referencia)

Algunos indicadores quitan el bloqueo para una red privada de confianza. Son para configuraciones especiales. Un inicio de sesión es la mejor opción. Consulta [Control de acceso](CONFIGURATION.md#access-control) para ver los indicadores y sus riesgos.

<a id="tailscale-and-docker-bypass"></a>

## Bypass de Tailscale y Docker

De forma predeterminada, Marinara confía en un dispositivo que se conecta directamente a tu red Tailscale. También confía en el propio host de un contenedor Docker. Un inicio de sesión, una lista de IP permitidas o `TRUSTED_AUTH_PROXY` detienen la confianza automática de Docker, así que cada dispositivo necesita entonces su inicio de sesión o su lugar en la lista permitida. Para ver los indicadores que cambian esto, consulta [Control de acceso](CONFIGURATION.md#access-control).

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Proxies inversos y túneles en la misma computadora

Un proxy inverso o un túnel en la máquina que ejecuta Marinara, como nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve o Funnel, o ngrok, se conecta a Marinara desde loopback. Marinara lo reconoce por los encabezados de reenvío que añade el proxy: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, los encabezados de identidad de Tailscale o `Via`. Marinara también reconoce una solicitud que llega por HTTP/1.0, porque los navegadores nunca lo usan pero un `proxy_pass` predeterminado de nginx sí. Marinara también reconoce una solicitud cuyo Host nombra a otra computadora, como un dominio o una dirección LAN, incluso cuando el proxy no añade encabezados. Entonces trata cada solicitud como el visitante remoto que es:

- El inicio de sesión se aplica (ver [Opción 1](#opción-1-inicio-de-sesión-recomendado)). Sin uno, los visitantes ven la página de configuración. Configura el inicio de sesión en **Settings** en esta computadora o en `.env`.
- `IP_ALLOWLIST` bloquea a los visitantes reenviados, porque el proxy oculta sus direcciones reales.
- Las acciones privilegiadas necesitan el secreto de administrador, y las funciones solo de loopback siguen sin estar disponibles.

Tu propio navegador en esa máquina, abierto en `http://127.0.0.1:7860` o `http://localhost:7860`, sigue sin contraseña.

Caddy, Traefik, Cloudflare Tunnel, Tailscale y ngrok añaden encabezados de reenvío de forma predeterminada. Para nginx, esta línea se sigue recomendando en el bloque `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Las herramientas que reenvían conexiones sin procesar, como `socat` o `ssh -R`, no añaden encabezados, así que su tráfico parece local. No las uses para publicar Marinara.

Si tu proxy ya hace iniciar sesión a cada visitante antes de reenviar algo, consulta [Proxies de inicio de sesión (forward auth)](#login-proxies-forward-auth).

<a id="login-proxies-forward-auth"></a>

## Proxies de inicio de sesión (forward auth)

Un proxy de forward auth, como [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io) u oauth2-proxy, pide a cada visitante iniciar sesión antes de reenviar la solicitud. Si un proxy así es la única forma de llegar a Marinara, puedes saltarte el segundo inicio de sesión de Marinara. No lo configures sin un proxy así.

Pon la dirección del proxy en `.env`:

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara deja entrar entonces cada solicitud cuya conexión venga de esa dirección. Marinara no pide su propio inicio de sesión para ellas, ni imprime ningún código de configuración. Marinara comprueba la dirección de la propia conexión. Ignora para esta decisión los encabezados de reenvío como `X-Forwarded-For`. Las solicitudes del proxy también pasan `IP_ALLOWLIST`, porque el proxy decide quién entra. No cuentan como locales, así que las acciones privilegiadas siguen necesitando el secreto de administrador. **Settings** → **Advanced** → **Access** muestra **Trusted login proxy: Set** mientras el ajuste está activo.

Antes de configurarlo:

- **El proxy debe pedir un inicio de sesión en cada ruta.** Eso incluye `/api/`, las conexiones WebSocket y los archivos estáticos. Una ruta que el proxy deja pasar sin inicio de sesión queda abierta para todos.
- **Marinara no debe ser accesible sin pasar por el proxy.** Enlaza Marinara a una dirección a la que solo llegue el proxy, o bloquea su puerto con un firewall. En Docker, pon el proxy y Marinara en la misma red Docker, dale al proxy una dirección fija en ella y no publiques el puerto de Marinara. Si el proxy se ejecuta en el host Docker, publica el puerto solo en loopback (`127.0.0.1:7860:7860`): Docker Desktop y OrbStack muestran cada cliente LAN como un puerto publicado en la dirección de la puerta de enlace de Docker, la misma dirección que el proxy. Si otro dispositivo puede conectarse directamente a Marinara, se salta el inicio de sesión del proxy.
- **Lista solo la dirección propia del proxy.** Un rango debe quedarse dentro del espacio de direcciones privadas; Marinara ignora los demás rangos. Registra una advertencia por cada rango, porque cada dispositivo de un rango se salta el inicio de sesión.
- **Añade el nombre público como para cualquier otro proxy.** Pon el nombre de host en `TRUSTED_HOSTS` y el origen en `CSRF_TRUSTED_ORIGINS` (ver [Por qué mi guardado está bloqueado (CSRF)](#por-qué-mi-guardado-está-bloqueado-csrf)).

Cuando `TRUSTED_AUTH_PROXY` está configurado, Marinara también detiene la confianza automática de Docker. Los visitantes directos que no son el proxy necesitan el inicio de sesión de Marinara o la lista de IP permitidas. Marinara deja entonces de mostrar también un banner de "no login yet" (todavía no hay inicio de sesión).

Si el proxy se ejecuta en la misma computadora que Marinara, usa `TRUSTED_AUTH_PROXY=127.0.0.1` y apunta el proxy a `127.0.0.1:7860`, no a `localhost:7860`. Un proxy que marca a `localhost` puede conectarse desde `::1`, que no coincide con `127.0.0.1`. Entonces también se confía en cualquier otro proxy o túnel de esa computadora, así que úsalo solo cuando el proxy de inicio de sesión sea el único. Esto no da a los visitantes con proxy el acceso de la máquina local.

Un ejemplo de Caddy, con Marinara en `192.168.1.20:7860`:

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Para Authelia, usa `forward_auth authelia:9091` con `uri /api/authz/forward-auth`. Authentik también sirve sus propias páginas de inicio de sesión a través del proxy. Pon sus líneas en un bloque `route` para que Caddy conserve su orden y la ruta del outpost no pase por el propio forward auth:

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Para Traefik y nginx, sigue la guía de forward-auth de tu proxy. Marinara no necesita nada más que la dirección del proxy.

## Servir por HTTPS

HTTPS cifra la conexión usando TLS. TLS es el cifrado que convierte una dirección `http` simple en una `https` segura. Usa siempre HTTPS para cualquier instalación accesible fuera de una red privada totalmente de confianza, sobre todo con Basic Auth.

Tienes dos formas de agregarlo.

1. TLS integrado. Apunta el servidor a un archivo de certificado y de clave privada:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Proxy inverso. Pon Marinara detrás de nginx, Caddy, Traefik o un Cloudflare Tunnel. El proxy maneja la parte de HTTPS y reenvía a Marinara por HTTP simple en la misma máquina. Lee primero [Proxies inversos y túneles en la misma computadora](#reverse-proxies-and-tunnels-on-the-same-computer).

Necesitas un certificado y una clave antes de configurar `SSL_CERT` y `SSL_KEY`. Puedes crear uno con una herramienta como `mkcert` para uso local, o `certbot` para un dominio público. Si los archivos faltan o no se pueden leer, el servidor se detiene al arrancar y nombra las rutas exactas que intentó.

## Admin Access y acciones privilegiadas

Algunas acciones son especialmente sensibles: borrar datos, crear o descargar copias de seguridad, importar y exportar perfiles, instalar temas e instalar el runtime del Local Model. Estas necesitan un secreto compartido aparte llamado el secreto de admin, además de la opción de acceso que hayas elegido arriba.

En la máquina loopback, estas acciones suelen funcionar sin secreto de admin. Desde un dispositivo remoto, necesitas configurar el secreto. Sigue estos pasos.

1. En `.env`, configura un valor aleatorio fuerte y guarda. Se aplica en un par de segundos, sin reiniciar.

```env
ADMIN_SECRET=some-long-random-string
```

2. En el dispositivo remoto, abre Marinara y ve a **Settings** (Configuración), luego a la pestaña **Advanced** (Avanzado), luego a la sección **Admin Access** (Acceso de administrador).
3. Pega el mismo valor en la casilla (su marcador de posición dice **ADMIN_SECRET**), luego haz clic en **Save** (Guardar).
4. Deberías ver el mensaje **Admin secret saved for this browser** (Secreto de admin guardado para este navegador).

Algunas cosas que conviene saber sobre el secreto de admin:

- Se guarda solo en ese navegador. No se sincroniza entre dispositivos. Cada navegador que necesite acciones privilegiadas debe pegarlo por separado.
- Hacer clic en **Save** con la casilla vacía lo borra y muestra **Admin secret cleared** (Secreto de admin borrado).
- Si el operador del servidor configura `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, incluso la máquina loopback necesita el secreto.
- Esto es aparte de Basic Auth. Puedes usar ambos. Basic Auth protege toda la app, y el secreto de admin protege las acciones peligrosas.

Si una acción privilegiada falla en un dispositivo remoto, Marinara muestra un mensaje de error con dos soluciones. Una solución es abrir la app a través de localhost. La otra es configurar `ADMIN_SECRET` en el `.env` del servidor, luego pegar el mismo valor en **Settings** > **Advanced** > **Admin Access**.

## Por qué mi guardado está bloqueado (CSRF)

CSRF significa cross-site request forgery (falsificación de solicitud entre sitios). Es una protección que impide que otro sitio web que tengas abierto haga cambios silenciosamente en Marinara sin tu permiso. Funciona automáticamente. No hay ningún ajuste para activarlo.

A veces CSRF bloquea tus propios guardados. Esto suele pasar cuando llegas a Marinara a través de un nombre de dominio público o un puerto inusual en el que el servidor aún no confía. Dos cosas te avisan cuando esto pasa.

- Un banner rojo en la parte superior de la app advierte que **Saves will silently fail** (Los guardados fallarán en silencio) porque este origen no es de confianza. El banner muestra la línea `.env` exacta que hay que agregar y tiene un botón **Copy** (Copiar).
- Si un guardado se rechaza de verdad, aparece un pequeño mensaje emergente. Su título es **Save blocked: missing CSRF header** (Guardado bloqueado: falta el encabezado CSRF), **Save blocked: cross-site request rejected** (Guardado bloqueado: solicitud entre sitios rechazada) o **Save blocked: origin not trusted** (Guardado bloqueado: origen no confiable).

Para arreglarlo, agrega tu dirección a la lista de confianza en `.env`:

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Cuando usas un dominio público o de proxy inverso, permite también el nombre de host:

```env
TRUSTED_HOSTS=chat.example.com
```

Las direcciones directas de LAN, Tailscale, IPv4 e IPv6 no necesitan `TRUSTED_HOSTS`. Los nombres locales `.local`/`.home.arpa` y los nombres de máquina de una sola etiqueta se aceptan automáticamente. Un nombre de host exacto que ya esté en `CSRF_TRUSTED_ORIGINS` también se acepta.

Loopback, las direcciones normales de LAN, Tailscale (`100.64.0.0/10`) y los orígenes de puente de Docker (`172.16.0.0/12`) son de confianza automáticamente. Solo necesitas listar direcciones IP públicas y nombres de dominio. El cambio surte efecto en un par de segundos, sin necesidad de reiniciar.

## Una nota sobre proveedores locales bloqueados

Digamos que conectas Marinara a un proveedor de IA local, por ejemplo uno que se ejecuta en tu propia máquina. La solicitud puede rechazarse con un mensaje sobre un "private, loopback, metadata, or reserved IP range" (rango de IP privado, loopback, de metadatos o reservado). Esa es una comprobación de seguridad distinta llamada protección SSRF. SSRF significa server-side request forgery (falsificación de solicitud del lado del servidor). Impide que el servidor llame a direcciones privadas salvo que lo permitas. El error nombra la variable `.env` exacta que hay que configurar, como `PROVIDER_LOCAL_URLS_ENABLED`. Consulta [Referencia de configuración del servidor](CONFIGURATION.md) para ver la lista completa.

## Acceso desde un teléfono o una tableta

Para abrir Marinara desde un teléfono o una tableta en la misma red:

1. Asegúrate de que el servidor escuche en todas las interfaces con `HOST=0.0.0.0` en `.env`.
2. Configura un inicio de sesión (Opción 1 arriba). Desde el teléfono, puedes hacerlo en la página que lo bloquea, con el código de configuración del registro del servidor.
3. Encuentra la dirección IP local de la máquina del servidor (por ejemplo `192.168.1.50`).
4. En el teléfono, abre `http://192.168.1.50:7860` en un navegador. El puerto predeterminado es `7860`.
5. Inicia sesión con tu nombre de usuario y tu contraseña.

Si la página no carga en absoluto, puede que el servidor no sea accesible. Revisa `HOST=0.0.0.0` y el valor de `PORT`. Si en cambio recibes un 403, tu dispositivo es accesible pero aún no está permitido. Vuelve a revisar la opción que elegiste arriba.

<a id="locked-out-after-updating"></a>

## Bloqueado después de actualizar

Las versiones nuevas piden un inicio de sesión cuando una visita llega a través de un proxy inverso, un túnel, Tailscale Serve o Tailscale Funnel. Las versiones anteriores dejaban entrar estas visitas sin contraseña. Si ahora ves una página de inicio de sesión, una página de configuración o un **403**, esta es la razón.

**Nota de actualización:** si usas Tailscale Serve, u otro proxy en la misma computadora, y nunca configuraste una contraseña, tus otros dispositivos quedan bloqueados tras la actualización. Un proxy en la misma computadora suele hablar con un servidor que escucha solo en loopback, así que el servidor no imprime ningún código de configuración. Configura en su lugar el inicio de sesión en la computadora que ejecuta Marinara.

Para volver a entrar:

1. Abre Marinara en la computadora que lo ejecuta, en `http://localhost:7860` (o en tu propio `PORT`). El uso local no necesita contraseña. En un servidor sin pantalla, ejecuta primero `ssh -L 7860:127.0.0.1:7860 user@server` en tu propia computadora y luego abre allí `http://localhost:7860`. En Docker, esto solo funciona mientras no haya inicio de sesión ni `IP_ALLOWLIST` configurados. En otro caso, escribe el código de configuración del registro del servidor (`docker logs <container> 2>&1 | grep "setup code"`) en la página que te bloquea o en **Settings** → **Advanced** → **Access**, o usa un navegador que aún tenga la sesión iniciada.
2. Ve a **Settings** → **Advanced** → **Access** y configura un nombre de usuario y una contraseña en **Remote login**. O abre el archivo `.env` de esa computadora y configura `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`. Si `IP_ALLOWLIST` está configurado, añade la dirección de tu otro dispositivo a la lista o quítala, porque un dispositivo que no está en la lista recibe un **403** incluso con un inicio de sesión.
3. Inicia sesión desde tu otro dispositivo con ese usuario y contraseña.

## Buscadores

Marinara pide a los buscadores que no indexen sus páginas (`X-Robots-Tag: noindex, nofollow`). Esto no protege tu instalación ni elimina las páginas que ya están indexadas. Usa los controles de acceso de arriba para mantener tu instalación privada.

## Guías relacionadas

- [Referencia de configuración del servidor](CONFIGURATION.md) para ver la lista completa de ajustes de `.env` y casos límite.
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md) para errores de conexión, acceso móvil y más.
- [Preguntas frecuentes](FAQ.md) para un recorrido rápido sobre cómo llegar a Marinara desde otro dispositivo.
