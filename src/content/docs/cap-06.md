---
title: "Capítulo 6: Manejo de errores y depuración"
---

# Capítulo 6: Manejo de errores y depuración

> El manejo de errores en JavaScript no es solo atrapar excepciones con `try/catch`.

## Introducción

En un entorno de producción (Node.js, Deno, Bun), los errores determinan si tu sistema se recupera o se cae. Este capítulo cubre el modelo de errores del lenguaje, la creación de jerarquías de error personalizadas, estrategias de depuración con `node --inspect`, logging estructurado, observabilidad y captura de errores no manejados a nivel de proceso.

**¿Por qué importa?** Porque un manejo de errores adecuado es la diferencia entre una aplicación que se recupera de problemas inesperados y una que falla catastroficamente. Al final del capítulo sabrás no solo *atrapar* errores, sino decidir qué hacer con cada uno según su naturaleza.

---

## 1. `try/catch/finally` y `throw` — el modelo básico

### El problema: un valor inválido en medio de la función vuelca todo el script

Sin manejo de errores, una sola llamada con datos malos detiene la ejecución en el lugar donde pasa — y el script entero se cae sin que sepas ni por qué ni dónde. JavaScript usa un modelo de excepciones síncrono: cuando lanzas un error con `throw`, el motor detiene la ejecución normal y busca el `catch` más cercano en la pila de llamadas. Si no encuentra ninguno, el error se propaga hasta el contexto global y, en Node.js, puede terminar el proceso. `finally` se ejecuta siempre — haya o no error — y es el lugar correcto para liberar recursos.

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

- ¿Por qué `return` en `finally` es peligroso? Porque traga errores silenciosamente: si el `try` lanza un error y el `finally` tiene `return`, el error desaparece sin ser capturado por ningún `catch` externo.
- ¿`catch` sin parámetro es válido? Sí, desde ES2019: `try { ... } catch { ... }` es válido cuando no necesitas el objeto de error.
- ¿Qué pasa si lanzas algo que no es un `Error`? `throw "algo"` funciona, pero pierdes el stack trace. Siempre lanza instancias de `Error`.

### Conexión con Python

Python usa el mismo trío, con un nombre distinto para el segundo:

```python
def procesar_pago(monto, metodo):
    if monto <= 0:
        raise ValueError("El monto debe ser un número positivo")
    return {"exito": True, "monto": monto, "metodo": metodo}

try:
    resultado = procesar_pago(-100, "tarjeta")
except ValueError as e:
    print(f"Error capturado: {e}")
finally:
    print("Limpieza siempre ejecutada")
```

**Traduce exactamente**: `try/catch/finally` ↔ `try/except/finally`; `throw` ↔ `raise`; `error.message` ↔ `str(e)` o `e.args`; el relanzado `throw error` ↔ `raise` a secas (re-lanza la excepción actual). En ambos, `finally` se ejecuta siempre.

**Cambia de fondo**: Python añade un bloque `else` que se ejecuta **solo si no hubo error** (no existe en JS: tendrías que ponerlo después del `try`). Además, Python captura excepciones por *tipo* (`except ValueError`), mientras que en JS el `catch` recibe todo y tú decides dentro. Y ojo: el gotcha de `return` en `finally` existe en ambos lenguajes — es una trampa del modelo, no un bug de JavaScript.

### Conexión con Java

Java también tiene `try/catch/finally`, más una pieza que JS no tiene:

```java
try {
    ProcesarPago.procesar(-100, "tarjeta");
} catch (IllegalArgumentException e) {
    System.out.println("Error capturado: " + e.getMessage());
} finally {
    System.out.println("Limpieza siempre ejecutada");
}

// try-with-resources: cierra el recurso automáticamente
try (Conexion c = new Conexion()) {
    c.usar();
}
```

**Traduce exactamente**: `try/catch/finally` y `throw` son el mismo verbo en Java; `catch (TypeError e)` captura por tipo como `catch (IllegalArgumentException e)`. El `finally` de tu ejemplo del pago (cerrar `conexion`) es exactamente lo que Java hace con *try-with-resources*: cerrar el recurso sin que tú escribas el `finally`.

**Cambia de fondo**: Java **obliga** al compilador a lidiar con las excepciones *checked* (declararlas con `throws` o capturarlas) — si no las manejas, el código no compila. JavaScript y Python dejan el manejo a tu criterio en runtime, que es más flexible pero más fácil de olvidar. Java tampoco tiene `catch` sin parámetro obligatorio: siempre necesitas el binding `catch (Exception e)`.

---

## 2. Tipos de error nativos y cuándo aparece cada uno

### El problema: el mismo mensaje de error aparece por motivos muy distintos

`TypeError` aparece tanto si accedes a `null.foo` como si llamas una variable que no es función; `ReferenceError` significa "esa variable no existe", no "esa variable falló". Si no distingues los tipos nativos, cada diagnóstico se vuelve adivinanza. La lista clásica tiene 7 tipos que heredan de `Error`; JS sumó un octavo en ES2021.

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
| `AggregateError` | Agrupa varias causas (ES2021) | `Promise.any` cuando todas fallan |

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

// AggregateError: Promise.any falla y agrupa todos los motivos
Promise.any([Promise.reject(new Error("a")), Promise.reject(new TypeError("b"))])
  .catch(e => e.errors)  // [Error: a, TypeError: b]
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

- ¿Por qué `SyntaxError` solo aparece en `eval()` o al parsear JSON inválido? Porque los errores de sintaxis en código fuente se detectan en tiempo de compilación, antes de ejecutar el código. Si tienes un `SyntaxError` en tu archivo `.js`, Node.js no arranca.
- ¿`ReferenceError` y `TypeError` se confunden? Sí: `let a = b` donde `b` no existe lanza `ReferenceError`, pero `let a = null; a.x` lanza `TypeError`. La diferencia es si la variable existe o no.
- ¿Los errores nativos se pueden extender? Sí: `class MiError extends TypeError {}` crea un subtipo que `instanceof TypeError` detecta.

### Conexión con Python

Python trae la misma idea, pero **con más grano fino**:

```python
try:
    dato = {"a": 1}
    print(dato["b"])          # KeyError
    print(int("x"))           # ValueError
except KeyError as e:
    print("Clave que no existe:", e)
except ValueError as e:
    print("Valor inválido:", e)
```

