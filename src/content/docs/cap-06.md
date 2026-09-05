---
title: "Capítulo 6: Manejo de errores y depuración"
---

# Capítulo 6: Manejo de errores y depuración

> El manejo de errores en JavaScript no es solo atrazar excepciones con `try/catch`.

## Introducción

En un entorno de producción (Node.js, Deno, Bun), los errores determinan si tu sistema se recupera o se cae. Este capítulo cubre el modelo de errores del lenguaje, la creación de jerarquías de error personalizadas, estrategias de depuración con `node --inspect`, logging estructurado, observabilidad y captura de errores no manejados a nivel de proceso.

**¿Por qué importa?** Porque un manejo de errores adecuado es la diferencia entre una aplicación que se recupera de problemas inesperados y una que falla catastroficamente. Los patrones de diseño también dependen de un manejo de errores robusto.

## 1. `try/catch/finally` y `throw` — el modelo básico

### Idea clave

JavaScript usa un modelo de excepciones síncrono: cuando se lanza un error con `throw`, el motor detiene la ejecución normal y busca el `catch` más cercano en la pila de llamadas. Si no encuentra ninguno, el error se propaga hasta el contexto global y, en Node.js, puede terminar el proceso. `finally` se ejecuta siempre — haya o no error — y es el lugar correcto para liberar recursos.

### Mecánica del flujo

1. El código entra al bloque `try`.
2. Si **no hay error**: `try` completa, se salta `catch`, ejecuta `finally`.
3. Si **hay error**: `try` se interrumpe en la línea del error, `catch` captura el error, `finally` se ejecuta.
4. Si `finally` tiene `return`, **anula** cualquier `return` o `throw` anterior — esto es un bug clásico.

### Ejemplo con explicación línea por línea

```javascript
// Función que simula una operación que puede fallar
function procesarPago(monto, metodo) {
  if (typeof monto !== "number" || monto <= 0) {
    // Lanzamos un error con un mensaje descriptivo
    // 'throw' interrumpe la ejecución inmediatamente
    throw new TypeError("El monto debe ser un número positivo")
  }

  if (!metodo) {
    throw new Error("Método de pago no especificado")
  }

  return { exito: true, monto, metodo }
}

// Uso con try/catch/finally
function intentarPago() {
  let conexion

  try {
    // Simulamos abrir una conexión (recurso que debe cerrarse)
    conexion = { abierta: true, cerrar() { this.abierta = false; console.log("Conexión cerrada") } }

    // Esta línea puede lanzar un error
    const resultado = procesarPago(-100, "tarjeta")
    console.log("Pago exitoso:", resultado)

  } catch (error) {
    // 'error' es el valor lanzado por 'throw'
    // Aquí decidimos qué hacer: loggear, reintentar, propagar...
    console.error(`Error capturado: ${error.message}`)
    console.error(`Tipo: ${error.name}`)
    console.error(`Stack:\n${error.stack}`)

    // Podemos relanzar el error si no sabemos manejarlo
    // throw error  // <-- descomenta para propagar

  } finally {
    // finally se ejecuta SIEMPRE, haya o no error
    // Es el lugar correcto para liberar recursos
    if (conexion && conexion.abierta) {
      conexion.cerrar()
    }
  }

  // Si el error fue capturado (no relanzado), la ejecución continúa aquí
  console.log("Intento de pago finalizado")
}

intentarPago()
// Salida:
// Error capturado: El monto debe ser un número positivo
// Tipo: TypeError
// Stack: TypeError: El monto debe ser un número positivo\n    at procesarPago ...
// Conexión cerrada
// Intento de pago finalizado
```

### El bug clásico de `return` en `finally`

```javascript
function calcular() {
  try {
    return 42  // Este return debería ser el resultado
  } finally {
    return 0   // ¡Pero finally anula el return del try!
  }
}

calcular() // 0, no 42

// Esto también aplica a throw:
function lanzar() {
  try {
    throw new Error("Error original")
  } finally {
    return "recuperado"  // ¡Anula el throw! El error desaparece
  }
}

lanzar() // "recuperado" — el error fue tragado silenciosamente
```

### Piensa críticamente

- ¿Por qué `return` en `finally` es peligroso? Porque traga errores silenciosamente: si el `try` lanza un error y el `finally` tiene `return`, el error desaparece sin ser capturado por ningún `catch` externo.
- ¿`catch` sin parámetro es válido? Sí, desde ES2019: `try { ... } catch { ... }` es válido cuando no necesitas el objeto de error.
- ¿Qué pasa si lanzas algo que no es un `Error`? `throw "algo"` funciona, pero pierdes el stack trace. Siempre lanza instancias de `Error`.

### Errores comunes

- Usar `return` dentro de `finally` (traga errores y valores).
- Lanzar strings o números en lugar de instancias de `Error` (pierde stack trace).
- Atrapar errores demasiado pronto sin saber qué hacer con ellos (swallowing).
- Olvidar que `async/await` necesita `try/catch` alrededor del `await`, no alrededor de la declaración de la función async.

