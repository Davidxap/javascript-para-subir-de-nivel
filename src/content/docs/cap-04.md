---
title: "Capítulo 4: Módulos y organización del código"
---

# Capítulo 4: Módulos y organización del código

> La organización del código en módulos es lo que separa un script de una aplicación mantenible.

## Introducción

JavaScript tiene dos sistemas de módulos: CommonJS (CJS, el sistema original de Node.js) y ES Modules (ESM, el estándar del lenguaje). Entender las diferencias, cuándo usar cada uno, y cómo migrar de CJS a ESM es esencial para cualquier proyecto Node.js moderno.

**¿Por qué importa?** Porque la organización del código determina la mantenibilidad, escalabilidad y rendimiento de las aplicaciones. Los patrones de diseño dependen de una buena estructura de módulos.

## 1. CommonJS: `require` y `module.exports`

### Idea clave

CommonJS es el sistema de módulos original de Node.js. Cada archivo es un módulo con su propio scope. `require()` importa un módulo (síncrono), `module.exports` exporta valores. Los módulos se cachean: la primera llamada carga el módulo, las siguientes devuelven el cache.

### Sintaxis básica

```javascript
// math.js — exportar
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }

// Opción 1: asignar a module.exports
module.exports = { sumar, restar }

// Opción 2: añadir propiedades
// exports.sumar = sumar
// exports.restar = restar
// ⚠️ No hagas: exports = { sumar, restar } — pierde la referencia a module.exports

// app.js — importar
const { sumar, restar } = require("./math")
console.log(sumar(2, 3))  // 5

// Importar todo el módulo
const math = require("./math")
console.log(math.sumar(2, 3))  // 5
```

### Caché de módulos

```javascript
// config.js
let contador = 0
module.exports = {
  incrementar() { return ++contador },
  obtener() { return contador },
}

// a.js
const config = require("./config")
config.incrementar()  // contador = 1

// b.js
const config = require("./config")
console.log(config.obtener())  // 1 — ¡es el MISMO objeto!
// require cachea: el módulo se ejecuta una sola vez

// Para ver la caché:
console.log(require.cache)  // objeto con todos los módulos cargados
```

### `require` es síncrono

```javascript
// require() bloquea el hilo hasta que el módulo carga
// Esto está bien en Node.js porque los archivos se cargan desde disco (rápido)
// Pero significa que no puedes require() dentro de async sin importación dinámica

// ❌ No funciona en ESM:
// const modulo = await require("./modulo")  // require no es async

// ✅ Importación dinámica (funciona en CJS y ESM):
const modulo = await import("./modulo.mjs")
```

### Resolución de rutas

```javascript
// Relativa al archivo actual
require("./modulo")        // mismo directorio
require("../utils/helpers") // directorio padre

// Node.js busca en este orden:
// 1. ./modulo.js
// 2. ./modulo.json
// 3. ./modulo/index.js
// 4. ./modulo/package.json → "main"

// node_modules (búsqueda hacia arriba)
require("express")  // busca en node_modules del dir actual, luego padre, etc.
```

### Piensa críticamente

- ¿Por qué `exports = { ... }` no funciona? Porque `exports` es un alias de `module.exports`. Si reasignas `exports`, pierdes la referencia. `module.exports = { ... }` sí funciona porque reasignas la propiedad real.
- ¿Se puede usar `require` en ESM? No directamente. En ESM, usa `import` o `import()` dinámico. Pero en Node.js, puedes usar `createRequire` de `module` para simular `require` en ESM.

## 2. ES Modules: `import` y `export`

### Idea clave

ES Modules es el estándar oficial del lenguaje. A diferencia de CJS, las importaciones son estáticas (se resuelven en tiempo de compilación), lo que permite tree shaking. Las exportaciones son live bindings: si el módulo exportador cambia el valor, el importador lo ve.

### Sintaxis básica

