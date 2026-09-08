---
title: "Capítulo 4: Módulos y organización del código"
---

# Capítulo 4: Módulos y organización del código

> Trabajar con módulos es lo que separa un script de una aplicación que alguien más puede mantener.

## Introducción

En un script pequeño puedes vivir con un solo archivo. Pero llega el día en que el archivo tiene 800 líneas, dos funciones se llaman `procesarDatos` y no sabes qué importa qué. Ahí es donde los módulos dejan de ser un detalle y se vuelven la columna vertebral del proyecto.

JavaScript tiene dos sistemas en convivencia: **CommonJS** (CJS, el original de Node.js, el de `require`) y **ES Modules** (ESM, el estándar del lenguaje, el de `import`/`export`). Durante años estuvieron separados, hoy conviven en un mismo ecosistema y saber moverse entre los dos es lo que más nota al leer código ajeno. En este capítulo verás qué hace cada uno por debajo, dónde se rompen, y cómo organizar un proyecto para que los bundlers hagan su magia sin que salga caro.

---

## 1. CommonJS: `require` y `module.exports`

### El problema: todo compartía el mismo scope global

Antes de que existieran los módulos, cada script cargado en la página o en el proceso colgaba sus variables en un scope global. Si dos librerías definían `contador`, la segunda borraba a la primera. Node.js resolvió esto en 2009 con CommonJS: **cada archivo es un módulo con su propio scope**, y solo lo que exportes explícitamente se vuelve accesible desde afuera.

```javascript
// matematicas.js
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }

// Todo lo no exportado queda encerrado en este archivo.
module.exports = { sumar, restar }

// app.js
const { sumar, restar } = require("./matematicas")
console.log(sumar(2, 3))   // 5

// También puedes importar el objeto completo:
const matematicas = require("./matematicas")
console.log(matematicas.sumar(2, 3))   // 5
```

### La trampa de `exports` vs `module.exports`

Existe `exports` como atajo, pero es un **alias** de `module.exports`. Mientras agregues propiedades funciona; si reasignas el alias, pierdes la referencia:

```javascript
// ❌ Esto NO exporta nada:
exports = { sumar, restar }

// ✅ Esto sí:
module.exports = { sumar, restar }

// ✅ Y esto también (agrega propiedades al mismo objeto):
exports.sumar = sumar
```

La regla: trata `exports` como un alias de solo lectura. Si necesitas reemplazar el objeto exportado completo, usa `module.exports`.

### El caché de módulos

`require` ejecuta el módulo una sola vez y guarda el resultado. Las llamadas siguientes devuelven el **mismo objeto**:

```javascript
// config.js
let contador = 0
module.exports = {
  incrementar() { return ++contador },
  obtener() { return contador },
}

// a.js
const config = require("./config")
config.incrementar()           // contador = 1

// b.js
const config = require("./config")
console.log(config.obtener())  // 1 — es el MISMO objeto, no una copia
```

Esto es muy útil para estado compartido (configuración, conexiones de BD) y es la razón por la cual puedes importar el mismo módulo en diez archivos sin que se ejecute diez veces. Pero también es la razón de los *singletons accidentales*: si el módulo guarda estado con `let`, ese estado es global para todo el proceso. La caché vive en `require.cache`.

### `require` es síncrono

Cuando llamas `require("./modulo")`, Node bloquea el hilo mientras lee y evalúa el archivo. Eso está bien en el arranque (leer un archivo desde disco es rápido), pero significa dos cosas:

1. No puedes hacer `await require(...)`: `require` no es asíncrono.
2. Todos los módulos se cargan en **serie**, aunque no los uses.

La alternativa para carga bajo demanda es `import()`, que verás más adelante y funciona en ambos sistemas.

### Resolución de rutas

`require` busca en un orden predecible:

```javascript
// Rutas relativas al archivo actual
require("./modulo")             // mismo directorio
require("../utils/helpers")     // directorio padre

// Rutas de paquete: busca en node_modules hacia arriba
require("express")              // ./node_modules, ../node_modules, ...
```

Para rutas relativas sin extensión, Node prueba en este orden: `./modulo.js`, `./modulo.json`, `./modulo/index.js`, y el campo `"main"` de `./modulo/package.json`.

### Conexión con Python

```python
# matematicas.py
def sumar(a, b):
    return a + b

# app.py
from matematicas import sumar
print(sumar(2, 3))  # 5
```

**Traduce exactamente**: Python y CommonJS son ambos **síncronos** y ambos mantienen una caché de módulos ya ejecutados (`require.cache` en Node, `sys.modules` en Python). En ambos, importar el mismo módulo dos veces devuelve la misma instancia, no una copia.

**Cambia de fondo**: Python está en el estándar del lenguaje — `import` es el único sistema y todos lo usan igual. CommonJS es una convención de Node.js que hoy compite con ESM. Cuando leas código JavaScript, siempre tienes que preguntarte *"¿este archivo es CJS o ESM?"* antes de entender cómo se resuelven sus imports. Y en Python, el equivalente al atajo `exports` no existe: un módulo exporta todo su namespace directamente.

### Conexión con Java

Java siempre tuvo modularidad estructural: los métodos y campos privados de una clase no son visibles fuera de ella, igual que las variables de un módulo CommonJS no lo son fuera de su archivo.

**Traduce exactamente**: un paquete Java (`package com.miempresa.util`) exporta explícitamente lo que sus clases públicas exponen, y quien consume importa con un `import com.miempresa.util.Matematicas;` — el mismo gesto mental de `const Matematicas = require("./matematicas")`.

