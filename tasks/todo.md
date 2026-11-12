# Fidelhop PWA - Plan (versión simple)

Diseño: `fidelhop.pen` (landing + 10 pantallas móvil cliente/comercio/delivery).

## Stack
- **TypeScript** en todo el proyecto (`pnpm typecheck`). Servidor: Node ejecuta `.ts` directo (type stripping, sin build; solo sintaxis borrable, imports con extensión `.ts`)
- Node + **Express** (un solo proceso: API + estáticos de la PWA)
- **MongoDB** (driver oficial `mongodb`, colecciones `clientes` y `sellos`), reemplaza al Excel
- Frontend: **React + Vite** (JS/JSX), `react-router`, `vite-plugin-pwa` (manifest + service worker)
- Estilos: **Tailwind CSS v4** (`@tailwindcss/vite`), colores y fuentes del .pen como tokens en `@theme`
- QR: `qrcode.react` para generar; escaneo con librería propia (`qr-scanner` o `@yudiel/react-qr-scanner`), NO `BarcodeDetector` (no existe en Safari/iOS ni Firefox)
- Express sirve `dist/` en producción; en dev Vite hace proxy de `/api` a Express
- Docker: `Dockerfile` multi-stage con imagen LTS (`node:24-alpine` (necesita type stripping estable), no Node 26) (build de Vite -> imagen final con Express) + `docker-compose.yml` con 2 servicios: `app` y `mongo` (volumen para los datos), ambos con `restart: unless-stopped`

## Alcance
- Un solo comercio (Casa Lola). Nombre, sellos requeridos (10) y premio viven en `config.js`
- Todo el acceso a Mongo pasa por `db.js` (conexión + funciones de datos); `MONGO_URL` por variable de entorno
- Índices únicos: `clientes.whatsapp`, `clientes.codigo`, `sellos.pedido` (garantiza QR de un solo uso)
- Caja: PIN en `config.js` -> sesión con cookie `httpOnly`, límite de intentos (no PIN suelto en header)
- **Identidad del cliente = su número de WhatsApp.** Al ingresar a `/app` escribe su número: se crea (o recupera) su tarjeta y una cookie firmada `httpOnly` (180 días) la recuerda. Sin tokens en URLs ni paso de "vincular". `CL-XXXX` queda solo como código corto para el QR del mostrador
- **Fidelizar (flujo principal):** la persona de caja toca *Fidelizar*, escribe el WhatsApp del cliente y se genera un **QR + enlace copiable de un solo uso** (`/f/<código>`, 48 h) asociado a ese número. El cliente lo abre desde donde sea: entra a su tarjeta sin escribir nada y se suma el sello. No hay "pedidos" ni número de pedido
- **Un token activo por número y 1 hora de espera:** al volver a pulsar Fidelizar para el mismo número dentro de la hora, si el enlace sigue sin usar se devuelve el mismo (aviso "mismo QR"); si ya se usó, 429 con los minutos que faltan (`ESPERA_REQUERIDA`). Pasada la hora se genera uno nuevo y el anterior sin usar queda anulado (`ENLACE_EXPIRADO`). La hora se cuenta desde que se creó el enlace. **Parámetro en Mongo:** colección `ajustes`, documento `{_id:'general', enlaceEsperaMinutos: 60}`; se crea al arrancar (sin pisar el existente) y se lee en cada petición, así que se cambia sin reiniciar: `db.ajustes.updateOne({_id:'general'},{$set:{enlaceEsperaMinutos:30}})`. 0 = sin espera; un valor inválido usa el de `config.ts` (60)
- **Sin sello manual:** se quitó "Añadir sello" (botón y ruta). Todo sello nace de un token. La ficha de caja solo consulta, canjea y lleva a Fidelizar con el número prellenado
- El sello se suma con un **POST** desde la app, no con el GET de abrir la página, para que las vistas previas de WhatsApp no gasten el enlace. Con la tarjeta completa el enlace no se consume
- Sin enlace, el cliente también puede entrar a `/app` escribiendo su número (ve su tarjeta con el WhatsApp enmascarado)
- Riesgo asumido: ese acceso por número no se verifica (sin código OTP). Mitigaciones: límite de 20 entradas/15 min por IP y números enmascarados. Si molesta, añadir verificación
- Caja: Fidelizar, buscar cliente por número o código, sumar sello a mano y canjear; validación de entradas en el servidor
- WhatsApp con enlace `wa.me` (sin API de Meta)
- Fuera de alcance: multi-comercio, Apple/Google Wallet

