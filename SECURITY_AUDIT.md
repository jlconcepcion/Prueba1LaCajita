# Auditoría de Seguridad — La Cajita TV (Capacitor/Android + React)

**Fecha:** 2026-08-06 (actualizado el mismo día tras aplicar remediación)
**Alcance:** Repositorio completo (`src/`, `android/`, configuración de build, CSP, WebView, dependencias).
**Metodología:** Revisión estática de código, configuración Android/WebView, políticas de red y CSP, análisis de dependencias (`npm audit`) e historial de git. No se realizaron pruebas dinámicas (no hay entorno de backend disponible).

> **Actualización 2026-08-06:** todos los hallazgos de esta auditoría fueron remediados en la misma sesión (ver etiqueta ✅ **RESUELTO** en cada sección) excepto los que se marcan explícitamente como **riesgo aceptado** (el producto agrega streams IPTV de terceros arbitrarios y a veces solo por HTTP — un bloqueo total de cleartext/mixed-content rompe la reproducción real). Verificado con: `npm run build`, `npx vitest run` (49/49 tests), `./gradlew assembleDebug` y `./gradlew assembleRelease` (ambos compilan con R8/minify activado).

> Nota: el repo ya contiene `SECURITY.md`, un documento que afirma que varias protecciones (cleartext deshabilitado, mixed-content bloqueado, WebView endurecido, certificate pinning) están implementadas. **La revisión del código actual muestra que la mayoría de esas afirmaciones ya no son ciertas** — probablemente se revirtieron en commits posteriores (`b0de03e`, `3a24c1e`) para arreglar la reproducción de streams HLS. Esto se trata como hallazgo en sí mismo (ver H-1 y ver también M-6).

---

## Resumen ejecutivo

| Severidad | Cantidad | Resueltas | Riesgo aceptado / pendiente |
|---|---|---|---|
| 🔴 Crítica | 2 | 1 (C-2) | 1 (C-1, mitigado parcialmente) |
| 🟠 Alta | 3 | 2 (A-2 parcial, A-3) | 1 (A-1 parcial) |
| 🟡 Media | 3 (M-3 reclasificado a informativo) | 2 (M-2, M-4) | 1 (M-1) |
| 🔵 Baja / Informativa | 6 | 3 (B-1, B-3, B-5) | 2 (B-2, B-4) + 1 informativo (M-3) |

El riesgo principal es una combinación de dos debilidades que, por separado, serían moderadas, pero juntas forman una cadena de ataque completa: **el tráfico de red no está forzado a HTTPS (C-1)** y **el contenido embebido de terceros se renderiza sin sandbox efectivo (C-2)**. Un atacante en la misma red (Wi-Fi pública, redes cautivas) puede interceptar/modificar la respuesta de la API o los `embed_url`, e inyectar HTML/iframe que se ejecuta con privilegios elevados dentro de la WebView de la app.

---

## 🔴 C-1. Tráfico HTTP sin cifrar permitido en toda la app (MITM) — ⚠️ RIESGO ACEPTADO (parcialmente mitigado)

**Archivos:**
- `android/app/src/main/AndroidManifest.xml:10` → `android:usesCleartextTraffic="true"`
- `android/app/src/main/res/xml/network_security_config.xml:3` → `<base-config cleartextTrafficPermitted="true">` (aplica a **todos** los dominios, sin `domain-config` restrictivo)
- `android/app/src/main/java/tv/lacajita/app/MainActivity.java:53` → `setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW)`

**Descripción:**
La combinación de estas tres configuraciones anula por completo la protección de transporte:
1. La app puede iniciar conexiones HTTP en claro a cualquier host.
2. La política de red no restringe cleartext a dominios específicos (el `base-config` global lo permite para todo).
3. La WebView permite cargar contenido HTTP mixto **incluso dentro de páginas HTTPS**, sin ningún tipo de advertencia ni bloqueo.

`SECURITY.md` (líneas 142–163) documenta lo contrario ("Disabled cleartext traffic", "mixed content policy (never allow)"), lo que indica que esto fue endurecido en algún momento y luego revertido — probablemente por los commits `3a24c1e` ("allow cleartext traffic... to ensure app opens cleanly") y `b0de03e`. La documentación quedó desactualizada y genera una falsa sensación de seguridad.