**Cambia de fondo**: Java no cachea clases del mismo modo: el classloader carga una clase la primera vez que se referencia y puede descargarla según la implementación de la JVM, mientras que el caché de CommonJS es persistente en todo el proceso una vez cargado. Además, en Java el nombre del archivo no tiene por qué coincidir con la clase pública, mientras en Node la ruta **es** la identidad del módulo.

---

## 2. ES Modules: `import` y `export`

### El problema: CommonJS no era un estándar y el tiempo decidió otra cosa

CommonJS fue una solución pragmática, pero los navegadores no tenían nada parecido y eso obligaba a usar bundlers para el frontend. JavaScript terminó necesitando un sistema **oficial** de módulos, resuelto en tiempo de compilación y capaz de optimizar qué código llega al navegador. Ese sistema es ES Modules.

La diferencia de fondo: las importaciones de ESM son **estáticas**. El motor las resuelve antes de ejecutar nada, conoce todo el grafo de dependencias de antemano, y eso permite lo que CommonJS nunca pudo: eliminar código que no se usa (*tree shaking*) y cargar en paralelo.

### Sintaxis básica

```javascript
// matematicas.mjs
export function sumar(a, b) { return a + b }
export function restar(a, b) { return a - b }
export const PI = 3.14159

// Una sola exportación por defecto por módulo:
export default function multiplicar(a, b) { return a * b }

// app.mjs
import { sumar, restar, PI } from "./matematicas.mjs"
import multiplicar from "./matematicas.mjs"   // el default
import * as matematicas from "./matematicas.mjs"  // namespace completo

console.log(sumar(2, 3))        // 5
console.log(multiplicar(2, 3))  // 6
console.log(matematicas.PI)     // 3.14159
```

Puedes exportar declarando al final, y renombrar en el camino:

```javascript
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }

export { sumar, restar }
export { sumar as add, restar as subtract }
```

### Live bindings: el valor que se ve desde afuera NO es una copia

Aquí está la sorpresa más grande para quien viene de otros lenguajes. En CommonJS, al importar obtienes una copia del valor. En ESM, las exportaciones son **enlaces vivos**: el importador ve el valor actualizado del módulo fuente en todo momento.

```javascript
// contador.mjs
export let contador = 0
export function incrementar() { contador++ }

// app.mjs
import { contador, incrementar } from "./contador.mjs"
console.log(contador)  // 0
incrementar()
console.log(contador)  // 1 — ¡el mismo enlace, ya actualizado!

// En CommonJS esto hubiera sido un número copiado: siempre 0.
```

Esto también significa que **no puedes reasignar** desde el importador: `contador = 5` lanza un error, porque estás intentando sobreescribir un binding que pertenece al módulo que lo exporta.

### Re-exportación: la base de los barrel files

Un módulo puede re-exportar lo que viene de otros, creando un punto de entrada único:

```javascript
// utilidades/index.mjs
export { sumar, restar } from "./matematicas.mjs"
export { filtrar, mapear } from "./array-utils.mjs"
export { formatear } from "./string-utils.mjs"

// El consumidor importa todo desde un solo lugar:
import { sumar, filtrar, formatear } from "./utilidades"
```

### ¿Cómo sabe Node qué tratar como ESM?

La extensión manda, salvo que el `package.json` diga otra cosa:

- `.mjs` → siempre ESM.
- `.cjs` → siempre CommonJS.
- `.js` → depende del campo `"type"` del `package.json` más cercano. Si es `"type": "module"`, se trata como ESM.

### Conexión con Java

El sistema de módulos oficial del que seguramente ya sabes: **JPMS** (`module-info.java`).

```java
// module-info.java
module com.miempresa.matematicas {
    exports com.miempresa.matematicas;
}
```

**Traduce exactamente**: ESM y JPMS son ambos sistemas **estáticos**, declarados al inicio del módulo y resueltos antes de ejecutar el código. En los dos, el grafo de dependencias es explícito y verificable de antemano: en Java lo valida el compilador, en JavaScript lo aprovecha el bundler. La declaración `export { sumar } from "./matematicas.mjs"` es conceptualmente el mismo gesto que `exports com.miempresa.matematicas;`.

**Cambia de fondo**: el bundler de JavaScript es **permisivo**: importar algo mal declarado produce una advertencia en build time o un error en runtime, pero rara vez bloquea el build. Java te **niega la compilación** si importas un paquete que no está exportado en el `module-info.java`. Y en Java solo puedes exportar paquetes enteros, mientras en ESM controlas qué funciones y variables exactas de cada archivo salen al exterior.

### Conexión con Python

```python
# contador.py
contador = 0

def incrementar():
    global contador
    contador += 1
```

**Traduce exactamente**: los dos son el sistema de módulos del lenguaje real (a diferencia de CommonJS, que es una convención de Node). Ambos tienen un namespace importable completo (`import * as matematicas` ↔ `import matematicas`).

**Cambia de fondo**: Python no tiene live bindings: `from contador import contador` copia el valor en el momento del import, exactamente igual que CommonJS. Si `incrementar()` cambia `contador` en el módulo, tu copia local no se entera. Para ESM, ese comportamiento es imposible: las importaciones nombradas son siempre enlaces vivos. Además, en Python la importación puede ocurrir en cualquier punto del módulo (es una sentencia ejecutada), mientras en ESM los `import` **se elevan** al inicio aunque los escribas abajo.