## Despliegue y PWA (servidor en el notebook del usuario)
- Cámara y service worker exigen **HTTPS**: exponer con **Cloudflare Tunnel** (o Tailscale Funnel). **Decidido: subdominio gratuito del túnel** (sin dominio propio). Con Cloudflare, el túnel rápido (`trycloudflare.com`) cambia de URL en cada reinicio: para QR impresos hace falta una URL estable (túnel con nombre, o Tailscale Funnel que da un nombre fijo `*.ts.net`). Elegir al llegar a B9 y verificarlo. `BASE_URL` por variable de entorno
- Respaldo diario con `mongodump` (cron o servicio en compose) a una carpeta fuera del volumen
- Cuidar suspensión/apagado del notebook; IP cambiante cubierta por el túnel
- `vite-plugin-pwa`: instalar y verificar compatibilidad con Vite 8; si falla, usar `workbox` directo
- iOS: instalar con "Añadir a pantalla de inicio" (sin aviso automático), push limitado -> el aviso al cliente va por WhatsApp (`wa.me`)

## Estructura
```
saasfull/
  server/
    index.ts    arranque: Mongo + Express + sirve dist/
    app.ts      rutas HTTP, sesiones por cookie firmada, límites de intentos
    repo.ts     acceso a datos y reglas (clientes, pedidos, movimientos)
    config.ts   nombre, sellos requeridos, premio; PIN y secretos por entorno
    tipos.ts, errors.ts, tiempo.ts
  src/          React: pages/ (Inicio, ClienteGate, Tarjeta, Escanear, Sello, Caja*, Ticket), components/, styles
  public/       iconos de la PWA
  vite.config.js
  Dockerfile, docker-compose.yml
```

## FASE 1 - Solo maqueta (ahora)
Solo frontend, datos de mentira en el código. Sin Express, Mongo ni Docker.
- [x] M1. Scaffold Vite + React + Tailwind (solo deps de frontend, pnpm) - `pnpm build` OK
- [x] M2. Tokens del .pen en Tailwind `@theme` (`src/index.css`)
- [ ] M3. Landing (pendiente; `/` es ahora un índice temporal `Maqueta.jsx`)
- [x] M4. Cliente: Mi tarjeta, Escanear, Sello sumado, Almuerzo gratis (falta pantalla WhatsApp)
- [x] M5. Comercio: Inicio, Nuevo cliente, Cliente vinculado, Sumar sello
- [x] M6. Ticket delivery
- [ ] M7. Comparar con el .pen y revisar con el usuario

## FASE 2 - Backend y PWA (después de aprobar la maqueta)
- [x] B1. Servidor Express (`server/index.ts`, `config.ts` por entorno; sin PIN por defecto); sirve `dist/`; proxy `/api` en Vite
- [x] B2. `server/repo.ts` (TDD): `clientes` (único por `whatsapp`), `pedidos`, `movimientos`; operaciones atómicas
- [x] B3. `server/app.ts` (TDD): entrar por número, tarjeta, escanear pedido, caja (alta/búsqueda/sellos/canje/pedidos/resumen/movimientos)
- [x] B4. Sesiones: caja (PIN, 12 h, bloqueo tras 5 fallos) y cliente (180 d, 20 altas/15 min por IP)
- [x] B5. Pantallas conectadas a la API en TSX. Rutas: `/app`, `/app/escanear` (pegar enlace/código), `/app/sello`, `/f/:codigo` (enlace de un solo uso), `/caja`, `/caja/fidelizar`, `/caja/sumar[/:codigo]`
  - Pendiente: revisión visual con captura (el navegador de Pencil dio timeout); pantalla de WhatsApp del diseño (ya no aplica: no hay envío de tarjeta por enlace); landing
  - El código del pedido y del cliente se teclea; la cámara es B6