```javascript
// math.mjs — exportar
export function sumar(a, b) { return a + b }
export function restar(a, b) { return a - b }
export const PI = 3.14159

// Exportación por defecto (una sola por módulo)
export default function multiplicar(a, b) { return a * b }

// app.mjs — importar
import { sumar, restar, PI } from "./math.mjs"
import multiplicar from "./math.mjs"  // import default
import * as math from "./math.mjs"   // importar todo como namespace

console.log(sumar(2, 3))       // 5
console.log(multiplicar(2, 3))  // 6
console.log(math.PI)            // 3.14159
```

### Exportación agrupada

```javascript
// math.mjs
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }
function multiplicar(a, b) { return a * b }

// Exportar todo al final
export { sumar, restar, multiplicar }

// Renombrar al exportar
export { sumar as add, restar as subtract }
```

### Re-exportación (barrel files)

```javascript
// index.mjs — re-exportar desde múltiples módulos
export { sumar, restar } from "./math.mjs"
export { filtrar, mapear } from "./array-utils.mjs"
export { formatear } from "./string-utils.mjs"

// El consumidor importa todo desde index:
import { sumar, filtrar, formatear } from "./utils"
```

### Live bindings

```javascript
// contador.mjs
export let contador = 0
export function incrementar() { contador++ }

// app.mjs
import { contador, incrementar } from "./contador.mjs"
console.log(contador)  // 0
incrementar()
console.log(contador)  // 1 — ¡el valor actualizado!
// En CJS, contador sería una copia y siempre sería 0
```

### Piensa críticamente

- ¿Las importaciones ESM son hoisted? Sí. Las importaciones se elevan al inicio del módulo, como `var`. Puedes usar un import antes de su declaración física.
- ¿Se pueden importar condicionalmente con ESM estático? No. Las importaciones estáticas siempre se ejecutan, sin importar condiciones. Para importación condicional, usa `import()` dinámico.
- ¿Por qué los archivos ESM necesitan `.mjs` o `"type": "module"`? Porque Node.js necesita saber qué sistema usar para parsear el archivo. `.mjs` siempre es ESM. `.cjs` siempre es CJS. `.js` depende de `package.json` `"type"`.

## 3. Diferencias clave entre CJS y ESM

### Tabla comparativa

| Característica | CommonJS | ES Modules |
|----------------|----------|------------|
| Carga | Síncrona | Asíncrona |
| Importación | `require()` (expresión) | `import` (declaración estática) |
| Exportación | `module.exports` (objeto) | `export` (declaraciones) |
| Cache | `require.cache` | Módulo cache (no accesible directamente) |
| Live bindings | No (copia del valor) | Sí (referencia live) |
| `this` en módulo | `module.exports` | `undefined` |
| Tree shaking | No | Sí |
| Top-level `await` | No | Sí (ES2022+) |
| `__dirname`/`__filename` | Disponible | No disponible (usa `import.meta.url`) |

### `__dirname` y `__filename` en ESM

```javascript
// CJS:
console.log(__dirname)  // /ruta/al/directorio
console.log(__filename)  // /ruta/al/archivo.js

// ESM — no existen. Usar import.meta:
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

### Top-level await (solo ESM)

```javascript
// ESM: await en el nivel superior del módulo (sin función async)
const config = await fetch("/api/config").then(r => r.json())
export default config

// CJS: no funciona — necesitas una función async autoejecutable
// (async () => { const config = await fetch(...) })()
```

## 4. Importación dinámica: `import()`

### Idea clave

`import()` es una función que devuelve una promesa con el módulo. Funciona tanto en CJS como en ESM. Permite carga diferida (lazy loading), importación condicional y carga bajo demanda.

### Ejemplos

```javascript
// Importación condicional
if (featureFlags.experimental) {
  const { experimentalFeature } = await import("./features/experimental.mjs")
  experimentalFeature()
}

// Lazy loading — solo carga cuando se necesita
async function procesarPDF(bytes) {
  // pdf-lib solo se carga cuando alguien procesa un PDF
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.load(bytes)
  return doc
}

