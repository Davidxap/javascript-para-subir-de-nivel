---
title: "Chapter 4: Modules and Code Organization"
---

# Chapter 4: Modules and Code Organization

> Working with modules is what separates a script from an application someone else can maintain.

## Introduction

In a small script, you can live with a single file. But the day comes when the file is 800 lines long, two functions are both called `processData`, and you no longer know what imports what. That's when modules stop being a detail and become the backbone of the project.

JavaScript has two coexisting systems: **CommonJS** (CJS, the original Node.js system, the one with `require`) and **ES Modules** (ESM, the language standard, the one with `import`/`export`). For years they lived apart; today they share one ecosystem, and knowing your way around both is what you most notice when reading someone else's code. In this chapter you'll see what each does under the hood, where they break, and how to organize a project so bundlers can do their magic without it costing you.

---

## 1. CommonJS: `require` and `module.exports`

### The problem: everything shared the same global scope

Before modules existed, every script loaded into a page or a process hung its variables on a global scope. If two libraries both defined `counter`, the second one erased the first. Node.js solved this in 2009 with CommonJS: **each file is a module with its own scope**, and only what you export explicitly becomes accessible from outside.

```javascript
// math.js
function add(a, b) { return a + b }
function subtract(a, b) { return a - b }

// Anything not exported stays locked inside this file.
module.exports = { add, subtract }

// app.js
const { add, subtract } = require("./math")
console.log(add(2, 3))   // 5

// You can also import the whole object:
const math = require("./math")
console.log(math.add(2, 3))   // 5
```

### The `exports` vs `module.exports` trap

There's a shortcut called `exports`, but it's an **alias** of `module.exports`. As long as you add properties it works; if you reassign the alias, you lose the reference:

```javascript
// ❌ This exports nothing:
exports = { add, subtract }

// ✅ This does:
module.exports = { add, subtract }

// ✅ And so does this (you add properties to the same object):
exports.add = add
```

The rule: treat `exports` as a read-only alias. If you need to replace the whole exported object, use `module.exports`.

### The module cache

`require` runs a module once and stores the result. Every later call returns the **same object**:

```javascript
// config.js
let counter = 0
module.exports = {
  increment() { return ++counter },
  get() { return counter },
}

// a.js
const config = require("./config")
config.increment()           // counter = 1

// b.js
const config = require("./config")
console.log(config.get())    // 1 — it's the SAME object, not a copy
```

That's very useful for shared state (configuration, DB connections) and is why you can import the same module from ten files without it executing ten times. But it's also how *accidental singletons* happen: if the module keeps state in a `let`, that state is global to the whole process. The cache lives in `require.cache`.

### `require` is synchronous

When you call `require("./module")`, Node blocks the thread while it reads and evaluates the file. That's fine at startup (reading one file from disk is fast), but it means two things:

1. You can't `await require(...)`: `require` isn't async.
2. All modules load **in series**, even the ones you never use.

The alternative for on-demand loading is `import()`, which you'll see later and works in both systems.

### Path resolution

`require` looks up modules in a predictable order:

```javascript
// Paths relative to the current file
require("./module")             // same directory
require("../utils/helpers")     // parent directory

// Package paths: walks up looking for node_modules
require("express")              // ./node_modules, ../node_modules, ...
```

For extension-less relative paths, Node tries, in order: `./module.js`, `./module.json`, `./module/index.js`, and the `"main"` field of `./module/package.json`.

### Connection with Python

```python
# math.py
def add(a, b):
    return a + b

# app.py
from math import add
print(add(2, 3))  # 5
```

**Exact translation**: Python and CommonJS are both **synchronous**, and both keep a cache of already-executed modules (`require.cache` in Node, `sys.modules` in Python). In both, importing the same module twice returns the same instance, not a copy.

**Underlying change**: Python is part of the language standard — `import` is the only system and everyone uses it the same way. CommonJS is a Node.js convention that today competes with ESM. When reading JavaScript, you always have to ask *"is this file CJS or ESM?"* before you can understand how its imports resolve. And in Python there's no equivalent to the `exports` shortcut: a module exports its whole namespace directly.

### Connection with Java

Java has always had structural modularity: a class's private methods and fields aren't visible outside it, just as a CommonJS module's variables aren't visible outside their file.

**Exact translation**: a Java package (`package com.mycompany.util`) exports explicitly what its public classes expose, and whoever consumes it imports via `import com.mycompany.util.Math;` — the same mental move as `const math = require("./math")`.