**Traduce exactamente**: `TypeError` ↔ `TypeError`; `RangeError` (stack overflow) ↔ `RecursionError`; el `RangeError` de valores ↔ `ValueError`/`IndexError`; capturar por tipo (`catch (TypeError e)`) ↔ `except TypeError as e`. Todos los errores nativos de JS están en la jerarquía de `Exception` de Python.

**Cambia de fondo**: Python distingue *acceso a diccionario inexistente* con `KeyError`, algo que JS resuelve devolviendo `undefined` — en JS "la clave no existe" rara vez lanza. Y Python organiza la entrada: `BaseException` (de donde sale `KeyboardInterrupt`, que casi nunca debes capturar) separada de `Exception` (lo que de verdad capturas). En JS, cualquier cosa que lances cae en `catch`, sí o sí, y siempre captura.

### Conexión con Java

Java tiene decenas de excepciones nativas y una jerarquía con una división que JS no tiene:

```java
Integer.parseInt("x");              // NumberFormatException (RuntimeException)
int[] arr = new int[3]; arr[9];     // ArrayIndexOutOfBoundsException
String s = null; s.length();        // NullPointerException
```

**Traduce exactamente**: `TypeError` por `null.foo` ↔ `NullPointerException`; `RangeError` por índice fuera de rango ↔ `IndexOutOfBoundsException`; `TypeError` por tipo inesperado ↔ `ClassCastException`/`NumberFormatException`. Son el mismo diagnóstico con otro nombre.

**Cambia de fondo**: Java separa las excepciones en *checked* (obligatorias de declarar) y *unchecked* (`RuntimeException` y sus hijas, opcionales). Los `TypeError`/`RangeError` de JS serían *unchecked* en Java. Además, Java reporta el stack trace en la salida estándar con el detalle de *cada* frame (clase, método, línea), mientras que el `stack` de JS es una propiedad no estándar del objeto — más débil por contrato, aunque hoy la implementa todo el mundo.

---

## 3. `Error.cause` y encadenamiento de errores (ES2022+)

### El problema: al relanzar con un mensaje más claro, el error original se pierde

Cuando un módulo interno falla y la capa superior relanza con su propio mensaje, el error original — el `TypeError` de red, el `HTTPS 404` — desaparece de la traza. En producción te quedas sabiendo *qué* falló (el mensaje nuevo) pero no *por qué* (la causa). `Error.cause` (ES2022) resuelve eso: el nuevo error lleva dentro el error original que lo provocó, preservando el contexto completo.

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

- ¿`Error.cause` aparece en el stack trace automáticamente? No. El stack trace del nuevo error empieza donde se creó. `cause` es una propiedad separada que debes inspeccionar manualmente.
- ¿Se puede encadenar indefinidamente? Sí, pero en la práctica 2-3 niveles es suficiente para diagnosticar cualquier problema.
- ¿Todos los entornos soportan `cause`? Node.js 16.9+, Deno, Bun y todos los navegadores modernos. Los entornos antiguos ignoran el segundo argumento silenciosamente.

### Conexión con Python

Python encadena excepciones desde 2003, con una palabra clave dedicada:

```python
def obtener_usuario(id):
    try:
        respuesta = fetch(f"/api/usuarios/{id}")
    except NetworkError as e:
        raise ValueError(f"No se pudo obtener el usuario {id}") from e
        # e queda disponible como __cause__ del nuevo error
```

**Traduce exactamente**: `throw new Error(msg, { cause: error })` ↔ `raise ValueError(msg) from error`. Para recorrer la cadena: seguir `error.cause` en JS ↔ seguir `e.__cause__` (y `e.__context__`) en Python. Relanzar sin perder la causa (con `raise` a secas) también existe en ambos.

**Cambia de fondo**: en Python la cadena se arma **también de forma implícita**: si relanzas dentro de un `except` sin `from`, Python guarda el contexto en `__context__` igualmente. En JS la causa es **solo explícita**: si no pasas `{ cause }`, se pierde sí o sí. Además, en Python `raise ... from None` *suprime* la causa a propósito; en JS el equivalente es relanzar sin el segundo argumento.

### Conexión con Java

Java encadena causas desde el JDK 1.4, tan instalado que rara vez se discute:

```java
try {
    fetchUsuario(id);
} catch (IOException e) {
    throw new ApiException("No se pudo obtener el usuario " + id, e);
    // 'e' queda como causa; e.getCause() la recupera
}
```

**Traduce exactamente**: `new Error(msg, { cause })` ↔ `new ApiException(msg, e)` — el constructor con causa es un estándar en Java. Recorrer la cadena: `error.cause` ↔ `e.getCause()`, o `ExceptionUtils.getRootCause(e)` (Apache Commons) para saltar directo a la raíz.

**Cambia de fondo**: en Java el encadenamiento es **obligatorio en la práctica** para que el stack trace completo haga sentido (cada `printStackTrace()` muestra cause tras cause), mientras que en JS fue una propiedad opcional que llegó en ES2022. Pero Java solo preserva la causa si el constructor de tu excepción la recibe (igual que JS), y en JS los `cause` se serializan mal a JSON — en Java tampoco viajan solos; en ambos el log estructurado es el que documenta la cadena para el sistema de observabilidad.

---

## 4. `Error.isError` — verificación fiable entre realms (ES2026+)

### El problema: `instanceof Error` miente cuando el error viene de otro realm

`instanceof Error` puede fallar cuando un error viene de otro "realm" (iframe, worker, vm context). Cada realm tiene su propio constructor `Error`, y los objetos no comparten la cadena de prototipos entre realms. `Error.isError()` resuelve esto verificando si un valor es genuinamente un `Error` sin importar de qué realm proviene — es el mismo truco de marca interna que `Array.isArray`.

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
console.log(Error.isError(new AggregateError([], ""))) // true
console.log(Error.isError({ message: "falso" }))       // false
console.log(Error.isError(null))                       // false
console.log(Error.isError("string"))                   // false

// Extra: un falso Error que imita el prototipo NO pasa la verificación
console.log(Error.isError({ __proto__: Error.prototype }))  // false