---

## 3. Diferencias clave entre CommonJS y ES Modules

### Tabla comparativa

| Característica | CommonJS | ES Modules |
|---|---|---|
| Carga | Síncrona, en serie | Asíncrona, resuelta en paralelo |
| Time de resolución | En ejecución (`require` es una función) | En compilación (`import` es declarativo) |
| Exportación | `module.exports` (objeto moldeable) | `export` (enlaces vivos) |
| Cache | `require.cache`, accesible | Interno, no directamente inspeccionable |
| Live bindings | No (copia del valor) | Sí |
| `this` a nivel de módulo | `module.exports` | `undefined` |
| Tree shaking | No | Sí |
| `await` de nivel superior | No | Sí |
| `__dirname` / `__filename` | Disponibles | No (usa `import.meta.url`) |

### `__dirname` y `__filename` en ESM

CommonJS los tiene de serie. En ES Modules no existen, pero se reconstruyen con dos funciones de la librería estándar:

```javascript
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

`import.meta.url` es la URL del archivo actual en formato `file://`, y `fileURLToPath` la convierte en una ruta normal del sistema de archivos.

### Top-level `await` (solo ESM)

En ESM puedes escribir `await` fuera de cualquier función async:

```javascript
// conf.mjs
const config = await fetch("/api/config").then(r => r.json())
export default config
```

En CommonJS eso es un `SyntaxError`. Tienes que envolverlo manualmente:

```javascript
// conf.js
let config
;(async () => {
  config = await fetch("/api/config").then(r => r.json())
})()
```

En módulos con top-level `await`, los importadores **esperan** a que el módulo termine antes de usar sus exportaciones. Eso hace el arranque más lento si abusas de él: cada `await` de nivel superior pone en pausa a todo el que dependa del módulo.

---

## 4. Importación dinámica: `import()`

### El problema: algunas veces no quieres cargar todo al inicio

Importar estáticamente todo al arranque es simple, pero derrocha: si tu app tiene una función de exportar a PDF que dos usuarios usan al mes, ¿para qué cargar `pdf-lib` (y sus KB de código) siempre? Aquí entra `import()`: una función que devuelve una **promesa** con el módulo, funciona en CJS y ESM, y es la base del *lazy loading* y el *code splitting*.

### Ejemplos

```javascript
// Importación condicional
if (featureFlags.experimental) {
  const { experimentalFeature } = await import("./funciones/experimental.mjs")
  experimentalFeature()
}

// Lazy loading: solo carga cuando se necesita
async function procesarPDF(bytes) {
  const { PDFDocument } = await import("pdf-lib")   // se carga aquí, no antes
  const doc = await PDFDocument.load(bytes)
  return doc
}

// En rutas de un servidor
router.get("/dashboard", async (req, res) => {
  const { renderDashboard } = await import("./vistas/dashboard.mjs")
  res.send(renderDashboard())
})
```

Reglas que conviene tener presentes:

1. **Devuelve una promesa** siempre. Si el módulo ya está cargado, se resuelve igual — pero en la próxima microtarea.
2. **Requiere la ruta completa**: en ESM, la extensión es obligatoria. `import("./modulo.mjs")` funciona; `import("./modulo")` resuelve una promesa que nunca se completa.
3. En el navegador, cada `import()` se convierte en un **punto de división del bundle**: el cargador pide ese archivo bajo demanda.

### Conexión con Python

```python
import importlib

modulo = importlib.import_module("matematicas")
print(modulo.sumar(2, 3))  # 5
```

**Traduce exactamente**: `importlib.import_module` es el mismo gesto de *importar en runtime* bajo demanda que `import()`. Los dos te devuelven un objeto-namespace completo del módulo.

**Cambia de fondo**: en Python, la importación dinámica rara vez pasa de ser una curiosidad porque la librería estándar lo limita bastante y las dependencias pesadas suelen importarse de forma estática. En JavaScript, `import()` es una herramienta de **rendimiento**: del lado del navegador decide qué bytes viajan por la red y cuáles no. Dos pesos muy distintos para la misma mecánica.

### Conexión con Java

```java
Class<?> clase = Class.forName("com.miempresa.analytics.AnalyticsPlugin");
AnalyticsPlugin plugin = (AnalyticsPlugin) clase.getDeclaredConstructor().newInstance();
```

**Traduce exactamente**: `Class.forName` carga una clase en runtime por su nombre, igual que `import()` carga un módulo por su ruta. Ambos rompen el esquema estático a propósito: cargas algo bajo demanda porque no sabías (o no querías) cargarlo antes.

**Cambia de fondo**: en Java obtienes una `Class<?>` y todo el acceso es por reflexión, siempre con el riesgo de errores en runtime disfrazados de infalibilidad en compilación. En JavaScript obtienes el namespace del módulo y usas sus exportaciones con normalidad; la desventaja es que el bundler **no puede** hacer tree shaking dentro de un `import()`: no sabe qué export usarás, así que el archivo llega completo al navegador. Java moderno con ServiceLoader añade descubrimiento de implementaciones; JavaScript no tiene equivalente directo (`import()` siempre apunta a una ruta literal).

---

## 5. Tree shaking y eliminación de código no usado

### El problema: tu bundle crece aunque no uses casi nada