**Underlying change**: Java doesn't cache classes the same way: the classloader loads a class the first time it's referenced and can unload it depending on the JVM, whereas the CommonJS cache is persistent across the process once loaded. Also, in Java the file name doesn't have to match the public class, while in Node the path **is** the module's identity.

---

## 2. ES Modules: `import` and `export`

### The problem: CommonJS wasn't a standard, and time demanded another approach

CommonJS was a pragmatic solution, but browsers had nothing like it, which forced bundlers on the frontend. JavaScript ended up needing an **official** module system, resolved at compile time and able to optimize what code reaches the browser. That system is ES Modules.

The fundamental difference: ESM imports are **static**. The engine resolves them before running anything, knows the whole dependency graph up front, and that's what enables what CommonJS never could: eliminating unused code (*tree shaking*) and loading in parallel.

### Basic syntax

```javascript
// math.mjs
export function add(a, b) { return a + b }
export function subtract(a, b) { return a - b }
export const PI = 3.14159

// One default export per module:
export default function multiply(a, b) { return a * b }

// app.mjs
import { add, subtract, PI } from "./math.mjs"
import multiply from "./math.mjs"   // the default
import * as math from "./math.mjs"  // the whole namespace

console.log(add(2, 3))        // 5
console.log(multiply(2, 3))  // 6
console.log(math.PI)         // 3.14159
```

You can export at the end of the file, and rename on the way:

```javascript
function add(a, b) { return a + b }
function subtract(a, b) { return a - b }

export { add, subtract }
export { add as sum, subtract as difference }
```

### Live bindings: the value seen from outside is NOT a copy

Here's the biggest surprise for anyone coming from other languages. With CommonJS, importing gives you a copy of the value. With ESM, exports are **live bindings**: the importer always sees the module's current value.

```javascript
// counter.mjs
export let counter = 0
export function increment() { counter++ }

// app.mjs
import { counter, increment } from "./counter.mjs"
console.log(counter)  // 0
increment()
console.log(counter)  // 1 — the same live binding, already updated!

// In CommonJS this would have been a copied number: always 0.
```

This also means you **can't reassign** from the importing side: `counter = 5` throws, because you'd be overwriting a binding that belongs to the exporting module.

### Re-exporting: the foundation of barrel files

A module can re-export what comes from others, creating a single entry point:

```javascript
// utils/index.mjs
export { add, subtract } from "./math.mjs"
export { filter, map } from "./array-utils.mjs"
export { format } from "./string-utils.mjs"

// Consumers import everything from one place:
import { add, filter, format } from "./utils"
```

### How does Node know what counts as ESM?

The extension rules, unless `package.json` says otherwise:

- `.mjs` → always ESM.
- `.cjs` → always CommonJS.
- `.js` → depends on the nearest `package.json` `"type"` field. If it's `"type": "module"`, the file is treated as ESM.

### Connection with Java

The official Java module system you may already know: **JPMS** (`module-info.java`).

```java
// module-info.java
module com.mycompany.math {
    exports com.mycompany.math;
}
```

**Exact translation**: ESM and JPMS are both **static** systems, declared at the top of the module and resolved before the code runs. In both, the dependency graph is explicit and verifiable up front: Java checks it at compile time, JavaScript exploits it at bundle time. The declaration `export { add } from "./math.mjs"` is conceptually the same move as `exports com.mycompany.math;`.

**Underlying change**: JavaScript's bundler is **permissive**: importing something badly declared produces a build warning or a runtime error, but rarely blocks the build. Java **refuses to compile** if you import a package that isn't exported in `module-info.java`. And Java can only export whole packages, while ESM lets you pick exactly which functions and variables of each file go out.

### Connection with Python

```python
# counter.py
counter = 0

def increment():
    global counter
    counter += 1
```

**Exact translation**: both are the language's real module system (unlike CommonJS, which is a Node convention). Both have a fully importable namespace (`import * as math` ↔ `import math`).

**Underlying change**: Python has no live bindings: `from counter import counter` copies the value at import time, exactly like CommonJS. If `increment()` changes `counter` inside the module, your local copy doesn't see it. In ESM that behavior is impossible: named imports are always live bindings. Also, in Python an import can appear anywhere in the module (it's an executed statement), while in ESM the `import` statements **hoist** to the top even if you write them lower down.

---

## 3. Key differences between CommonJS and ES Modules

### Comparison table