// En rutas (code splitting en frontend)
router.get("/dashboard", async (req, res) => {
  const { renderDashboard } = await import("./views/dashboard.mjs")
  res.send(renderDashboard())
})
```

### Piensa críticamente

- ¿`import()` rompe el tree shaking? Sí, parcialmente. Los módulos cargados con `import()` no se incluyen en el bundle inicial, pero el bundler no puede hacer tree shaking dentro de ellos porque no sabe qué se importará en runtime.
- ¿`import()` es siempre asíncrono? Sí. Devuelve una promesa. Incluso si el módulo ya está cacheado, la promesa se resuelve en la siguiente microtarea.

## 5. Tree shaking y side effects

### Idea clave

El tree shaking es la eliminación de código no usado durante el bundling. Solo funciona con ESM porque las importaciones son estáticas: el bundler sabe exactamente qué se usa y qué no. Los "side effects" — código que ejecuta algo al importarse — pueden impedir el tree shaking.

### Cómo funciona

```javascript
// utils.mjs
export function usarA() { return "A" }
export function usarB() { return "B" }
export function usarC() { return "C" }

// app.mjs
import { usarA } from "./utils.mjs"
// El bundler elimina usarB y usarC del bundle final
// El código de usarB y usarC no se incluye
```

### Side effects que rompen tree shaking

```javascript
// ⚠️ Este módulo tiene side effects
// polyfill.js
window.customElements.define("my-widget", MyWidget)  // se ejecuta al importar
export function algo() { return "algo" }

// Si importas { algo } from "./polyfill.js", el bundler NO puede eliminar
// el código de customElements.define porque es un side effect.
// El bundler no sabe si ese side effect es necesario.

// Declarar que no hay side effects en package.json:
// { "sideEffects": false }
// Esto le dice al bundler que puede eliminar cualquier export no usada
```

### `sideEffects` en package.json

```json
{
  "sideEffects": false  // el módulo no tiene side effects — tree shaking máximo
}
```

```json
{
  "sideEffects": ["./polyfill.js", "*.css"]  // estos archivos tienen side effects
}
```

## 6. Patrones de organización: barrel exports, re-exports

### Idea clave

Los barrel files (usualmente `index.js`) re-exportan de múltiples módulos para simplificar las importaciones. Pero pueden impedir el tree shaking si no se configuran bien.

### Barrel file básico

```javascript
// utils/index.mjs
export * from "./math.mjs"
export * from "./string.mjs"
export * from "./array.mjs"

// Consumidor:
import { sumar, formatear, filtrar } from "./utils"
// Una sola importación en lugar de tres
```

### El problema de los barrel files

```javascript
// ⚠️ Si importas solo una función:
import { sumar } from "./utils"
// El bundler podría incluir TODOS los módulos (math, string, array)
// porque export * no permite tree shaking granular en algunos bundlers

// ✅ Mejor: importar directamente del módulo
import { sumar } from "./utils/math.mjs"
// Solo se incluye math.mjs en el bundle
```

## 7. `package.json`: `type`, `exports`, `main`, `module`

### Idea clave

El `package.json` controla cómo Node.js y los bundlers interpretan tu paquete. `type` determina si los `.js` son CJS o ESM. `exports` es el mapa moderno de entrada. `main` es el punto de entrada clásico.

### Configuración típica

```json
{
  "name": "mi-paquete",
  "type": "module",  // los .js son ESM por defecto
  "main": "./dist/index.cjs",      // CJS fallback (para consumidores CJS)
  "module": "./dist/index.mjs",     // ESM para bundlers (webpack, vite)
  "exports": {
    ".": {
      "import": "./dist/index.mjs",   // ESM
      "require": "./dist/index.cjs",  // CJS
      "types": "./dist/index.d.ts"    // TypeScript
    },
    "./utils": {
      "import": "./dist/utils.mjs",
      "require": "./dist/utils.cjs"
    }
  },
  "sideEffects": false
}
```

### `exports` vs `main`

```javascript
// Sin exports: el consumidor puede importar cualquier archivo
import algo from "mi-paquete/cualquier/ruta"  // funciona