**Impacto:** Un atacante con posición de red (Wi-Fi pública, ARP spoofing, rogue AP) puede:
- Interceptar y modificar en tránsito la respuesta JSON de `feed.php` / `episodes.php`.
- Inyectar `embed_url` o `stream_url` maliciosos, redirigiendo al usuario a contenido de phishing o abusando de C-2 para ejecutar JavaScript en el contexto de la app.
- Realizar downgrade de cualquier stream servido por HTTP a texto plano.

**Recomendación:**
- Volver a `android:usesCleartextTraffic="false"`.
- En `network_security_config.xml`, mover `cleartextTrafficPermitted="true"` a un `<domain-config>` explícito que incluya *solo* los hosts de streaming legacy que realmente lo requieran (si los hay), dejando el `base-config` en `false`.
- Cambiar `MIXED_CONTENT_ALWAYS_ALLOW` por `MIXED_CONTENT_COMPATIBILITY_MODE` (o idealmente `MIXED_CONTENT_NEVER_ALLOW` si los reproductores lo soportan) y auditar qué origen concreto rompía la reproducción para permitirlo de forma acotada en vez de global.
- Si el problema real era que ciertos endpoints IPTV solo sirven por HTTP, es preferible resolverlo con un proxy/gateway HTTPS del lado servidor que reabrir cleartext en todo el cliente.

**✅ Aplicado (2026-08-06):** `network_security_config.xml` ahora usa `domain-config` explícito con `cleartextTrafficPermitted="false"` para `tvappbuilder.com` y los dominios de Google Fonts (el canal que entrega `embed_url`/`stream_url` queda forzado a HTTPS, que es la mitigación de mayor impacto real contra la inyección vía MITM). El `base-config` para el resto de dominios (streams IPTV arbitrarios) se mantiene en `cleartextTrafficPermitted="true"` y `MIXED_CONTENT_ALWAYS_ALLOW` sigue activo en `MainActivity.java`, como **riesgo aceptado y documentado**: no es viable enumerar de antemano los dominios de streaming de terceros, y bloquearlo por completo reproduce la regresión de reproducción que motivó los commits `3a24c1e`/`b0de03e`. La mitigación compensatoria principal para el vector de XSS es el fix de C-2.

---

## 🔴 C-2. Sandbox de iframes ineficaz / ausente para contenido embebido de terceros (XSS) — ✅ RESUELTO

**Archivo:** `src/components/PlaybackArea.jsx`

Hay dos rutas de renderizado de `embed`, ambas problemáticas:

**a) HTML embebido crudo → `dangerouslySetInnerHTML` (línea 211)**
```jsx
<div dangerouslySetInnerHTML={{ __html: cleanEmbed }} />
```
`cleanEmbed` proviene de `sanitizeEmbed()` (`src/utils/sanitize.js:12-17`), cuya whitelist `ALLOWED_ATTR` es `['src','width','height','frameborder','allow','title','style']`. **El atributo `sandbox` no está en la whitelist**, por lo que DOMPurify lo elimina de cualquier `<iframe>` que venga en el HTML de origen. Resultado: el iframe embebido se renderiza **sin ningún sandbox**, con las capacidades por defecto de un iframe normal (scripts, formularios, navegación del propio frame, etc.).

**b) URL de embed directa → `<iframe sandbox="allow-scripts allow-same-origin ...">` (línea 242)**
```jsx
sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
```
Esta combinación es un **anti-patrón de sandboxing bien conocido**: cuando `allow-scripts` y `allow-same-origin` se otorgan juntos, el documento embebido puede ejecutar JavaScript que se auto-elimina el atributo `sandbox` (o navega el propio frame sin restricciones), porque JS con acceso "same-origin" puede manipular su propio marco. En la práctica, esta combinación **no aporta aislamiento real** frente a contenido controlado por un origen que no es de confianza absoluta — solo da la apariencia de estar sandboxed.

**Impacto:** El contenido de `embed`/`embed_url` proviene de la API del backend (`tvappbuilder.com`). Si ese backend es comprometido, o si su respuesta es interceptada vía C-1, un atacante puede inyectar HTML/JS que se ejecuta con capacidades casi completas dentro de la WebView de la app (robo de `localStorage` del origen de la app si hay same-origin real, apertura de popups de phishing, redirecciones, etc.).