Si cargas una librería de utilidades con 80 funciones, ¿por qué tus usuarios deberían descargar 80 funciones si usas 4? El *tree shaking* responde a eso: el bundler analiza qué exportaciones se usan realmente y **elimina el resto** del archivo final.

### Cómo funciona

```javascript
// utilidades.mjs
export function usarA() { return "A" }
export function usarB() { return "B" }   // no se usa en ningún lado
export function usarC() { return "C" }   // no se usa en ningún lado

// app.mjs
import { usarA } from "./utilidades.mjs"
// El bundle final solo contiene usarA. B y C jamás se empaquetan.
```

Funciona porque ESM es **estático**: el bundler conoce el grafo completo de importaciones antes de ejecutar nada. CommonJS no puede hacer esto porque `require` es dinámico — cualquiera podría hacer `require(rutaVariable)` y el bundler no tiene forma de saber qué se cargó.

### Side effects que rompen el tree shaking

Un *side effect* es código que ejecuta algo al ser importado:

```javascript
// ⚠️ Este módulo hace algo al importarse:
window.customElements.define("mi-widget", MyWidget)
export function algo() { return "algo" }
```

Si importas `{ algo }` de ese módulo, el bundler **no puede** descartar `customElements.define`: no sabe si ejecutarlo es necesario, así que mantiene el módulo completo. La manera de decírselo es declararlo en el `package.json`:

```json
{
  "sideEffects": false
}
```

Con `sideEffects: false` le dices al bundler: *"este paquete solo entrelaza y exporta, puedes eliminar con seguridad lo que no se use."* Si tienes archivos que sí tienen efectos, los listas:

```json
{
  "sideEffects": ["./polyfill.js", "*.css"]
}
```

Ojo: `false` es una **promesa**. Si mentiste — el módulo realmente mutaba algo global — el bundler la eliminará y la página se romperá en producción, que es el bug más difícil de cazar.

### Conexión con Python

**Traduce exactamente**: en ninguno de los dos lenguajes el intérprete elimina código. Python ejecuta cada sentencia de un módulo importado; JavaScript, si no hay bundler de por medio, también.

**Cambia de fondo**: Python **no tiene** ningún mecanismo de tree shaking — es un lenguaje interpretado, no hay fase de empaquetado donde descartar código. JavaScript lo tiene solo gracias al ecosistema de bundlers (Vite, webpack, Rollup) que sí existen: el intérprete no elimina nada, el empaquetador sí. Por eso "código no usado" pesa en la memoria de Python pero pesa en los *bytes que viajan por la red* en JavaScript de frontend.

### Conexión con Java

**Traduce exactamente**: Java también tiene una fase de "empaquetado" donde lo no usado se puede ir: un jar con dependencias innecesarias es inflable y las herramientas de optimización (ProGuard/R8 en Android, `jdeps`/`jlink` en desktop) eliminan clases y campos que nadie referencia.

**Cambia de fondo**: el árbol de dependencias de Java se arma en tiempo de ejecución con el classloader (carga perezosa), así que una clase `UsarB` que nadie referencia nunca se carga de disco: el ahorro es natural. En JavaScript de navegador no hay "cargar bajo demanda" gratis: todo módulo presente en el bundle llega al usuario, incluso si solo se ejecuta bajo ciertas condiciones. Por eso el tree shaking es una preocupación central del ecosistema JS y apenas un detalle en Java.

---

## 6. Barrel files: comodidad vs. bundle

### El problema: importaciones larguísimas que se descontrolan

Sin un punto de entrada único, cada consumidor importa con rutas profundas y frágiles: `import { sumar } from "./utilidades/matematicas/matematicas.mjs"`. El *barrel file* (normalmente `index.mjs`) re-exporta todo lo público desde un solo archivo para que los consumidores importen de una ruta corta.

```javascript
// utilidades/index.mjs
export * from "./matematicas.mjs"
export * from "./strings.mjs"
export * from "./arrays.mjs"

// Consumidor
import { sumar, formatear, filtrar } from "./utilidades"
```

### El precio que esconden

```javascript
// ⚠️ Si solo necesitas una función, pero importas del barrel:
import { sumar } from "./utilidades"
// El bundler puede incluir TODOS los módulos del barrel (matemáticas,
// strings, arrays) incluso si solo quieres sumar().

// ✅ Importar directo del archivo:
import { sumar } from "./utilidades/matematicas.mjs"
// Solo matematicas.mjs entra al bundle.
```

La regla práctica:

- En **librerías públicas** (paquetes que otros consumen), el barrel es la fachada ideal: expone tu API estable y la protege de cambios internos.
- En tu **código de aplicación**, preferir imports directos o barrels pequeños y por dominio, sobre todo si el paquete tiene muchos módulos.

### Conexión con Python

```python
# utilidades/__init__.py
from .matematicas import sumar, restar
from .strings import formatear
```

**Traduce exactamente**: el `__init__.py` de un paquete Python es el barrel file de JavaScript: un punto de entrada que re-exporta lo público de los sub-módulos.

**Cambia de fondo**: en Python el barrel es gratis — no hay fase de bundling que castigue el re-exportar; el código no usado de tus propios paquetes igual viaja en el mismo directorio. En JavaScript, cada exportación de un barrel es una invitación a qué el bundler arrastre un archivo entero. Y en Python, importar de la ruta interna (`from utilidades.matematicas import sumar`) es tan válido como importar del barrel; en JavaScript, si el paquete define `exports`, las rutas internas **pueden quedar bloqueadas** (lo ves en la siguiente sección).