- [x] B6. **Escáner de la caja** (`/caja/escanear`, `qr-scanner`): lee el QR de la tarjeta del cliente (`CL-XXXX`) y abre su ficha; rechaza QR que no son de un cliente (p. ej. enlaces de sello). Probado con cámara falsa en Chromium. En celular real exige HTTPS (o localhost) y permiso de cámara. Pendiente: la pantalla del cliente `/app/escanear` aún tiene un visor decorativo sin cámara (solo funciona pegando el enlace)
- [x] B6d. **Correo y PIN guardados en la base; el login solo compara.** `ajustes.correo` y `ajustes.pinHash` (PIN cifrado con scrypt + sal, nunca en claro). Se cargan **una sola vez** al arrancar desde `CAJA_EMAIL` y `CAJA_PIN` (si ya existen en la base, **la base manda** y cambiar el entorno no los pisa). El servidor se niega a arrancar si la base no tiene correo y PIN (define `CAJA_EMAIL` + `CAJA_PIN`). Login siempre con correo + PIN (el correo no distingue mayúsculas); error genérico `CREDENCIALES_INCORRECTAS` que no revela cuál falló; los fallos cuentan para el bloqueo de 5 intentos. En Opciones se cambia el correo y el PIN (el PIN pide el actual, mínimo 6 caracteres, y los fallos también cuentan para el bloqueo). Sin nota de "primer ingreso". No envía ni verifica correos. Recuperación si se olvidan: borrar `correo` y `pinHash` de `ajustes` en Mongo y reiniciar con `CAJA_EMAIL`/`CAJA_PIN`. Portada: se quitó "Soy cliente"; queda "Ingresar a la tienda". **Producción:** antes de desplegar este código hay que poner `CAJA_EMAIL` en Render; el `CAJA_PIN` actual se guarda cifrado en el primer arranque
- [x] B6c. **Nombre de la tienda editable** (Opciones de la caja): campo de 1 a 40 caracteres (se recorta y colapsan espacios; sin saltos de línea). Guarda en `ajustes.nombre` de Mongo (`PUT /api/caja/ajustes` acepta `nombre` y/o `enlaceEsperaMinutos`, actualización parcial). Se refleja en la sesión de caja, la tarjeta y pantalla de sello del cliente, el QR/ticket y el mensaje de WhatsApp. El valor de `config.nombre` ('Casa Lola') es el inicial y el respaldo si el de Mongo falta o es inválido. `init` añade el nombre a ajustes antiguos sin pisar uno cambiado
- [x] B6b. **Opciones de la caja** (`/caja/opciones`, engranaje en el inicio): interruptor para quitar o activar la espera entre códigos y minutos (atajos 15 min / 30 min / 1 h / 2 h o un valor de 1 a 1440). Guarda en `ajustes` de Mongo (`GET/PUT /api/caja/ajustes`, validado en el servidor); se aplica al instante. Con 0, cada vez que se genera un código se crea uno nuevo y el anterior sin usar queda anulado
- [ ] B7. PWA instalable: manifest, iconos, service worker (tarjeta/QR offline)
- [x] B8. Docker: `Dockerfile` multi-stage `node:24-alpine`, usuario `node`, `.dockerignore`. Probado: arranca, `/healthz` 200, API 401 sin sesión, cookie `Secure; HttpOnly; SameSite=Strict`
- [x] B9. Despliegue en **Render**: Blueprint `render.yaml` (servicio web Docker, plan `free`, región virginia, `/healthz`; `SESSION_SECRET` generado; `CAJA_PIN`, `MONGO_URL`, `BASE_URL` los pide Render al crear). La base en **MongoDB Atlas M0** con **Terraform** (`infra/`: proyecto, clúster, usuario con contraseña aleatoria, acceso IP; salida sensible `mongo_url`). Terraform validado contra el esquema real del proveedor (atlas 2.21.0). El proveedor de Terraform de Render solo documenta planes de pago (starter+), por eso Render va por Blueprint
- [x] B9b. Arranque seguro en producción (`construirConfig`, con tests): exige PIN >= 6, `SESSION_SECRET` >= 32, `BASE_URL` https pública
- [x] B9c. **En producción** (Render, plan free, virginia): `https://fidelhop.onrender.com`. Blueprint `fidelhop` creado por el usuario; servicio `srv-dbqhjblbedkc73dl0u80`; base en Atlas M0 (`Project 0` / `Cluster0`). Probado desde fuera: `/healthz`, SPA, login de caja (cookie `Secure; HttpOnly; SameSite=Strict`), fidelizar, abrir enlace (+1 sello), reuso rechazado, espera de 60 min, GET no consume el enlace. Atlas permite `0.0.0.0/0` (Render gratis sin IP fija)
- [x] B9e. Zona horaria de la tienda: **America/Santiago** (Chile). Valor por defecto en `config.ts`, `render.yaml`, `.env.example` y puesto en el servicio en producción (redesplegado, `live`). Tests de límite de día para Santiago en verano (UTC-3) e invierno (UTC-4)
- [ ] B9d. Pendientes de seguridad/limpieza: revocar claves de Render, Atlas y token de GitHub compartidas en el chat; rotar la contraseña del usuario de Atlas y actualizar `MONGO_URL`; más adelante restringir Atlas a las IPs de salida de Render (service > Connect > Outbound); el repo `fullsaas` está público
- [ ] B10. Verificar en Render: flujo completo en celular real, cámara, PWA, Lighthouse

## Tests (TDD)
- `pnpm test` (node:test, 138 tests; sin dependencias extra) y `pnpm typecheck` (tsc). Necesita Mongo real: contenedor `fidelhop-mongo-test` (`docker run -d --name fidelhop-mongo-test --ulimit nofile=65536:65536 --tmpfs /data/db:rw,size=1g -p 127.0.0.1:27017:27017 mongo:7`). **Importante:** sin `--ulimit nofile` Mongo se cae con `Too many open files` al crear tantas colecciones en las pruebas (fassert 50853) y los tests se cuelgan 30 s
- Antes de producción: `TRUST_PROXY=1` detrás del túnel, para que el límite de intentos use la IP real

## Review
(pendiente)
