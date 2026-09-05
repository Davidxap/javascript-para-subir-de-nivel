---
title: "Chapter 4: Modules and Code Organization"
---

# Chapter 4: Modules and Code Organization

> Code organization into modules is what separates a script from a maintainable application.

## Introduction

JavaScript has two module systems: CommonJS (CJS, the original Node.js system) and ES Modules (ESM, the language standard). Understanding the differences, when to use each, and how to migrate from CJS to ESM is essential for any modern Node.js project.

**Why does it matter?** Because code organization determines the maintainability, scalability, and performance of applications. Design patterns rely on a good module structure.

## 1. CommonJS: `require` and `module.exports`

### Key Idea

CommonJS is the original module system of Node.js. Each file is a module with its own scope. `require()` imports a module (synchronously), while `module.exports` exports values. Modules are cached: the first call loads the module, and subsequent calls return the cache.

### Basic Syntax

```javascript
// math.js — export
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }

// Option 1: assign to module.exports
module.exports = { sumar, restar }

// Option 2: add properties
// exports.sumar = sumar
// exports.restar = restar
// ⚠️ Do not do: exports = { sumar, restar } — loses the reference to module.exports

// app.js — import
const { sumar, restar } = require("./math")
console.log(sumar(2, 3))  // 5

// Import the entire module
const math = require("./math")
console.log(math.sumar(2, 3))  // 5
```

### Module Cache

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
console.log(config.obtener())  // 1 — it is the SAME object!
// require caches: the module is executed only once

// To view the cache:
console.log(require.cache)  // object with all loaded modules
```

### `require` is Synchronous

```javascript
// require() blocks the thread until the module loads
// This is fine in Node.js because files are loaded from disk (fast)
// But it means you cannot require() inside async without dynamic import

// ❌ Does not work in ESM:
// const modulo = await require("./modulo")  // require is not async

// ✅ Dynamic import (works in CJS and ESM):
const modulo = await import("./modulo.mjs")
```

### Path Resolution

```javascript
// Relative to the current file
require("./modulo")        // same directory
require("../utils/helpers") // parent directory

// Node.js searches in this order:
// 1. ./modulo.js
// 2. ./modulo.json
// 3. ./modulo/index.js
// 4. ./modulo/package.json → "main"

// node_modules (lookup upwards)
require("express")  // searches in node_modules of the current dir, then parent, etc.
```

### Think Critically

- Why doesn't `exports = { ... }` work? Because `exports` is an alias for `module.exports`. If you reassign `exports`, you lose the reference. `module.exports = { ... }` does work because you are reassigning the actual property.
- Can you use `require` in ESM? Not directly. In ESM, use `import` or dynamic `import()`. However, in Node.js, you can use `createRequire` from `module` to simulate `require` in ESM.

## 2. ES Modules: `import` and `export`

### Key Idea

ES Modules is the official language standard. Unlike CJS, imports are static (resolved at compile time), which enables tree shaking. Exports are live bindings: if the exporting module changes the value, the importer sees it.

### Basic Syntax

```javascript
// math.mjs — export
export function sumar(a, b) { return a + b }
export function restar(a, b) { return a - b }
export const PI = 3.14159

// Default export (only one per module)
export default function multiplicar(a, b) { return a * b }

// app.mjs — import
import { sumar, restar, PI } from "./math.mjs"
import multiplicar from "./math.mjs"  // import default
import * as math from "./math.mjs"   // import everything as a namespace

console.log(sumar(2, 3))       // 5
console.log(multiplicar(2, 3))  // 6
console.log(math.PI)            // 3.14159
```

### Grouped Export

```javascript
// math.mjs
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }
function multiplicar(a, b) { return a * b }

// Export everything at the end
export { sumar, restar, multiplicar }

// Rename when exporting
export { sumar as add, restar as subtract }
```

### Re-exporting (Barrel Files)

```javascript
// index.mjs — re-export from multiple modules
export { sumar, restar } from "./math.mjs"
export { filtrar, mapear } from "./array-utils.mjs"
export { formatear } from "./string-utils.mjs"

