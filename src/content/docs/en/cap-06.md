---
title: "Chapter 6: Error Handling and Debugging"
---

# Chapter 6: Error Handling and Debugging

> Error handling in JavaScript is not just about catching exceptions with `try/catch`.

## Introduction

In a production environment (Node.js, Deno, Bun), errors determine whether your system recovers or crashes. This chapter covers the language's error model, creating custom error hierarchies, debugging strategies with `node --inspect`, structured logging, observability, and capturing unhandled errors at the process level.

**Why does it matter?** Because proper error handling is the difference between an application that recovers from unexpected issues and one that fails catastrophically. Design patterns also rely on robust error handling.

## 1. `try/catch/finally` and `throw` — the basic model

### Key idea

JavaScript uses a synchronous exception model: when an error is thrown with `throw`, the engine stops normal execution and looks for the nearest `catch` in the call stack. If it doesn't find one, the error propagates to the global context and, in Node.js, can terminate the process. `finally` always executes — whether there is an error or not — and is the correct place to release resources.

### Flow mechanics

1. The code enters the `try` block.
2. If **there is no error**: `try` completes, `catch` is skipped, and `finally` executes.
3. If **there is an error**: `try` is interrupted at the error line, `catch` captures the error, and `finally` executes.
4. If `finally` has a `return`, it **overrides** any previous `return` or `throw` — this is a classic bug.

### Example with line-by-line explanation

```javascript
// Function that simulates an operation that can fail
function procesarPago(monto, metodo) {
  if (typeof monto !== "number" || monto <= 0) {
    // We throw an error with a descriptive message
    // 'throw' interrupts execution immediately
    throw new TypeError("El monto debe ser un número positivo")
  }

  if (!metodo) {
    throw new Error("Método de pago no especificado")
  }

  return { exito: true, monto, metodo }
}

// Usage with try/catch/finally
function intentarPago() {
  let conexion

  try {
    // We simulate opening a connection (resource that must be closed)
    conexion = { abierta: true, cerrar() { this.abierta = false; console.log("Conexión cerrada") } }

    // This line can throw an error
    const resultado = procesarPago(-100, "tarjeta")
    console.log("Pago exitoso:", resultado)

  } catch (error) {
    // 'error' is the value thrown by 'throw'
    // Here we decide what to do: log, retry, propagate...
    console.error(`Error capturado: ${error.message}`)
    console.error(`Tipo: ${error.name}`)
    console.error(`Stack:\n${error.stack}`)

    // We can rethrow the error if we don't know how to handle it
    // throw error  // <-- uncomment to propagate

  } finally {
    // finally ALWAYS executes, whether there is an error or not
    // It is the correct place to release resources
    if (conexion && conexion.abierta) {
      conexion.cerrar()
    }
  }

  // If the error was caught (not rethrown), execution continues here
  console.log("Intento de pago finalizado")
}

intentarPago()
// Output:
// Error capturado: El monto debe ser un número positivo
// Tipo: TypeError
// Stack: TypeError: El monto debe ser un número positivo\n    at procesarPago ...
// Conexión cerrada
// Intento de pago finalizado
```

### The classic `return` in `finally` bug

```javascript
function calcular() {
  try {
    return 42  // This return should be the result
  } finally {
    return 0   // But finally overrides the try's return!
  }
}

calcular() // 0, not 42

// This also applies to throw:
function lanzar() {
  try {
    throw new Error("Error original")
  } finally {
    return "recuperado"  // Overrides the throw! The error disappears
  }
}

lanzar() // "recuperado" — the error was silently swallowed
```

### Think critically

- Why is `return` in `finally` dangerous? Because it silently swallows errors: if the `try` throws an error and the `finally` has a `return`, the error disappears without being caught by any external `catch`.
- Is `catch` without a parameter valid? Yes, since ES2019: `try { ... } catch { ... }` is valid when you don't need the error object.
- What happens if you throw something that is not an `Error`? `throw "something"` works, but you lose the stack trace. Always throw instances of `Error`.

### Common errors

- Using `return` inside `finally` (swallows errors and values).
- Throwing strings or numbers instead of `Error` instances (loses stack trace).
- Catching errors too early without knowing what to do with them (swallowing).
- Forgetting that `async/await` needs `try/catch` around the `await`, not around the async function declaration.

## 2. Native error types and when each one appears

### Key idea

JavaScript has 7 native error types that inherit from `Error`. Each signals a specific category of failure. Knowing which one appears in each situation helps you diagnose problems faster.

### Table of native types

| Type | When it appears | Typical example |
|------|----------------|----------------|
| `Error` | Generic error, base for all others | `throw new Error("algo")` |
| `TypeError` | Operation on an incorrect type | `null.foo`, `undefined()` |
| `RangeError` | Value outside allowed range | Stack overflow, `Array(-1)` |
| `SyntaxError` | Syntactically invalid code | `eval("var x =")` |
| `ReferenceError` | Variable not defined in the scope | `console.log(x)` where x does not exist |
| `URIError` | Misuse of `decodeURI`/`encodeURI` | `decodeURIComponent("%")` |
| `EvalError` | Deprecated (no longer thrown in ES5+) | — |

### Real examples of each type