// Con exports: solo las rutas definidas son accesibles
import algo from "mi-paquete"           // funciona (".")
import utils from "mi-paquete/utils"    // funciona ("./utils")
import secreto from "mi-paquete/interno"  // Error: no exportado
```

## Errores Comunes

### Mapa de depuración del capítulo

- Si ves `SyntaxError: Cannot use import statement outside a module` → el archivo se está cargando como CJS pero usa sintaxis ESM. Añade `"type": "module"` al package.json o renombra a `.mjs`.
- Si ves `require is not defined` → estás en ESM pero intentas usar `require`. Usa `import` o `import()` dinámico.
- Si `__dirname` no está definido → estás en ESM. Usa `fileURLToPath(import.meta.url)`.
- Si una importación no se encuentra → verifica el `exports` field del package.json del paquete.
- Si el bundle es muy grande → revisa los barrel files y los side effects. Importa directamente de los módulos.
- Si `import()` devuelve una promesa pendiente → verifica la ruta. En ESM, las extensiones son obligatorias: `import("./modulo.mjs")`, no `import("./modulo")`.

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Crear un módulo básico con CommonJS y ES Modules

**Ejercicio**: Crea un módulo `calculadora.js` que exporte funciones para sumar, restar, multiplicar y dividir. Luego, importa y usa esas funciones en otro archivo.

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa `module.exports` para CommonJS
2. Usa `export` para ES Modules
3. Asegúrate de manejar la división por cero

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>


</details>


**CommonJS (calculadora.js)**:
```javascript
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }
function multiplicar(a, b) { return a * b }
function dividir(a, b) {
  if (b === 0) throw new Error("No se puede dividir por cero");
  return a / b;
}

module.exports = { sumar, restar, multiplicar, dividir };
```

**CommonJS (app.js)**:
```javascript
const calculadora = require('./calculadora');
console.log(calculadora.sumar(5, 3));      // 8
console.log(calculadora.dividir(10, 2));   // 5
```

**ES Modules (calculadora.mjs)**:
```javascript
export function sumar(a, b) { return a + b }
export function restar(a, b) { return a - b }
export function multiplicar(a, b) { return a * b }
export function dividir(a, b) {
  if (b === 0) throw new Error("No se puede dividir por cero");
  return a / b;
}
```

**ES Modules (app.mjs)**:
```javascript
import { sumar, dividir } from './calculadora.mjs';
console.log(sumar(5, 3));      // 8
console.log(dividir(10, 2));   // 5
```

### Nivel Intermedio

**Objetivo**: Crear un sistema de loggers con múltiples módulos

**Ejercicio**: Crea un sistema de logging que soporte diferentes niveles (info, warn, error) y formatos (consola, archivo). Usa módulos para separar responsabilidades.

**Requisitos**:
1. Módulo `logger.js` con la función principal
2. Módulo `formateadores.js` con diferentes formatos de salida
3. Módulo `destinos.js` con diferentes destinos (consola, archivo simulado)
4. Usa barrel exports para simplificar importaciones

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa composición para combinar formateadores y destinos
2. Implementa el patrón Strategy para diferentes formatos
3. Usa `__dirname` o `import.meta.url` para rutas relativas

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>


</details>


**formateadores.js (ESM)**:
```javascript
export const formatoConsola = (nivel, mensaje) => 
  `[${new Date().toISOString()}] ${nivel.toUpperCase()}: ${mensaje}`;

export const formatoJSON = (nivel, mensaje) => 
  JSON.stringify({ timestamp: Date.now(), level: nivel, message: mensaje });
```

**destinos.js (ESM)**:
```javascript
import fs from 'fs';
import path from 'path';

export const destinoConsola = {
  escribir(formateado) { console.log(formateado); }
};

export const crearDestinoArchivo = (ruta) => ({
  escribir(formateado) { fs.appendFileSync(ruta, formateado + '\n'); }
});
```

**logger.js (ESM)**:
```javascript
import { formatoConsola } from './formateadores.js';
import { destinoConsola } from './destinos.js';