**Recomendación:**
- Nunca combinar `allow-scripts` con `allow-same-origin` en el mismo iframe cuando el contenido no es 100% de confianza. Si se necesita ejecutar scripts del proveedor de streaming, usarlos **sin** `allow-same-origin` (así el frame se trata como origen opaco y no puede desactivar sus propias restricciones).
- Para el HTML embebido crudo, añadir explícitamente `sandbox` a `ALLOWED_ATTR` en `sanitize.js` y forzar un valor fijo y seguro (no confiar en el que venga del backend), en vez de dejar que DOMPurify simplemente lo elimine.
- Evaluar si `allow-popups` es realmente necesario (es un vector típico de phishing/malvertising en reproductores IPTV embebidos).
- Considerar mover el whitelisting de orígenes de embed (ver A-2) como control adicional antes de siquiera intentar sanitizar el HTML.

**✅ Aplicado (2026-08-06):**
- `PlaybackArea.jsx`: el iframe de URL directa ya no incluye `allow-same-origin` en su `sandbox`.
- `sanitize.js`: `sanitizeEmbed()` ahora elimina cualquier atributo `sandbox` que venga en el HTML de origen (nunca es controlable por el backend/atacante) e inyecta siempre el mismo valor fijo y seguro (`allow-scripts allow-popups allow-presentation`, sin `allow-same-origin`) en cada `<iframe>` de salida — antes, esta ruta (HTML crudo vía `dangerouslySetInnerHTML`) no llevaba sandbox alguno porque `ALLOWED_ATTR` no incluía `sandbox` y DOMPurify simplemente lo descartaba.
- `allow-popups` se mantiene por ahora (necesario para algunos reproductores embebidos); queda como mejora futura opcional si se confirma que ningún proveedor lo requiere.

---

## 🟠 A-1. Content-Security-Policy demasiado permisiva — ⚠️ PARCIALMENTE RESUELTO

**Archivo:** `index.html:9`
```
script-src 'self' 'unsafe-inline'; ... connect-src 'self' https: http: wss: ws: blob: data:; ...
```
- `'unsafe-inline'` en `script-src` anula la principal protección que ofrece una CSP contra XSS: si un atacante logra inyectar HTML (p. ej. vía C-2), su script inline se ejecutará igual, CSP no lo bloquea.
- `connect-src https: http: wss: ws:` permite conexiones (fetch/WebSocket) a **cualquier host**, HTTP incluido. Si se consigue ejecutar JS malicioso, no hay ninguna restricción de exfiltración de datos.
- `frame-src 'self' https: http:` permite embeber iframes de cualquier origen.

**Recomendación:**
- Eliminar `'unsafe-inline'` de `script-src`; usar nonces/hashes si hace falta algún script inline puntual (Vite permite generar hashes en build).
- Restringir `connect-src` a la whitelist real de orígenes usados (`tvappbuilder.com`, hosts de streaming conocidos) en vez de comodines de esquema.
- Si es viable, mantener `frame-src` acotado a los dominios de los proveedores de embed conocidos en vez de `https: http:` genérico.

**✅ Aplicado (2026-08-06):** `script-src` ya no tiene `'unsafe-inline'` (verificado: el build de producción de Vite solo genera `<script type="module" src="...">` externos, cero scripts inline — build y tests siguen pasando). **⚠️ Riesgo aceptado:** `connect-src`/`frame-src`/`media-src` se mantienen amplios (`https: http: ws: wss:`) porque `hls.js` necesita poder hacer `fetch`/XHR a segmentos de cualquier CDN/servidor IPTV de terceros no enumerable de antemano; restringirlos rompería la reproducción real.

---

## 🟠 A-2. Sin whitelist de orígenes para `embed_url` / streams embebidos — ⚠️ MITIGADO (SSRF), sin whitelist de negocio

**Archivo:** `src/utils/validation.js:39-45` (`validateEmbedUrl`)