## 2. Tipos de error nativos y cuándo aparece cada uno

### Idea clave

JavaScript tiene 7 tipos de error nativos que heredan de `Error`. Cada uno señala una categoría específica de fallo. Conocer cuál aparece en cada situación te ayuda a diagnosticar problemas más rápido.

### Tabla de tipos nativos

| Tipo | Cuándo aparece | Ejemplo típico |
|------|----------------|----------------|
| `Error` | Error genérico, base de todos los demás | `throw new Error("algo")` |
| `TypeError` | Operación sobre un tipo incorrecto | `null.foo`, `undefined()` |
| `RangeError` | Valor fuera de rango permitido | Stack overflow, `Array(-1)` |
| `SyntaxError` | Código sintácticamente inválido | `eval("var x =")` |
| `ReferenceError` | Variable no definida en el scope | `console.log(x)` donde x no existe |
| `URIError` | Mal uso de `decodeURI`/`encodeURI` | `decodeURIComponent("%")` |
| `EvalError` | Obsoleto (ya no se lanza en ES5+) | — |

### Ejemplos reales de cada tipo

```javascript
// TypeError: acceder a propiedad de null/undefined
let usuario = null
usuario.nombre  // TypeError: Cannot read properties of null (reading 'nombre')

// TypeError: llamar algo que no es función
const obj = {}
obj()  // TypeError: obj is not a function

// RangeError: recursión infinita (stack overflow)
function infinito() { return infinito() }
infinito()  // RangeError: Maximum call stack size exceeded

// RangeError: array con longitud inválida
new Array(-1)  // RangeError: Invalid array length

// SyntaxError: código inválido (solo en eval o parsing)
eval("const x =")  // SyntaxError: Unexpected end of input

// ReferenceError: variable no definida
console.log(variableInexistente)  // ReferenceError: variableInexistente is not defined

// URIError: mal uso de decodeURIComponent
decodeURIComponent("%")  // URIError: URI malformed
```

### Inspección de un objeto Error

```javascript
const error = new TypeError("Mensaje descriptivo")

// Propiedades estándar de todo Error:
error.name     // "TypeError" — el nombre del constructor
error.message  // "Mensaje descriptivo" — el mensaje pasado al constructor
error.stack    // "TypeError: Mensaje descriptivo\n    at ..." — traza de pila

// El stack NO es parte del estándar ECMAScript, pero todos los motores lo implementan.
// En V8 (Node.js/Chrome), el stack incluye el mensaje + las frames de llamada.
// En Node.js, puedes acceder al stack sin el mensaje con:
error.stack.split("\n").slice(1).join("\n")  // solo las frames
```

### Piensa críticamente

- ¿Por qué `SyntaxError` solo aparece en `eval()` o al parsear JSON inválido? Porque los errores de sintaxis en código fuente se detectan en tiempo de compilación, antes de ejecutar el código. Si tienes un `SyntaxError` en tu archivo `.js`, Node.js no arranca.
- ¿`ReferenceError` y `TypeError` se confunden? Sí: `let a = b` donde `b` no existe lanza `ReferenceError`, pero `let a = null; a.x` lanza `TypeError`. La diferencia es si la variable existe o no.
- ¿Los errores nativos se pueden extender? Sí: `class MiError extends TypeError {}` crea un subtipo que `instanceof TypeError` detecta.

## 3. `Error.cause` y encadenamiento de errores (ES2022+)

### Idea clave

Antes de ES2022, cuando atrapabas un error y lo relanzabas con un mensaje nuevo, perdías la causa original. `Error.cause` permite encadenar errores: el nuevo error lleva dentro el error original que lo provocó, preservando el stack trace y el contexto completo.

### El problema sin `Error.cause`

```javascript
async function obtenerUsuario(id) {
  try {
    const respuesta = await fetch(`/api/usuarios/${id}`)
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    return await respuesta.json()
  } catch (error) {
    // Relanzamos con un mensaje más descriptivo, pero PERDEMOS el error original
    throw new Error(`No se pudo obtener el usuario ${id}`)
    // El stack trace original de fetch se pierde
    // No sabemos si fue un error de red, un 404, o un timeout
  }
}
```

### La solución con `Error.cause`

```javascript
async function obtenerUsuario(id) {
  try {
    const respuesta = await fetch(`/api/usuarios/${id}`)
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    return await respuesta.json()
  } catch (error) {
    // El segundo argumento { cause } preserva el error original
    throw new Error(`No se pudo obtener el usuario ${id}`, { cause: error })
    // Ahora error.cause contiene el error original con su stack trace
  }
}

// En el nivel superior, podemos recorrer toda la cadena:
try {
  await obtenerUsuario(42)
} catch (error) {
  console.error(error.message)        // "No se pudo obtener el usuario 42"
  console.error(error.cause.message)   // "HTTP 404" o "fetch failed"
  console.error(error.cause.cause)     // Posible error de red subyacente
}
```

### Patrón: logging recursivo de la cadena de causas