// En el caso del worker:
worker.on("error", (error) => {
  console.log(Error.isError(error))  // true — fiable entre realms
})
```

### Estado de la propuesta

- `Error.isError` es parte de **ES2026** (alcanzó Stage 4 en mayo de 2025; la especificación se publicó en la edición de junio de 2026).
- Disponible en **Node.js 24+** y navegadores modernos (**Chrome 134+, Edge 134+, Firefox 138+**). Safari tiene soporte solo parcial. Los entornos antiguos simplemente no tienen la función.
- Detalle útil: `Error.isError(new DOMException())` devuelve `true` — los `DOMException` se tratan como errores a efectos de la verificación.
- Si necesitas soportar entornos antiguos, una **aproximación heurística** (no exacta): `const isError = (v) => v instanceof Error || (v && typeof v === "object" && v.name && v.message && v.stack)`. Sirve para la mayoría de casos, pero puede dar falsos positivos con objetos que "parecen" errores.

- ¿Por qué no usar `typeof error === "object" && error instanceof Error`? Porque `instanceof` falla entre realms. `Error.isError` usa una marca interna del motor (`[[ErrorData]]`), un slot privado que el constructor `Error` inicializa y que no depende de la cadena de prototipos.
- ¿`Error.isError` detecta subclases de Error? Sí. Si `class MiError extends Error {}`, entonces `Error.isError(new MiError())` devuelve `true`.
- ¿Se puede falsificar un Error que pase `Error.isError`? No fácilmente. La verificación usa el slot interno `[[ErrorData]]` del motor, que no es accesible desde JavaScript — un objeto normal no tiene cómo marcarlo.

### Conexión con Python

Python no tiene un equivalente directo, porque su arquitectura no crea el problema:

```python
import concurrent.futures as cf

def tarea():
    raise ValueError("boom")

with cf.ThreadPoolExecutor() as pool:
    fut = pool.submit(tarea)
    try:
        fut.result()
    except ValueError as e:
        print("Es una excepción:", isinstance(e, ValueError))  # True