| Feature | CommonJS | ES Modules |
|---|---|---|
| Loading | Synchronous, in series | Asynchronous, resolved in parallel |
| Resolve time | At runtime (`require` is a function) | At compile time (`import` is declarative) |
| Exporting | `module.exports` (mutable object) | `export` (live bindings) |
| Cache | `require.cache`, accessible | Internal, not directly inspectable |
| Live bindings | No (value copy) | Yes |
| Top-level `this` | `module.exports` | `undefined` |
| Tree shaking | No | Yes |
| Top-level `await` | No | Yes |
| `__dirname` / `__filename` | Available | Not available (use `import.meta.url`) |

### `__dirname` and `__filename` in ESM

CommonJS has them built in. ES Modules don't, but you can rebuild them with two standard-library functions:

```javascript
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

`import.meta.url` is the current file's URL in `file://` form, and `fileURLToPath` turns it into a regular filesystem path.

### Top-level `await` (ESM only)

In ESM you can write `await` outside any async function:

```javascript
// config.mjs
const config = await fetch("/api/config").then(r => r.json())
export default config
```

In CommonJS that's a `SyntaxError`. You have to wrap it by hand:

```javascript
// config.js
let config
;(async () => {
  config = await fetch("/api/config").then(r => r.json())
})()
```

In modules with top-level `await`, importers **wait** for the module to finish before using its exports. That slows startup if you overuse it: every top-level `await` pauses everyone who depends on the module.

---

## 4. Dynamic import: `import()`

### The problem: sometimes you don't want to load everything at startup

Static imports of everything at boot are simple, but wasteful: if your app has an "export to PDF" feature that two users a month actually use, why always ship the PDF library (and its KB of code)? Here comes `import()`: a function that returns a **promise** resolving to the module, works in CJS and ESM, and is the basis of *lazy loading* and *code splitting*.

### Examples

```javascript
// Conditional import
if (featureFlags.experimental) {
  const { experimentalFeature } = await import("./features/experimental.mjs")
  experimentalFeature()
}

// Lazy loading: only loads when needed
async function processPDF(bytes) {
  const { PDFDocument } = await import("pdf-lib")   // loads here, not before
  const doc = await PDFDocument.load(bytes)
  return doc
}

// Inside a server route
router.get("/dashboard", async (req, res) => {
  const { renderDashboard } = await import("./views/dashboard.mjs")
  res.send(renderDashboard())
})
```

Rules worth keeping in mind:

1. **It always returns a promise.** Even if the module is already loaded, the promise resolves — but on the next microtask.
2. **It needs the full path**: in ESM, the extension is mandatory. `import("./module.mjs")` works; `import("./module")` returns a promise that never settles.
3. In the browser, each `import()` becomes a **split point** in the bundle: the loader requests that file on demand.

### Connection with Python

```python
import importlib

module = importlib.import_module("math")
print(module.add(2, 3))  # 5
```

**Exact translation**: `importlib.import_module` is the same move as *importing at runtime* on demand, just like `import()`. Both hand you a full module-namespace object.

**Underlying change**: in Python, dynamic import is rarely more than a curiosity because the standard library keeps it limited and heavy dependencies are usually imported statically. In JavaScript, `import()` is a **performance** tool: on the browser side it decides which bytes go over the network and which don't. Two very different weights for the same mechanism.

### Connection with Java

```java
Class<?> clazz = Class.forName("com.mycompany.analytics.AnalyticsPlugin");
AnalyticsPlugin plugin = (AnalyticsPlugin) clazz.getDeclaredConstructor().newInstance();
```

**Exact translation**: `Class.forName` loads a class at runtime by name, just like `import()` loads a module by path. Both deliberately break the static scheme: you load on demand because you didn't know (or didn't want) to load it before.

**Underlying change**: in Java you get a `Class<?>` and all access goes through reflection, always with the risk of runtime errors hidden behind a compile-time smile. In JavaScript you get the module's namespace and use its exports normally; the trade-off is that bundlers **can't** tree-shake inside an `import()`: they don't know which export you'll use, so the whole file reaches the browser. Modern Java with ServiceLoader adds implementation discovery, which JavaScript has no direct equivalent of (`import()` always targets a literal path).

---

## 5. Tree shaking and unused-code elimination

### The problem: your bundle grows even though you barely use anything

If you load a utility library with 80 functions, why should your users download 80 functions when you use 4? *Tree shaking* answers that: the bundler analyses which exports are actually used and **removes the rest** from the final file.