// The consumer imports everything from index:
import { sumar, filtrar, formatear } from "./utils"
```

### Live Bindings

```javascript
// contador.mjs
export let contador = 0
export function incrementar() { contador++ }

// app.mjs
import { contador, incrementar } from "./contador.mjs"
console.log(contador)  // 0
incrementar()
console.log(contador)  // 1 — the updated value!
// In CJS, contador would be a copy and would always be 0
```

### Think Critically

- Are ESM imports hoisted? Yes. Imports are hoisted to the top of the module, just like `var`. You can use an import before its physical declaration.
- Can you conditionally import with static ESM? No. Static imports always execute, regardless of conditions. For conditional importing, use dynamic `import()`.
- Why do ESM files need `.mjs` or `"type": "module"`? Because Node.js needs to know which system to use to parse the file. `.mjs` is always ESM. `.cjs` is always CJS. `.js` depends on the `"type"` in `package.json`.

## 3. Key Differences Between CJS and ESM

### Comparison Table

| Feature | CommonJS | ES Modules |
|----------------|----------|------------|
| Loading | Synchronous | Asynchronous |
| Import | `require()` (expression) | `import` (static declaration) |
| Export | `module.exports` (object) | `export` (declarations) |
| Cache | `require.cache` | Module cache (not directly accessible) |
| Live bindings | No (copy of the value) | Yes (live reference) |
| `this` in module | `module.exports` | `undefined` |
| Tree shaking | No | Yes |
| Top-level `await` | No | Yes (ES2022+) |
| `__dirname`/`__filename` | Available | Not available (use `import.meta.url`) |

### `__dirname` and `__filename` in ESM

```javascript
// CJS:
console.log(__dirname)  // /path/to/directory
console.log(__filename)  // /path/to/file.js

// ESM — they do not exist. Use import.meta:
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

### Top-Level Await (ESM Only)

```javascript
// ESM: await at the top level of the module (without an async function)
const config = await fetch("/api/config").then(r => r.json())
export default config

// CJS: does not work — you need an immediately invoked async function (IIFE)
// (async () => { const config = await fetch(...) })()
```

## 4. Dynamic Import: `import()`

### Key Idea

`import()` is a function that returns a promise with the module. It works in both CJS and ESM. It allows for lazy loading, conditional importing, and on-demand loading.

### Examples

```javascript
// Conditional import
if (featureFlags.experimental) {
  const { experimentalFeature } = await import("./features/experimental.mjs")
  experimentalFeature()
}

// Lazy loading — only loads when needed
async function procesarPDF(bytes) {
  // pdf-lib is only loaded when someone processes a PDF
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.load(bytes)
  return doc
}

// In routes (code splitting in frontend)
router.get("/dashboard", async (req, res) => {
  const { renderDashboard } = await import("./views/dashboard.mjs")
  res.send(renderDashboard())
})
```

### Think Critically

- Does `import()` break tree shaking? Yes, partially. Modules loaded with `import()` are not included in the initial bundle, but the bundler cannot perform tree shaking inside them because it doesn't know what will be imported at runtime.
- Is `import()` always asynchronous? Yes. It returns a promise. Even if the module is already cached, the promise resolves in the next microtask.

## 5. Tree Shaking and Side Effects

### Key Idea

Tree shaking is the removal of unused code during bundling. It only works with ESM because imports are static: the bundler knows exactly what is used and what is not. "Side effects" — code that executes something when imported — can prevent tree shaking.

### How It Works

```javascript
// utils.mjs
export function usarA() { return "A" }
export function usarB() { return "B" }
export function usarC() { return "C" }

// app.mjs
import { usarA } from "./utils.mjs"
// The bundler removes usarB and usarC from the final bundle
// The code for usarB and usarC is not included
```

### Side Effects That Break Tree Shaking