```javascript
// TypeError: accessing a property of null/undefined
let usuario = null
usuario.nombre  // TypeError: Cannot read properties of null (reading 'nombre')

// TypeError: calling something that is not a function
const obj = {}
obj()  // TypeError: obj is not a function

// RangeError: infinite recursion (stack overflow)
function infinito() { return infinito() }
infinito()  // RangeError: Maximum call stack size exceeded

// RangeError: array with invalid length
new Array(-1)  // RangeError: Invalid array length

// SyntaxError: invalid code (only in eval or parsing)
eval("const x =")  // SyntaxError: Unexpected end of input

// ReferenceError: undefined variable
console.log(variableInexistente)  // ReferenceError: variableInexistente is not defined

// URIError: misuse of decodeURIComponent
decodeURIComponent("%")  // URIError: URI malformed
```

### Inspecting an Error object

```javascript
const error = new TypeError("Mensaje descriptivo")

// Standard properties of every Error:
error.name     // "TypeError" — the constructor name
error.message  // "Mensaje descriptivo" — the message passed to the constructor
error.stack    // "TypeError: Mensaje descriptivo\n    at ..." — stack trace

// The stack is NOT part of the ECMAScript standard, but all engines implement it.
// In V8 (Node.js/Chrome), the stack includes the message + the call frames.
// In Node.js, you can access the stack without the message using:
error.stack.split("\n").slice(1).join("\n")  // frames only
```

### Think critically

- Why does `SyntaxError` only appear in `eval()` or when parsing invalid JSON? Because syntax errors in source code are detected at compile time, before executing the code. If you have a `SyntaxError` in your `.js` file, Node.js won't start.
- Are `ReferenceError` and `TypeError` easily confused? Yes: `let a = b` where `b` does not exist throws a `ReferenceError`, but `let a = null; a.x` throws a `TypeError`. The difference is whether the variable exists or not.
- Can native errors be extended? Yes: `class MiError extends TypeError {}` creates a subtype that `instanceof TypeError` detects.

## 3. `Error.cause` and error chaining (ES2022+)

### Key idea

Before ES2022, when you caught an error and rethrew it with a new message, you lost the original cause. `Error.cause` allows you to chain errors: the new error carries the original error that caused it inside, preserving the stack trace and the full context.

### The problem without `Error.cause`

```javascript
async function obtenerUsuario(id) {
  try {
    const respuesta = await fetch(`/api/usuarios/${id}`)
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    return await respuesta.json()
  } catch (error) {
    // We rethrow with a more descriptive message, but we LOSE the original error
    throw new Error(`No se pudo obtener el usuario ${id}`)
    // The original fetch stack trace is lost
    // We don't know if it was a network error, a 404, or a timeout
  }
}
```

### The solution with `Error.cause`

```javascript
async function obtenerUsuario(id) {
  try {
    const respuesta = await fetch(`/api/usuarios/${id}`)
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    return await respuesta.json()
  } catch (error) {
    // The second argument { cause } preserves the original error
    throw new Error(`No se pudo obtener el usuario ${id}`, { cause: error })
    // Now error.cause contains the original error with its stack trace
  }
}

// At the top level, we can traverse the entire chain:
try {
  await obtenerUsuario(42)
} catch (error) {
  console.error(error.message)        // "No se pudo obtener el usuario 42"
  console.error(error.cause.message)   // "HTTP 404" or "fetch failed"
  console.error(error.cause.cause)     // Possible underlying network error
}
```

### Pattern: recursive logging of the cause chain

```javascript
function logCadenaErrores(error, profundidad = 0) {
  const prefijo = "  ".repeat(profundidad)
  console.error(`${prefijo}→ ${error.name}: ${error.message}`)

  if (error.cause instanceof Error) {
    logCadenaErrores(error.cause, profundidad + 1)
  }
}

// Usage:
// → Error: No se pudo obtener el usuario 42
//   → Error: HTTP 404
//     → TypeError: fetch failed
```

### When to use it

- When you translate a low-level error (network, database) into a clearer domain error.
- When an error propagates through multiple layers (API → service → repository) and you want to preserve the original context.
- In libraries: the consumer can inspect `error.cause` to decide whether to retry, cache, or propagate.

### Think critically

- Does `Error.cause` automatically appear in the stack trace? No. The stack trace of the new error starts where it was created. `cause` is a separate property that you must inspect manually.
- Can it be chained indefinitely? Yes, but in practice 2-3 levels are enough to diagnose any problem.
- Do all environments support `cause`? Node.js 16.9+, Deno, Bun, and all modern browsers. Older environments silently ignore the second argument.

## 4. `Error.isError` — reliable verification across realms (ES2025+)

### Key idea

`instanceof Error` can fail when an error comes from another "realm" (iframe, worker, vm context). Each realm has its own `Error` constructor, and objects do not share the prototype chain across realms. `Error.isError()` resolves this by verifying if a value is genuinely an `Error` regardless of which realm it comes from.

### The problem across realms

```javascript
// In Node.js with worker_threads:
const { Worker } = require("worker_threads")

const worker = new Worker(`
  throw new Error("Error desde el worker")
`, { eval: true })

worker.on("error", (error) => {
  // 'error' was created in the worker, which has its own Error constructor
  console.log(error instanceof Error)  // can be false in some environments
  console.log(error.message)            // "Error desde el worker" (works)
  console.log(error.stack)              // works, but instanceof is not reliable
})

// In browsers with iframes:
const iframe = document.createElement("iframe")
document.body.appendChild(iframe)
const errorFromIframe = new iframe.contentWindow.Error("Error del iframe")

console.log(errorFromIframe instanceof Error)  // false — different constructor
console.log(errorFromIframe instanceof iframe.contentWindow.Error)  // true
```