---

## 7. `package.json`: cómo el paquete se presenta al mundo

### El problema: el mismo archivo tenía significados distintos según quién lo usaba

Node.js, los bundlers y TypeScript leen `package.json` para saber cómo consumir tu paquete. Sin una declaración clara, cada uno adivina a su manera. Los campos que controlan todo:

```json
{
  "name": "mi-paquete",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./utilidades": {
      "import": "./dist/utilidades.mjs",
      "require": "./dist/utilidades.cjs"
    }
  },
  "sideEffects": false
}
```

- **`type`**: decide si los `.js` son ESM (`"module"`) o CJS (`"commonjs"`, el valor por defecto).
- **`main`**: el punto de entrada clásico que usó Node durante años. Útil como respaldo para consumidores viejos.
- **`module`**: la entrada pensada para **bundlers** (webpack, Vite). No es parte de la especificación de Node, es una convención del ecosistema; `exports` la ha vuelto secundaria.
- **`exports`**: el mapa moderno y **restrictivo**. Define exactamente qué rutas son públicas.

### `exports` como muro de contención

Sin `exports`, cualquier archivo de tu paquete es importable:

```javascript
import secreto from "mi-paquete/dist/internos/secreto.mjs"   // funciona
```

Con `exports`, solo lo declarado:

```javascript
import algo from "mi-paquete"               // ✅ funciona (".")
import utilidades from "mi-paquete/utilidades"
import secreto from "mi-paquete/internos/secreto.mjs"   // ❌ Error: no exportado
```

Eso es bueno: **el API público es lo que decides exponer**, y el resto deja de ser alcanzable. También permite servir versiones distintas según el consumidor: los que usen `require` reciben el `.cjs`, los que usen `import`, el `.mjs`.

### Conexión con Java

**Traduce exactamente**: el `exports` de JavaScript es la misma idea que `exports` en `module-info.java`: una lista explícita de lo público, con bloqueo de todo lo demás. Ambos son comunicación de *contrato*: "esto es lo que ofrezco, esto queda cerrado".

**Cambia de fondo**: en Java el `exports` es exhaustivo y verificado por el compilador; en JavaScript, `exports` convive con un montón de herramientas que lo interpretan distinto (`main`, `module`, bundlers, Node, TypeScript), así que una librería publicada mal suele toparse con el error "can't find module". Java manda: o la compila o no. JavaScript negocia entre varios lectores del mismo archivo.

### Conexión con Python

**Traduce exactamente**: `exports` y `__all__` son mecanismos equivalentes de *lo que el mundo exterior ve*:

```python
# matematicas/__init__.py
__all__ = ["sumar", "restar"]   # solo esto es público
```

**Cambia de fondo**: `__all__` es una **convención** — afirma qué importar, pero `from matematicas import cualquier_cosa_interna` sigue funcionando. El `exports` de JavaScript es un **bloqueo real**: las rutas no declaradas lanzan error. Esa es la diferencia entre una cultura de *recomendación* (Python) y una de *restricción* (JavaScript moderno).

---

## Práctica y ejercicios

Intenta resolver cada desafío mentalmente o en código **antes** de abrir las soluciones desplegables.

### 1. Preguntas de repaso

<details>
<summary><b>1. Importas un objeto con `require` en tres archivos y mutas una propiedad del objeto en uno de ellos. ¿Los otros dos ven el cambio?</b></summary>

**Explicación**: Sí. `require` cachea el módulo y todas las llamadas devuelven la **misma referencia**. El estado vive en el módulo, no en cada importador. Por eso los módulos CommonJS son un lugar natural para configuración compartida, y por eso mutar singletons "por accidente" es tan fácil.
</details>

<details>
<summary><b>2. Un módulo ESM exporta `let contador = 0`. Otro módulo importa `{ contador }` y ejecuta `contador++`. ¿Qué pasa?</b></summary>

**Explicación**: Lanza `TypeError` (no puedes reasignar una importación). Las importaciones ESM son enlaces de solo lectura hacia el binding del módulo exportador. Para incrementar, el importador debe llamar a una función exportada (`incrementar()`), y al hacerlo sí verá reflejado el cambio porque el enlace es vivo. Es lo contrario a CommonJS, donde escribir la variable funcionaría (pero sería una copia separada).
</details>

<details>
<summary><b>3. ¿Por qué un bundler no puede hacer tree shaking sobre un `import()` dinámico?</b></summary>

**Explicación**: Porque el bundler no sabe en tiempo de compilación qué exportaciones del módulo se van a usar: la ruta y el uso son decididos en runtime. Solo puede saber que **todo** el archivo puede ser necesario, así que lo conserva completo. Los `import` estáticos se pueden analizar de antemano; los dinámicos, no.
</details>

<details>
<summary><b>4. Tienes una base de código en ESM y un script heredado en CJS que necesita importar un módulo ESM. ¿Es posible?</b></summary>

**Explicación**: En Node.js moderno sí, con matices. Un módulo CJS puede cargar ESM con `import()`, que devuelve una promesa (los `require` de módulos ESM no existen en Node estable porque `require` es síncrono y ESM admite top-level `await`). En el sentido inverso, un módulo ESM puede importar un módulo CJS con `import` normal: Node expone su `module.exports` como el *default* del módulo. Hoy `import()` es el puente confiable en ambas direcciones.
</details>

---

### 2. Explicarlo con tus palabras