```javascript
function logCadenaErrores(error, profundidad = 0) {
  const prefijo = "  ".repeat(profundidad)
  console.error(`${prefijo}→ ${error.name}: ${error.message}`)

  if (error.cause instanceof Error) {
    logCadenaErrores(error.cause, profundidad + 1)
  }
}

// Uso:
// → Error: No se pudo obtener el usuario 42
//   → Error: HTTP 404
//     → TypeError: fetch failed
```

### Cuándo usarlo

- Cuando traduces un error de bajo nivel (red, base de datos) a un error de dominio más claro.
- Cuando un error se propaga por múltiples capas (API → servicio → repositorio) y quieres preservar el contexto original.
- En librerías: el consumidor puede inspeccionar `error.cause` para decidir si reintentar, cachear o propagar.

### Piensa críticamente

- ¿`Error.cause` aparece en el stack trace automáticamente? No. El stack trace del nuevo error empieza donde se creó. `cause` es una propiedad separada que debes inspeccionar manualmente.
- ¿Se puede encadenar indefinidamente? Sí, pero en la práctica 2-3 niveles es suficiente para diagnosticar cualquier problema.
- ¿Todos los entornos soportan `cause`? Node.js 16.9+, Deno, Bun y todos los navegadores modernos. Los entornos antiguos ignoran el segundo argumento silenciosamente.

## 4. `Error.isError` — verificación fiable entre realms (ES2025+)

### Idea clave

`instanceof Error` puede fallar cuando un error viene de otro "realm" (iframe, worker, vm context). Cada realm tiene su propio constructor `Error`, y los objetos no comparten la cadena de prototipos entre realms. `Error.isError()` resuelve esto verificando si un valor es genuinamente un `Error` sin importar de qué realm proviene.

### El problema entre realms

```javascript
// En Node.js con worker_threads:
const { Worker } = require("worker_threads")

const worker = new Worker(`
  throw new Error("Error desde el worker")
`, { eval: true })

worker.on("error", (error) => {
  // 'error' fue creado en el worker, que tiene su propio Error constructor
  console.log(error instanceof Error)  // puede ser false en algunos entornos
  console.log(error.message)            // "Error desde el worker" (funciona)
  console.log(error.stack)              // funciona, pero instanceof no es fiable
})

// En navegadores con iframes:
const iframe = document.createElement("iframe")
document.body.appendChild(iframe)
const errorFromIframe = new iframe.contentWindow.Error("Error del iframe")

console.log(errorFromIframe instanceof Error)  // false — diferente constructor
console.log(errorFromIframe instanceof iframe.contentWindow.Error)  // true
```

### La solución con `Error.isError`

```javascript
// Error.isError verifica si un valor es un Error genuino,
// sin importar de qué realm proviene
console.log(Error.isError(new Error("test")))         // true
console.log(Error.isError(new TypeError("test")))      // true (hereda de Error)
console.log(Error.isError({ message: "falso" }))       // false
console.log(Error.isError(null))                       // false
console.log(Error.isError("string"))                   // false

// En el caso del worker:
worker.on("error", (error) => {
  console.log(Error.isError(error))  // true — fiable entre realms
})
```

### Estado de la propuesta

- `Error.isError` es parte de **ES2025** (Stage 4, finalizada).
- Disponible en Node.js 22+ y navegadores modernos (Chrome 131+, Firefox 137+).
- En entornos que no lo soportan, un polyfill simple: `const isError = (v) => v instanceof Error || (v && typeof v === "object" && v.name && v.message && v.stack)`.

### Piensa críticamente

- ¿Por qué no usar `typeof error === "object" && error instanceof Error`? Porque `instanceof` falla entre realms. `Error.isError` usa un mecanismo interno del motor que no depende de la cadena de prototipos.
- ¿`Error.isError` detecta subclases de Error? Sí. Si `class MiError extends Error {}`, entonces `Error.isError(new MiError())` devuelve `true`.
- ¿Se puede falsificar un Error que pase `Error.isError`? No fácilmente. La verificación usa el slot interno `**ErrorData**` del motor, que no es accesible desde JavaScript.

## 5. Jerarquías de error personalizadas

### Idea clave

En aplicaciones reales, un solo tipo de `Error` no basta. Necesitas distinguir entre un error de validación (que el cliente puede corregir), un error de autenticación (que requiere re-login) y un error de base de datos (que requiere reintentar). Las jerarquías de error personalizadas permiten esto.

### Patrón: jerarquía base