### The solution with `Error.isError`

```javascript
// Error.isError verifies if a value is a genuine Error,
// regardless of which realm it comes from
console.log(Error.isError(new Error("test")))         // true
console.log(Error.isError(new TypeError("test")))      // true (inherits from Error)
console.log(Error.isError({ message: "falso" }))       // false
console.log(Error.isError(null))                       // false
console.log(Error.isError("string"))                   // false

// In the case of the worker:
worker.on("error", (error) => {
  console.log(Error.isError(error))  // true — reliable across realms
})
```

### Proposal status

- `Error.isError` is part of **ES2025** (Stage 4, finalized).
- Available in Node.js 22+ and modern browsers (Chrome 131+, Firefox 137+).
- In environments that do not support it, a simple polyfill: `const isError = (v) => v instanceof Error || (v && typeof v === "object" && v.name && v.message && v.stack)`.

### Think critically

- Why not use `typeof error === "object" && error instanceof Error`? Because `instanceof` fails across realms. `Error.isError` uses an internal engine mechanism that does not depend on the prototype chain.
- Does `Error.isError` detect subclasses of Error? Yes. If `class MiError extends Error {}`, then `Error.isError(new MiError())` returns `true`.
- Can an Error be faked to pass `Error.isError`? Not easily. The check uses the engine's internal `**ErrorData**` slot, which is not accessible from JavaScript.

## 5. Custom error hierarchies

### Key idea

In real-world applications, a single `Error` type is not enough. You need to distinguish between a validation error (which the client can correct), an authentication error (which requires re-login), and a database error (which requires retrying). Custom error hierarchies allow for this.

### Pattern: base hierarchy

```javascript
// Base class for all application errors
class AppError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    // Necessary for 'instanceof' to work correctly when extending Error
    this.name = this.constructor.name

    // Preserve the prototype chain (necessary in some environments)
    Object.setPrototypeOf(this, new.target.prototype)

    // Custom properties
    this.codigo = options.codigo || "APP_ERROR"
    this.contexto = options.contexto || {}
    this.esOperacional = options.esOperacional ?? true  // true = expected error, false = bug
  }
}

// Specific domain errors
class ValidationError extends AppError {
  constructor(message, campo, options = {}) {
    super(message, { ...options, codigo: "VALIDATION_ERROR" })
    this.campo = campo
  }
}

class AuthError extends AppError {
  constructor(message, options = {}) {
    super(message, { ...options, codigo: "AUTH_ERROR" })
  }
}

class DatabaseError extends AppError {
  constructor(message, options = {}) {
    super(message, { ...options, codigo: "DATABASE_ERROR" })
    this.esOperacional = false  // DB errors are usually bugs or infrastructure issues
  }
}

class NotFoundError extends AppError {
  constructor(recurso, id, options = {}) {
    super(`${recurso} con id ${id} no encontrado`, { ...options, codigo: "NOT_FOUND" })
    this.recurso = recurso
    this.id = id
  }
}
```

### Usage in an Express controller

```javascript
async function handler(req, res) {
  try {
    const usuario = await buscarUsuario(req.params.id)
    if (!usuario) throw new NotFoundError("Usuario", req.params.id)

    if (!usuario.activo) throw new AuthError("Usuario inactivo")

    if (!req.body.email) throw new ValidationError("Email requerido", "email")

    res.json(usuario)
  } catch (error) {
    // Centralized handling based on error type
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message, codigo: error.codigo })
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, campo: error.campo })
    }
    if (error instanceof AuthError) {
      return res.status(401).json({ error: error.message })
    }
    if (error instanceof DatabaseError) {
      console.error("Error de BD:", error)
      return res.status(503).json({ error: "Servicio no disponible" })
    }
    // Unknown error — probably a bug
    console.error("Error no manejado:", error)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
}
```

### Why `Object.setPrototypeOf(this, new.target.prototype)` is necessary

```javascript
// Without this line, when extending Error in TypeScript/ES6 with some transpilers:
class MiError extends Error {
  constructor(message) {
    super(message)
    // Without setPrototypeOf:
    // this.__proto__ points to Error.prototype instead of MiError.prototype
    // instanceof MiError fails
  }
}

const e = new MiError("test")
e instanceof MiError  // can be false without setPrototypeOf
e instanceof Error     // true (always works)
```

### Think critically

- Why separate operational errors from bugs? Operational errors (validation, not found, auth) are expected and should be sent to the client with a clear message. Bugs (unexpected TypeError, ReferenceError) should not expose details to the client and must be logged for debugging.
- When should you use `error.codigo` instead of `instanceof`? When errors cross process boundaries (microservices, IPC). `instanceof` does not work across processes, but a string code (`"VALIDATION_ERROR"`) can always be serialized.
- How many hierarchy levels are reasonable? 2-3 maximum. More levels make the code difficult to maintain.

## 6. Debugging strategies in Node.js (`node --inspect`, breakpoints, sourcemaps)

### Key idea

`console.log` is useful for quick debugging, but in production or for complex bugs, you need more powerful tools. Node.js integrates with Chrome DevTools via the inspection protocol, allowing breakpoints, variable inspection, watch expressions, and CPU/memory profiling.

### Debugging with Chrome DevTools

```bash
# Start Node.js in inspection mode
node --inspect server.js
# Or pause on the first line:
node --inspect-brk server.js

# Then open chrome://inspect in Chrome and click "inspect"
```

### Programmatic debugging with `debugger`