```javascript
// ⚠️ This module has side effects
// polyfill.js
window.customElements.define("my-widget", MyWidget)  // executes upon import
export function algo() { return "algo" }

// If you import { algo } from "./polyfill.js", the bundler CANNOT remove
// the customElements.define code because it is a side effect.
// The bundler does not know if that side effect is necessary.

// Declare that there are no side effects in package.json:
// { "sideEffects": false }
// This tells the bundler that it can remove any unused export
```

### `sideEffects` in package.json

```json
{
  "sideEffects": false  // the module has no side effects — maximum tree shaking
}
```

```json
{
  "sideEffects": ["./polyfill.js", "*.css"]  // these files have side effects
}
```

## 6. Organization Patterns: Barrel Exports, Re-exports

### Key Idea

Barrel files (usually `index.js`) re-export from multiple modules to simplify imports. However, they can prevent tree shaking if not configured properly.

### Basic Barrel File

```javascript
// utils/index.mjs
export * from "./math.mjs"
export * from "./string.mjs"
export * from "./array.mjs"

// Consumer:
import { sumar, formatear, filtrar } from "./utils"
// A single import instead of three
```

### The Problem with Barrel Files

```javascript
// ⚠️ If you import only one function:
import { sumar } from "./utils"
// The bundler might include ALL modules (math, string, array)
// because export * does not allow granular tree shaking in some bundlers

// ✅ Better: import directly from the module
import { sumar } from "./utils/math.mjs"
// Only math.mjs is included in the bundle
```

## 7. `package.json`: `type`, `exports`, `main`, `module`

### Key Idea

The `package.json` file controls how Node.js and bundlers interpret your package. `type` determines whether `.js` files are treated as CJS or ESM. `exports` is the modern entry point map. `main` is the classic entry point.

### Typical Configuration

```json
{
  "name": "mi-paquete",
  "type": "module",  // .js files are ESM by default
  "main": "./dist/index.cjs",      // CJS fallback (for CJS consumers)
  "module": "./dist/index.mjs",     // ESM for bundlers (webpack, vite)
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
// Without exports: the consumer can import any file
import algo from "mi-paquete/cualquier/ruta"  // works

// With exports: only the defined paths are accessible
import algo from "mi-paquete"           // works (".")
import utils from "mi-paquete/utils"    // works ("./utils")
import secreto from "mi-paquete/interno"  // Error: not exported
```

## Common Errors

### Chapter Debugging Map

- If you see `SyntaxError: Cannot use import statement outside a module` → the file is being loaded as CJS but uses ESM syntax. Add `"type": "module"` to `package.json` or rename the file to `.mjs`.
- If you see `require is not defined` → you are in ESM but trying to use `require`. Use `import` or dynamic `import()`.
- If `__dirname` is not defined → you are in ESM. Use `fileURLToPath(import.meta.url)`.
- If an import is not found → check the `exports` field of the package's `package.json`.
- If the bundle is too large → check your barrel files and side effects. Import directly from modules.
- If `import()` returns a pending promise → check the path. In ESM, file extensions are mandatory: `import("./modulo.mjs")`, not `import("./modulo")`.

---

## Practical Exercises

### Basic Level

**Objective**: Create a basic module with CommonJS and ES Modules

**Exercise**: Create a `calculadora.js` module that exports functions to add, subtract, multiply, and divide. Then, import and use those functions in another file.

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use `module.exports` for CommonJS
2. Use `export` for ES Modules
3. Make sure to handle division by zero

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>


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

### Intermediate Level

**Objective**: Create a logger system with multiple modules

**Exercise**: Create a logging system that supports different levels (info, warn, error) and formats (console, file). Use modules to separate responsibilities.

**Requirements**:
1. `logger.js` module with the main function
2. `formateadores.js` module with different output formats
3. `destinos.js` module with different destinations (console, simulated file)
4. Use barrel exports to simplify imports

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use composition to combine formatters and destinations
2. Implement the Strategy pattern for different formats
3. Use `__dirname` or `import.meta.url` for relative paths

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>


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

### Advanced Level

