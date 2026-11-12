# Actualizaciones automáticas mediante GitHub Releases

OpenHub utiliza el **plugin oficial Tauri Updater** y releases públicas firmadas. El código fuente puede permanecer privado en `iPUDDING/OpenH`; los instaladores y `latest.json` se publican en `iPUDDING/OpenH-updates`.

## Comportamiento

- Cada push a `main` asigna `<mayor>.<menor>.<GITHUB_RUN_NUMBER>` usando el mayor/menor de `package.json`; después compila, ejecuta pruebas, firma y publica una release.
- Los pull requests compilan y prueban, pero no firman ni publican.
- Al abrir OpenHub, la aplicación consulta `latest.json` después de 1,8 segundos.
- Si hay una versión superior, muestra un cartel con versión y notas.
- **Descargar y actualizar** requiere una acción del usuario. Después se instala en modo pasivo y se reinicia.
- **Más tarde** descarta esa versión para no volver a avisar automáticamente; se puede recuperar mediante Ajustes → Buscar actualizaciones.
- Si no hay internet, el inicio no muestra errores. Una comprobación manual sí informa el problema.
- Todos los documentos, TTS, mapas y preferencias siguen siendo locales. Solo buscar/descargar actualizaciones usa red.

## Configuración única obligatoria

### 1. Crear el repositorio público de releases

Crea `https://github.com/iPUDDING/OpenH-updates` como repositorio **público**, con un README inicial para que exista la rama `main`.

No subas código fuente ni claves a ese repositorio: GitHub Actions añadirá tags, releases, instaladores, firmas y `latest.json`.

### 2. Crear un token limitado

En GitHub, crea un **fine-grained personal access token** con:

- **Repository access:** Only select repositories → `OpenH-updates`.
- **Repository permissions → Contents:** Read and write.
- Ningún permiso adicional innecesario.

Guarda su valor como secreto `OPENH_UPDATE_REPO_TOKEN` en el repositorio privado `OpenH`:

**OpenH → Settings → Secrets and variables → Actions → New repository secret**.

Este token permite al workflow privado publicar releases en el repositorio público. No se incluye en la aplicación. Renúevalo antes de que caduque.

### 3. Guardar las claves de firma

En los mismos secretos Actions de `OpenH`, crea:

| Secreto | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido completo del archivo privado generado fuera del proyecto, incluidas sus líneas codificadas. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña usada al generar esa clave. |
| `OPENH_UPDATE_REPO_TOKEN` | Token limitado creado en el paso anterior. |

La clave pública ya está incorporada en `src-tauri/tauri.conf.json`. Es seguro publicarla.

**Nunca añadas la clave privada ni su contraseña a Git, al ZIP fuente, al repositorio de releases o a una issue.** Conserva una copia offline cifrada. Si pierdes cualquiera de las dos, las aplicaciones existentes no podrán aceptar nuevas firmas hasta que se distribuya una transición de claves.

### 4. Subir y comprobar

1. Sube estos cambios a `main` en `iPUDDING/OpenH`.
2. Abre Actions → **Build y publicar OpenHub para Windows**.
3. Si faltan secretos, el workflow se detiene antes de compilar/publicar.
4. Si todo es correcto, aparece `v<mayor>.<menor>.<ejecución>` en `OpenH-updates/releases` con:
   - instalador NSIS `.exe`;
   - MSI `.msi`;
   - archivos de actualización y `.sig`;
   - `latest.json`.
5. Instala manualmente esta primera versión que ya contiene el actualizador. Las versiones anteriores sin este módulo no pueden autoactualizarse retroactivamente.

## Comprobar el flujo completo en Windows

1. Instala la versión `N`.
2. Haz otro push a `main` y espera la release `N+1`.
3. Abre OpenHub; debe aparecer el cartel de nueva versión.
4. Pulsa **Más tarde** y verifica que no insiste en el próximo arranque.
5. Abre Ajustes → **Buscar actualizaciones**.
6. Pulsa **Descargar y actualizar** y espera el reinicio.
7. Comprueba que la cabecera muestra la nueva versión y que documentos/ajustes persisten.

La compilación y el reinicio nativos deben validarse en Windows/WebView2; las pruebas frontend del entorno de desarrollo no sustituyen esa verificación.

## Referencias oficiales

- [Tauri Updater: firma, configuración y API](https://v2.tauri.app/plugin/updater/)
- [Tauri Process: reinicio y permisos](https://v2.tauri.app/plugin/process/)
- [Tauri Action: releases y latest.json](https://github.com/tauri-apps/tauri-action)