> **Reto**: Explica a una persona que acaba de mudarse de Python qué significa eso de "las importaciones de ESM son enlaces vivos y estáticas", usando la metáfora de una **hoja de cálculo compartida** (la celda `C5` a la que todos miran) en lugar de copiar el valor.  
> *Pista: si dudas, relee la [Sección 2](#2-es-modules-import-y-export).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): Misma calculadora, dos mundos

**Objetivo**: escribir el mismo módulo de calculadora en CommonJS y en ES Modules, y consumirlo en ambos estilos.

**Enunciado**:
1. Crea `calculadora.js` (CommonJS) que exporte `sumar`, `restar`, `multiplicar` y un `dividir` que valide la división entre cero lanzando un `Error` con mensaje claro.
2. Crea `app.js` (CommonJS) que lo importe y muestre `sumar(5, 3)` y `dividir(10, 2)`.
3. Repite el módulo como `calculadora.mjs` (ESM) y consúmelo desde `app.mjs`.
4. Verifica que, con `"type": "commonjs"` (el valor por defecto), tu `app.js` funcione igual que `.mjs`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. CommonJS exporta con `module.exports = { ... }` e importa con `require("./calculadora")`.
2. ESM exporta con `export function` e importa con `import { ... } from "./calculadora.mjs"` — sin olvidar la extensión `.mjs`.
3. La validación del divisor cero vive dentro de `dividir`, idéntica en ambos mundos.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
// calculadora.js (CommonJS)
function sumar(a, b) { return a + b }
function restar(a, b) { return a - b }
function multiplicar(a, b) { return a * b }
function dividir(a, b) {
  if (b === 0) {
    throw new Error("No se puede dividir por cero")
  }
  return a / b
}

module.exports = { sumar, restar, multiplicar, dividir }
```

```javascript
// app.js (CommonJS) — extensiones implícitas, caché y todo eso ya funciona
const calculadora = require("./calculadora")

console.log(calculadora.sumar(5, 3))     // 8
console.log(calculadora.dividir(10, 2))  // 5
```

```javascript
// calculadora.mjs (ESM)
export function sumar(a, b) { return a + b }
export function restar(a, b) { return a - b }
export function multiplicar(a, b) { return a * b }
export function dividir(a, b) {
  if (b === 0) {
    throw new Error("No se puede dividir por cero")
  }
  return a / b
}
```

```javascript
// app.mjs (ESM) — observa la extensión obligatoria
import { sumar, dividir } from "./calculadora.mjs"

console.log(sumar(5, 3))     // 8
console.log(dividir(10, 2))  // 5
```

**¿Por qué funciona?** En CommonJS la extensión es opcional, en ESM es obligatoria — el error `ERR_MODULE_NOT_FOUND` por omitirla es el más común al migrar. La validación de `dividir` vive en la única zona del módulo que la conoce; ambos sistemas respetan ese encapsulamiento.
</details>

---

#### Ejercicio 2 (Intermedio): Sistema de logging por módulos

**Objetivo**: construir un pequeño sistema de logging en ESM donde cada responsabilidad (formato, destino, orquestación) viva en su propio módulo y se consuma a través de un barrel.

**Requisitos**:
1. `formateadores.mjs`: exporta `formatoConsola` (texto legible con timestamp) y `formatoJSON` (objeto serializado).
2. `destinos.mjs`: exporta `destinoConsola` (`console.log`) y `crearDestinoArchivo(ruta)` que escribe en un archivo con `fs.appendFileSync`.
3. `logger.mjs`: exporta `crearLogger({ formato, destinos })` con métodos `info`, `warn` y `error`.
4. `index.mjs`: barrel que re-exporta `crearLogger`, los formateadores y los destinos.
5. Desde `app.mjs`, crea un logger que escriba en consola con formato legible y otro que escriba en archivo con formato JSON.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Cada responsabilidad en su archivo: formatos, destinos y orquestación por separado.
2. `crearLogger({ formato, destinos })` itera los destinos y aplica el formato antes de `destino.escribir(...)`.
3. El barrel `index.mjs` re-exporta con `export { ... } from "./..."` para una única fachada pública.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
// formateadores.mjs
export const formatoConsola = (nivel, mensaje) =>
  `[${new Date().toISOString()}] ${nivel.toUpperCase()}: ${mensaje}`

export const formatoJSON = (nivel, mensaje) =>
  JSON.stringify({ timestamp: Date.now(), nivel, mensaje })
```

```javascript
// destinos.mjs
import fs from "node:fs"

export const destinoConsola = {
  escribir(formateado) {
    console.log(formateado)
  },
}

export const crearDestinoArchivo = (ruta) => ({
  escribir(formateado) {
    fs.appendFileSync(ruta, formateado + "\n")
  },
})
```

```javascript
// logger.mjs
import { formatoConsola } from "./formateadores.mjs"
import { destinoConsola } from "./destinos.mjs"

export function crearLogger(configuracion = {}) {
  const { formato = formatoConsola, destinos = [destinoConsola] } = configuracion

  const escribir = (nivel, mensaje) => {
    const formateado = formato(nivel, mensaje)
    destinos.forEach((destino) => destino.escribir(formateado))
  }

  return {
    info: (mensaje) => escribir("info", mensaje),
    warn: (mensaje) => escribir("warn", mensaje),
    error: (mensaje) => escribir("error", mensaje),
  }
}
```

```javascript
// index.mjs (barrel)
export { crearLogger } from "./logger.mjs"
export { formatoConsola, formatoJSON } from "./formateadores.mjs"
export { destinoConsola, crearDestinoArchivo } from "./destinos.mjs"
```

```javascript
// app.mjs
import { crearLogger, formatoJSON, crearDestinoArchivo } from "./index.mjs"

const consola = crearLogger()
consola.info("Arranque del sistema")

const aArchivo = crearLogger({
  formato: formatoJSON,
  destinos: [crearDestinoArchivo("./eventos.log")],
})
aArchivo.error("Fallo al contactar el servicio")
```

**¿Por qué funciona?** cada módulo declara solo su pedazo del contrato y el barrel es la fachada pública. El patrón *Strategy* aparece naturalmente: `formato` y `destinos` son funciones/objetos intercambiables que el logger combina sin saber sus detalles — exactamente el tipo de composición que los módulos están diseñados para permitir.
</details>

---

#### Ejercicio 3 (Avanzado): Cargador de plugins con `import()` y control de errores

**Objetivo**: diseñar un sistema que cargue y descargue plugins bajo demanda, con importación dinámica, validación de la interfaz del plugin y manejo de fallos.

**Especificaciones**:
1. `cargarPlugin(ruta)`: usa `import()` dinámico; espera que el módulo exporte por defecto una clase. Valida con carga perezosa que el plugin tenga `nombre`, `version` e `inicializar()`.
2. Los plugins cargados se guardan en un `Map`, con su `inicializar()` ejecutado una sola vez.
3. `descargarPlugin(nombre)`: llama a `destruir()` si existe (para limpiar event listeners, timers) y lo quita del `Map`.
4. `listarPlugins()`: devuelve un arreglo `{ nombre, version }`.
5. Errores controlados: una ruta inválida o una interfaz incorrecta deben fallar con mensajes claros, sin estallar la aplicación.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Carga con `const modulo = await import(ruta)`; el export default es `modulo.default`.
2. Valida `nombre`, `version` e `inicializar()` antes de registrar; guarda la instancia en un `Map`.
3. `descargarPlugin` llama a `destruir()` (si existe) antes de `Map.delete`, y `listarPlugins` lee el `Map`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class SistemaPlugins {
  constructor() {
    this.plugins = new Map()
  }

  async cargarPlugin(ruta) {
    const modulo = await import(ruta)

    const ClasePlugin = modulo.default ?? modulo.Plugin
    if (typeof ClasePlugin !== "function") {
      throw new Error(`El módulo ${ruta} no exporta un plugin válido`)
    }

    const instancia = new ClasePlugin()

    for (const requerido of ["nombre", "version"]) {
      if (!instancia[requerido]) {
        throw new Error(`Plugin en ${ruta} no tiene propiedad "${requerido}"`)
      }
    }
    if (typeof instancia.inicializar !== "function") {
      throw new Error(`Plugin en ${ruta} no tiene método inicializar()`)
    }

    if (this.plugins.has(instancia.nombre)) {
      await this.descargarPlugin(instancia.nombre)
    }

    await instancia.inicializar()
    this.plugins.set(instancia.nombre, instancia)
    console.log(`Plugin ${instancia.nombre} v${instancia.version} cargado`)
    return instancia
  }

  async descargarPlugin(nombre) {
    const plugin = this.plugins.get(nombre)
    if (!plugin) {
      throw new Error(`Plugin ${nombre} no está cargado`)
    }
    if (typeof plugin.destruir === "function") {
      await plugin.destruir()
    }
    this.plugins.delete(nombre)
    console.log(`Plugin ${nombre} descargado`)
  }

  listarPlugins() {
    return [...this.plugins.values()].map((p) => ({
      nombre: p.nombre,
      version: p.version,
    }))
  }
}

// plugins/analytics.mjs
export default class PluginAnalytics {
  constructor() {
    this.nombre = "analytics"
    this.version = "1.0.0"
  }
  async inicializar() {
    this.intervalo = setInterval(() => console.log("latido analytics"), 10000)
  }
  async destruir() {
    clearInterval(this.intervalo)
  }
}

// app.js
const sistema = new SistemaPlugins()

try {
  await sistema.cargarPlugin("./plugins/analytics.mjs")
  console.log(sistema.listarPlugins())
  await sistema.descargarPlugin("analytics")
} catch (error) {
  console.error(`Fallo al gestionar plugin: ${error.message}`)
}
```

**¿Por qué funciona?** `import()` devuelve una promesa, `await` la usa. La validación antes de registrar evita plugins pagados que "parecen" correctos pero fallan en silencio, y `descargarPlugin` sigue el ciclo de vida al revés: primero limpia (timers, listeners), luego olvida. El `Map` como almacén da `get`/`delete`/`has` O(1) y claves con nombres únicos por plugin. Para cancelar cargas lentas con `AbortController` (`import(ruta, { signal })`) es el siguiente paso si los plugins se vuelven remotos.
</details>

---

## Depuración en la práctica

### Escenario 1: El bug fantasma de la dependencia circular

**Situación**: En producción, `a.js` importa `b.js` y `b.js` importa `a.js`. El sistema funciona en tu máquina… hasta que cambiaste el orden de dos `require` al refactorizar. Ahora, de forma intermitente, una función devuelve `undefined` en `a.js` cuando en `b.js` se evalúa algo "demasiado pronto".

**Preguntas de análisis**:
1. ¿Qué garantiza la resolución estática de ESM sobre un pair circular, y por qué CommonJS es el que falla aquí?
2. ¿Qué dos estrategias de diseño eliminan la dependencia circular de raíz?

**Diagnóstico arquitectónico**:
- **Causa**: `require` es síncrono y sin "elevación": al cargar `a.js`, Node necesita `b.js`, entonces carga `b.js`, que necesita a `a.js` — pero `a.js` no ha terminado de ejecutarse y sus exportaciones todavía están incompletas. `b.js` recibe `{}` parcial y cualquier desestructuración (`const { x } = require("./a.js")`) le da `undefined`.
- **Solución real**: dividir el estado compartido en un tercer módulo (`shared.mjs`) que ambos importan, o inyectar las funciones (dependencia inversa) en lugar de importarlas: cada módulo recibe `setA(fn)`/`setB(fn)` de un módulo neutro, y la resolución se aplaza hasta después del arranque. Si la circularidad solo existe para *tipos*, `import type` en TypeScript ya la rompe, porque se borra en compilación.

---

### Escenario 2: El árbol que no se sacude

**Situación**: Pasaste el proyecto a ESM y "activaste" tree shaking configurando el bundler. El bundle sigue pesando 900 KB y una funcioób que quitaron de `imports` hace meses sigue apareciendo en el archivo final.

**Preguntas de análisis**:
1. ¿Qué tres causas revisarías primero, en orden de frecuencia?
2. ¿Qué herramienta te ayuda a ver qué se está incluyendo?

**Diagnóstico**:
- **Causa probable 1 — side effects**: algún módulo ejecuta algo al ser importado (un `define`, un `polyfill`, una suscripción global), y el bundler lo conserva completo. Revisa qué haces al nivel superior de tus módulos y declara `sideEffects` con honestidad en el `package.json`.
- **Causa probable 2 — barrel abuse**: si todos los consumidores importan del `index`, el bundler arrastra todos los re-exportados. Importa directo de los submódulos donde el tamaño importa.
- **Causa probable 3 — dependencia mal empaquetada**: algún paquete de `node_modules` se distribuye en CommonJS, y el tree shaking sobre CJS no existe. Usa `bundle-analysis` (Vite o `webpack-bundle-analyzer`) para ver quién pesa: el paquete culpable suele esperarte ahí con el 60% del total.
- **Herramienta**: `pnpm vite build --debug` o análisis visual de un bundle: la gráfica muestra módulos con colores por tamaño y de inmediato saltan las librerías enteras coladas.

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Característica | JavaScript | Python |
|---|---|---|
| **Sistema de módulos** | Dos: CommonJS (Node, síncrono) y ESM (estándar, estático). | Uno: `import` (síncrono, estándar). |
| **Live bindings** | ESM sí, CJS no (copia). | No: copia del valor al importar. |
| **Importación dinámica** | `import()` (promesa, clave de rendimiento). | `importlib.import_module` (rara vez usada). |
| **Tree shaking** | Sí, en bundlers (ESM). | No existe. |
| **Punto de entrada público** | `exports` en `package.json` (bloqueo real). | `__all__` (convención, no bloquea). |
| **Caché de módulos** | `require.cache`, mutable y accesible (útil para invalidar). | `sys.modules`. |

### JavaScript vs. Java

| Característica | JavaScript | Java |
|---|---|---|
| **Modularidad estructural** | Archivo-módulo (CJS y ESM). | Clase-archivo + paquetes + módulos JPMS. |
| **Resolución de imports** | Estática (ESM) o runtime (CJS), sin verificación completa en build. | Estática, verificada por el compilador. |
| **Carga bajo demanda** | `import()` — punto de corte del bundle. | `Class.forName` / ServiceLoader (reflexión). |
| **Exportaciones públicas** | `exports` en `package.json` (mapa de rutas). | `exports` en `module-info.java` (paquetes). |
| **Optimización de tamaño** | Tree shaking en bundlers (frontend crítico). | Carga perezosa del classloader, R8/jlink. |
| **Tipos** | No importa para módulos (todo archivo). | Necesarios: el sistema de paquetes se estructura con ellos. |

---

## Resumen del capítulo

1. **CommonJS es síncrono y cachea**: `require` devuelve siempre el mismo objeto; el estado module-level es global a todo el proceso.
2. **ESM es estático y con live bindings**: los `import` se resuelven en compilación y las exportaciones son enlaces vivos de solo lectura para el importador.
3. **La extensión manda**: `.mjs` es ESM, `.cjs` es CommonJS, `.js` depende del `"type"` del `package.json`.
4. **`import()` es el puente para todo**: funciona en ambos sistemas, habilita lazy loading y crea puntos de corte en el navegador.
5. **El tree shaking solo existe sobre ESM**: los side effects lo silencian; declara `sideEffects` con honestidad o el bundle miente.
6. **Los barrel files son una compensación**: comodidad de importación vs. riesgo de arrastrar módulos enteros; usa fachadas con cabeza y imports directos con cintura.
7. **`exports` en `package.json` es tu muro de contención**: el API público es lo que declaras, y los consumidores viejos siguen sirviendo con `main`/`module`.

---

## Siguiente Capítulo

→ **[Capítulo 5: Estructuras de datos avanzadas e iteración](./cap-05)**: Ya sabes organizar el código; ahora verás cómo JavaScript te da herramientas más potentes que los arrays simples — `Map`, `Set`, `WeakMap`, iteradores y generadores — y cuándo cada una gana frente a las otras.