```

**Traduce exactamente**: no hay correspondencia sintáctica. El gesto conceptual es `isinstance(e, Exception)` — verificar que lo capturado es de verdad una excepción.

**Cambia de fondo**: en Python no hay *realms*: `isinstance(e, ValueError)` funciona aunque la excepción venga de `concurrent.futures`, de un hilo o de una librería compilada en C. El problema que `Error.isError` resuelve es **físicamente inexistente** en Python — en JS sí existe porque workers, iframes y `vm.createContext` crean constructores distintos por cada entorno.

### Conexión con Java

Java tampoco necesita el equivalente, pero comparte la reflexión interna:

```java
Throwable e = ...;
if (e instanceof RuntimeException) {   // verificación por tipo, siempre local
  ...
}
```

**Traduce exactamente**: `Error.isError(x)` ↔ `x instanceof Throwable` — el análogo de "¿es verdaderamente un error?, y si lo es, de qué familia".

**Cambia de fondo**: en Java el *classloader* puede crear dos clases `MiError` distintas en dos cargas, pero en la práctica `instanceof Throwable` funciona en el 99% de los casos; la verificación fiable de "es un error" es parte del lenguaje porque `Throwable` es una clase real con herencia real. En JS el prototipo de los errores es *otra* pieza que cada realm duplica, así que `instanceof` dejó de ser fiable y el estándar tuvo que añadir `Error.isError` (ES2026) para recuperar la garantía que Java tiene desde los 90.

---

## 5. Jerarquías de error personalizadas

### El problema: un solo tipo de `Error` no dice ni quién puede arreglarlo ni qué hacer con él

En aplicaciones reales, un solo tipo de `Error` no basta. Necesitas distinguir entre un error de validación (que el cliente puede corregir), un error de autenticación (que requiere re-login) y un error de base de datos (que requiere reintentar). Las jerarquías de error personalizadas permiten capturar por tipo y responder distinto a cada caso.

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

- ¿Por qué separar errores operacionales de bugs? Los errores operacionales (validación, no encontrado, auth) son esperados y deben enviarse al cliente con un mensaje claro. Los bugs (TypeError inesperado, ReferenceError) no deben exponer detalles al cliente y deben loguearse para debugging.
- ¿Cuándo usar `error.codigo` en lugar de `instanceof`? Cuando los errores cruzan límites de proceso (microservicios, IPC). `instanceof` no funciona entre procesos, pero un código string (`"VALIDATION_ERROR"`) siempre se puede serializar.
- ¿Cuántos niveles de jerarquía son razonables? 2-3 máximo. Más niveles hacen el código difícil de mantener.

### Conexión con Python

Python hace lo mismo con la herencia de `Exception` — y su `raise` captura por el orden correcto de la jerarquía:

```python
class ErrorAPI(Exception):
    def __init__(self, mensaje, codigo, causa=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.causa = causa          # o usar 'raise ... from causa' fuera

class ErrorAutenticacion(ErrorAPI):
    def __init__(self, mensaje="No autenticado", causa=None):
        super().__init__(mensaje, 401, causa)

try:
    raise ErrorAutenticacion("Token expirado")
except ErrorAutenticacion as e:
    print("401:", e.codigo)
except ErrorAPI as e:               # la base captura lo que las hijas no atraparon
    print("Otro error de API:", e.codigo)
```

**Traduce exactamente**: `class X extends Error` ↔ `class X(Exception)`; `class X extends AppError` ↔ `class X(ErrorAPI)`. El `catch` que discrimina por tipo (`if (error instanceof ValidationError)`) ya viene en Python como `except ValidationError:` — la sintaxis decide que las subclases se capturan por su tipo desde siempre.

**Cambia de fondo**: en Python `super().__init__(mensaje)` solo guarda el mensaje, y para *contexto* adicional (como tu `codigo` o `campo`) usas atributos propios — igual que en JS. La diferencia: en Python el `raise ... from` deja la causa *seriada* (la excepción anterior queda viva en el traceback), mientras que en JS pasarla por `{ cause }` es opcional y olvidarla es fácil. Además en Python capturar *en orden* es relevante: `except ErrorAutenticacion` debe ir **antes** que `except ErrorAPI`; en JS no hay orden, cada `instanceof` se evalúa por separado.

### Conexión con Java

Java fue quien hizo famoso el patrón de *jerarquías* de excepciones:

```java
class ErrorAPI extends RuntimeException {
    private final int codigo;
    ErrorAPI(String mensaje, int codigo) { super(mensaje); this.codigo = codigo; }
    public int getCodigo() { return codigo; }
}

class ErrorAutenticacion extends ErrorAPI {
    ErrorAutenticacion(String mensaje) { super(mensaje, 401); }
}

try {
    throw new ErrorAutenticacion("Token expirado");
} catch (ErrorAutenticacion e) {
    System.out.println("401: " + e.getCodigo());
} catch (ErrorAPI e) {
    System.out.println("Otro error de API: " + e.getCodigo());
}
```

**Traduce exactamente**: la herencia es el mismo verbo (`extends` en ambos); `error.codigo` ↔ `e.getCodigo()` (atributo + getter); el handler por tipo de Express es exactamente el `catch (ErrorAutenticacion e)` de Java.

**Cambia de fondo**: en Java, si tus errores *checked* (no `RuntimeException`) atraviesan capas, cada método debe declararlos (`throws ErrorAPI`) o el compilador falla — a cambio, saber qué requiere manejo es explícito. En JS y Python, la jerarquía es pura política de runtime: nadie te obliga, técnicamente puedes capturar "todo". El esqueleto `EsOperacional`/`esOperacional` de la sección es la adaptación JS de la distinción que en Java ya está implícita en checked vs. unchecked.

---

## 6. Estrategias de depuración en Node.js (`node --inspect`, breakpoints, sourcemaps)

### El problema: `console.log` no dice ni dónde ni por qué

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
    writeHeapSnapshot(`./heap-${Date.now()}.heapsnapshot`)
  }
}, 60000)  // cada minuto
```

- ¿`console.log` vs `debugger`? `console.log` es más rápido para casos simples pero modifica el código y puede causar efectos secundarios en producción. `debugger` no afecta el código en producción (se ignora si no hay inspector) y permite inspección interactiva.
- ¿Los sourcemaps exponen el código fuente en producción? Sí, si los archivos `.map` son accesibles. En producción, sirve los sourcemaps en una ruta protegida o no los sirvas, pero manténlos para debugging.
- ¿Cuándo usar profiling de CPU en lugar de heap snapshots? Cuando la aplicación es lenta pero no tiene un leak de memoria. El CPU profile muestra dónde pasa el tiempo el motor.

### Conexión con Python

Python tiene su depurador de toda la vida, más la función `breakpoint()` (Python 3.7+):

```python
def calcular_total(items):
    total = 0
    for item in items:
        breakpoint()          # equivale a `import pdb; pdb.set_trace()`
        total += item["precio"] * item["cantidad"]
    return total

# Consola interactiva de pdb: (Pdb) total, (Pdb) item, (Pdb) n  # siguiente
```

**Traduce exactamente**: `node --inspect-brk` ↔ `python -m pdb script.py` o `breakpoint()`; el `debugger;` de JS ↔ `breakpoint()`. Ver inspección en DevTools ↔ la consola interactiva de `pdb`, y en los casos simples un `python -m trace`/`logging` cumple el papel de `console.log`.

**Cambia de fondo**: Node te da un depurador **gráfico** (Chrome DevTools) por el protocolo de inspección; Python por defecto te da `pdb`, de texto puro (los IDEs añaden lo gráfico encima). JavaScript compilado (TypeScript) necesita **sourcemaps** para mostrar el código original; Python ejecuta tu fuente directamente, así que el debugger siempre ve lo que escribiste — el análogo de "sourcemap" en Python solo existe para extensiones en C compiladas.

### Conexión con Java

Java depura desde siempre gracias a que el bytecode guarda metadatos de depuración:

```bash
# JVM con depuración remota (el análogo de node --inspect)
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 MiApp
# Luego te conectas con un IDE (IntelliJ, Eclipse) por JDWP
```

**Traduce exactamente**: `node --inspect` (protocolo de inspección) ↔ harness de JDWP (`-agentlib:jdwp`); los breakpoints y watch expressions en DevTools ↔ los mismos botones en IntelliJ; el heap snapshot de DevTools ↔ el **JFR**/`jmap` o MAT para memoria.

**Cambia de fondo**: Java compila a bytecode e incrusta el *debug info* (tabla de líneas fuente) en el `.class`: el IDE te muestra la clase original sin necesidad de sourcemaps. JavaScript pierde ese vínculo al compilar, y lo recupera con los `.map`. Además, en Java el profiling (JFR) viene de serie y es de bajo costo; en Node los CPU profiles los importas en DevTools igual que los heap snapshots — mismo gesto, motor distinto.

---

## 7. Logging estructurado y observabilidad

### El problema: un log sin estructura no se puede buscar ni correlacionar

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

try {
  throw new Error("ECONNREFUSED")
} catch (error) {
  logger.error("Error de base de datos", { operacion: "SELECT", tabla: "usuarios", error: error.message })
}
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

- ¿Qué campos no debes loguear? Contraseñas, tokens, datos personales sensibles (PII). Usa una función de redacción que elimine campos sensibles antes de loguear.
- ¿Niveles de log: cuándo usar cada uno? `debug` = solo desarrollo, `info` = eventos normales, `warn` = algo inusual pero no crítico, `error` = fallo que necesita atención, `fatal` = el proceso debe terminar.
- ¿Por qué `requestId` es importante? Porque en sistemas distribuidos, una petición puede generar logs en múltiples servicios. El `requestId` permite seguir la traza completa.

### Conexión con Python

Python tiene logging **en la librería estándar**, con verbosidad y handlers con los mismos nombres:

```python
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("api-usuarios")
log.info("Usuario creado", extra={"usuario_id": 42})
log.error("Error de base de datos", exc_info=True)   # añade el traceback

# JSON estructurado: estructurar como en la sección necesita un formateador
import json, logging

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname.lower(),
            "timestamp": self.formatTime(record),
            "message": record.getMessage(),
            **record.__dict__.get("extra_data", {}),
        })
```

**Traduce exactamente**: los niveles `debug/info/warn/error/fatal` ↔ `logging.debug/info/warning/error/critical`; el logger por servicio (`new Logger("api-usuarios")`) ↔ `logging.getLogger("api-usuarios")`; el JSON estructurado ↔ un `Formatter` JSON (`structlog` si quieres la experiencia completa con pipelines de redacción).

**Cambia de fondo**: en Python, el logging **es estándar**: niveles, jerarquía de loggers, rotación de archivos y envíos a múltiples destinos vienen gratis. JavaScript no tiene logger en la librería estándar: `console.*` y a elegir entre `pino`, `winston` u otros. El `extra={...}` de Python es el primo del `{ ...contexto }` de tu `Logger`; y `exc_info=True` loguea el traceback completo con la causa, el equivalente de loguear `error.stack` + `error.cause` a mano.

### Conexión con Java

Java tiene el ecosistema de logging más maduro de los tres — y el inventor del patrón `requestId`:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

Logger log = LoggerFactory.getLogger("api-usuarios");
MDC.put("requestId", requestId);      // MDC = Mapped Diagnostic Context
try {
    log.info("Petición recibida");
} catch (Exception e) {
    log.error("Petición fallida", e);  // SLF4J añade el stack trace + la causa
} finally {
    MDC.remove("requestId");
}
```

**Traduce exactamente**: `new Logger("api")` ↔ `LoggerFactory.getLogger("api")`; los niveles ↔ los mismos niveles SLF4J/Logback; loguear `{ requestId, ... }` ← es exactamente lo que hace el **MDC** de SLF4J, excepto que tu `requestId` viaja como campo del JSON y el de MDC como un valor de thread que cualquier log del hilo hereda.

**Cambia de fondo**: Java separa *API* (`SLF4J`) de *implementación* (`Logback`, `Log4j2`), así que tu código no depende del backend de logs — en JS la elección (`pino`, `winston`) se hace en cada proyecto y los marcos como NestJS la inyectan. El MDC es el antepasado directo de tu `requestId` explícito: en Java el contexto de la petición viaja *en el hilo*; en JS el hilo no existe (misma pila para todo), así que el `requestId` se pasa a mano como argumento — el patrón `AsyncLocalStorage` de Node intenta recuperar esa comodidad del hilo para contextos async.

---

## 8. Captura de errores no manejados a nivel de proceso

### El problema: el error que nadie atrapó decide si tu proceso vive o muere

Cuando un error no es atrapado por ningún `try/catch`, llega al nivel de proceso. En Node.js, esto puede terminar el proceso. Capturar estos errores a nivel de proceso es tu última línea de defensa antes del crash — y hay que decidir con cabeza fría si seguir o morir.

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

- ¿Por qué Node.js 15+ termina el proceso en `unhandledRejection`? Porque las promesas rechazadas no manejadas son bugs. En versiones anteriores, el proceso continuaba en estado potencialmente inconsistente.
- ¿`SIGTERM` vs `SIGKILL`? `SIGTERM` permite shutdown grácil (cerrar conexiones, guardar estado). `SIGKILL` mata el proceso inmediatamente sin oportunidad de cleanup. Docker envía `SIGTERM` y espera `--stop-timeout` (default 10s) antes de `SIGKILL`.
- ¿Se pueden recuperar de un `uncaughtException`? Técnicamente sí (con domains o zone.js), pero es peligroso. La práctica recomendada es loguear, salir y dejar que el gestor de procesos reinicie.

### Conexión con Python

Python atrapa lo no capturado en la puerta de salida:

```python
import sys, signal, asyncio

def crash_hook(exc_type, exc, tb):
    print("EXCEPCIÓN NO CAPTURADA:", exc)

sys.excepthook = crash_hook          # ↔ process.on("uncaughtException")

def cerrar(*args):
    print("SIGTERM/SIGINT recibido — cerrando grácilmente...")
    sys.exit(0)

signal.signal(signal.SIGTERM, cerrar)  # ↔ process.on("SIGTERM")
signal.signal(signal.SIGINT, cerrar)   # ↔ process.on("SIGINT")
```

**Traduce exactamente**: `process.on("uncaughtException")` ↔ `sys.excepthook`; `process.on("SIGTERM"/"SIGINT")` ↔ `signal.signal(...)`; la rutina de shutdown grácil ↔ un handler de señal que cierra recursos y sale. `Process` ↔ runtime de Python corriendo tu script.

**Cambia de fondo**: en Node, una excepción no capturada **mata el proceso por defecto**; en Python también termina (imprime el traceback y el proceso sale con código distinto de cero en la mayoría de los eventos). La gran diferencia: el `unhandledRejection` de JS no tiene análogo en Python — un `await` que lanza es una excepción normal que pasa por `try/except`; no existe un estado de "promesa abandonada". Y en Python, gracias a `asyncio`, el cierre grácil de un servidor async suele ser el gesto de `await server.stop()` bien cubierto, no un handler frágil a mano.

### Conexión con Java

La JVM también cede sus "líneas de defensa" al programador:

```java
Thread.setDefaultUncaughtExceptionHandler((thread, e) -> {
    System.err.println("EXCEPCIÓN NO CAPTURADA en " + thread.getName());
    System.exit(1);
});

Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    System.out.println("Apagando: cerrando recursos...");
    // ↔ tu shutdown grácil: server.close(), db.close(), etc.
}));
```

**Traduce exactamente**: `process.on("uncaughtException")` ↔ `Thread.setDefaultUncaughtExceptionHandler`; el shutdown grácil con señales ↔ un **shutdown hook** (`addShutdownHook`). El gestor verbo `server.close()` y `db.close()` cabe verbatim en el cuerpo del hook.

**Cambia de fondo**: en Java, un error no capturado en un hilo **no** mata el proceso entero por defecto — el hilo muere y los demás siguen (peligro sutil); en Node, el modelo de un solo hilo hace que `uncaughtException` sí tumbe el proceso, que es más honesto pero más dramático. Los shutdown hooks de la JVM corren cuando el proceso se apaga por cualquier vía *natural*; en Node los handlers de `SIGTERM/SIGINT` son tuyos solos, y `SIGKILL` igual mata sin avisar en ambos mundos.

---

## 9. Patrones de manejo de errores en producción

### El problema: cada tipo de error necesita una respuesta distinta

En producción, el manejo de errores no es solo atrapar excepciones. Es un sistema de capas que decide qué hacer con cada tipo de error: loguearlo, enviarlo al cliente, reintentar, abrir el circuito o terminar el proceso.

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

- ¿Por qué el jitter en el backoff exponencial? Sin jitter, si varios servicios fallan al mismo tiempo, todos reintentan al mismo tiempo (thundering herd). El jitter dispersa los reintentos.
- ¿Cuándo usar circuit breaker vs retry? Retry es para fallos transitorios (red, timeout). Circuit breaker es para servicios que pueden estar caídos por un rato — evita gastar recursos en peticiones que van a fallar.
- ¿El circuit breaker debe resetear automáticamente? Sí, con el estado HALF_OPEN: después del timeout, permite una petición de prueba. Si tiene éxito, cierra el circuit. Si falla, lo vuelve a abrir.

### Conexión con Python

Python tiene la librería *tenacity* que declara retry y backoff en un decorador:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=30),
    retry_on_exception=lambda e: getattr(e, "reintentable", False),
)
def obtener_datos():
    return fetch("https://api.ejemplo.com/datos")
```