### How it works

```javascript
// utils.mjs
export function useA() { return "A" }
export function useB() { return "B" }   // never used anywhere
export function useC() { return "C" }   // never used anywhere

// app.mjs
import { useA } from "./utils.mjs"
// The final bundle only contains useA. B and C are never packaged.
```

It works because ESM is **static**: the bundler knows the full import graph before executing anything. CommonJS can't do this because `require` is dynamic — anyone could do `require(variablePath)`, and the bundler has no way to know what got loaded.

### Side effects that break tree shaking

A *side effect* is code that does something when imported:

```javascript
// ⚠️ This module does something on import:
window.customElements.define("my-widget", MyWidget)
export function something() { return "something" }
```

If you import `{ something }` from that module, the bundler **can't** drop `customElements.define`: it doesn't know whether running it is necessary, so it keeps the whole module. The way to tell it is to declare it in `package.json`:

```json
{
  "sideEffects": false
}
```

With `sideEffects: false` you tell the bundler: *"this package only links and exports; you may safely drop anything unused."* If you do have files with effects, you list them:

```json
{
  "sideEffects": ["./polyfill.js", "*.css"]
}
```

Careful: `false` is a **promise**. If you lied — the module really mutated something global — the bundler will drop it and the page will break in production, which is the hardest bug to hunt.

### Connection with Python

**Exact translation**: in neither language does the interpreter eliminate code. Python executes every statement of an imported module; JavaScript, without a bundler in the loop, does too.

**Underlying change**: Python has **no** tree-shaking mechanism at all — it's an interpreted language, with no packaging phase where code can be discarded. JavaScript only has it thanks to the bundler ecosystem (Vite, webpack, Rollup): the engine eliminates nothing, the packager does. That's why "unused code" weighs on memory in Python but weighs in *bytes sent over the network* in frontend JavaScript.

### Connection with Java

**Exact translation**: Java also has a "packaging" phase where unused code can go: a jar with unnecessary dependencies is bloated, and optimizer tools (ProGuard/R8 on Android, `jdeps`/`jlink` on desktop) drop classes and fields nobody references.

**Underlying change**: Java's dependency graph is assembled at runtime by the classloader (lazy loading), so a class like `UseB` that nothing references is never loaded from disk: the saving is natural. In browser JavaScript there's no free "load on demand": every module present in the bundle reaches the user, even if it only runs under certain conditions. That's why tree shaking is a central concern of the JS ecosystem and barely a footnote in Java.

---

## 6. Barrel files: convenience vs. bundle

### The problem: import lines that never stop growing

Without a single entry point, every consumer imports with deep, fragile paths: `import { add } from "./utils/math/math.mjs"`. The *barrel file* (usually `index.mjs`) re-exports everything public from one file so consumers import a short path.

```javascript
// utils/index.mjs
export * from "./math.mjs"
export * from "./strings.mjs"
export * from "./arrays.mjs"

// Consumer
import { add, format, filter } from "./utils"
```

### The price they hide

```javascript
// ⚠️ If you only need one function, but you import from the barrel:
import { add } from "./utils"
// The bundler may include ALL the barrel's modules (math, strings,
// arrays) even though you only wanted add().

// ✅ Import direct from the file:
import { add } from "./utils/math.mjs"
// Only math.mjs enters the bundle.
```

The practical rule:

- In **public libraries** (packages others consume), the barrel is the ideal facade: it exposes your stable API and shields it from internal changes.
- In your **application code**, prefer direct imports or small, domain-sized barrels, especially when the package has many modules.

### Connection with Python

```python
# utils/__init__.py
from .math import add, subtract
from .strings import format
```

**Exact translation**: a Python package's `__init__.py` is JavaScript's barrel file: a single entry point that re-exports the public parts of its sub-modules.

**Underlying change**: in Python, barrels are free — there's no bundling phase to punish re-exports; the unused code of your own packages travels in the same directory anyway. In JavaScript, every barrel export is an invitation for the bundler to drag in a whole file. And in Python, importing from the internal path (`from utils.math import add`) is just as valid as importing from the barrel; in JavaScript, if the package defines `exports`, the internal paths **can be blocked** (you'll see that in the next section).

---

## 7. `package.json`: how the package presents itself to the world

### The problem: the same file meant different things depending on who read it

Node.js, bundlers, and TypeScript all read `package.json` to know how to consume your package. Without a clear declaration, each one guesses in its own way. The fields that control everything:

```json
{
  "name": "my-package",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils.mjs",
      "require": "./dist/utils.cjs"
    }
  },
  "sideEffects": false
}
```

- **`type`**: decides whether `.js` files are ESM (`"module"`) or CJS (`"commonjs"`, the default).
- **`main`**: the classic entry point Node used for years. Useful as a fallback for older consumers.
- **`module`**: the entry point meant for **bundlers** (webpack, Vite). It's not part of the Node specification, it's an ecosystem convention; `exports` has made it secondary.
- **`exports`**: the modern, **restrictive** map. It defines exactly which paths are public.

### `exports` as a containment wall

Without `exports`, any file of your package is importable:

```javascript
import secret from "my-package/dist/internals/secret.mjs"   // works
```

With `exports`, only what you declared:

```javascript
import something from "my-package"                            // ✅ works (".")
import utils from "my-package/utils"
import secret from "my-package/dist/internals/secret.mjs"   // ❌ Error: not exported
```

That's a good thing: **the public API is what you decide to expose**, and the rest becomes unreachable. It also lets you serve different versions per consumer: those using `require` get the `.cjs`, those using `import` get the `.mjs`.

### Connection with Java

**Exact translation**: JavaScript's `exports` is the same idea as `exports` in `module-info.java`: an explicit list of what's public, with everything else blocked. Both are *contract* communication: "this is what I offer, this stays closed."

**Underlying change**: in Java, `exports` is exhaustive and verified by the compiler; in JavaScript, `exports` coexists with a pile of tools that interpret it differently (`main`, `module`, bundlers, Node, TypeScript), so a badly published library usually runs into a `ERR_PACKAGE_PATH_NOT_EXPORTED` wall. Java dictates: either it compiles or it doesn't. JavaScript negotiates between several readers of the same file.

### Connection with Python

**Exact translation**: `exports` and `__all__` are equivalent mechanisms for *what the outside world sees*:

```python
# math/__init__.py
__all__ = ["add", "subtract"]   # only this is public
```

**Underlying change**: `__all__` is a **convention** — it states what to import, but `from math import whatever_internal_name` still works. JavaScript's `exports` is a real **blockade**: undeclared paths throw errors. That's the difference between a culture of *recommendation* (Python) and one of *restriction* (modern JavaScript).

---

## Practice and exercises

Try to solve each challenge mentally or in code **before** opening the collapsible solutions.

### 1. Review questions

<details>
<summary><b>1. You import an object with `require` in three files and mutate a property of that object in one of them. Do the other two see the change?</b></summary>

**Explanation**: Yes. `require` caches the module and every call returns the **same reference**. The state lives in the module, not in each importer. That's why CommonJS modules are a natural home for shared configuration, and why mutating singletons "by accident" is so easy.
</details>

<details>
<summary><b>2. An ESM module exports `let counter = 0`. Another module imports `{ counter }` and runs `counter++`. What happens?</b></summary>