```javascript
function calcularTotal(items) {
  let total = 0

  for (const item of items) {
    // The engine pauses here if in inspection mode
    debugger  // Pauses execution — inspect variables in DevTools
    total += item.precio * item.cantidad
  }

  return total
}
```

### Sourcemaps in TypeScript and bundlers

```javascript
// When you use TypeScript, the code Node.js executes is the compiled .js,
// not the original .ts. Sourcemaps map the .js to the .ts.

// tsconfig.json:
// { "compilerOptions": { "sourceMap": true } }

// Upon compilation, archivo.js + archivo.js.map is generated
// Node.js uses the sourcemaps automatically with --inspect:
node --inspect dist/server.js

// The debugger shows the original TypeScript code, not the compiled one
```

### Inspecting memory leaks with heap snapshots

```bash
# 1. Start in inspection mode
node --inspect server.js

# 2. Open chrome://inspect → inspect
# 3. Memory tab → Take heap snapshot
# 4. Run the operation you suspect has a leak
# 5. Take another heap snapshot
# 6. Compare: "Objects allocated between snapshot 1 and 2"
# 7. If there are many objects of a type that are not released, there is a leak
```

### Programmatic detection of memory leaks

```javascript
const { writeHeapSnapshot } = require("node:v8")

// In a diagnostic endpoint or timer:
setInterval(() => {
  const used = process.memoryUsage()
  console.log({
    rss: `${(used.rss / 1024 / 1024).toFixed(1)} MB`,
    heapUsed: `${(used.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    heapTotal: `${(used.heapTotal / 1024 / 1024).toFixed(1)} MB`,
  })

  // If heapUsed grows without limit, take a snapshot to investigate
  if (used.heapUsed > 500 * 1024 * 1024) {  // 500 MB
    writeHeapSnapshot(`./heap-${Date.now}.heapsnapshot`)
  }
}, 60000)  // every minute
```

### Think critically

- `console.log` vs `debugger`? `console.log` is faster for simple cases but modifies the code and can cause side effects in production. `debugger` does not affect production code (it is ignored if there is no inspector) and allows interactive inspection.
- Do sourcemaps expose source code in production? Yes, if the `.map` files are accessible. In production, serve sourcemaps on a protected route or do not serve them at all, but keep them for debugging.
- When should you use CPU profiling instead of heap snapshots? When the application is slow but does not have a memory leak. The CPU profile shows where the engine is spending its time.

## 7. Structured logging and observability

### Key idea

`console.log` is not enough in production. You need structured logs (JSON) that can be searched, filtered, and correlated by tools like Datadog, Grafana Loki, or ELK. Structured logging turns every log into an event with defined fields.

### From console.log to structured logging

```javascript
// ❌ Bad: unstructured log, hard to search
console.log(`Usuario ${userId} compró ${producto} por ${precio}`)
// Output: "Usuario 42 compró laptop por 1500"
// How do you search for all errors of a specific user? You can't.

// ✅ Good: structured log in JSON
const log = {
  level: "info",
  timestamp: new Date().toISOString(),
  evento: "compra",
  usuarioId: userId,
  producto: producto,
  precio: precio,
  moneda: "COP",
  requestId: req.id  // To correlate logs from the same request
}
console.log(JSON.stringify(log))
// Output: {"level":"info","timestamp":"2026-07-21T15:00:00Z","evento":"compra",...}
// Now you can filter by usuarioId, evento, level, etc.
```

### Structured logger with levels

```javascript
class Logger {
  constructor(servicio = "app") {
    this.servicio = servicio
  }

  log(nivel, mensaje, contexto = {}) {
    const entrada = {
      nivel,                    // "debug" | "info" | "warn" | "error" | "fatal"
      timestamp: new Date().toISOString(),
      servicio: this.servicio,
      mensaje,
      ...contexto,
    }

    // In production: stdout in JSON to be collected by the logging system
    // In development: readable format
    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entrada))
    } else {
      const color = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" }[nivel] || ""
      console.log(`${color}[${nivel.toUpperCase()}]\x1b[0m ${mensaje}`, contexto)
    }
  }

  debug(mensaje, contexto) { this.log("debug", mensaje, contexto) }
  info(mensaje, contexto) { this.log("info", mensaje, contexto) }
  warn(mensaje, contexto) { this.log("warn", mensaje, contexto) }
  error(mensaje, contexto) { this.log("error", mensaje, contexto) }
}

// Usage
const logger = new Logger("api-usuarios")

