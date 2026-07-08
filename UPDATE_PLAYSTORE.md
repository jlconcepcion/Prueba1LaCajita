# Guía Rápida - Actualizar Versión en Google Play Store

## 🚀 PROCESO DE ACTUALIZACIÓN (Ya publicada)

### Paso 1: Actualizar Versión en Código

Editar: `android/app/build.gradle`

```gradle
defaultConfig {
    versionCode 2          // ← INCREMENTAR (1 → 2 → 3...)
    versionName "1.0.1"    // ← CAMBIAR (formato semántico)
}
```

**IMPORTANTE**: `versionCode` DEBE ser mayor que la versión anterior publicada

---

### Paso 2: Compilar Build

```bash
# En la raíz del proyecto
npm run build

# Navegar a Android
cd android

# Limpiar builds anteriores
./gradlew clean

# Compilar release
./gradlew bundleRelease

# El archivo generado estará en:
# android/app/build/outputs/bundle/release/app-release.aab
```

---

### Paso 3: Subir a Play Console

1. **Abrir Google Play Console**
   - https://play.google.com/console

2. **Seleccionar tu app** (LaCajitaTV)

3. **Ir a: Release > Production > Create new release**

4. **Upload AAB**
   - Click "Browse files"
   - Seleccionar: `android/app/build/outputs/bundle/release/app-release.aab`
   - Esperar upload (~1-2 min)

5. **Revisar información**
   ```
   - Permissions: ✓ Revisar
   - Target API level: 34
   - Min SDK: 21
   - Version: Debe mostrar tu nuevo versionCode
   ```

6. **Agregar Release Notes** (Changelog)
   ```
   Ejemplo:
   - Seguridad: Implementadas mejoras de XSS prevention
   - Nuevo: Validación mejorada de URLs
   - Fix: Error handling en API calls
   - Mejora: Rate limiting para API
   ```

7. **Click "Save"** para guardar como borrador
8. **Click "Review Release"**
9. **Click "Publish to Production"** (o Staged Rollout si prefieres 25%→50%→100%)

---

### Paso 4: Monitorear Publicación

```
En Google Play Console:
├── Release → Production
│   └── Ver status "Publishing..."
├── Esperar 1-5 horas
│   └── Cambiar a "Live"
├── Android App Bundles
│   └── Verificar nueva versión listada
└── Statistics
    └── Verificar installs/updates
```

---

## ⚠️ CHECKLIST PRE-ACTUALIZACIÓN

```
CÓDIGO:
☐ npm run build sin errores
☐ versionCode incrementado (anterior +1)
☐ versionName actualizado
☐ Cambios testeados localmente

COMPILACIÓN:
☐ ./gradlew bundleRelease completó exitosamente
☐ AAB generado (verificar tamaño ~50-100MB)
☐ Sin warnings importantes

PREPARACIÓN:
☐ Changelog/Release notes listos
☐ Play Console abierto
☐ Tienes credenciales Google
☐ Conexión internet estable
```

---

## 📝 CHANGELOG EXAMPLES

```markdown
### v1.0.1 (Actualización de Seguridad)
- 🔒 Seguridad: XSS prevention en embeds
- 🔒 Validación mejorada de URLs
- 🔒 CSP headers implementados
- 🐛 Fix: Error handling en API calls
- ⚡ Performance: Rate limiting
- 📝 Logs mejorados para debugging

### v1.1.0 (Nueva Característica)
- ✨ Nueva: Favoritos mejorados
- 🐛 Fix: Crashes en Android 11
- ⚡ Optimización de memoria
- 📱 Mejor soporte tablet
```

---

## 🎯 COMANDOS RÁPIDOS

```bash
# Build completo (desde raíz)
npm run build && cd android && ./gradlew clean && ./gradlew bundleRelease

# Ver ubicación del AAB
ls -lh android/app/build/outputs/bundle/release/

# Verificar firma del AAB
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

---

## ⏱️ TIEMPO TOTAL

```
Compilación:        ~5-10 minutos
Upload a Play:      ~2-3 minutos
Revisión de Google: ~1-5 horas
TOTAL:              1-6 horas hasta Live
```

---

## 🆘 PROBLEMAS COMUNES

### Error: "versionCode X is less than previous"
```
Solución: versionCode debe ser MAYOR que el anterior
Verificar en Play Console qué versionCode tiene la versión actual
Incrementar tu versionCode a uno mayor
```

### Error: "Invalid signature"
```
Solución: El keystore es incorrecto
Verificar: android/app/build.gradle signingConfig
Asegurar contraseñas correctas en variables de entorno
```

### AAB muy grande (>150MB)
```
Solución: Verificar node_modules en APK
- Asegurar minifyEnabled = true
- Revisar dependencias innecesarias
- Considerar dynamic features
```

### Play Console rechaza el AAB
```
Pasos:
1. Revisar error específico en Play Console
2. Ir a "Release" y revisar sección "Issues"
3. Corregir el issue
4. Compilar nuevamente
5. Subir nueva versión del AAB
```

---

## 📊 VERSIONING SEMÁNTICO

```
FORMATO: MAJOR.MINOR.PATCH

1.0.0 → 1.0.1  (Patch: Bug fixes, seguridad)
1.0.0 → 1.1.0  (Minor: Nuevas features, no breaking)
1.0.0 → 2.0.0  (Major: Cambios incompatibles)

EJEMPLOS:
v1.0.0 → Publicación inicial
v1.0.1 → Security update (este documento)
v1.1.0 → Nuevas features
v2.0.0 → Rewrite/cambio mayor
```

---

## 🔄 ACTUALIZACIÓN RÁPIDA (Resumen)

```bash
# 1. Cambiar versión
nano android/app/build.gradle
# versionCode: incrementar +1
# versionName: cambiar (ej: 1.0.1)

# 2. Compilar
npm run build
cd android && ./gradlew bundleRelease

# 3. Verificar
ls android/app/build/outputs/bundle/release/app-release.aab

# 4. Subir a Play Console manualmente
# - Abrir: https://play.google.com/console
# - tu app > Release > Production > Create new release
# - Upload AAB
# - Agregar changelog
# - Publish
```

---

## 📌 NOTAS IMPORTANTES

1. **versionCode**: Incrementa siempre (no puede bajar)
2. **Keystore**: Mismo que usaste para publicar (guardar bien)
3. **Tiempo**: Primera revisión suele ser más rápida (1-2 horas)
4. **Changelog**: Los usuarios lo ven en Play Store
5. **Rollout**: Puedes hacer gradual (25%→50%→100%) para testear

---

**Última actualización**: 2026-07-08
**Para**: Actualizaciones de versión en producción