**Traduce exactamente**: tu `conRetry(fn, { maxIntentos: 3, delayBase: 1000, delayMax: 30000 })` ↔ `@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=30))`. El jitter en el "equivalente estricto" se activa con `wait_random_exponential`; para circuit breakers en Python baja a librerías de resiliencia (poco estándares) o a tu propia clase como en JS.

**Cambia de fondo**: en Python el retry con backoff es una **decisión declarativa** de un decorador estándar de facto; en JS lo normal es escribirlo a mano (o traer `p-retry`/`bottleneck`). La lógica es la misma — por eso este capítulo la enseña a pelo: si la implementaste una vez, leer `tenacity` o `p-retry` es leer tu propio código con una firma declarativa.

### Conexión con Java

Java tiene estos patrones **industrializados** en *Resilience4j*:

```java
Retry retryPolicy = Retry.ofDefaults("api");
CircuitBreaker cb = CircuitBreaker.ofDefaults("api-externa");

// Componer: reintentar CON circuito abierto
Supplier<String> call = () -> llamarApi();
Supplier<String> guarded = CircuitBreaker.decorateSupplier(cb, call);
Supplier<String> retried = Retry.decorateSupplier(retryPolicy, guarded);
String resultado = retried.get();
```

**Traduce exactamente**: tu `conRetry` ↔ `Retry.ofDefaults`, con backoff configurado (`RetryConfig`) y `exponentialWait`; tu `CircuitBreaker` ↔ `CircuitBreaker.ofDefaults`, con estados CLOSED/OPEN/HALF_OPEN y `countFailure`/`waitDurationInOpenState`. El patrón de "envolver la propia función" (`breaker.ejecutar(() => ...)`) ↔ los *decorators* `Retry.decorateSupplier`/`CircuitBreaker.decorateSupplier`.