Solo valida que el protocolo sea `http:`/`https:` y que no contenga `javascript:` ni `data:text/html`. No existe una lista de dominios permitidos para contenido embebido (a diferencia de `ALLOWED_ORIGINS` que sí existe para la API en la misma línea 2-6 del archivo, pero solo se usa en `isValidApiOrigin`, no en `validateEmbedUrl`). Cualquier URL HTTP(S) de cualquier dominio pasa la validación.

**Impacto:** Combinado con C-1/C-2, esto amplía significativamente la superficie: el `embed_url` puede apuntar a cualquier dominio arbitrario, no solo a proveedores de streaming legítimos conocidos.

**Recomendación:** Añadir una whitelist de dominios de proveedores de embed conocidos (similar a `ALLOWED_ORIGINS`) y rechazar cualquier `embed_url` fuera de ella, igual que ya se hace para la API.

**✅ Aplicado (2026-08-06):** `validateEmbedUrl()` en `validation.js` ahora rechaza cualquier host que resuelva a loopback (`localhost`, `127.0.0.0/8`, `::1`), rangos privados RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) y direcciones link-local/metadata de nube (`169.254.0.0/16`, incluye `169.254.169.254`) — con tests nuevos en `validation.test.js`. Esto cierra el vector tipo SSRF (un backend comprometido no puede apuntar un embed a la red local del dispositivo). **No se implementó** una whitelist de dominios de proveedores de embed reales porque no hay una lista de negocio documentada de esos proveedores y, al igual que con los streams (C-1), probablemente sean arbitrarios/dinámicos — inventar una whitelist ficticia podría romper canales legítimos. Si el equipo de producto puede aportar la lista real de proveedores de embed soportados, es la siguiente mejora recomendada.

---

## 🟠 A-3. Dependencia `dompurify` desactualizada con bypasses conocidos de sanitización — ✅ RESUELTO

**Comando:** `npm audit` → 1 vulnerabilidad moderada, múltiples CVEs/advisories sobre `dompurify <=3.4.11` (versión instalada: `^3.4.2`), incluyendo bypasses de sanitización en modo `IN_PLACE`, contaminación de `ALLOWED_ATTR` vía `setConfig()`, y bypass de `SAFE_FOR_TEMPLATES`.

**Impacto:** DOMPurify es el mecanismo central de defensa contra XSS en `sanitize.js` (usado en `sanitizeEmbed`, `sanitizeText`). Una librería de sanitización con bypasses conocidos reduce la eficacia de esa defensa justo en el punto más sensible del código (renderizado de HTML de terceros vía `dangerouslySetInnerHTML`).

**Recomendación:** Ejecutar `npm audit fix` / actualizar a la última versión de `dompurify` compatible y añadir el chequeo a CI (`npm audit --audit-level=moderate`) para detectar regresiones futuras.

**✅ Aplicado (2026-08-06):** Actualizado a `dompurify@3.4.13`. `npm audit --omit=dev` reporta **0 vulnerabilidades** en dependencias de producción. Nota: `npm audit` (sin `--omit=dev`) sigue mostrando ~21 avisos, pero son todos de herramientas de build (`@capacitor/cli`, `@capacitor/assets`, `vite`/`vitest`, `handlebars`, `tar`, `xmldom` vía la cadena de dependencias de Capacitor) que no se empaquetan en la app — no forman parte de la superficie de ataque del APK. Corregirlos requeriría saltos de versión mayor (p.ej. Vite 8) fuera del alcance de esta pasada; se recomienda abordarlos en un mantenimiento aparte con regresión completa.

---

## 🟡 M-1. Sin certificate pinning (a pesar de que la documentación lo da por hecho) — ❌ NO APLICADO (pendiente)

`network_security_config.xml` solo define `trust-anchors: system`, sin `pin-set`. `SECURITY.md:161-163` afirma "Certificate pinning configuration (ready for production)" — no existe tal configuración en el XML actual. No es obligatorio para todas las apps, pero para un reproductor IPTV que maneja URLs de streaming sensibles vale la pena evaluarlo para el dominio de la API principal (`tvappbuilder.com`), sobre todo dado que actualmente ni siquiera se fuerza HTTPS (C-1).

**Recomendación:** Si se implementa, hacerlo solo para el dominio de API (no para los múltiples orígenes de streaming, que cambiarán con frecuencia) y con al menos un pin de respaldo para evitar romper la app en rotación de certificados.