logger.info("Usuario creado", { usuarioId: 42, email: "david@ejemplo.com" })
logger.error("Error de base de datos", { operacion: "SELECT", tabla: "usuarios", error: error.message })
```

### Logging errors with context

```javascript
async function handler(req, res) {
  const logger = new Logger("api")
  const requestId = crypto.randomUUID()

  try {
    logger.info("Petición recibida", { requestId, ruta: req.path, metodo: req.method })

    const resultado = await procesar(req.body)

    logger.info("Petición exitosa", { requestId, duracionMs: Date.now() - req.startTime })
    res.json(resultado)
  } catch (error) {
    // Log the error with all the context needed to diagnose
    logger.error("Petición fallida", {
      requestId,
      ruta: req.path,
      metodo: req.method,
      error: error.message,
      tipo: error.name,
      stack: error.stack,
      causa: error.cause?.message,  // If there is Error.cause
      body: req.body,                // Watch out for sensitive data
    })

    res.status(500).json({ error: "Error interno", requestId })
  }
}
```

### Think critically

- Which fields should you not log? Passwords, tokens, personally identifiable information (PII). Use a redaction function that removes sensitive fields before logging.
- Log levels: when to use each? `debug` = development only, `info` = normal events, `warn` = something unusual but not critical, `error` = failure that needs attention, `fatal` = the process must terminate.
- Why is `requestId` important? Because in distributed systems, a request can generate logs across multiple services. The `requestId` allows you to trace the entire path.

## 8. Capturing unhandled errors at the process level

### Key idea

When an error is not caught by any `try/catch`, it reaches the process level. In Node.js, this can terminate the process. Capturing these errors at the process level is your last line of defense before a crash.

### Process events in Node.js

```javascript
// 1. Uncaught synchronous exception
process.on("uncaughtException", (error) => {
  console.error("EXCEPCIÓN NO CAPTURADA:", error)
  // ⚠️ In production, the correct approach is to log and terminate the process.
  // Continuing after an uncaughtException is dangerous because the application's
  // state may be inconsistent.
  // Use a process manager (PM2, systemd) to restart automatically.

  process.exit(1)  // Terminate with error
})

// 2. Unhandled rejected promise (async)
process.on("unhandledRejection", (razon, promesa) => {
  console.error("PROMESA RECHAZADA NO MANEJADA:", razon)
  // In Node.js 15+, unhandledRejection terminates the process by default.
  // You can change this with --unhandled-rejections=warn (not recommended in production)
})

// 3. Operating system signals
process.on("SIGTERM", () => {
  console.log("SIGTERM recibido — cerrando grácilmente...")
  server.close(() => {
    console.log("Servidor cerrado")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT (Ctrl+C) — cerrando...")
  server.close(() => process.exit(0))
})
```

### Pattern: graceful shutdown

```javascript
async function shutdownGracil(server, signal) {
  console.log(`${signal} recibido. Iniciando shutdown grácil...`)

  // 1. Stop accepting new connections
  server.close()

  // 2. Wait for in-flight requests to finish (with timeout)
  const timeout = setTimeout(() => {
    console.error("Timeout: forzando cierre")
    process.exit(1)
  }, 10000)  // 10 seconds

  // 3. Close database connections
  await db.close()

  // 4. Close other resources (queues, caches, etc.)
  await queue.close()

  clearTimeout(timeout)
  console.log("Shutdown completo")
  process.exit(0)
}

process.on("SIGTERM", () => shutdownGracil(server, "SIGTERM"))
process.on("SIGINT", () => shutdownGracil(server, "SIGINT"))
```

### Why must `uncaughtException` terminate the process?

```javascript
// Example of the danger of continuing after an uncaughtException:
let cache = { usuarios: new Map() }

// Suppose an error corrupts the cache
process.on("uncaughtException", (error) => {
  console.error("Error:", error)
  // If we DO NOT terminate the process, the application keeps running
  // but cache.usuarios could be in an inconsistent state
  // Subsequent operations will use corrupt data without knowing it
})

// Instead, log and exit:
process.on("uncaughtException", (error) => {
  console.error("Error fatal, terminando proceso:", error)
  process.exit(1)
  // The process manager (PM2, Docker, systemd) will restart the app
})
```

### Think critically

- Why does Node.js 15+ terminate the process on `unhandledRejection`? Because unhandled rejected promises are bugs. In earlier versions, the process continued in a potentially inconsistent state.
- `SIGTERM` vs `SIGKILL`? `SIGTERM` allows for a graceful shutdown (closing connections, saving state). `SIGKILL` kills the process immediately with no opportunity for cleanup. Docker sends `SIGTERM` and waits for `--stop-timeout` (default 10s) before sending `SIGKILL`.
- Can you recover from an `uncaughtException`? Technically yes (using domains or zone.js), but it is dangerous. The recommended practice is to log, exit, and let the process manager restart.

## 9. Error handling patterns in production

### Key idea

In production, error handling is not just about catching exceptions. It is a layered system that decides what to do with each type of error: log it, send it to the client, retry, circuit break, or terminate the process.

### Pattern: Express error middleware

```javascript
// Error middleware — must have 4 parameters (err, req, res, next)
function errorHandler(err, req, res, next) {
  const logger = req.logger || console

  // Operational errors (expected): send to client
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      campo: err.campo,
      codigo: err.codigo,
    })
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: err.message,
      codigo: err.codigo,
    })
  }

  if (err instanceof AuthError) {
    return res.status(401).json({
      error: err.message,
    })
  }

  // Non-operational errors (bugs): log and send generic response
  logger.error("Error no manejado", {
    error: err.message,
    stack: err.stack,
    causa: err.cause?.message,
    ruta: req.path,
    metodo: req.method,
  })

  // Never send the stack trace to the client in production
  res.status(500).json({
    error: "Error interno del servidor",
    requestId: req.id,
  })
}

