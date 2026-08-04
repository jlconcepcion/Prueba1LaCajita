# Guía de Compilación y Publicación — La Cajita TV (Android)

Guía completa para compilar la app y generar un artefacto listo para subir a Google Play Console, desde cero. Para actualizar una versión ya publicada, consulta también [UPDATE_PLAYSTORE.md](./UPDATE_PLAYSTORE.md) (proceso resumido, mismo flujo).

## 0. Datos del proyecto

```
App ID:        tv.lacajita.app
App Name:      La Cajita TV
Framework:     Vite + React 18, empaquetado con Capacitor 8 (WebView)
minSdk:        24
targetSdk:     36
compileSdk:    36
versionCode:   2   (android/app/build.gradle)
versionName:   1.0.1
Keystore:      android/app/lacajita-key.jks  (NO está en git — *.jks ignorado)
```

---

## 1. Prerrequisitos

- Node.js 18+ y npm
- Android SDK (Android Studio, o solo `cmdline-tools` + `platform-tools`)
- Variable de entorno `ANDROID_HOME` / `android/local.properties` apuntando al SDK (ya configurado localmente)
- JDK 17 (el que trae Android Studio sirve)
- El keystore de release `lacajita-key.jks` y sus contraseñas reales. **Si no lo tienes, ve a la sección 2.1** — sin este archivo no puedes firmar una release válida para Play Store, y si alguna vez subiste una versión anterior, DEBES usar el mismo keystore (Play Store rechaza AAB firmados con una clave distinta a la original).

```bash
npm install
```

---

## 2. Firma de la app (signing)

### 2.1 Generar el keystore (solo la primera vez)

Si `android/app/lacajita-key.jks` no existe todavía:

```bash
keytool -genkeypair -v \
  -keystore android/app/lacajita-key.jks \
  -alias lacajita-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

Te pedirá una contraseña de store, datos del certificado, y puede usar la misma contraseña para la key o una distinta. **Guarda el `.jks` y las contraseñas en un lugar seguro fuera del repo** (gestor de contraseñas, backup cifrado). Si lo pierdes, no podrás volver a publicar actualizaciones de esta app — tendrías que publicarla como app nueva.

### 2.2 Configurar las credenciales localmente

Las contraseñas del keystore **no se guardan en archivos versionados por git**. Se leen desde `android/keystore.properties`, que está en `.gitignore`.

```bash
cp android/keystore.properties.example android/keystore.properties
```

Edita `android/keystore.properties` con tus valores reales:

```properties
RELEASE_STORE_FILE=lacajita-key.jks
RELEASE_STORE_PASSWORD=tu-contraseña-real
RELEASE_KEY_ALIAS=lacajita-alias
RELEASE_KEY_PASSWORD=tu-contraseña-real
```

`android/app/build.gradle` carga este archivo automáticamente si existe (ver `signingConfigs.release`). Si `keystore.properties` no existe, el build de release compila sin firmar (falla al generar el AAB firmado) — es la señal de que falta este paso.

**Nunca** vuelvas a poner estas contraseñas directamente en `android/gradle.properties` ni en ningún archivo que git rastree: ese archivo se commitea, y las credenciales quedarían expuestas en el historial para siempre (incluso si luego las borras).

---

## 3. Actualizar el número de versión

Cada subida a Play Store necesita un `versionCode` mayor al de la última versión publicada.

Editar `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 3          // incrementar siempre (nunca puede bajar ni repetirse)
    versionName "1.0.2"    // versión semántica visible al usuario
}
```

---

## 4. Compilar

```bash
# 1. Build del frontend (React/Vite) -> genera dist/
npm run build

# 2. Sincronizar los assets web dentro del proyecto Android
npx cap sync android

# 3. Compilar el bundle firmado para Play Store
cd android
./gradlew clean
./gradlew bundleRelease
```

Salida esperada:

```
android/app/build/outputs/bundle/release/app-release.aab
```

> ¿Necesitas un `.apk` para probar en un dispositivo en vez de un `.aab`? Usa `./gradlew assembleRelease` — el resultado queda en `android/app/build/outputs/apk/release/lacajita-release.apk` (nombre definido por `outputFileName` en `build.gradle`). Play Store exige `.aab`, no `.apk`.

### Verificar la firma

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Debe imprimir `jar verified.` al final.

---

## 5. Checklist antes de subir

```
CÓDIGO
☐ npm run build sin errores ni warnings de seguridad nuevos
☐ versionCode incrementado respecto a la última versión publicada
☐ versionName actualizado
☐ Probado en dispositivo/emulador (npx cap run android, o instalar el APK release)

COMPILACIÓN
☐ ./gradlew bundleRelease completó exitosamente
☐ jarsigner confirma "jar verified"
☐ AAB generado en android/app/build/outputs/bundle/release/

CREDENCIALES
☐ android/keystore.properties existe localmente y NO aparece en `git status`
☐ Es el mismo keystore (lacajita-key.jks) usado en publicaciones anteriores
```

---

## 6. Publicar en Google Play Console

1. Entra a [https://play.google.com/console](https://play.google.com/console)
2. Selecciona **La Cajita TV**
3. **Release → Production → Create new release** (o el track que uses: Internal testing / Closed testing / Open testing / Production)
4. Sube `app-release.aab`
5. Revisa el resumen: permisos, target API level (36), min SDK (24), y que el `versionCode` sea el nuevo
6. Agrega las notas de la versión (changelog), visibles para los usuarios
7. **Save** → **Review release** → **Publish** (o rollout gradual 25%→50%→100% si prefieres probar antes del 100%)

Tiempos aproximados: compilación 5–10 min, subida 2–3 min, revisión de Google 1–5 horas (primera publicación puede tardar más, hasta días, por la revisión inicial de la app).

---

## 7. Problemas comunes

| Error | Causa / solución |
|---|---|
| `versionCode X has already been used` | Sube el `versionCode` en `build.gradle` a uno mayor al último publicado |
| Falla `bundleRelease` sin firmar / `signingConfig` vacío | Falta `android/keystore.properties` o tiene valores incorrectos (ver sección 2.2) |
| `Upload failed: You uploaded an APK/bundle with invalid signature` | El keystore usado no coincide con el original de la app — no hay forma de recuperarlo, solo puedes usar el keystore correcto |
| AAB muy grande (>150MB) | Revisar que `minifyEnabled`/`shrinkResources` estén activos (ya lo están por defecto), dependencias innecesarias, considerar Play Feature Delivery |
| Play Console rechaza el AAB por política | Revisar la sección "Issues" del release en Play Console, corregir, recompilar, resubir |

---

**Relacionado**: [SECURITY.md](./SECURITY.md) · [DEVELOPMENT.md](./DEVELOPMENT.md) · [UPDATE_PLAYSTORE.md](./UPDATE_PLAYSTORE.md)