**Explanation**: It throws a `TypeError` (you can't reassign an import). ESM imports are read-only bindings to the exporting module's binding. To increment, the importer must call an exported function (`increment()`), and when it does, it sees the change because the binding is live. That's the opposite of CommonJS, where assigning the variable would work (but it would be a separate copy).
</details>

<details>
<summary><b>3. Why can't a bundler tree-shake a dynamic `import()`?</b></summary>

**Explanation**: Because at compile time the bundler doesn't know which exports of the module will be used: both the path and the usage are decided at runtime. It can only know that **all** of the file might be needed, so it keeps it whole. Static `import` statements can be analysed up front; dynamic ones can't.
</details>

<details>
<summary><b>4. You have a codebase in ESM and a legacy CJS script that needs to import an ESM module. Is that possible?</b></summary>

**Explanation**: In modern Node.js, yes, with nuances. A CJS module can load ESM with `import()`, which returns a promise (the `require` of ESM modules doesn't exist in stable Node because `require` is synchronous and ESM supports top-level `await`). In the opposite direction, an ESM module can import a CJS module with a regular `import`: Node exposes its `module.exports` as the module's *default*. Today `import()` is the reliable bridge in both directions.
</details>

---

### 2. Explain it in your own words

> **Challenge**: Explain to someone just migrating from Python what it means that "ESM imports are live and static," using the metaphor of a **shared spreadsheet** (the `C5` cell everyone looks at) instead of copying the value.  
> *Hint: if you hesitate, reread [Section 2](#2-es-modules-import-and-export).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): One calculator, two worlds

**Goal**: write the same calculator module in CommonJS and in ES Modules, and consume it in both styles.

**Statement**:
1. Create `calculator.js` (CommonJS) exporting `add`, `subtract`, `multiply`, and a `divide` that validates division by zero by throwing an `Error` with a clear message.
2. Create `app.js` (CommonJS) that imports it and prints `add(5, 3)` and `divide(10, 2)`.
3. Repeat the module as `calculator.mjs` (ESM) and consume it from `app.mjs`.
4. Verify that with `"type": "commonjs"` (the default), your `app.js` works just like `.mjs`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. CommonJS exports with `module.exports = { ... }` and imports with `require("./calculator")`.
2. ESM exports with `export function` and imports with `import { ... } from "./calculator.mjs"` — mind the `.mjs` extension.
3. The divide-by-zero validation lives inside `divide`, identical in both worlds.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
// calculator.js (CommonJS)
function add(a, b) { return a + b }
function subtract(a, b) { return a - b }
function multiply(a, b) { return a * b }
function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero")
  }
  return a / b
}

module.exports = { add, subtract, multiply, divide }
```

```javascript
// app.js (CommonJS) — implicit extensions, cache and all that, already works
const calculator = require("./calculator")

console.log(calculator.add(5, 3))     // 8
console.log(calculator.divide(10, 2)) // 5
```

```javascript
// calculator.mjs (ESM)
export function add(a, b) { return a + b }
export function subtract(a, b) { return a - b }
export function multiply(a, b) { return a * b }
export function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero")
  }
  return a / b
}
```

```javascript
// app.mjs (ESM) — notice the mandatory extension
import { add, divide } from "./calculator.mjs"

console.log(add(5, 3))     // 8
console.log(divide(10, 2)) // 5
```

**Why does it work?** in CommonJS the extension is optional, in ESM it's mandatory — the `ERR_MODULE_NOT_FOUND` error from omitting it is the most common one when migrating. The `divide` validation lives in the only part of the module that knows it; both systems respect that encapsulation.
</details>

---

#### Exercise 2 (Intermediate): Modular logging system

**Goal**: build a small ESM logging system where each responsibility (formatting, destination, orchestration) lives in its own module and is consumed through a barrel.

**Requirements**:
1. `formatters.mjs`: exports `consoleFormat` (readable text with timestamp) and `jsonFormat` (an object serialized to JSON).
2. `destinations.mjs`: exports `consoleDestination` (`console.log`) and `createFileDestination(path)` that appends to a file with `fs.appendFileSync`.
3. `logger.mjs`: exports `createLogger({ formatters, destinations })` with `info`, `warn`, and `error` methods.
4. `index.mjs`: a barrel re-exporting `createLogger`, the formatters, and the destinations.
5. From `app.mjs`, create one logger writing to the console in readable format and another writing to a file in JSON format.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Each responsibility in its own file: formatting, destinations, and orchestration.
2. `createLogger({ formatters, destinations })` iterates destinations and applies a formatter before `destination.write(...)`.
3. The `index.mjs` barrel re-exports with `export { ... } from "./..."` for a single public facade.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
// formatters.mjs
export const consoleFormat = (level, message) =>
  `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`

export const jsonFormat = (level, message) =>
  JSON.stringify({ timestamp: Date.now(), level, message })
```

```javascript
// destinations.mjs
import fs from "node:fs"

export const consoleDestination = {
  write(formatted) {
    console.log(formatted)
  },
}

export const createFileDestination = (path) => ({
  write(formatted) {
    fs.appendFileSync(path, formatted + "\n")
  },
})
```

```javascript
// logger.mjs
import { consoleFormat } from "./formatters.mjs"
import { consoleDestination } from "./destinations.mjs"

export function createLogger(config = {}) {
  const { formatters = consoleFormat, destinations = [consoleDestination] } = config

  const write = (level, message) => {
    const formatted = formatters(level, message)
    destinations.forEach((destination) => destination.write(formatted))
  }

  return {
    info: (message) => write("info", message),
    warn: (message) => write("warn", message),
    error: (message) => write("error", message),
  }
}
```

```javascript
// index.mjs (barrel)
export { createLogger } from "./logger.mjs"
export { consoleFormat, jsonFormat } from "./formatters.mjs"
export { consoleDestination, createFileDestination } from "./destinations.mjs"
```