// Must be registered AFTER all routes
app.use(errorHandler)
```

### Pattern: retry with exponential backoff

```javascript
async function conRetry(fn, opciones = {}) {
  const {
    maxIntentos = 3,
    delayBase = 1000,        // 1 second initial
    delayMax = 30000,         // 30 seconds max
    factor = 2,               // Exponential multiplier
    erroresReintentables = ["NETWORK_ERROR", "TIMEOUT", "DATABASE_ERROR"],
  } = opciones

  let ultimoError

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await fn(intento)
    } catch (error) {
      ultimoError = error

      // Is this error retryable?
      const esReintentable = erroresReintentables.includes(error.codigo)
      if (!esReintentable) throw error

      // Is it the last attempt?
      if (intento === maxIntentos) {
        throw new Error(`Operación fallida después de ${maxIntentos} intentos`, {
          cause: error,
        })
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(delayBase * Math.pow(factor, intento - 1), delayMax)
      const jitter = Math.random() * 500  // Avoids thundering herd
      await new Promise(resolve => setTimeout(resolve, delay + jitter))

      console.log(`Reintento ${intento + 1}/${maxIntentos} en ${delay}ms`)
    }
  }

  throw ultimoError
}

// Usage:
const resultado = await conRetry(
  () => fetch("https://api.ejemplo.com/datos"),
  { maxIntentos: 5, delayBase: 500 }
)
```

### Pattern: circuit breaker

```javascript
class CircuitBreaker {
  constructor(opciones = {}) {
    this.umbral = opciones.umbral || 5        // Failures before opening
    this.timeout = opciones.timeout || 60000  // Time before half-open
    this.estado = "CLOSED"                     // CLOSED | OPEN | HALF_OPEN
    this.fallos = 0
    this.ultimaVezAbierto = null
  }

  async ejecutar(fn) {
    if (this.estado === "OPEN") {
      if (Date.now() - this.ultimaVezAbierto > this.timeout) {
        this.estado = "HALF_OPEN"  // Allow a trial attempt
      } else {
        throw new Error("Circuit breaker abierto — operación rechazada")
      }
    }

    try {
      const resultado = await fn()
      this.exito()
      return resultado
    } catch (error) {
      this.fallo()
      throw error
    }
  }

  exito() {
    this.fallos = 0
    this.estado = "CLOSED"
  }

  fallo() {
    this.fallos++
    if (this.fallos >= this.umbral) {
      this.estado = "OPEN"
      this.ultimaVezAbierto = Date.now()
    }
  }
}

// Usage: protect calls to an external service
const breaker = new CircuitBreaker({ umbral: 5, timeout: 30000 })

async function llamarApi() {
  return breaker.ejecutar(() => fetch("https://api-externa.com/datos"))
}
```

### Think critically

- Why use jitter in exponential backoff? Without jitter, if multiple services fail at the same time, they all retry at the same time (thundering herd). Jitter spreads out the retries.
- When should you use a circuit breaker vs retry? Retry is for transient failures (network, timeout). A circuit breaker is for services that might be down for a while — it avoids wasting resources on requests that are bound to fail.
- Should the circuit breaker reset automatically? Yes, using the HALF_OPEN state: after the timeout, it allows a trial request. If it succeeds, it closes the circuit. If it fails, it opens it again.

## Common Errors

### Chapter debugging map

- If you see `TypeError: Cannot read properties of null` → something returned null/undefined where you expected an object. Check the data source.
- If you see `RangeError: Maximum call stack size exceeded` → infinite recursion or recursion without a base case.
- If you see `ReferenceError: x is not defined` → the variable does not exist in the scope. Check if an `import` is missing or if there is a typo.
- If an error propagates without context → use `Error.cause` to preserve the original error.
- If `instanceof Error` returns false for an error from a worker/iframe → use `Error.isError`.
- If the application crashes without explanation → check `uncaughtException` and `unhandledRejection` in the logs.
- If the application progressively slows down → take heap snapshots and look for memory leaks.
- If the logs are not useful → migrate from `console.log` to structured logging with context.
- If an external service repeatedly fails → implement a circuit breaker.
- If requests sometimes fail and sometimes don't → implement retry with exponential backoff.

---

## Practical Exercises

### Basic Level

**Objective**: Create functions with basic error handling

**Exercise**: Create a `dividir` function that takes two numbers and returns the result. It must handle division by zero and non-numeric type errors.

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use `try/catch` to handle errors
2. Throw descriptive errors with `throw`
3. Use `finally` for cleanup if necessary

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
function dividir(a, b) {
  try {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new TypeError('Ambos argumentos deben ser números');
    }
    
    if (b === 0) {
      throw new RangeError('No se puede dividir por cero');
    }
    
    return a / b;
  } catch (error) {
    console.error(`Error en división: ${error.message}`);
    throw error; // Rethrow so the caller handles the error
  }
}

// Usage
try {
  console.log(dividir(10, 2));   // 5
  console.log(dividir(10, 0));   // Error: No se puede dividir por cero
  console.log(dividir('10', 2)); // Error: Ambos argumentos deben ser números
} catch (error) {
  console.log('Error capturado externamente:', error.message);
}
```

</details>


### Intermediate Level

**Objective**: Create a custom error hierarchy

**Exercise**: Create an `ErrorAPI` base class and subclasses for different types of API errors (authentication, not found, rate limit). Include `Error.cause` to preserve original errors.