**Objective**: Create a plugin system with dynamic import

**Exercise**: Design a plugin system that loads modules on demand. Plugins must be able to register and unregister dynamically.

**Specifications**:
1. Plugins are loaded using dynamic `import()`
2. Each plugin has `nombre`, `version`, `inicializar()`, and `destruir()`
3. The system must handle loading errors
4. Support for remote plugins (URLs)

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use a `Map` to store loaded plugins
2. Implement plugin validation using duck typing
3. Use `AbortController` to cancel loads

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
class SistemaPlugins {
  constructor() {
    this.plugins = new Map();
    this.controllers = new Map();
  }
  
  async cargarPlugin(ruta) {
    // Cancel previous load if it exists
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
      
      // Validate plugin interface
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

// Usage
const sistema = new SistemaPlugins();

// Conditional load
if (featureFlags.usarAnalytics) {
  await sistema.cargarPlugin('./plugins/analytics.mjs');
}

// Load with timeout
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

## Critical Thinking

### Problem 1: Circular Dependencies

**Situation**: Two modules import each other, causing errors or `undefined` values.

**Guiding Questions**:
1. Why do circular dependencies occur?
2. How do you detect and resolve them?
3. What strategies does Python use for this?

**Analysis**:
- **Cause**: Modules that depend on each other before they finish loading.
- **JS Solution**: Refactor, use dynamic imports, or patterns like dependency injection.
- **Python**: Also has issues with circular imports; uses lazy imports or code restructuring.

```javascript
// ❌ Circular dependency
// a.js
import { b } from './b.js';
export const a = () => b();

// b.js
import { a } from './a.js';
export const b = () => a();

// ✅ Solution: dependency injection
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

### Problem 2: Ineffective Tree Shaking

**Situation**: Your bundle is larger than expected despite using ESM.

**Guiding Questions**:
1. What factors prevent tree shaking?
2. How do you audit what code is included?
3. What configurations help?

**Analysis**:
- **Factors**: Side effects, barrel files, dynamic imports, non-ESM code.
- **Audit**: Use tools like webpack-bundle-analyzer.
- **Configuration**: `sideEffects: false`, direct imports, avoid `export *`.

---

## Connection with Python

### Module System in Python

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

**Differences from JavaScript**:
1. **Synchronous**: Python loads modules synchronously (like CJS).
2. **No tree shaking**: Python does not eliminate unused code.
3. **No live bindings**: Python exports values, not references.
4. **`__init__.py`**: Python packages require this file.

### Common Patterns

**Barrel exports in Python (package/__init__.py)**:
```python
# utils/__init__.py
from .math_utils import sumar, restar
from .string_utils import formatear
```

**Dynamic import in Python**:
```python
import importlib

def cargar_modulo(nombre):
    return importlib.import_module(nombre)

# Usage
modulo = cargar_modulo('math')
print(modulo.sumar(2, 3))
```

### When to Use Each

**JavaScript (ESM) is best for**:
- Web frontend (where tree shaking is critical)
- Projects with bundling (webpack, vite)
- Code splitting and lazy loading

**Python is best for**:
- Scripts and automation
- Data science and machine learning
- Backend with Django/FastAPI

---

## Summary

1. **CommonJS** uses `require`/`module.exports` (synchronous, cache, copy of values)
2. **ES Modules** uses `import`/`export` (static, asynchronous, live bindings, tree shaking)
3. **ESM supports top-level `await`**; CJS does not
4. **`__dirname`/`__filename`** do not exist in ESM; use `import.meta.url`
5. **`import()`** allows dynamic importing and lazy loading in both systems
6. **Tree shaking** eliminates unused code, but side effects prevent it
7. **`exports`** in `package.json` controls which entry points are accessible
8. **Barrel files** simplify imports but can increase the bundle size

---

## Next Chapter

→ **Cap-5-Estructuras-Avanzadas-Iteracion**: In the next chapter, we will look at advanced structures and iteration, including Map, Set, WeakMap, WeakSet, and new array methods.