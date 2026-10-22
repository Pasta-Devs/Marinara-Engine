# Acceso remoto: Basic Auth y lista de IP permitidas

Esta guía explica cómo llegar a Marinara Engine desde otro dispositivo, como tu teléfono, una laptop o un contenedor de Docker. Cubre las dos opciones principales: Basic Auth y la lista de IP permitidas. También cubre el bypass de red privada, HTTPS, Admin Access y el mensaje CSRF de "save blocked" (guardado bloqueado). Casi todos los ajustes de aquí viven en el archivo `.env` del servidor, no en la app.

Una lista rápida de palabras que se usan en toda esta guía:

- archivo `.env`: un archivo de texto plano con ajustes, en la carpeta de Marinara Engine, junto a `package.json`.
- Loopback: la máquina que en realidad está ejecutando el servidor. Su dirección es `127.0.0.1` o `localhost`.
- Acceso remoto: abrir Marinara desde cualquier dispositivo que NO sea la máquina que ejecuta el servidor.

## Lo que Marinara bloquea de forma predeterminada

Para proteger tus datos, una instalación nueva de Marinara rechaza las conexiones de otros dispositivos hasta que configuras el control de acceso. De forma predeterminada, solo se confía en tres tipos de cliente:

1. Loopback (`127.0.0.1` o `::1`), la máquina que ejecuta el servidor. Los visitantes que reenvía un proxy inverso o un túnel en la misma máquina no cuentan; consulta [Proxies inversos y túneles en la misma computadora](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Dispositivos de Tailscale en tu tailnet. Tailscale es una herramienta de red privada, y sus direcciones usan el rango `100.64.0.0/10`.
3. Clientes de Docker en el mismo host. Marinara reconoce el rango de puente habitual `172.16.0.0/12` y la puerta de enlace predeterminada exacta del contenedor, lo que también cubre Docker Desktop y los grupos de direcciones personalizados.

Todo lo demás, como tu teléfono en la misma Wi-Fi o un cliente de internet público, queda bloqueado hasta que elijas una opción de abajo. Un dispositivo bloqueado que abre Marinara en un navegador ve una página de configuración oscura. Su título dice **This Marinara Engine install needs access control before remote devices can connect.** (Esta instalación de Marinara Engine necesita control de acceso antes de que los dispositivos remotos puedan conectarse.) La página muestra la propia IP de tu dispositivo y dos fragmentos `.env` listos para copiar y pegar.

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
2. Quieres llegar a Marinara desde un teléfono, una tableta o una laptop en la Wi-Fi de tu casa. Usa Basic Auth (Opción 1, abajo).
3. Estás exponiendo Marinara al internet público. Usa Basic Auth más HTTPS.
4. Tus dispositivos cliente tienen direcciones IP fijas y prefieres no escribir una contraseña. Usa la lista de IP permitidas (Opción 2, abajo).
5. Toda tu red es de confianza y nunca quieres una contraseña. Usa el bypass de red privada (Opción 3, abajo). Lee primero la advertencia que hay ahí.

Basic Auth es la opción más flexible. Funciona desde cualquier IP, no necesita configuración por dispositivo, y el navegador recuerda el inicio de sesión.

## Opción 1: Basic Auth (recomendada)

Basic Auth significa que el navegador pide un nombre de usuario y una contraseña antes de dejarte entrar. Para activarlo, agrega dos líneas a `.env`:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Elige una contraseña fuerte y única. Basic Auth envía tu inicio de sesión con cada solicitud, así que trátala como cualquier otra contraseña de cuenta. Puedes generar una al azar:

```bash
openssl rand -base64 24
```

Guarda `.env`. El cambio se aplica en un par de segundos, sin reiniciar. Luego sigue estos pasos desde el dispositivo remoto.

1. Abre Marinara en tu navegador usando la dirección del servidor, por ejemplo `http://192.168.1.50:7860`.
2. Escribe el nombre de usuario y la contraseña que configuraste cuando el navegador te lo pida.
3. Deberías ver la app cargarse. El navegador recuerda el inicio de sesión durante el resto de la sesión.

Después de 10 contraseñas incorrectas distintas en 15 minutos, Marinara rechaza los inicios de sesión desde esa dirección con **429 Too Many Requests** (429 Demasiadas solicitudes) hasta que pasan los 15 minutos. Una contraseña correcta antes de ese momento borra el recuento. Los visitantes que reenvía un proxy inverso o un túnel en el host comparten un mismo recuento, y que uno de ellos inicie sesión no lo borra. Reiniciar el servidor también lo borra. Un navegador que ya inició sesión antes sigue entrando con la contraseña correcta, así que las contraseñas incorrectas de otras personas no pueden bloquearte el acceso desde un dispositivo que ya usas.

De forma predeterminada, el aviso del navegador dice **Marinara Engine**. Puedes cambiar ese texto con `BASIC_AUTH_REALM`.

Algunos clientes se saltan la contraseña incluso con Basic Auth activado:

- Loopback (`127.0.0.1`, `::1`), así que nunca necesitas una contraseña en la propia máquina host. Los visitantes que reenvía un proxy inverso o un túnel en esa máquina sí la necesitan.
- Cualquier dirección en `IP_ALLOWLIST`. Cuidado: configurar una lista permitida también bloquea toda dirección que no esté en la lista (ver Opción 2).
- El tráfico directo de Tailscale (`100.64.0.0/10`), salvo que desactives su bypass.
- El tráfico de puente/puerta de enlace de Docker, solo cuando estableces `BYPASS_AUTH_DOCKER=true`. Con Basic Auth activado, la confianza automática en Docker está desactivada (ver [Bypass de Tailscale y Docker](#tailscale-and-docker-bypass)).
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
- El tráfico directo de Tailscale también se salta la lista, salvo que desactives su bypass. El tráfico de puente/puerta de enlace de Docker solo se la salta cuando estableces `BYPASS_AUTH_DOCKER=true` (ver [Bypass de Tailscale y Docker](#tailscale-and-docker-bypass)).
- Las entradas inválidas se ignoran y se registran. No hacen que el servidor se caiga.
- La lista permitida sigue siendo estricta incluso con Basic Auth activado. Las direcciones de la lista se saltan el aviso de contraseña. Toda otra dirección sigue bloqueada con **403 Forbidden** y nunca recibe un aviso de inicio de sesión.

La lista permitida no puede crear una configuración mixta en la que los dispositivos de la lista se salten la contraseña y todos los demás inicien sesión. Si quieres que otros dispositivos inicien sesión con una contraseña, deja `IP_ALLOWLIST` sin configurar y usa Basic Auth solo.

Puedes desactivar la aplicación de la regla por un rato sin borrar tu lista. Esto es útil al resolver problemas desde una IP nueva. Configura el indicador de activación en falso:

```env
IP_ALLOWLIST_ENABLED=false
```

## Opción 3: bypass de red privada (sin contraseña)

Puede que toda tu red sea de confianza, por ejemplo una LAN doméstica (red local) sin reenvío de puertos. En ese caso, puedes quitar el bloqueo sin configurar una contraseña:

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

Esto restaura el comportamiento antiguo de "abierto en la LAN, bloqueado desde el internet público". Se aplica solo a los rangos estándar de red privada, por ejemplo `10.0.0.0/8`, `172.16.0.0/12` y `192.168.0.0/16`. El rango CGNAT `100.64.0.0/10` no cuenta, porque algunos proveedores de internet lo comparten entre clientes que no tienen relación; añádelo a `TRUSTED_PRIVATE_NETWORKS` solo si confías en él. Las direcciones del internet público siguen bloqueadas con un 403. Algunos proveedores de internet y de telefonía móvil dan a sus clientes direcciones de este rango. Si lo añades, los demás clientes del mismo proveedor también cuentan como clientes de red privada. `TRUSTED_PRIVATE_NETWORKS` reemplaza los rangos predeterminados, así que mantén en la lista los rangos de LAN que aún necesites.

Advertencia: cualquiera en la misma red podrá entonces llegar a Marinara sin contraseña. Eso está bien en una red que tú controlas. No está bien en una Wi-Fi compartida de una cafetería, un aeropuerto o una residencia. En caso de duda, usa Basic Auth en su lugar.

También hay un indicador más amplio, `ALLOW_UNAUTHENTICATED_REMOTE=true`, que permite el acceso sin contraseña desde CUALQUIER dirección, incluido el internet público. No lo actives. Si de verdad necesitas acceso público, usa Basic Auth más HTTPS, o pon delante un proxy inverso que maneje el inicio de sesión.

<a id="tailscale-and-docker-bypass"></a>

## Bypass de Tailscale y Docker

Dos indicadores permiten que el tráfico directo de Tailscale y Docker se salte tanto la lista de IP permitidas como Basic Auth, igual que hace loopback. Déjalos vacíos para la detección automática:

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

El modo automático solo confía en un dispositivo de Tailscale cuando se conecta directamente a la dirección de Tailscale de este equipo. En Linux, una interfaz de Tailscale con nombre personalizado (`tailscaled --tun=...`) no es de confianza automática; inicia sesión o establece `BYPASS_AUTH_TAILSCALE=true`. Solo confía en el tráfico de Docker cuando Marinara se ejecuta en un contenedor y el origen coincide con una interfaz de contenedor detectada o con su puerta de enlace exacta. Así, la configuración privada habitual de Tailscale y Docker en el mismo host sigue funcionando sin tratar como autenticado el tráfico no relacionado de CGNAT, LAN, red del anfitrión o proxy.

La confianza automática en Docker solo se aplica mientras no estén configurados ni Basic Auth ni `IP_ALLOWLIST`. Docker Desktop, OrbStack y Docker sin root hacen pasar por la puerta de enlace del contenedor a todo dispositivo que abra un puerto publicado, así que Marinara no puede distinguir tu propio navegador de un teléfono o de un desconocido en la red. En cuanto configuras una contraseña o una lista permitida, todo cliente de Docker debe superarla, incluido el navegador del host. Establece `BYPASS_AUTH_DOCKER=true` solo si confías en todos los dispositivos que pueden llegar al puerto publicado.

Pon un indicador en `false` si quieres aplicar a esos clientes las comprobaciones normales de Basic Auth y de la lista de IP permitidas. Ponlo en `true` para conservar el bypass amplio anterior cuando la detección automática no esté disponible: Tailscale confiará en todo `100.64.0.0/10`, mientras que Docker también confiará en sus interfaces y puerta de enlace detectadas y en el rango heredado `172.16.0.0/12`. Usa este modo de compatibilidad solo si todos los pares que coincidan son de confianza.

Los visitantes de Tailscale Serve y Funnel se conectan desde loopback con encabezados de reenvío, así que deben iniciar sesión. No hay ningún indicador para desactivarlo. Una conexión directa `100.x` sigue sin contraseña.

Por ejemplo, si tu tailnet incluye pares de menor confianza, desactiva el bypass de Tailscale:

```env
BYPASS_AUTH_TAILSCALE=false
```

Si no quieres que los pares de Docker detectados eviten la autenticación, desactiva el bypass de Docker y añade clientes específicos a `IP_ALLOWLIST` si hace falta:

```env
BYPASS_AUTH_DOCKER=false
```

Puede que Marinara también esté detrás de un contenedor de proxy inverso o de túnel en el puente de Docker o en la puerta de enlace detectada. Los encabezados de reenvío, como `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host` o `X-Forwarded-Proto`, indican que el par de Docker representa a otro cliente. Un Host que apunta a otro equipo, como `marinara:7860` o un nombre público, o una solicitud HTTP/1.0 hace lo mismo. Entonces Marinara aplica sus comprobaciones normales de Basic Auth y de lista de IP permitidas de forma predeterminada:

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

Para restaurar el bypass antiguo, configura esto en `false`. Hazlo solo cuando el propio proxy exija un inicio de sesión a cada visitante, porque los clientes reenviados heredarán el estado sin contraseña de Docker. Si pones un proxy delante de Docker, conserva la publicación del puerto en `127.0.0.1` de `docker-compose.yml` y configura primero un inicio de sesión.

El servidor registra una advertencia `[auth-bypass]` la primera vez que uno de estos bypasses deja pasar una solicitud. Esa advertencia confirma que el bypass está activo.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Proxies inversos y túneles en la misma computadora

Un proxy inverso o un túnel en la máquina que ejecuta Marinara, como nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve o Funnel, o ngrok, se conecta a Marinara desde loopback. Marinara lo reconoce por los encabezados de reenvío que añade el proxy: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, los encabezados de identidad de Tailscale o `Via`. Marinara también reconoce una solicitud que llega por HTTP/1.0, porque los navegadores nunca la usan pero el `proxy_pass` predeterminado de nginx sí. Marinara también reconoce una solicitud cuyo Host apunta a otro equipo, como un dominio o una dirección de la LAN, aunque el proxy no añada encabezados. Entonces trata cada solicitud como lo que es, un visitante remoto:

- Se aplica Basic Auth, así que configura `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`. Sin ellos, los visitantes ven la página de configuración.
- `IP_ALLOWLIST` bloquea a los visitantes reenviados, porque el proxy oculta sus direcciones reales.
- Las acciones privilegiadas necesitan el secreto de administrador, y las funciones solo para loopback siguen sin estar disponibles.

Tu propio navegador en esa máquina, abierto en `http://127.0.0.1:7860` o `http://localhost:7860`, sigue sin pedir contraseña.

Caddy, Traefik, Cloudflare Tunnel, Tailscale y ngrok añaden encabezados de reenvío de forma predeterminada. Para nginx, esta línea sigue siendo recomendable en el bloque `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Las herramientas que reenvían conexiones sin procesar, como `socat` o `ssh -R`, no añaden encabezados, así que su tráfico parece local. No las uses para publicar Marinara.

Si tu proxy ya obliga a cada visitante a iniciar sesión antes de reenviar nada, puedes omitir las comprobaciones propias de Marinara para su tráfico. Hazlo solo cuando el propio proxy exija un inicio de sesión a cada visitante:

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

Entonces los visitantes obtienen el mismo acceso completo que la máquina host, incluidas las acciones privilegiadas sin el secreto de administrador. Si solo llegas a Marinara por un nombre que añadiste a `/etc/hosts`, no uses este indicador. Usa un nombre `*.localhost`, por ejemplo `marinara.localhost`.

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
2. Elige una opción de acceso de arriba. Basic Auth es la más simple para un teléfono en la Wi-Fi de tu casa.
3. Encuentra la dirección IP local de la máquina del servidor (por ejemplo `192.168.1.50`).
4. En el teléfono, abre `http://192.168.1.50:7860` en un navegador. El puerto predeterminado es `7860`.
5. Si configuraste Basic Auth, escribe tu nombre de usuario y contraseña cuando se te pida.

Si la página no carga en absoluto, puede que el servidor no sea accesible. Revisa `HOST=0.0.0.0` y el valor de `PORT`. Si en cambio recibes un 403, tu dispositivo es accesible pero aún no está permitido. Vuelve a revisar la opción que elegiste arriba.

<a id="locked-out-after-updating"></a>

## Bloqueado después de actualizar

Las versiones nuevas piden un inicio de sesión cuando una visita llega a través de un proxy inverso, un túnel, Tailscale Serve o Tailscale Funnel. Las versiones anteriores dejaban entrar estas visitas sin contraseña. Si ahora ves una página de inicio de sesión, una página de configuración o un **403**, esta es la razón.

Para volver a entrar:

1. Abre Marinara en la computadora que lo ejecuta, en `http://localhost:7860` (o en tu propio `PORT`). El uso local no necesita contraseña. En Docker, esto solo es cierto mientras no haya un inicio de sesión ni `IP_ALLOWLIST` configurados. En otro caso, usa tu inicio de sesión.
2. Abre el archivo `.env` en esa computadora y configura `BASIC_AUTH_USER` y `BASIC_AUTH_PASS`. Si `IP_ALLOWLIST` está configurado, añade la dirección de tu otro dispositivo o quítalo, porque un dispositivo que no está en la lista recibe un **403** incluso con inicio de sesión.
3. Guarda el archivo. Marinara detecta el cambio en unos segundos. Si no lo hace, o si usas Docker, reinicia Marinara. Después inicia sesión desde tu otro dispositivo con ese usuario y contraseña.

## Buscadores

Marinara pide a los buscadores que no indexen sus páginas (`X-Robots-Tag: noindex, nofollow`). Esto no protege tu instalación ni elimina las páginas que ya están indexadas. Usa los controles de acceso de arriba para mantener tu instalación privada.

## Guías relacionadas

- [Referencia de configuración del servidor](CONFIGURATION.md) para ver la lista completa de ajustes de `.env` y casos límite.
- [Solución de problemas de Marinara Engine](TROUBLESHOOTING.md) para errores de conexión, acceso móvil y más.
- [Preguntas frecuentes](FAQ.md) para un recorrido rápido sobre cómo llegar a Marinara desde otro dispositivo.