```javascript
// app.mjs
import { createLogger, jsonFormat, createFileDestination } from "./index.mjs"

const consoleLogger = createLogger()
consoleLogger.info("System starting")

const fileLogger = createLogger({
  formatters: jsonFormat,
  destinations: [createFileDestination("./events.log")],
})
fileLogger.error("Failed to reach the service")
```

**Why does it work?** each module declares only its piece of the contract and the barrel is the public facade. The *Strategy* pattern appears naturally: `formatters` and `destinations` are interchangeable functions/objects that the logger combines without knowing their details — exactly the kind of composition modules were designed to enable.
</details>

---

#### Exercise 3 (Advanced): Plugin loader with `import()` and error handling

**Goal**: design a system that loads and unloads plugins on demand, with dynamic imports, validation of the plugin interface, and failure handling.

**Specifications**:
1. `loadPlugin(path)`: uses dynamic `import()`; expects the module to export a class by default. Validates lazily that the plugin has `name`, `version`, and `initialize()`.
2. Loaded plugins are stored in a `Map`, with their `initialize()` called exactly once.
3. `unloadPlugin(name)`: calls `destroy()` if present (to clean up event listeners, timers) and removes it from the `Map`.
4. `listPlugins()`: returns an array of `{ name, version }`.
5. Controlled errors: an invalid path or an incorrect interface must fail with clear messages, without crashing the app.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Load with `const module = await import(path)`; the default export is `module.default`.
2. Validate `name`, `version`, and `initialize()` before registering; store the instance in a `Map`.
3. `unloadPlugin` calls `destroy()` (if present) before `Map.delete`, and `listPlugins` reads the `Map`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class PluginSystem {
  constructor() {
    this.plugins = new Map()
  }

  async loadPlugin(path) {
    const module = await import(path)

    const PluginClass = module.default ?? module.Plugin
    if (typeof PluginClass !== "function") {
      throw new Error(`Module ${path} does not export a valid plugin`)
    }

    const instance = new PluginClass()

    for (const required of ["name", "version"]) {
      if (!instance[required]) {
        throw new Error(`Plugin at ${path} is missing property "${required}"`)
      }
    }
    if (typeof instance.initialize !== "function") {
      throw new Error(`Plugin at ${path} has no initialize() method`)
    }

    if (this.plugins.has(instance.name)) {
      await this.unloadPlugin(instance.name)
    }

    await instance.initialize()
    this.plugins.set(instance.name, instance)
    console.log(`Plugin ${instance.name} v${instance.version} loaded`)
    return instance
  }

  async unloadPlugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`Plugin ${name} is not loaded`)
    }
    if (typeof plugin.destroy === "function") {
      await plugin.destroy()
    }
    this.plugins.delete(name)
    console.log(`Plugin ${name} unloaded`)
  }

  listPlugins() {
    return [...this.plugins.values()].map((p) => ({
      name: p.name,
      version: p.version,
    }))
  }
}

// plugins/analytics.mjs
export default class AnalyticsPlugin {
  constructor() {
    this.name = "analytics"
    this.version = "1.0.0"
  }
  async initialize() {
    this.timer = setInterval(() => console.log("analytics heartbeat"), 10000)
  }
  async destroy() {
    clearInterval(this.timer)
  }
}

// app.js
const system = new PluginSystem()