```javascript
// Clase base para todos los errores de la aplicación
class AppError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    // Necesario para que 'instanceof' funcione correctamente al extender Error
    this.name = this.constructor.name

    // Preservar la cadena de prototipos (necesario en algunos entornos)
    Object.setPrototypeOf(this, new.target.prototype)

    // Propiedades personalizadas
    this.codigo = options.codigo || "APP_ERROR"
    this.contexto = options.contexto || {}
    this.esOperacional = options.esOperacional ?? true  // true = error esperado, false = bug
  }
}

// Errores de dominio específicos
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
    this.esOperacional = false  // Errores de BD suelen ser bugs o problemas de infra
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

### Uso en un controlador Express

```javascript
async function handler(req, res) {
  try {
    const usuario = await buscarUsuario(req.params.id)
    if (!usuario) throw new NotFoundError("Usuario", req.params.id)

    if (!usuario.activo) throw new AuthError("Usuario inactivo")

    if (!req.body.email) throw new ValidationError("Email requerido", "email")

    res.json(usuario)
  } catch (error) {
    // Manejo centralizado según tipo de error
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
    // Error desconocido — probablemente un bug
    console.error("Error no manejado:", error)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
}
```

### Por qué `Object.setPrototypeOf(this, new.target.prototype)` es necesario

```javascript
// Sin esta línea, al extender Error en TypeScript/ES6 con algunos transpilers:
class MiError extends Error {
  constructor(message) {
    super(message)
    // Sin setPrototypeOf:
    // this.__proto__ apunta a Error.prototype en lugar de MiError.prototype
    // instanceof MiError falla
  }
}

const e = new MiError("test")
e instanceof MiError  // puede ser false sin setPrototypeOf
e instanceof Error     // true (siempre funciona)
```

### Piensa críticamente

- ¿Por qué separar errores operacionales de bugs? Los errores operacionales (validación, no encontrado, auth) son esperados y deben enviarse al cliente con un mensaje claro. Los bugs (TypeError inesperado, ReferenceError) no deben exponer detalles al cliente y deben loguearse para debugging.
- ¿Cuándo usar `error.codigo` en lugar de `instanceof`? Cuando los errores cruzan límites de proceso (microservicios, IPC). `instanceof` no funciona entre procesos, pero un código string (`"VALIDATION_ERROR"`) siempre se puede serializar.
- ¿Cuántos niveles de jerarquía son razonables? 2-3 máximo. Más niveles hacen el código difícil de mantener.

## 6. Estrategias de depuración en Node.js (`node --inspect`, breakpoints, sourcemaps)

### Idea clave

`console.log` es útil para debugging rápido, pero en producción o en bugs complejos necesitas herramientas más potentes. Node.js integra con Chrome DevTools a través del protocolo de inspección, permitiendo breakpoints, inspección de variables, watch expressions y profiling de CPU/memoria.

### Depuración con Chrome DevTools

```bash
# Iniciar Node.js en modo inspección
node --inspect server.js
# O pausar en la primera línea:
node --inspect-brk server.js

# Luego abrir chrome://inspect en Chrome y hacer clic en "inspect"
```

### Depuración programática con `debugger`

```javascript
function calcularTotal(items) {
  let total = 0

  for (const item of items) {
    // El motor pausa aquí si está en modo inspección
    debugger  // Pausa la ejecución — inspecciona variables en DevTools
    total += item.precio * item.cantidad
  }

  return total
}
```

### Sourcemaps en TypeScript y bundlers

```javascript
// Cuando usas TypeScript, el código que ejecuta Node.js es el .js compilado,
// no el .ts original. Los sourcemaps mapean el .js al .ts.

// tsconfig.json:
// { "compilerOptions": { "sourceMap": true } }

// Al compilar, se genera archivo.js + archivo.js.map
// Node.js usa el sourcemaps automáticamente con --inspect:
node --inspect dist/server.js

// El debugger muestra el código TypeScript original, no el compilado
```

### Inspección de memory leaks con heap snapshots

```bash
# 1. Iniciar en modo inspección
node --inspect server.js

# 2. Abrir chrome://inspect → inspect
# 3. Pestaña Memory → Take heap snapshot
# 4. Ejecutar la operación que sospechas que tiene un leak
# 5. Take another heap snapshot
# 6. Comparar: "Objects allocated between snapshot 1 and 2"
# 7. Si hay muchos objetos de un tipo que no se liberan, hay un leak
```

### Detección de memory leaks programáticamente

```javascript
const { writeHeapSnapshot } = require("node:v8")

// En un endpoint de diagnóstico o timer:
setInterval(() => {
  const used = process.memoryUsage()
  console.log({
    rss: `${(used.rss / 1024 / 1024).toFixed(1)} MB`,
    heapUsed: `${(used.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    heapTotal: `${(used.heapTotal / 1024 / 1024).toFixed(1)} MB`,
  })

  // Si heapUsed crece sin límite, tomar un snapshot para investigar
  if (used.heapUsed > 500 * 1024 * 1024) {  // 500 MB
    writeHeapSnapshot(`./heap-${Date.now}.heapsnapshot`)
  }
}, 60000)  // cada minuto
```

### Piensa críticamente

- ¿`console.log` vs `debugger`? `console.log` es más rápido para casos simples pero modifica el código y puede causar efectos secundarios en producción. `debugger` no afecta el código en producción (se ignora si no hay inspector) y permite inspección interactiva.
- ¿Los sourcemaps exponen el código fuente en producción? Sí, si los archivos `.map` son accesibles. En producción, sirve los sourcemaps en una ruta protegida o no los sirvas, pero manténlos para debugging.
- ¿Cuándo usar profiling de CPU en lugar de heap snapshots? Cuando la aplicación es lenta pero no tiene un leak de memoria. El CPU profile muestra dónde pasa el tiempo el motor.

## 7. Logging estructurado y observabilidad

### Idea clave

`console.log` no es suficiente en producción. Necesitas logs estructurados (JSON) que puedan ser buscados, filtrados y correlacionados por herramientas como Datadog, Grafana Loki o ELK. El logging estructurado convierte cada log en un evento con campos definidos.

### De console.log a logging estructurado

```javascript
// ❌ Mal: log no estructurado, difícil de buscar
console.log(`Usuario ${userId} compró ${producto} por ${precio}`)
// Salida: "Usuario 42 compró laptop por 1500"
// ¿Cómo buscas todos los errores de un usuario específico? No puedes.

// ✅ Bien: log estructurado en JSON
const log = {
  level: "info",
  timestamp: new Date().toISOString(),
  evento: "compra",
  usuarioId: userId,
  producto: producto,
  precio: precio,
  moneda: "COP",
  requestId: req.id  // Para correlacionar logs de la misma petición
}
console.log(JSON.stringify(log))
// Salida: {"level":"info","timestamp":"2026-07-21T15:00:00Z","evento":"compra",...}
// Ahora puedes filtrar por usuarioId, evento, level, etc.
```

### Logger estructurado con niveles

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

    // En producción: stdout en JSON para que lo recoja el sistema de logs
    // En desarrollo: formato legible
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

// Uso
const logger = new Logger("api-usuarios")

logger.info("Usuario creado", { usuarioId: 42, email: "david@ejemplo.com" })
logger.error("Error de base de datos", { operacion: "SELECT", tabla: "usuarios", error: error.message })
```

### Logging de errores con contexto

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
    // Log del error con todo el contexto necesario para diagnosticar
    logger.error("Petición fallida", {
      requestId,
      ruta: req.path,
      metodo: req.method,
      error: error.message,
      tipo: error.name,
      stack: error.stack,
      causa: error.cause?.message,  // Si hay Error.cause
      body: req.body,                // Cuidado con datos sensibles
    })

    res.status(500).json({ error: "Error interno", requestId })
  }
}
```

### Piensa críticamente

- ¿Qué campos no debes loguear? Contraseñas, tokens, datos personales sensibles (PII). Usa una función de redacción que elimine campos sensibles antes de loguear.
- ¿Niveles de log: cuándo usar cada uno? `debug` = solo desarrollo, `info` = eventos normales, `warn` = algo inusual pero no crítico, `error` = fallo que necesita atención, `fatal` = el proceso debe terminar.
- ¿Por qué `requestId` es importante? Porque en sistemas distribuidos, una petición puede generar logs en múltiples servicios. El `requestId` permite seguir la traza completa.

## 8. Captura de errores no manejados a nivel de proceso

### Idea clave

Cuando un error no es atrapado por ningún `try/catch`, llega al nivel de proceso. En Node.js, esto puede terminar el proceso. Capturar estos errores a nivel de proceso es tu última línea de defensa antes del crash.

### Eventos de proceso en Node.js

```javascript
// 1. Excepción síncrona no capturada
process.on("uncaughtException", (error) => {
  console.error("EXCEPCIÓN NO CAPTURADA:", error)
  // ⚠️ En producción, lo correcto es loguear y terminar el proceso.
  // Continuar después de un uncaughtException es peligroso porque el estado
  // de la aplicación puede ser inconsistente.
  // Usa un gestor de procesos (PM2, systemd) para reiniciar automáticamente.

  process.exit(1)  // Terminar con error
})

// 2. Promesa rechazada no manejada (async)
process.on("unhandledRejection", (razon, promesa) => {
  console.error("PROMESA RECHAZADA NO MANEJADA:", razon)
  // En Node.js 15+, unhandledRejection termina el proceso por defecto.
  // Puedes cambiar esto con --unhandled-rejections=warn (no recomendado en producción)
})

// 3. Señales del sistema operativo
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

### Patrón: shutdown grácil

```javascript
async function shutdownGracil(server, signal) {
  console.log(`${signal} recibido. Iniciando shutdown grácil...`)

  // 1. Dejar de aceptar nuevas conexiones
  server.close()

  // 2. Esperar a que las peticiones en curso terminen (con timeout)
  const timeout = setTimeout(() => {
    console.error("Timeout: forzando cierre")
    process.exit(1)
  }, 10000)  // 10 segundos

  // 3. Cerrar conexiones de base de datos
  await db.close()

  // 4. Cerrar otros recursos (colas, caches, etc.)
  await queue.close()

  clearTimeout(timeout)
  console.log("Shutdown completo")
  process.exit(0)
}

process.on("SIGTERM", () => shutdownGracil(server, "SIGTERM"))
process.on("SIGINT", () => shutdownGracil(server, "SIGINT"))
```

### ¿Por qué `uncaughtException` debe terminar el proceso?

```javascript
// Ejemplo del peligro de continuar después de un uncaughtException:
let cache = { usuarios: new Map() }

// Supongamos que un error corrompe la cache
process.on("uncaughtException", (error) => {
  console.error("Error:", error)
  // Si NO terminamos el proceso, la aplicación sigue funcionando
  // pero cache.usuarios podría estar en estado inconsistente
  // Las siguientes operaciones usarán datos corruptos sin saberlo
})

// En su lugar, loguear y salir:
process.on("uncaughtException", (error) => {
  console.error("Error fatal, terminando proceso:", error)
  process.exit(1)
  // El gestor de procesos (PM2, Docker, systemd) reiniciará la app
})
```

### Piensa críticamente

- ¿Por qué Node.js 15+ termina el proceso en `unhandledRejection`? Porque las promesas rechazadas no manejadas son bugs. En versiones anteriores, el proceso continuaba en estado potencialmente inconsistente.
- ¿`SIGTERM` vs `SIGKILL`? `SIGTERM` permite shutdown grácil (cerrar conexiones, guardar estado). `SIGKILL` mata el proceso inmediatamente sin oportunidad de cleanup. Docker envía `SIGTERM` y espera `--stop-timeout` (default 10s) antes de `SIGKILL`.
- ¿Se pueden recuperar de un `uncaughtException`? Técnicamente sí (con domains o zone.js), pero es peligroso. La práctica recomendada es loguear, salir y dejar que el gestor de procesos reinicie.

## 9. Patrones de manejo de errores en producción

### Idea clave

En producción, el manejo de errores no es solo atrapar excepciones. Es un sistema de capas que decide qué hacer con cada tipo de error: loguearlo, enviarlo al cliente, reintentar, circuit break o terminar el proceso.

### Patrón: middleware de errores en Express

```javascript
// Middleware de errores — debe tener 4 parámetros (err, req, res, next)
function errorHandler(err, req, res, next) {
  const logger = req.logger || console

  // Errores operacionales (esperados): enviar al cliente
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

  // Errores no operacionales (bugs): loguear y responder genérico
  logger.error("Error no manejado", {
    error: err.message,
    stack: err.stack,
    causa: err.cause?.message,
    ruta: req.path,
    metodo: req.method,
  })

  // Nunca enviar el stack trace al cliente en producción
  res.status(500).json({
    error: "Error interno del servidor",
    requestId: req.id,
  })
}

// Debe registrarse DESPUÉS de todas las rutas
app.use(errorHandler)
```

### Patrón: retry con backoff exponencial

```javascript
async function conRetry(fn, opciones = {}) {
  const {
    maxIntentos = 3,
    delayBase = 1000,        // 1 segundo inicial
    delayMax = 30000,         // 30 segundos máximo
    factor = 2,               // Multiplicador exponencial
    erroresReintentables = ["NETWORK_ERROR", "TIMEOUT", "DATABASE_ERROR"],
  } = opciones

  let ultimoError

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await fn(intento)
    } catch (error) {
      ultimoError = error

      // ¿Este error es reintentable?
      const esReintentable = erroresReintentables.includes(error.codigo)
      if (!esReintentable) throw error

      // ¿Es el último intento?
      if (intento === maxIntentos) {
        throw new Error(`Operación fallida después de ${maxIntentos} intentos`, {
          cause: error,
        })
      }

      // Calcular delay con backoff exponencial + jitter
      const delay = Math.min(delayBase * Math.pow(factor, intento - 1), delayMax)
      const jitter = Math.random() * 500  // Evita thundering herd
      await new Promise(resolve => setTimeout(resolve, delay + jitter))

      console.log(`Reintento ${intento + 1}/${maxIntentos} en ${delay}ms`)
    }
  }

  throw ultimoError
}

// Uso:
const resultado = await conRetry(
  () => fetch("https://api.ejemplo.com/datos"),
  { maxIntentos: 5, delayBase: 500 }
)
```

### Patrón: circuit breaker

```javascript
class CircuitBreaker {
  constructor(opciones = {}) {
    this.umbral = opciones.umbral || 5        // Fallos antes de abrir
    this.timeout = opciones.timeout || 60000  // Tiempo antes de half-open
    this.estado = "CLOSED"                     // CLOSED | OPEN | HALF_OPEN
    this.fallos = 0
    this.ultimaVezAbierto = null
  }

  async ejecutar(fn) {
    if (this.estado === "OPEN") {
      if (Date.now() - this.ultimaVezAbierto > this.timeout) {
        this.estado = "HALF_OPEN"  // Permitir un intento de prueba
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

// Uso: proteger llamadas a un servicio externo
const breaker = new CircuitBreaker({ umbral: 5, timeout: 30000 })

async function llamarApi() {
  return breaker.ejecutar(() => fetch("https://api-externa.com/datos"))
}
```

### Piensa críticamente

- ¿Por qué el jitter en el backoff exponencial? Sin jitter, si varios servicios fallan al mismo tiempo, todos reintentan al mismo tiempo (thundering herd). El jitter dispersa los reintentos.
- ¿Cuándo usar circuit breaker vs retry? Retry es para fallos transitorios (red, timeout). Circuit breaker es para servicios que pueden estar caídos por un rato — evita gastar recursos en peticiones que van a fallar.
- ¿El circuit breaker debe resetear automáticamente? Sí, con el estado HALF_OPEN: después del timeout, permite una petición de prueba. Si tiene éxito, cierra el circuit. Si falla, lo vuelve a abrir.

## Errores Comunes

### Mapa de depuración del capítulo

- Si ves `TypeError: Cannot read properties of null` → algo devolvió null/null donde esperabas un objeto. Revisa el origen del dato.
- Si ves `RangeError: Maximum call stack size exceeded` → recursión infinita o recursión sin caso base.
- Si ves `ReferenceError: x is not defined` → la variable no existe en el scope. Revisa si falta `import` o si hay un typo.
- Si un error se propaga sin contexto → usa `Error.cause` para preservar el error original.
- Si `instanceof Error` devuelve false para un error de un worker/iframe → usa `Error.isError`.
- Si la aplicación se cae sin explicación → revisa `uncaughtException` y `unhandledRejection` en los logs.
- Si la aplicación se vuelve lenta progresivamente → toma heap snapshots y busca memory leaks.
- Si los logs no son útiles → migra de `console.log` a logging estructurado con contexto.
- Si un servicio externo falla repetidamente → implementa circuit breaker.
- Si las peticiones a veces fallan y a veces no → implementa retry con backoff exponencial.

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Crear funciones con manejo de errores básico

**Ejercicio**: Crea una función `dividir` que tome dos números y devuelva el resultado. Debe manejar errores de división por cero y tipos no numéricos.

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa `try/catch` para manejar errores
2. Lanza errores descriptivos con `throw`
3. Usa `finally` para limpieza si es necesario

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

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
    throw error; // Re-lanzar para que el llamador maneje el error
  }
}

// Uso
try {
  console.log(dividir(10, 2));   // 5
  console.log(dividir(10, 0));   // Error: No se puede dividir por cero
  console.log(dividir('10', 2)); // Error: Ambos argumentos deben ser números
} catch (error) {
  console.log('Error capturado externamente:', error.message);
}
```

</details>


### Nivel Intermedio

**Objetivo**: Crear una jerarquía de errores personalizada

**Ejercicio**: Crea una clase base `ErrorAPI` y subclases para diferentes tipos de errores de API (autenticación, no encontrado, rate limit). Incluye `Error.cause` para preservar errores originales.

**Requisitos**:
1. `ErrorAPI` debe tener `codigo`, `mensaje`, `timestamp`
2. `ErrorAutenticacion` para errores 401
3. `ErrorNoEncontrado` para errores 404
4. `ErrorRateLimit` para errores 429
5. Todas deben soportar `Error.cause`

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Extiende de `Error` nativo
2. Usa `super()` con mensaje descriptivo
3. Establece `this.name` correctamente

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class ErrorAPI extends Error {
  constructor(mensaje, codigo, causa = null) {
    super(mensaje, { cause: causa });
    this.name = this.constructor.name;
    this.codigo = codigo;
    this.timestamp = new Date().toISOString();
    
    // Mantener el stack trace correcto
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

// Uso
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


### Nivel Avanzado

**Objetivo**: Implementar un sistema de logging estructurado con circuit breaker

**Ejercicio**: Crea un sistema de logging que:
1. Formatee mensajes en JSON con contexto (timestamp, nivel, servicio, requestId)
2. Integre un circuit breaker para servicios externos
3. Soporte diferentes destinos (consola, archivo, servicio externo)

**Especificaciones**:
1. Cada log debe incluir: timestamp, level, service, requestId, message, metadata
2. El circuit breaker debe tener estados: CLOSED, OPEN, HALF_OPEN
3. Soporte para redacción de datos sensibles (PII)

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa closures para mantener el contexto
2. Implementa el patrón State para el circuit breaker
3. Usa Proxy para interceptar writes y redactar datos

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
// Logger estructurado
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

// Uso
const logger = new LoggerEstructurado({
  servicio: 'mi-api',
  nivelMinimo: 'info',
  redactores: [
    (mensaje) => mensaje.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX') // Redactar SSN
  ]
});

const breaker = new CircuitBreaker({ umbral: 3, timeout: 10000 });

async function llamadaExterna() {
  return breaker.ejecutar(async () => {
    logger.info('Iniciando llamada externa', { requestId: '123' });
    // Simular llamada a API
    await new Promise(resolve => setTimeout(resolve, 100));
    return { datos: 'resultado' };
  });
}
```

</details>


---

## Pensamiento Crítico

### Problema 1: Errores en código asíncrono

**Situación**: Tienes una función asíncrona que maneja errores, pero algunos errores no se capturan correctamente.

**Preguntas guía**:
1. ¿Por qué `try/catch` no captura errores en callbacks no envueltos en promesas?
2. ¿Cómo manejas errores en `Promise.all` cuando una promesa falla?
3. ¿Qué estrategias usa Python para esto?

**Análisis**:
- **Problema**: Los callbacks tradicionales no integrados con promesas no son capturados por `try/catch` externo
- **Solución**: Envolver callbacks en promesas, usar `Promise.allSettled`, manejar errores en `.catch()`
- **Python**: Usa `asyncio.gather` con `return_exceptions=True` para manejar múltiples errores

```javascript
// ❌ Problema: forEach con async/await
const ids = [1, 2, 3];
try {
  ids.forEach(async (id) => {
    await procesar(id); // Error aquí no se captura externamente
  });
} catch (error) {
  console.log('Nunca se ejecuta'); // ❌
}

// ✅ Solución: for...of con try/catch
try {
  for (const id of ids) {
    await procesar(id); // Error aquí sí se captura
  }
} catch (error) {
  console.log('Error capturado:', error.message); // ✅
}

// ✅ Solución: Promise.all con manejo individual
const resultados = await Promise.allSettled(
  ids.map(id => procesar(id))
);

resultados.forEach((resultado, index) => {
  if (resultado.status === 'rejected') {
    console.error(`Error en ID ${ids[index]}:`, resultado.reason);
  }
});
```

### Problema 2: Logging en producción

**Situación**: Tu aplicación tiene logs, pero son inútiles para debugear problemas en producción.

**Preguntas guía**:
1. ¿Qué información debe incluir un log estructurado?
2. ¿Cómo balanceas detalle con rendimiento?
3. ¿Qué estrategias usa Python para logging en producción?

**Análisis**:
- **Información esencial**: Timestamp, nivel, servicio, requestId, mensaje, metadata contextual
- **Rendimiento**: Lazy evaluation, buffering, sampling en altas cargas
- **Python**: Usa `structlog` o `python-json-logger` para logging estructurado

```javascript
// ✅ Logging con contexto requestId para trazabilidad
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuid();
  req.logger = logger.child({ requestId: req.requestId });
  next();
});

// En controlador
async function obtenerUsuario(req, res) {
  req.logger.info('Iniciando obtención de usuario', { userId: req.params.id });
  
  try {
    const usuario = await usuarioService.obtener(req.params.id);
    req.logger.info('Usuario obtenido exitosamente', { userId: req.params.id });
    res.json(usuario);
  } catch (error) {
    req.logger.error('Error obteniendo usuario', { 
      userId: req.params.id, 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ error: 'Error interno' });
  }
}
```

---

## Conexión con Python

### Manejo de errores en Python

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
        raise  # Re-lanzar para que el llamador maneje el error
    finally:
        print("Operación de división completada")

# Uso
try:
    print(dividir(10, 2))   # 5.0
    print(dividir(10, 0))   # Error: No se puede dividir por cero
    print(dividir('10', 2)) # Error: Ambos argumentos deben ser números
except Exception as e:
    print(f"Error capturado externamente: {e}")
```

**Jerarquía de errores en Python**:
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

### Diferencias clave

| Aspecto | JavaScript | Python |
|---------|------------|--------|
| **Captura** | `try/catch` | `try/except` |
| ** finally** | Siempre se ejecuta | Siempre se ejecuta |
| **Re-lanzar** | `throw error` | `raise` |
| **Herencia** | `extends Error` | `class MiError(Exception)` |
| **Causa** | `Error.cause` (ES2022) | `raise ... from causa` (Python 3) |

### Cuándo usar cada uno

**JavaScript es mejor para**:
- Aplicaciones web con manejo de errores en tiempo real
- Frontend con errores de UI/UX
- APIs REST con códigos de estado HTTP

**Python es mejor para**:
- Scripts y automatización con manejo de errores robusto
- Data science con validación de datos
- Backend web con logging estructurado

---

## Resumen

1. **`try/catch/finally`** captura errores síncronos; `finally` se ejecuta siempre, pero `return` en `finally` traga errores
2. **Hay 7 tipos de error nativos**: `Error`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `URIError`, `EvalError`
3. **`Error.cause`** (ES2022) preserva la cadena de errores original al relanzar
4. **`Error.isError`** (ES2025) verifica errores de forma fiable entre realms (workers, iframes)
5. **Las jerarquías de error personalizadas** permiten manejo diferenciado por tipo
6. **`node --inspect`** + Chrome DevTools permite breakpoints, inspección de variables y heap snapshots
7. **El logging estructurado** (JSON) es esencial para observabilidad en producción
8. **`uncaughtException`** y `unhandledRejection` son la última línea de defensa; en producción, loguear y salir
9. **Patrones de producción**: middleware de errores, retry con backoff, circuit breaker, shutdown grácil
10. **Python maneja errores de forma similar** pero con sintaxis y convenciones diferentes

---

## Siguiente Capítulo

→ **[Capítulo 7: Patrones creacionales](./cap-07)**: Factory, Singleton y Builder, aplicados a JavaScript moderno.