**Requirements**:
1. `ErrorAPI` must have `codigo`, `mensaje`, `timestamp`
2. `ErrorAutenticacion` for 401 errors
3. `ErrorNoEncontrado` for 404 errors
4. `ErrorRateLimit` for 429 errors
5. All must support `Error.cause`

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Extend from native `Error`
2. Use `super()` with a descriptive message
3. Set `this.name` correctly

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
class ErrorAPI extends Error {
  constructor(mensaje, codigo, causa = null) {
    super(mensaje, { cause: causa });
    this.name = this.constructor.name;
    this.codigo = codigo;
    this.timestamp = new Date().toISOString();
    
    // Maintain the correct stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      codigo: this.codigo,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class ErrorAutenticacion extends ErrorAPI {
  constructor(mensaje = 'No autenticado', causa = null) {
    super(mensaje, 401, causa);
  }
}

class ErrorNoEncontrado extends ErrorAPI {
  constructor(recurso = 'Recurso', causa = null) {
    super(`${recurso} no encontrado`, 404, causa);
  }
}

class ErrorRateLimit extends ErrorAPI {
  constructor(reintentarEn = 60, causa = null) {
    super(`Rate limit excedido. Reintentar en ${reintentarEn} segundos`, 429, causa);
    this.reintentarEn = reintentarEn;
  }
}

// Usage
async function obtenerUsuario(id) {
  try {
    const respuesta = await fetch(`/api/usuarios/${id}`);
    
    if (!respuesta.ok) {
      const errorOriginal = new Error(`HTTP ${respuesta.status}`);
      
      switch (respuesta.status) {
        case 401:
          throw new ErrorAutenticacion('Token expirado', errorOriginal);
        case 404:
          throw new ErrorNoEncontrado('Usuario', errorOriginal);
        case 429:
          throw new ErrorRateLimit(30, errorOriginal);
        default:
          throw new ErrorAPI('Error desconocido', respuesta.status, errorOriginal);
      }
    }
    
    return await respuesta.json();
  } catch (error) {
    if (error instanceof ErrorAPI) {
      console.error('Error de API:', error.toJSON());
    } else {
      console.error('Error inesperado:', error);
    }
    throw error;
  }
}
```

</details>


### Advanced Level

**Objective**: Implement a structured logging system with a circuit breaker

**Exercise**: Create a logging system that:
1. Formats messages in JSON with context (timestamp, level, service, requestId)
2. Integrates a circuit breaker for external services
3. Supports different destinations (console, file, external service)

**Specifications**:
1. Each log must include: timestamp, level, service, requestId, message, metadata
2. The circuit breaker must have states: CLOSED, OPEN, HALF_OPEN
3. Support for redacting sensitive data (PII)

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use closures to maintain context
2. Implement the State pattern for the circuit breaker
3. Use Proxy to intercept writes and redact data

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
// Structured logger
class LoggerEstructurado {
  constructor(configuracion) {
    this.servicio = configuracion.servicio;
    this.nivelMinimo = configuracion.nivelMinimo || 'info';
    this.destinos = configuracion.destinos || [console];
    this.redactores = configuracion.redactores || [];
    
    this.niveles = { debug: 0, info: 1, warn: 2, error: 3 };
  }
  
  _redactar(mensaje) {
    let redactado = mensaje;
    for (const redactor of this.redactores) {
      redactado = redactor(redactado);
    }
    return redactado;
  }
  
  _formatear(nivel, mensaje, metadata = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: nivel,
      service: this.servicio,
      requestId: metadata.requestId || 'sin-request',
      message: this._redactar(mensaje),
      ...metadata
    };
  }
  
  _escribir(log) {
    if (this.niveles[log.level] < this.niveles[this.nivelMinimo]) {
      return;
    }
    
    const logFormateado = JSON.stringify(log);
    this.destinos.forEach(destino => {
      if (destino.write) {
        destino.write(logFormateado);
      } else if (destino.log) {
        destino.log(logFormateado);
      }
    });
  }
  
  debug(mensaje, metadata) {
    this._escribir(this._formatear('debug', mensaje, metadata));
  }
  
  info(mensaje, metadata) {
    this._escribir(this._formatear('info', mensaje, metadata));
  }
  
  warn(mensaje, metadata) {
    this._escribir(this._formatear('warn', mensaje, metadata));
  }
  
  error(mensaje, metadata) {
    this._escribir(this._formatear('error', mensaje, metadata));
  }
}

// Circuit Breaker
class CircuitBreaker {
  constructor(configuracion) {
    this.umbral = configuracion.umbral || 5;
    this.timeout = configuracion.timeout || 30000;
    this.estado = 'CLOSED';
    this.fallos = 0;
    this.ultimaVezAbierto = 0;
  }
  
  async ejecutar(funcion) {
    if (this.estado === 'OPEN') {
      if (Date.now() - this.ultimaVezAbierto > this.timeout) {
        this.estado = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN - servicio no disponible');
      }
    }
    
    try {
      const resultado = await funcion();
      this._exito();
      return resultado;
    } catch (error) {
      this._fallo();
      throw error;
    }
  }
  
  _exito() {
    this.fallos = 0;
    if (this.estado === 'HALF_OPEN') {
      this.estado = 'CLOSED';
    }
  }
  
  _fallo() {
    this.fallos++;
    if (this.fallos >= this.umbral) {
      this.estado = 'OPEN';
      this.ultimaVezAbierto = Date.now();
    }
  }
}

// Usage
const logger = new LoggerEstructurado({
  servicio: 'mi-api',
  nivelMinimo: 'info',
  redactores: [
    (mensaje) => mensaje.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX') // Redact SSN
  ]
});

const breaker = new CircuitBreaker({ umbral: 3, timeout: 10000 });

async function llamadaExterna() {
  return breaker.ejecutar(async () => {
    logger.info('Iniciando llamada externa', { requestId: '123' });
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return { datos: 'resultado' };
  });
}
```

</details>


---

## Critical Thinking

### Problem 1: Errors in asynchronous code

**Situation**: You have an asynchronous function that handles errors, but some errors are not caught correctly.

**Guiding questions**:
1. Why doesn't `try/catch` catch errors in callbacks not wrapped in promises?
2. How do you handle errors in `Promise.all` when a promise fails?
3. What strategies does Python use for this?

**Analysis**:
- **Problem**: Traditional callbacks not integrated with promises are not caught by an external `try/catch`
- **Solution**: Wrap callbacks in promises, use `Promise.allSettled`, handle errors in `.catch()`
- **Python**: Uses `asyncio.gather` with `return_exceptions=True` to handle multiple errors

```javascript
// ❌ Problem: forEach with async/await
const ids = [1, 2, 3];
try {
  ids.forEach(async (id) => {
    await procesar(id); // Error here is not caught externally
  });
} catch (error) {
  console.log('Nunca se ejecuta'); // ❌
}

// ✅ Solution: for...of with try/catch
try {
  for (const id of ids) {
    await procesar(id); // Error here is caught
  }
} catch (error) {
  console.log('Error caught:', error.message); // ✅
}

// ✅ Solution: Promise.all with individual handling
const resultados = await Promise.allSettled(
  ids.map(id => procesar(id))
);

resultados.forEach((resultado, index) => {
  if (resultado.status === 'rejected') {
    console.error(`Error in ID ${ids[index]}:`, resultado.reason);
  }
});
```

### Problem 2: Logging in production

**Situation**: Your application has logs, but they are useless for debugging problems in production.

**Guiding questions**:
1. What information should a structured log include?
2. How do you balance detail with performance?
3. What strategies does Python use for logging in production?

**Analysis**:
- **Essential information**: Timestamp, level, service, requestId, message, contextual metadata
- **Performance**: Lazy evaluation, buffering, sampling under high loads
- **Python**: Uses `structlog` or `python-json-logger` for structured logging

```javascript
// ✅ Logging with requestId context for traceability
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuid();
  req.logger = logger.child({ requestId: req.requestId });
  next();
});

// In controller
async function obtenerUsuario(req, res) {
  req.logger.info('Starting user retrieval', { userId: req.params.id });
  
  try {
    const usuario = await usuarioService.obtener(req.params.id);
    req.logger.info('User successfully retrieved', { userId: req.params.id });
    res.json(usuario);
  } catch (error) {
    req.logger.error('Error retrieving user', { 
      userId: req.params.id, 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ error: 'Error interno' });
  }
}
```

---

## Connection with Python

### Error handling in Python

**Python (try/except/finally)**:
```python
def dividir(a, b):
    try:
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            raise TypeError("Ambos argumentos deben ser números")
        
        if b == 0:
            raise ValueError("No se puede dividir por cero")
        
        return a / b
    except (TypeError, ValueError) as e:
        print(f"Error en división: {e}")
        raise  # Rethrow so the caller handles the error
    finally:
        print("Division operation completed")

# Usage
try:
    print(dividir(10, 2))   # 5.0
    print(dividir(10, 0))   # Error: No se puede dividir por cero
    print(dividir('10', 2)) # Error: Ambos argumentos deben ser números
except Exception as e:
    print(f"Error caught externally: {e}")
```

**Error hierarchy in Python**:
```python
class ErrorAPI(Exception):
    def __init__(self, mensaje, codigo, causa=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.causa = causa
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self):
        return {
            'error': str(self),
            'codigo': self.codigo,
            'timestamp': self.timestamp
        }

class ErrorAutenticacion(ErrorAPI):
    def __init__(self, mensaje="No autenticado", causa=None):
        super().__init__(mensaje, 401, causa)

class ErrorNoEncontrado(ErrorAPI):
    def __init__(self, recurso="Recurso", causa=None):
        super().__init__(f"{recurso} no encontrado", 404, causa)
```

### Key differences

| Aspect | JavaScript | Python |
|---------|------------|--------|
| **Catching** | `try/catch` | `try/except` |
| **finally** | Always executes | Always executes |
| **Rethrow** | `throw error` | `raise` |
| **Inheritance** | `extends Error` | `class MiError(Exception)` |
| **Cause** | `Error.cause` (ES2022) | `raise ... from causa` (Python 3) |

### When to use each

**JavaScript is best for**:
- Web applications with real-time error handling
- Frontend with UI/UX errors
- REST APIs with HTTP status codes

**Python is best for**:
- Scripts and automation with robust error handling
- Data science with data validation
- Web backend with structured logging

---

## Summary

1. **`try/catch/finally`** catches synchronous errors; `finally` always executes, but `return` in `finally` swallows errors.
2. **There are 7 native error types**: `Error`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `URIError`, `EvalError`.
3. **`Error.cause`** (ES2022) preserves the original error chain when rethrowing.
4. **`Error.isError`** (ES2025) reliably verifies errors across realms (workers, iframes).
5. **Custom error hierarchies** allow for differentiated handling by type.
6. **`node --inspect`** + Chrome DevTools allows for breakpoints, variable inspection, and heap snapshots.
7. **Structured logging** (JSON) is essential for production observability.
8. **`uncaughtException`** and `unhandledRejection` are the last line of defense; in production, log and exit.
9. **Production patterns**: error middleware, retry with backoff, circuit breaker, graceful shutdown.
10. **Python handles errors similarly** but with different syntax and conventions.

---

## Next Chapter

→ **Cap-7-Patrones-Creacionales**: In the next chapter, we will look at creational patterns such as Factory, Singleton, and Builder, applied to modern JavaScript.