export function crearLogger(configuracion = {}) {
  const {
    formato = formatoConsola,
    destinos = [destinoConsola]
  } = configuracion;
  
  return {
    info(mensaje) {
      const formateado = formato('info', mensaje);
      destinos.forEach(destino => destino.escribir(formateado));
    },
    warn(mensaje) {
      const formateado = formato('warn', mensaje);
      destinos.forEach(destino => destino.escribir(formateado));
    },
    error(mensaje) {
      const formateado = formato('error', mensaje);
      destinos.forEach(destino => destino.escribir(formateado));
    }
  };
}
```

**index.js (barrel export)**:
```javascript
export { crearLogger } from './logger.js';
export { formatoConsola, formatoJSON } from './formateadores.js';
export { destinoConsola, crearDestinoArchivo } from './destinos.js';
```

### Nivel Avanzado

**Objetivo**: Crear un sistema de plugins con importación dinámica

**Ejercicio**: Diseña un sistema de plugins que cargue módulos bajo demanda. Los plugins deben poder registrarse y desregistrarse dinámicamente.

**Especificaciones**:
1. Los plugins se cargan con `import()` dinámico
2. Cada plugin tiene `nombre`, `version`, `inicializar()` y `destruir()`
3. El sistema debe manejar errores de carga
4. Soporte para plugins remotos (URLs)

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un Map para almacenar plugins cargados
2. Implementa validación de plugins con duck typing
3. Usa AbortController para cancelar cargas

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class SistemaPlugins {
  constructor() {
    this.plugins = new Map();
    this.controllers = new Map();
  }
  
  async cargarPlugin(ruta) {
    // Cancelar carga anterior si existe
    if (this.controllers.has(ruta)) {
      this.controllers.get(ruta).abort();
    }
    
    const controller = new AbortController();
    this.controllers.set(ruta, controller);
    
    try {
      const modulo = await import(ruta, { signal: controller.signal });
      const Plugin = modulo.default || modulo.Plugin;
      
      if (!Plugin || typeof Plugin !== 'function') {
        throw new Error(`Plugin en ${ruta} no tiene exportación válida`);
      }
      
      const instancia = new Plugin();
      
      // Validar interfaz del plugin
      if (!instancia.nombre || !instancia.version) {
        throw new Error(`Plugin en ${ruta} no tiene nombre o versión`);
      }
      
      if (typeof instancia.inicializar !== 'function') {
        throw new Error(`Plugin en ${ruta} no tiene método inicializar()`);
      }
      
      await instancia.inicializar();
      this.plugins.set(instancia.nombre, instancia);
      
      console.log(`Plugin ${instancia.nombre} v${instancia.version} cargado`);
      return instancia;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`Carga de ${ruta} cancelada`);
      } else {
        console.error(`Error cargando plugin ${ruta}:`, error);
      }
      throw error;
    } finally {
      this.controllers.delete(ruta);
    }
  }
  
  async descargarPlugin(nombre) {
    const plugin = this.plugins.get(nombre);
    if (!plugin) {
      throw new Error(`Plugin ${nombre} no encontrado`);
    }
    
    if (typeof plugin.destruir === 'function') {
      await plugin.destruir();
    }
    
    this.plugins.delete(nombre);
    console.log(`Plugin ${nombre} descargado`);
  }
  
  listarPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      nombre: p.nombre,
      version: p.version
    }));
  }
}

// Uso
const sistema = new SistemaPlugins();

// Carga condicional
if (featureFlags.usarAnalytics) {
  await sistema.cargarPlugin('./plugins/analytics.mjs');
}

// Carga con timeout
async function conTimeout(promesa, ms) {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promesa, timeout]);
}

try {
  await conTimeout(sistema.cargarPlugin('./plugins/remoto.js'), 5000);
} catch (error) {
  console.error('Plugin remoto no cargó a tiempo:', error.message);
}
```

</details>


---

## Pensamiento Crítico