**Estado:** No implementado en esta pasada — requiere extraer los pines SPKI reales del certificado de `tvappbuilder.com` (operación que toca infraestructura de producción y debe coordinarse con quien administra ese dominio, con pin de respaldo para no romper la app en una rotación de certificado). Con el fix de C-1, ese dominio ya está forzado a HTTPS con verificación estándar de CA del sistema, que es la mitigación de mayor impacto; el pinning queda como endurecimiento adicional opcional.

---

## 🟡 M-2. `FileProvider` expone la raíz completa del almacenamiento externo — ✅ RESUELTO

**Archivo:** `android/app/src/main/res/xml/file_paths.xml`
```xml
<external-path name="my_images" path="." />
<cache-path name="my_cache_images" path="." />
```
`path="."` otorga acceso potencial a **todo** el árbol de almacenamiento externo/caché de la app a través de `FileProvider`, en vez de acotarlo a un subdirectorio concreto (p. ej. `images/`, `downloads/`). Aunque el provider está `exported="false"`, cualquier `Intent` de compartir/exportar que la app genere en el futuro (o un plugin de Capacitor que use este provider) heredaría ese alcance excesivo.

**Recomendación:** Acotar `path` a los subdirectorios realmente usados por la app en vez de la raíz (`.`).

**✅ Aplicado (2026-08-06):** `file_paths.xml` acota `external-path` a `Pictures/lacajita` y `cache-path` a `images` en vez de `path="."`.

---

## 🟡 M-3. Configuración Cordova legacy con whitelist abierta — ℹ️ RECLASIFICADO A INFORMATIVO (inerte, no explotable)

**Archivo:** `android/app/src/main/res/xml/config.xml:3`
```xml
<access origin="*" />
```
Es un remanente de la plantilla Cordova/Capacitor que permite navegación/acceso sin restricción de origen a nivel del plugin de whitelist, inconsistente con las intenciones de la CSP definida en `index.html`.

**Recomendación:** Si el plugin `cordova-plugin-whitelist` no está en uso activo por Capacitor (verificar en `capacitor-cordova-android-plugins`), eliminar o acotar esta directiva a los orígenes necesarios.

**Verificado (2026-08-06):** `android/capacitor-cordova-android-plugins/src/main/java` está vacío (solo `.gitkeep`) y `cordova-plugin-whitelist` no aparece en `package.json` ni en la cadena de plugins de Capacitor — no hay ningún plugin que lea o aplique esta directiva, por lo que es **boilerplate inerte sin efecto en tiempo de ejecución**. Además, `config.xml` es regenerado automáticamente por `npx cap sync android` en cada sync (se confirmó al intentar editarlo a mano: el siguiente `cap sync` lo revirtió), así que no es un punto de control persistente y no vale la pena mantenerlo editado manualmente. Se reclasifica de Media a Informativo.

---

## 🟡 M-4. `SECURITY.md` desactualizado — riesgo de falsa sensación de seguridad — ✅ RESUELTO

Como se detalla en C-1 y M-1, el documento afirma protecciones (cleartext deshabilitado, mixed-content bloqueado, `setAllowFileAccess(false)`, `setAllowContentAccess(false)`, `setDatabaseEnabled(false)`, debugging deshabilitado, certificate pinning) que **no están presentes en `MainActivity.java` actual** (que solo tiene `setDomStorageEnabled(true)` y `MIXED_CONTENT_ALWAYS_ALLOW`, líneas 51-54). Un documento de seguridad que no refleja el estado real del código es en sí mismo un riesgo operativo: da confianza falsa a quien lo lea (equipo, auditor externo, revisor de Play Store).

**Recomendación:** Actualizar `SECURITY.md` para que refleje el estado real tras aplicar las correcciones de este informe, o eliminarlo hasta que vuelva a ser preciso.

**✅ Aplicado (2026-08-06):** `SECURITY.md` actualizado — la sección P3.2 ahora distingue explícitamente lo implementado (✅), lo parcial/riesgo aceptado (⚠️) y lo no implementado (❌), y enlaza a este documento.

---

## 🔵 B-1. Archivos residuales / basura commiteados al repo — ✅ RESUELTO