try {
  await system.loadPlugin("./plugins/analytics.mjs")
  console.log(system.listPlugins())
  await system.unloadPlugin("analytics")
} catch (error) {
  console.error(`Plugin operation failed: ${error.message}`)
}
```

**Why does it work?** `import()` returns a promise, `await` consumes it. Validating before registering avoids plugins that *look* right but fail silently, and `unloadPlugin` walks the lifecycle in reverse: first clean up (timers, listeners), then forget. The `Map` gives O(1) `get`/`delete`/`has` with plugin names as unique keys. If plugins become remote, the next step is cancelling slow loads with `AbortController` (`import(path, { signal })`).
</details>

---

## Debugging in practice

### Scenario 1: The phantom circular-dependency bug

**Situation**: In production, `a.js` imports `b.js` and `b.js` imports `a.js`. It works on your machine… until you changed the order of two `require` calls while refactoring. Now, intermittently, a function returns `undefined` in `a.js` because something in `b.js` evaluates "too early."

**Analysis questions**:
1. What does ESM's static resolution guarantee about a circular pair, and why is CommonJS the one that fails here?
2. Which two design strategies kill the circular dependency at the root?

**Architectural diagnosis**:
- **Cause**: `require` is synchronous and doesn't "hoist": when loading `a.js`, Node needs `b.js`, so it loads `b.js`, which needs `a.js` — but `a.js` hasn't finished executing and its exports are still incomplete. `b.js` receives a partial `{}` and any destructuring (`const { x } = require("./a.js")`) gives it `undefined`.
- **Real solution**: move the shared state into a third module (`shared.mjs`) that both import, or inject the functions (inversion of dependency) instead of importing them: each module receives `setA(fn)`/`setB(fn)` from a neutral module, and resolution is deferred until after startup. If the circularity only exists for *types*, TypeScript's `import type` already breaks it, because it's erased at compile time.

---

### Scenario 2: The tree that won't shake

**Situation**: You moved the project to ESM and "enabled" tree shaking in the bundler. The bundle still weighs 900 KB, and a function removed from the `imports` months ago still shows up in the final file.

**Analysis questions**:
1. Which three causes would you check first, in order of frequency?
2. Which tool helps you see what's actually included?

**Diagnosis**:
- **Likely cause 1 — side effects**: some module does something when imported (a `define`, a polyfill, a global subscription), and the bundler keeps it whole. Review what you do at the top level of your modules and declare `sideEffects` honestly in `package.json`.
- **Likely cause 2 — barrel abuse**: if every consumer imports from the `index`, the bundler drags in every re-exported module. Where size matters, import directly from the sub-modules.
- **Likely cause 3 — a poorly packaged dependency**: some package in `node_modules` ships in CommonJS, and there's no tree shaking over CJS. Use a bundle analyser (Vite's or `webpack-bundle-analyzer`) to see who weighs: the culprit is usually waiting there with 60% of the total.
- **Tool**: `pnpm vite build --debug` or a visual bundle analysis: the diagram colors modules by size and the whole-libraries-stowed-away show up immediately.

---

## Comparison table across languages

### JavaScript vs. Python

| Feature | JavaScript | Python |
|---|---|---|
| **Module system** | Two: CommonJS (Node, sync) and ESM (standard, static). | One: `import` (sync, standard). |
| **Live bindings** | ESM yes, CJS no (copy). | No: copies the value on import. |
| **Dynamic import** | `import()` (promise, key for performance). | `importlib.import_module` (rarely used). |
| **Tree shaking** | Yes, in bundlers (ESM). | Doesn't exist. |
| **Public entry point** | `exports` in `package.json` (real block). | `__all__` (convention, doesn't block). |
| **Module cache** | `require.cache`, mutable and accessible (useful for invalidation). | `sys.modules`. |

### JavaScript vs. Java

| Feature | JavaScript | Java |
|---|---|---|
| **Structural modularity** | File-module (CJS and ESM). | Class-file + packages + JPMS modules. |
| **Import resolution** | Static (ESM) or runtime (CJS), no full build-time checks. | Static, verified by the compiler. |
| **On-demand loading** | `import()` — a bundle split point. | `Class.forName` / ServiceLoader (reflection). |
| **Public exports** | `exports` in `package.json` (path map). | `exports` in `module-info.java` (packages). |
| **Size optimization** | Tree shaking in bundlers (frontend-critical). | Lazy classloader loading, R8/jlink. |
| **Types** | Irrelevant to modules (everything is a file). | Required: the package system is structured with them. |

---

## Chapter summary

1. **CommonJS is synchronous and caches**: `require` always returns the same object; module-level state is global to the whole process.
2. **ESM is static and uses live bindings**: `import` resolves at compile time and exports are live, read-only bindings for the importer.
3. **The extension decides**: `.mjs` is ESM, `.cjs` is CommonJS, `.js` depends on `"type"` in `package.json`.
4. **`import()` is the universal bridge**: it works in both systems, enables lazy loading, and creates split points in the browser.
5. **Tree shaking only works over ESM**: side effects silence it; declare `sideEffects` honestly or the bundle lies.
6. **Barrel files are a trade-off**: import convenience vs. risk of dragging in whole modules; use facades with sense and direct imports with purpose.
7. **`exports` in `package.json` is your containment wall**: the public API is what you declare, and older consumers keep working through `main`/`module`.

---

## Next Chapter

→ **[Chapter 5: Advanced data structures and iteration](./cap-05)**: Now that you know how to organize code, you'll see how JavaScript gives you tools more powerful than plain arrays — `Map`, `Set`, `WeakMap`, iterators and generators — and when each one wins over the others.