**Cambia de fondo**: Resilience4j viene con métricas, eventos y *fallback* (`Recover`) integrados — es un ciudadano de primera clase en gradle/maven. En JS no existe el equivalente estándar: las apps grandes lo montan a mano (como los ejemplos de este capítulo) o con librerías parciales. Pero la matemática del estado (umbral, timeout, HALF_OPEN) es idéntica: si entendiste tu `CircuitBreaker` de 50 líneas, entiendes Resilience4j entero.

---

## Práctica y ejercicios

Intenta resolver cada desafío mentalmente o en código **antes** de abrir las soluciones desplegables.

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Qué garantiza `finally`? ¿Y qué pasa si dentro de `finally` hay un `return`?</b></summary>

**Explicación**: `finally` se ejecuta **siempre**, haya o no error, y ahí es donde liberas recursos (cerrar conexión, limpiar timers). Pero si `finally` tiene `return` (o `throw`), **anula** lo que el `try` tenía preparado: el `return 42` del `try` pasa a ser el `return 0` del `finally`, y un `throw` de `try` queda tragado sin llegar a ningún `catch`. Por eso, jamás pongas `return` en `finally`.
</details>

<details>
<summary><b>2. ¿Cuál es la diferencia entre `ReferenceError` y `TypeError`? Da un ejemplo de cada uno.</b></summary>

**Explicación**: `ReferenceError` significa que la variable **no existe** en el scope (`console.log(x)` con `x` sin declarar). `TypeError` significa que la variable existe pero la operación es inválida sobre su tipo (`null.foo` — acceder a propiedad de `null`/`undefined`; `obj()` — llamar algo que no es función). Diagnóstico rápido: si el error dice "is not defined" es `ReferenceError`; si dice "cannot read properties of null" o "is not a function", es `TypeError`.
</details>

<details>
<summary><b>3. Al relanzar un error con un mensaje nuevo, ¿qué pierdes si no usas `Error.cause`?</b></summary>

**Explicación**: Pierdes el **error original**: su `message` (¿fue un 404, un timeout o un error de red?) y su `stack` (¿dónde realmente falló?). El mensaje nuevo te dice *qué* falleció (capa superior), pero sin `cause` te quedas sin el *por qué real*, y en producción eso es la diferencia entre arreglar el problema del producto o arreglar un síntoma.
</details>

<details>
<summary><b>4. ¿Por qué `instanceof Error` puede devolver `false` para un error de un worker, y cómo lo arregla `Error.isError`?</b></summary>

**Explicación**: Porque cada `realm` (worker, iframe, contexto `vm`) tiene su **propio** constructor `Error`. El objeto viene del realm del worker, así que su cadena de prototipos no pasa por `Error.prototype` *de tu mundo*. `Error.isError` no mira la cadena de prototipos: hace una verificación por marca interna del motor (slot `[[ErrorData]]`) que el `Error` constructor deja al crear la instancia — por eso responde `true` venga de donde venga (ES2026, Node 24+).
</details>

<details>
<summary><b>5. ¿Por qué la recomendación de producción es terminar el proceso en `uncaughtException` en vez de seguir?</b></summary>

**Explicación**: Porque una excepción no capturada puede haber dejado el estado **inconsistente** (una caché a medias, una transacción a medias, estructuras corruptas). Si sigues funcionando, las siguientes operaciones operan sobre datos contaminados sin saberlo: fallas lentas y silenciosas, las peores de diagnosticar. Loguear, salir con `process.exit(1)` y dejar que el gestor (PM2, Docker, systemd) reinicie es más barato que correr con estado roto.
</details>