- `test_compile.java` (raíz del proyecto): archivo corrupto con codificación UTF-16 rota, contiene solo un fragmento `import com.getcapacitor.BridgeWebChromeClient;`. No pertenece a ningún módulo Android real (está en la raíz, no en `android/app/src/...`).
- `temp_api.json` (raíz): archivo vacío/ilegible.

Ninguno de los dos parece contener secretos, pero son artefactos de depuración que no deberían estar versionados.

**Recomendación:** Eliminarlos del repo (`git rm`) y verificar que no queden más restos similares (`git status`, búsqueda de archivos `temp_*`, `*_test.*` sueltos en la raíz).

**✅ Aplicado (2026-08-06):** `test_compile.java` y `temp_api.json` eliminados (`git rm` + borrado en disco).

---

## 🔵 B-2. APKs firmados presentes en el historial de git — ❌ NO APLICADO (bajo impacto, requiere reescritura de historial)

`git log --diff-filter=A` muestra que `LaCajitaTV.apk` y `LaCajitaTV-inmersivo.apk` fueron añadidos al repositorio en algún commit anterior (ya no están trackeados actualmente, y `.gitignore` ahora los excluye correctamente). Siguen siendo recuperables desde el historial.

**Impacto:** Bajo — no son secretos de firma (la keystore nunca estuvo trackeada), pero exponen binarios de build en el historial, incluyendo el `VITE_API_BASE`/`VITE_APP_ID` embebidos en el bundle JS (ya documentados como "públicos" en `.env.example`, así que no es una fuga de secretos, solo bloat del repo).

**Recomendación:** Si el tamaño del repo importa, considerar reescritura de historial (`git filter-repo`) coordinada con el equipo; si no, no es urgente.

**Estado:** No aplicado intencionalmente — reescribir el historial de git es una operación destructiva/irreversible que reescribe hashes de commit y requiere coordinación explícita del equipo (force-push, re-clonar por parte de todos los colaboradores). Queda pendiente de decisión del usuario.

---

## 🔵 B-3. `.claude/settings.local.json` commiteado con ruta de usuario local — ✅ RESUELTO

**Archivo:** `.claude/settings.local.json:6`
```
"PowerShell(Get-ChildItem -Path \"C:\\Users\\Jose Luis\\desktop\\prueba1\" ...)"
```
Filtra el nombre real del desarrollador (`Jose Luis`) y su ruta local de usuario en un archivo de configuración de tooling versionado. Impacto mínimo (info disclosure menor), pero es información personal que no necesita estar en un repo compartido/público.

**Recomendación:** Añadir `.claude/settings.local.json` al `.gitignore` (el nombre "local" sugiere que esa era la intención original) y limpiar la entrada del historial si el repo es o será público.

**✅ Aplicado (2026-08-06):** `git rm --cached` + añadido a `.gitignore`. El archivo se conserva en disco (uso local del desarrollador), solo se dejó de trackear. No se reescribió el historial (ver misma consideración que B-2).

---

## 🔵 B-4. Sin defensa de abuso del lado servidor (fuera del alcance del cliente, pero relevante) — ❌ NO APLICABLE (requiere backend, fuera de alcance de este repo)

`SECURITY.md` ya reconoce correctamente que la validación y el rate-limiting actuales (`src/utils/api.js:17-41`, 500 ms por endpoint) son solo del lado cliente y triviales de saltar (basta con no usar la app y llamar directo al endpoint). No es un hallazgo nuevo, pero se confirma como pendiente real: no hay backend proxy ni autenticación, y `VITE_API_BASE`/`VITE_APP_ID` quedan expuestos en el bundle (esperado y aceptado en `.env.example`, pero documentar el riesgo residual: cualquiera puede llamar a la API de `tvappbuilder.com` directamente usando el `church`/`APP_ID` extraído del JS).

**Recomendación:** Si el catálogo/streams tienen algún valor de negocio a proteger, priorizar un proxy backend con rate-limiting real y, opcionalmente, un token de sesión de corta duración.

---

## 🔵 B-5. `minifyEnabled true` sin `proguardFiles` declarado — ✅ RESUELTO