### Problema 1: Circular dependencies

**Situación**: Dos módulos se importan mutuamente, causando errores o valores `undefined`.

**Preguntas guía**:
1. ¿Por qué ocurren las dependencias circulares?
2. ¿Cómo las detectas y resuelves?
3. ¿Qué estrategias usa Python para esto?

**Análisis**:
- **Causa**: Módulos que dependen entre sí antes de terminar de cargarse
- **Solución JS**: Refactorizar, usar imports dinámicos, o patrones como dependency injection
- **Python**: También tiene problemas con imports circulares; usa lazy imports o reestructura el código

```javascript
// ❌ Dependencia circular
// a.js
import { b } from './b.js';
export const a = () => b();

// b.js
import { a } from './a.js';
export const b = () => a();

// ✅ Solución: dependency injection
// shared.js
let aFunc, bFunc;
export const setA = (fn) => aFunc = fn;
export const setB = (fn) => bFunc = fn;
export const getA = () => aFunc;
export const getB = () => bFunc;

// a.js
import { setA, getB } from './shared.js';
export const a = () => getB()();
setA(a);

// b.js
import { setB, getA } from './shared.js';
export const b = () => getA()();
setB(b);
```

### Problema 2: Tree shaking ineffective

**Situación**: Tu bundle es más grande de lo esperado a pesar de usar ESM.

**Preguntas guía**:
1. ¿Qué factores impiden el tree shaking?
2. ¿Cómo auditar qué código se incluye?
3. ¿Qué configuraciones ayudan?

**Análisis**:
- **Factores**: Side effects, barrel files, dynamic imports, código no ESM
- **Auditoría**: Usa herramientas como webpack-bundle-analyzer
- **Configuración**: `sideEffects: false`, imports directos, evita `export *`

---

## Conexión con Python

### Sistema de módulos en Python

**Python (imports)**:
```python
# math.py
def sumar(a, b):
    return a + b

def restar(a, b):
    return a - b

PI = 3.14159
```

```python
# app.py
from math import sumar, restar
import math

print(sumar(2, 3))  # 5
print(math.PI)      # 3.14159
```

**Diferencias con JavaScript**:
1. **Síncrono**: Python carga módulos síncronamente (como CJS)
2. **No hay tree shaking**: Python no elimina código no usado
3. **No hay live bindings**: Python exporta valores, no referencias
4. **`__init__.py`**: Los paquetes Python requieren este archivo

### Patrones comunes

**Barrel exports en Python (package/__init__.py)**:
```python
# utils/__init__.py
from .math_utils import sumar, restar
from .string_utils import formatear
```

**Importación dinámica en Python**:
```python
import importlib

def cargar_modulo(nombre):
    return importlib.import_module(nombre)

# Uso
modulo = cargar_modulo('math')
print(modulo.sumar(2, 3))
```

### Cuándo usar cada uno

**JavaScript (ESM) es mejor para**:
- Frontend web (tree shaking escrítico)
- Proyectos con bundling (webpack, vite)
- Code splitting y lazy loading

**Python es mejor para**:
- Scripts y automatización
- Data science y machine learning
- Backend con Django/FastAPI

---

## Resumen

1. **CommonJS** usa `require`/`module.exports` (síncrono, cache, copia de valores)
2. **ES Modules** usa `import`/`export` (estático, asíncrono, live bindings, tree shaking)
3. **ESM soporta top-level `await`**; CJS no
4. **`__dirname`/`__filename`** no existen en ESM; usa `import.meta.url`
5. **`import()`** permite importación dinámica y lazy loading en ambos sistemas
6. **Tree shaking** elimina código no usado, pero los side effects lo impiden
7. **`exports`** en package.json controla qué puntos de entrada son accesibles
8. **Los barrel files** simplifican importaciones pero pueden aumentar el bundle

---

## Siguiente Capítulo

→ **[Capítulo 5: Estructuras avanzadas de datos e iteración](./cap-05)**: Map, Set, WeakMap, WeakSet y los métodos modernos de arrays.