---

### 2. Explicarlo con tus palabras

> **Reto**: Explica a un amigo que viene de Python cómo funciona el **modelo de errores de JavaScript**, usando la metáfora de un **equipo de trabajo**: el error es un aviso que sale de la tarea (la función), asciende por la cadena de mando (la pila de llamadas), y cada nivel decide "esto lo resuelvo yo" (`catch`) o "lo dejo seguir" (`throw`). Sin nadie que lo atrape, el jefe — el proceso — cierra la empresa (`uncaughtException`). Después explica: ¿qué información extra porta `Error.cause`, y qué garantiza `Error.isError` que `instanceof` no puede?
> *Pista: si dudas, relee la [Sección 1](#1-trycatchfinally-y-throw--el-modelo-básico), la [Sección 3](#3-errorcause-y-encadenamiento-de-errores-es2022) y la [Sección 4](#4-erroriserror--verificación-fiable-entre-realms-es2026).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): `dividir` con validación y relanzado controlado

**Objetivo**: Crear una función con manejo de errores básico que valide sus entradas y decida si puede resolver el error o lo relanza.

**Enunciado**: Escribe una función `dividir(a, b)` que:
1. Lance un `TypeError` si algún argumento no es un número.
2. Lance un `RangeError` si `b === 0`.
3. Atrape el error que ella misma lanzó, lo loguee y lo **relance** para que el llamador decida.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Guarda las validaciones con `throw new TypeError(...)` antes de intentar dividir.
2. Envuelve el cuerpo en `try/catch`; en el `catch` haz `console.error` y luego `throw error`.
3. Fuera de la función, compara las salidas: `dividir(10, 2)`, `dividir(10, 0)` y `dividir("10", 2)`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

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

**¿Por qué funciona?** el `throw` interrumpe el bloque y salta directo al `catch` interno, que loguea y relanza con `throw error`. El `throw` interno **no puede tragarse** el error (lo relanza con el mismo stack). El `catch` externo lo recibe intacto: ambos `console.log` del final aparecen. Tipo elegido a propósito: `TypeError` para "argumento inválido", `RangeError` para "valor fuera de rango" — los tipos nativos son el idioma que la consola habla.
</details>

---

#### Ejercicio 2 (Intermedio): Jerarquía de errores `ErrorAPI` con `Error.cause`

**Objetivo**: Construir una jerarquía de errores de API con códigos HTTP, timestamp y soporte de `Error.cause`, y manejarla por tipo en el llamador.

**Requisitos**:
1. `ErrorAPI` debe tener `codigo`, `mensaje`, `timestamp`.
2. `ErrorAutenticacion` para errores 401, `ErrorNoEncontrado` para 404, `ErrorRateLimit` para 429.
3. Todas deben soportar `Error.cause` para preservar el error original.
4. El llamador (`obtenerUsuario`) traduce los `HTTP N` del `fetch` al tipo de error que corresponde.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Extiende de `Error` nativo y pasa `{ cause }` al `super()`.
2. Establece `this.name = this.constructor.name` dentro de la base.
3. En el flujo de `fetch`, usa el `respuesta.status` para elegir cuál subclase lanzar.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

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

**¿Por qué funciona?** la base `ErrorAPI` centraliza `name`, `codigo` y `timestamp`, y cada subclase solo aporta su `HTTP status` — la jerarquía es lo que permite al `catch` discriminar: `error instanceof ErrorAutenticacion` etc. `Error.captureStackTrace(this, this.constructor)` recorta el stack para que no muestre el constructor de `ErrorAPI` como frame extra (el `name` por defecto sería `Error`; ponerlo a mano hace legible el log). El `throw error` final relanza para que el sistema de nivel superior (middleware, ver Sección 9) decida la respuesta HTTP.
</details>

---

#### Ejercicio 3 (Avanzado): Logger estructurado con circuit breaker

**Objetivo**: Montar el sistema de logging de la Sección 7 *más* el circuit breaker de la Sección 9, con niveles, `requestId` y redacción de datos sensibles (PII).

**Especificaciones**:
1. Cada log debe incluir: timestamp, level, service, requestId, message, metadata.
2. El circuit breaker debe tener estados: CLOSED, OPEN, HALF_OPEN.
3. Soporte para redacción de datos sensibles (PII): por ejemplo, los números de seguro social (SSN) estilo `123-45-6789` deben salir enmascarados.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa un `Logger` con métodos `debug/info/warn/error` y un filtro de redacción en el camino de `message`.
2. Implementa el circuit breaker como clase con `estado`, `fallos` y `ultimaVezAbierto` (ya lo viste en la Sección 9).
3. El breaker envuelve la llamada externa; el logger registra entrada y salida con el mismo `requestId`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

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

**¿Por qué funciona?** el `Logger` respeta el nivel mínimo (`debug` 0 < `info` 1, se descarta) y aplica los redactores *antes* de serializar — el SSN nunca llega al destino, ni al archivo ni al servicio de observabilidad. El `CircuitBreaker` acumula fallos hasta el umbral, abre el circuito (todas las llamadas fallan rápido sin tocar el servicio), y tras el timeout vuelve a `HALF_OPEN` para probar con una sola petición. Juntos son un "mini-Remote" como los que ves en la Sección 9: protección contra sobrecarga *y* trazabilidad del mismo `requestId` desde el log de entrada hasta el de salida.
</details>

---

## Depuración en la práctica

### Qué error ves y cómo atacarlo

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

### Escenario 1: El error que se escapa del `forEach` asíncrono

**Situación**: Tienes una función asíncrona que maneja errores, pero algunos errores no se capturan. El `try/catch` externo "solo atrapa algunos". En producción ves `unhandledRejection` en los logs.

**Diagnóstico**:
- **Causa probable**: `ids.forEach(async (id) => { ... })` lanza callbacks async sin esperar: para `forEach` no eres un `await` que pueda fallar, eres un **fuego y olvido** que descarta las promesas. El error del `procesar(id)` interno revienta como promesa rechazada que nadie maneja — el `try/catch` externo nunca lo ve, porque la pila donde se ejecuta ya regresó.
- **Y después**: con `for...of` + `await`, cada error cae en el `try/catch` y es capturable; con `Promise.allSettled`, obtienes los resultados exitosos y los rechazados sin que ninguno tumbe el flujo.
- **En Python**: el análogo es olvidar `await` u olvidarse de una tarea `asyncio` — la excepción sale como "Task exception was never retrieved". `asyncio.gather(...)`, para comparar con `Promise.all`.

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

---

### Escenario 2: Los logs que no sirven en producción

**Situación**: Tu aplicación tiene logs, pero son inútiles para debugear problemas en producción. Un error aparece miles de veces al día y no sabes *de qué petición* viene ni *cuánto tardó* nada.

**Diagnóstico**:
- **Causa probable**: logs planos tipo ``console.log(`Usuario ${id} ...`)`` — sin level, sin timestamp, sin `requestId`. No puedes filtrar "todos los errores del usuario 42", y los logs de una sola petición están regados por el archivo sin forma de unirlos.
- **Solución**: logging estructurado en JSON con `requestId`, `level`, `timestamp` y `servicio` (Sección 7). El `requestId` se genera por petición y se propaga a todos los niveles — así el sistema de logs (Datadog, Loki) puede *seguir la traza* entera.
- **En Python**: lo mismo con `logging` + formatter JSON o `structlog`; en Java con SLF4J + MDC (el `requestId` lo llevas en el contexto del hilo).

```javascript
// ✅ Logging con contexto requestId para trazabilidad
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.logger = new Logger('api');   // o req.logger = logger.child({ requestId })
  next();
});

// En controlador
async function obtenerUsuario(req, res) {
  req.logger.info('Iniciando obtención de usuario', { requestId: req.requestId, userId: req.params.id });

  try {
    const usuario = await usuarioService.obtener(req.params.id);
    req.logger.info('Usuario obtenido exitosamente', { requestId: req.requestId, userId: req.params.id });
    res.json(usuario);
  } catch (error) {
    req.logger.error('Error obteniendo usuario', {
      requestId: req.requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Error interno', requestId: req.requestId });
  }
}
```

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Característica | JavaScript | Python |
|---|---|---|
| **Sintaxis base** | `try/catch/finally` | `try/except/finally` (+ `else` si no hubo error) |
| **Relanzar** | `throw error` | `raise` (a secas, sin perder la actual) |
| **Tipos de error nativos** | 7 clásicos + `AggregateError` | Jerarquía rica en `Exception` (`ValueError`, `KeyError`, `RecursionError`...) |
| **Causa original** | `{ cause }` (ES2022, explícito) | `raise ... from e` explícito y `__context__` implícito |
| **Verificación cross-realm** | `Error.isError` (ES2026, necesario por realms) | `isinstance(e, Exception)`; realms no existen |
| **Errores personalizados** | `class X extends Error` + `instanceof` | `class X(Exception)` + `except X:` |
| **Depuración** | `node --inspect` (GUI en Chrome DevTools) + sourcemaps | `pdb`/`breakpoint()` (texto) |
| **Logging** | No hay estándar: `console` + `pino`/`winston` | `logging` estándar + formatters JSON |
| **No manejado a nivel proceso** | `uncaughtException`/`unhandledRejection` | `sys.excepthook`; sin equivalente de `unhandledRejection` |
| **Retry / circuit breaker** | A mano o `p-retry`/`bottleneck` | `tenacity` (retry declarativo) |

### JavaScript vs. Java

| Característica | JavaScript | Java |
|---|---|---|
| **Sintaxis base** | `try/catch/finally` | `try/catch/finally` + try-with-resources |
| **Excepciones obligatorias** | Ninguna | *checked*: declaran `throws` o no compilan |
| **Tipos de error nativos** | 7 + `AggregateError` | Decenas; `NullPointerException`, `NumberFormatException`, `ArrayIndexOutOfBoundsException`... |
| **Causa original** | `{ cause }` (ES2022) | Constructor con causa + `getCause()` (desde JDK 1.4) |
| **Verificación cross-realm** | `Error.isError` (ES2026) | `instanceof Throwable` (los realms casi no existen) |
| **Errores personalizados** | `class X extends Error` + `instanceof` | `class X extends Exception/RuntimeException` + `catch (X e)` |
| **Depuración** | `node --inspect` (GUI) + sourcemaps | JDWP + IDE (bytes con debug info) |
| **Logging** | `console` + `pino`/`winston`; `requestId` a mano | SLF4J + Logback; **MDC** para el `requestId` |
| **No manejado a nivel proceso** | `uncaughtException` tumba el proceso | Hilo muere; `setDefaultUncaughtExceptionHandler` + shutdown hooks |
| **Retry / circuit breaker** | A mano o librerías parciales | **Resilience4j** (`Retry`, `CircuitBreaker`, fallback, métricas) |

---

## Resumen del capítulo

1. **El modelo es `try/catch/finally` con `throw`**: `finally` siempre se ejecuta (liberar recursos), pero un `return` ahí **traga** errores y valores.
2. **Los tipos nativos son el idioma del diagnóstico**: `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`... más `AggregateError` (ES2021). `name`, `message` y `stack` (este último no estándar).
3. **`Error.cause` (ES2022) preserva el error original al relanzar**: sin él, cada capa nueva borra la causa raíz.
4. **`Error.isError` (ES2026) es la verificación fiable entre realms**: `instanceof` falla con workers/iframes; la marca interna no (Node 24+, Chrome 134+).
5. **Las jerarquías propias + `error.codigo` permiten discriminar por tipo**: operacional vs. bug, y respuesta distinta por `catch`.
6. **En producción: logging estructurado JSON con `requestId`**, `node --inspect` para depurar, heap snapshots para leaks, y `uncaughtException`/`SIGTERM` como última línea (loguear, salir, dejar que el gestor reinicie).
7. **Los patrones de resiliencia**: retry con backoff exponencial + jitter para fallos transitorios; circuit breaker (CLOSED/OPEN/HALF_OPEN) para servicios caídos; shutdown grácil al final.

---

## Siguiente Capítulo

→ **[Capítulo 7: Patrones creacionales (Factory, Singleton, Builder)](./cap-07)**: Ahora que sabes manejar los fallos en producción, pasamos a los patrones que estructuran cómo creas objetos y controlas sus instancias en JavaScript moderno.