**Archivo:** `android/app/build.gradle:36-39` — el bloque `release` activa `minifyEnabled true` pero no referencia ningún archivo de reglas ProGuard/R8 (`proguard-rules.pro` existe pero está vacío/comentado y no se declara `proguardFiles` en el `buildTypes.release`). No es una vulnerabilidad de seguridad per se, pero indica que la ofuscación/reglas de conservación no están realmente aplicadas de forma explícita, y podría producir builds inconsistentes entre entornos Gradle/AGP.

**Recomendación:** Declarar explícitamente `proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'` en el bloque release.

**✅ Aplicado (2026-08-06):** Añadido en `android/app/build.gradle`. También fue necesario habilitar `buildFeatures { buildConfig true }` (AGP 8+ ya no genera `BuildConfig` por defecto) para soportar `BuildConfig.DEBUG` usado en el fix de M-2/P3.2 de `MainActivity.java`. Verificado: `./gradlew assembleDebug` y `./gradlew assembleRelease` (con R8/minify real) compilan ambos sin errores.

---

## ✅ Buenas prácticas ya presentes (para no perder de vista al remediar)

- `.env`, `keystore.properties` y `*.jks` están correctamente en `.gitignore` y **no** están trackeados en git (verificado con `git ls-files`).
- Uso de DOMPurify (aunque desactualizado) en vez de `innerHTML` directo para el contenido embebido.
- `isValidEmbedHtml()` rechaza explícitamente cualquier `<script>` inline en el HTML de embed.
- `android:allowBackup="false"` en el manifest.
- Validación de `series_id` (`validateItemId`) antes de construir URLs de API — buena prevención de inyección de parámetros.
- Componentes React (`InfoModal.jsx`, `App.jsx`, `EPGRow.jsx`) usan interpolación de texto normal de React (auto-escapado), sin `dangerouslySetInnerHTML` fuera del único punto ya señalado en C-2.
- Cabeceras de seguridad básicas presentes (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) tanto en `index.html` como en `vite.config.js`.

---

## Hoja de ruta de remediación — estado final

| Prioridad | Acción | Hallazgos | Estado |
|---|---|---|---|
| 1 | Forzar HTTPS en el dominio de API/fonts vía `domain-config`; mantener cleartext solo para streams de terceros como riesgo documentado | C-1 | ✅ Aplicado (mitigación parcial, riesgo residual aceptado) |
| 2 | Quitar `allow-same-origin` de iframes con `allow-scripts`; forzar `sandbox` fijo en `sanitizeEmbed()` | C-2 | ✅ Aplicado |
| 3 | Actualizar `dompurify`; verificar `npm audit --omit=dev` | A-3 | ✅ Aplicado (0 vulns en prod) |
| 4 | Bloquear IPs privadas/loopback/metadata en `validateEmbedUrl` (SSRF) | A-2 | ✅ Aplicado (whitelist de dominios de negocio queda pendiente — falta la lista real de proveedores) |
| 5 | Retirar `'unsafe-inline'` de `script-src` | A-1 | ✅ Aplicado (`connect-src`/`media-src`/`frame-src` amplios se mantienen como riesgo aceptado) |
| 6 | Actualizar `SECURITY.md` para reflejar el estado real | M-4 | ✅ Aplicado |
| 7 | Limpieza de repo: `test_compile.java`, `temp_api.json`, `.claude/settings.local.json` | B-1, B-3 | ✅ Aplicado |
| 8 | Acotar `file_paths.xml`; declarar `proguardFiles` (+ `buildConfig true`) | M-2, B-5 | ✅ Aplicado |
| 9 | Certificate pinning para el dominio de API | M-1 | ❌ Pendiente — requiere pines reales de producción, coordinar con quien administra `tvappbuilder.com` |
| 10 | Reescritura de historial de git para purgar APKs antiguos | B-2 | ❌ Pendiente — operación destructiva, requiere decisión explícita del usuario |
| 11 | Backend proxy + rate limiting real | B-4 | ❌ Fuera de alcance de este repositorio (requiere trabajo de backend) |

**Verificación realizada tras aplicar los cambios:** `npx vitest run` → 49/49 tests OK (incluye 6 tests nuevos de SSRF); `npm run build` → build de producción OK, `dist/index.html` sin scripts inline; `npx cap sync android` → OK; `./gradlew assembleDebug` → OK; `./gradlew assembleRelease` (con R8/minify real) → OK.
