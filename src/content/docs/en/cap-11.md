---
title: "Chapter 11: Asynchronous Resource Management (using, Explicit Resource Management)"
---

# Chapter 11: Asynchronous Resource Management (using, Explicit Resource Management)

## Introduction

Chapter 10 taught you to close the front door: trust nothing that comes from outside. This chapter closes the other door — the way out. Every application that opens something — a file, a database connection, a timer, a stream reader — has to close it, and classic JavaScript left that closing to the programmer's memory with a hand-rolled `try/finally`.

The **Explicit Resource Management** proposal (standard **ES2027**, already available in runtimes) introduces `using` and `await using`: you declare a resource and the language releases it on its own when the block exits, no matter what happens (normal completion, exception, `return`, `break`). It is JavaScript's answer to a mechanism Java has been using since 2011 with `try-with-resources` — and that Python sums up in a single word: `with`. It is also proof that ECMAScript keeps absorbing the best of the others: this chapter and the last one in the book are about exactly that, modern APIs that reach the standard.

Two honest warnings before starting:

- In Node.js this already works out of the box (verified in this book on Node 24+); moreover, native handles such as `fs/promises` and its `FileHandle` already implement the contract. It is not futurism.
- JavaScript has a *garbage collector* for memory, but it has **never** had destructors for resources: `using` is not a destructor, it is a *release contract* you implement. You will see the difference and how to cover it.

## 1. `using`: guaranteed resource release

### The problem: a close you have to remember

Every resource you open is a favor someone must repay. Without `using`, the guarantee is built by hand with `try/finally`:

```javascript
let conexionesAbiertas = 0

async function obtenerDatos(sql) {
  const conexion = await abrirConexion()
  conexionesAbiertas++
  try {
    return await conexion.consultar(sql)
  } finally {
    await conexion.cerrar()
    conexionesAbiertas--
  }
}
```

It works… if you remember it. The `finally` exists precisely because *you can forget*: a route that returns early, an early exception, and the connection stays open with nobody reclaiming it. The `finally` also repeats in every function — ten data-access functions, ten cloned `try/finally` blocks. And if in the `finally` you close first and then throw something, you lose the original error (you saw it with the chains in chapter 6).

**`using` declares the resource and the language takes care of it**: when the block exits, `[Symbol.dispose]` (synchronous) or `[Symbol.asyncDispose]` (asynchronous) is called, whether the block finishes well or throws.

```javascript
class ConexionBD {
  constructor(host) {
    this.host = host
    this.conectada = false
  }

  async conectar() {
    await new Promise(resolve => setTimeout(resolve, 10))
    this.conectada = true
    console.log(`[${this.host}] conectada`)
  }

  consultar(sql) {
    return `Resultado de: ${sql}`
  }

  async [Symbol.asyncDispose]() {
    await new Promise(resolve => setTimeout(resolve, 10))
    this.conectada = false
    console.log(`[${this.host}] conexión cerrada`)
  }
}

async function obtenerDatos(sql) {
  await using conn = new ConexionBD("localhost:5432")
  await conn.conectar()
  return conn.consultar(sql)
} // <- here [Symbol.asyncDispose] runs automatically
```

No `try/finally`: the cleanup is part of the resource's *contract*, not of the discipline of whoever uses it. And not only in functions: `using` works in any block, `if`, `for` and `try`.

### The contract: `Symbol.dispose` and `Symbol.asyncDispose`

The object you pass to `using` must implement the method with the corresponding symbol:

| Declaration | Method called on exit | Typical use |
|---|---|---|
| `using recurso = ...` | `[Symbol.dispose]()` (synchronous) | closing files, timers, listeners |
| `await using recurso = ...` | `[Symbol.asyncDispose]()` (asynchronous) | closing connections, undoing locks |

If the value does not implement the contract, you get a clear `TypeError`:

```javascript
{ using x = {} } // TypeError: Symbol(Symbol.dispose) is not a function
```

And notice what it does **not** do: `using` guarantees that your release method is called, but it does **not** prevent the object from being used afterwards. If you want a released resource to reject calls, the guard goes in your class (a flag you check), as you will do in the advanced exercise.

### Connection with Java

**Literal translation**: `using` is a straight port of Java 7 (2011): `try-with-resources` with `AutoCloseable`. Java popularized it so much that TC39 drew inspiration from it.

```java
public final class ConexionBD implements AutoCloseable {
    private final String host;

    public ConexionBD(String host) {
        this.host = host;
    }

    @Override
    public void close() {
        System.out.println("[" + host + "] conexión cerrada");
    }

    public String consultar(String sql) {
        return "Resultado de: " + sql;
    }
}

// Automatic calls to close() when the block ends
try (ConexionBD conn = new ConexionBD("localhost:5432")) {
    System.out.println(conn.consultar("SELECT * FROM usuarios"));
}
```

**Change of scene**: Java closes automatically at the end of the `try`, JavaScript when the `using` block exits — the same contract, different box. One difference Java does not have: JavaScript distinguishes **asynchronous** release (`await using` + `[Symbol.asyncDispose]`), because in Node closing a real connection usually involves I/O. Java's `close()` is synchronous, period — there is no async `AutoCloseable` in the standard (solutions arrive through frameworks like Spring).

### Connection with Python

**Literal translation**: Python solves it with `with` and *context managers*: `__enter__`/`__exit__` (synchronous) and `__aenter__`/`__aexit__` (asynchronous).

```python
class ConexionBD:
    def __init__(self, host):
        self.host = host

    def __enter__(self):
        print(f"Conectando a {self.host}...")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Cerrando conexión a {self.host}...")
        return False  # Do not suppress exceptions; let them propagate

    def consultar(self, sql):
        return f"Resultado de: {sql}"

with ConexionBD("localhost") as conn:
    print(conn.consultar("SELECT * FROM usuarios"))
# When the block exits, __exit__ runs automatically


class ConexionAsync:
    async def __aenter__(self):
        await self.conectar()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

async def usar():
    async with ConexionAsync() as conn:
        return await conn.consultar("SELECT 1")
```

**Change of scene**: in Python the interface is called `__enter__`/`__exit__` and you have to *know* it exists; in JavaScript the `Symbol.dispose` is a symbol — a guaranteed-unique identifier, impossible to collide with — and the contract is just as explicit with `[Symbol.dispose]()`. Both languages release even if the block throws: that is the promise a hand-rolled `try/finally` cannot match.

## 2. Release order and cascading errors

### The problem: two resources that depend on each other

When one resource depends on another, the closing order matters. A transaction opens a connection; you cannot *close* the transaction after the connection stops existing:

```javascript
async function conTransaccion() {
  let conexion
  let transaccion
  try {
    conexion = await abrirConexion()
    transaccion = await conexion.abrirTransaccion()
    await transaccion.commit()
  } finally {
    if (transaccion) await transaccion.cerrar()
    if (conexion) await conexion.cerrar()
  }
}
```

Look at the fragility: we close in reverse order (first what was opened later) by hand, with two `if`s we added in case the opening failed. Forgetting an `if` or the order causes leaks or premature closes.

**`using` gives you the reverse order by design.** Resources declared in the same block are released in the **opposite order of their declaration** (LIFO): the one opened last is the one closed first — exactly what the cascade above needs, without the `if`s or the hand-made order.

```javascript
let orden = []

class Transaccion {
  constructor(conexion) { this.conexion = conexion }

  async commit() { orden.push("commit") }

  async [Symbol.asyncDispose]() {
    orden.push("cerrar transacción")
  }
}

class Conexion {
  abrirTransaccion() { return new Transaccion(this) }

  async [Symbol.asyncDispose]() {
    orden.push("cerrar conexión")
  }
}

async function ejemplo() {
  await using conexion = new Conexion()
  await using transaccion = conexion.abrirTransaccion()
  await transaccion.commit()
} // the scope empties: transaction first, then connection

await ejemplo()
console.log(orden) // ["commit", "cerrar transacción", "cerrar conexión"]
```

### The uncomfortable case: the body and the cleanup fail at the same time

What if your code throws **and** the cleanup does too? The standard groups both into a **`SuppressedError`** (verified like this on Node 24+):

```javascript
class Roto {
  [Symbol.dispose]() {
    throw new Error("la limpieza también falló")
  }
}

try {
  using r = new Roto()
  throw new Error("el cuerpo lanzó")
} catch (error) {
  console.log(error.constructor.name) // SuppressedError
  console.log(error.error.message) // la limpieza también falló
  console.log(error.suppressed.message) // el cuerpo lanzó
}
```

A delicate point you should know: the error that **wins** is the disposal one (`error.error`) and the body one stays *suppressed* in `error.suppressed`. Your original exception is not lost — but you have to know to look for it in `.suppressed` when you see a `SuppressedError` in the log.

And an error in the release **does** propagate: if the whole block finished fine but the `dispose` throws, the exception you see is the `dispose` one.

### Connection with Java

**Literal translation**: `try-with-resources` also releases in reverse declaration order:

```java
try (Conexion conexion = abrir();
     Transaccion transaccion = conexion.abrirTransaccion()) {
    transaccion.commit();
} // closes the transaction and then the connection
```

**Change of scene**: here a **different detail** shows up. In Java, if the body throws and `close()` too, the **body** error wins and the close one is attached with `addSuppressed()`; in JavaScript the **disposal** error wins and the body one stays in `.suppressed`. Same principle (no lost exceptions) with opposite priorities — mix it up mentally between the two languages once and you will remember it forever.

### Connection with Python

**Literal translation**: Python nests scopes and the same LIFO rule applies with nested `with` blocks — you leave blocks in reverse order of their opening. For dynamic dependencies (you do not know how many resources you will open until you run), Python has `contextlib.ExitStack`, which stacks up and releases in reverse order just like one `using` after another:

```python
from contextlib import ExitStack

with ExitStack() as stack:
    conexion = stack.enter_context(ConexionBD("localhost"))
    stack.callback(lambda: print("limpieza extra"))
# entries close in reverse order: callback, and then conexion
```

**Change of scene**: `ExitStack` covers the *unknown count* case, which in JavaScript is solved two ways: several `using` at once (if you know them) or `DisposableStack`/`AsyncDisposableStack` (if you keep adding them in a loop — the equivalent of `ExitStack`, with `use()` and LIFO release). The LIFO order is the same rule in all three languages: it is rare that something is identical across Java, Python and JavaScript, but cleanup is.

## Debugging in practice

### When cleanup fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `conexionesAbiertas` never returns to 0 | `try/finally` forgotten on some path | Declare with `using`/`await using` |
| `TypeError: Symbol(Symbol.dispose) is not a function` | The value does not implement the contract | Add `[Symbol.dispose]` or `[Symbol.asyncDispose]` |
| You see `SuppressedError` in the log | The body and the disposal both failed | Read `.error` and `.suppressed` so you do not lose your exception |
| The resource is used after being released and breaks | `using` does not freeze the object | Guard it in the class with a `yaLiberado` flag |
| The connection pool grows without bound | The idle ones never close | `limpiarInactivas()` with a timeout (see the advanced exercise) |

### Scenario 1: many resources, many scopes

In a large application there is no `finally` you can find — there are fifty, each in its own function, some forgotten. Figuring out "how many connections are open right now" is impossible because the state is scattered. The fix combines two things: **centralizing** the long-lived resources (a connection pool like the advanced exercise, with statistics) and **bounding the life** of temporary ones with `using` in the scope where they are used. The pool answers "how many are open?"; `using` answers "none will stay open just because I forgot".

### Scenario 2: the cascading cleanup and partial release

Resources with dependencies (config → file → connection, or transaction → connection) impose two rules: **reverse order** of release and **tolerance** for failing in the middle of the cascade. If you close the connection before the transaction, the in-flight data is lost; if the first `close` throws, the rest must keep closing even if partially. `using` gives you the reverse order for free; for fault tolerance, remember that each `[Symbol.dispose]` runs in its own block — an exception in one dispose does not stop the next from being called. Design every `dispose` as if it were the only thing in the system that works.

## Practice and exercises

### 1. Review questions

<details>
<summary><b>1. What contract must an object fulfil to be used with `using`? And with `await using`?</b></summary>

**Explanation**: for `using` it must implement `[Symbol.dispose]()` (synchronous); for `await using`, `[Symbol.asyncDispose]()` (asynchronous). Without the method, the runtime throws `TypeError: Symbol(Symbol.dispose) is not a function`.
</details>

<details>
<summary><b>2. In what order are several `using` declarations in the same block released, and why does it matter?</b></summary>

**Explanation**: in reverse declaration order (LIFO): the last one opened closes first. It matters for dependent resources — a transaction must close before its connection — and it is exactly what a hand-rolled `try/finally` is forced to repeat in every function.
</details>

<details>
<summary><b>3. If the body and the disposal throw at the same time, what do you get and where is each error?</b></summary>

**Explanation**: a `SuppressedError`. There `.error` is the disposal exception (the one that wins) and `.suppressed` is the body's; your original error is not lost, it is in `.suppressed`. If the block ends fine but the `dispose` throws, the `dispose` one propagates.
</details>

<details>
<summary><b>4. Does `using` stop you from using a resource after releasing it?</b></summary>

**Explanation**: no. `using` only guarantees that `Symbol.dispose`/`Symbol.asyncDispose` is called when the block exits; the object stays callable. If you want to reject uses after release, the guard (a flag) is implemented by your class — like `ReferenciaConexion` in the advanced exercise.
</details>

<details>
<summary><b>5. What is `using`'s ancestor in Java and Python's equivalent?</b></summary>

**Explanation**: the ancestor is Java 7's `try-with-resources` (2011) with `AutoCloseable` and `close()`, which also closes in reverse order. In Python the equivalent is `with` and the context managers `__enter__`/`__exit__` (or `__aenter__`/`__aexit__`), with `contextlib.ExitStack` for dynamic resources.
</details>

### 2. Explain it in your own words

> **Challenge**: explain to a friend coming from Java how `await using` works with the metaphor of **checking out of a hotel with an automatic concierge**: when you check in (open the resource) the concierge notes down the room; at check-out, the concierge closes **in reverse order** what you opened (if you locked two doors, it unlocks the inner one first) and does it *even if you run out because of a fire* (exception). Then focus on the odd case: if while closing the door you also hear the hallway lock breaking, the concierge hands you a double form: the door fault (`.error`) and the reason you ran out (`.suppressed`).
> *Hint: if you hesitate, re-read [Section 1](#1-using-guaranteed-resource-release) and [Section 2](#2-release-order-and-cascading-errors).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): a self-closing temporary file

**Objective**: implement `Symbol.dispose` and check that `using` calls the cleanup when the block exits.

**Statement**: create a `TempFile` class that:
1. Creates a temporary file on instantiation (simulated: keeps a name and content in memory).
2. Implements `Symbol.dispose` to mark it as deleted and print it.
3. Prints a message on creation and another on deletion.
4. After release, `leer()` rejects with a clear `Error` (the guard against later use).

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Keep `this.nombre` and `this.contenido`; a `this.eliminado` flag starts as `false`.
2. In `leer()`, if `this.eliminado === true`, throw `new Error("El archivo ya fue liberado")`.
3. Write the message order with `console.log` and compare it with what you see when running.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class TempFile {
  constructor(nombre) {
    this.nombre = nombre
    this.contenido = ""
    this.eliminado = false
    console.log(`Creando archivo temporal: ${nombre}`)
  }

  escribir(texto) {
    if (this.eliminado) throw new Error("El archivo ya fue liberado")
    this.contenido = texto
    console.log(`Escribiendo en ${this.nombre}: ${texto}`)
  }

  leer() {
    if (this.eliminado) throw new Error("El archivo ya fue liberado")
    console.log(`Leyendo de ${this.nombre}`)
    return this.contenido
  }

  [Symbol.dispose]() {
    this.eliminado = true
    this.contenido = ""
    console.log(`Eliminando archivo temporal: ${this.nombre}`)
  }
}

function procesar() {
  using temp = new TempFile("cache.tmp")
  temp.escribir("datos importantes")
  return temp.leer()
}

console.log(procesar())
// Creando archivo temporal: cache.tmp
// Escribiendo en cache.tmp: datos importantes
// Leyendo de cache.tmp
// Eliminando archivo temporal: cache.tmp
// datos importantes

let temp
{
  using manejador = new TempFile("otro.tmp")
  temp = manejador
  console.log(temp.leer()) // "" — inside the scope, not yet released
}
// here the scope ended: [Symbol.dispose] has run
try {
  temp.leer()
} catch (error) {
  console.log(error.message) // El archivo ya fue liberado
}
```

**Why does it work?** `using` calls `[Symbol.dispose]` as soon as the scope ends, whether the body throws or not — no `try/finally` needed. And since `using` does not freeze the object on its own, here the class uses the `eliminado` flag to stop anyone from using the file after release. Notice the *when* nuance: it is not released at the declaration, but when **leaving the block** — that is why `temp.leer()` inside the `{}` works and the same `leer()` after it throws. That exact nuance is the source of bugs when migrating an old `finally` to `using`.
</details>

#### Exercise 2 (Intermediate): asynchronous connection with deterministic retry

**Objective**: implement `Symbol.asyncDispose`, a controlled reconnection (no randomness) and a verifiable operation log.

**Statement**: create a `ConexionBD` class that:
1. `conectar()` sets `conectada = true` with a small simulated delay.
2. `consultar(sql)` fails the first time *if configured* with `modoFallar: 1` (deterministic, so it can be checked), and on failure marks `conectada = false`.
3. `reconectar()` tries until `maxReintentos` and throws `Error` when exhausted.
4. Implements `Symbol.asyncDispose` that closes the connection and logs it.
5. Keeps a log (`registrar`) of all operations, retrievable with `obtenerLog()`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. The programmed failure: a `fallosRestantes` counter that decrements on each `consultar` if > 0.
2. `reconectar` increments `reintentos` and throws `"Máximo de reintentos alcanzado"` on reaching `maxReintentos`.
3. The `[Symbol.asyncDispose]` is an `async` method that logs and sets `conectada = false`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class ConexionBD {
  constructor(host, { modoFallar = 0 } = {}) {
    this.host = host
    this.conectada = false
    this.fallosRestantes = modoFallar
    this.reintentos = 0
    this.maxReintentos = 3
    this.log = []
  }

  async conectar() {
    this.registrar("conectar")
    await esperar(20)
    this.conectada = true
    return this
  }

  async consultar(sql) {
    if (!this.conectada) await this.reconectar()
    this.registrar(`consultar: ${sql}`)

    if (this.fallosRestantes > 0) {
      this.fallosRestantes--
      this.conectada = false
      throw new Error("Conexión perdida")
    }

    return `Resultado de: ${sql}`
  }

  async reconectar() {
    this.reintentos++
    this.registrar(`reintento ${this.reintentos}/${this.maxReintentos}`)
    if (this.reintentos > this.maxReintentos) {
      throw new Error("Máximo de reintentos alcanzado")
    }
    await esperar(20)
    this.conectada = true
    return this
  }

  async [Symbol.asyncDispose]() {
    this.registrar("cerrar conexión")
    await esperar(10)
    this.conectada = false
  }

  registrar(mensaje) {
    this.log.push(mensaje)
    console.log(`[${this.host}] ${mensaje}`)
  }

  obtenerLog() {
    return [...this.log]
  }
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const conn = new ConexionBD("localhost:5432", { modoFallar: 1 })

async function ejecutarConsultas() {
  await using c = conn
  await c.conectar()

  const fallos = []
  try {
    await c.consultar("SELECT * FROM usuarios") // fails by design (modoFallar)
  } catch (error) {
    fallos.push(error.message) // "Conexión perdida"
  }

  const logs = await c.consultar("SELECT * FROM logs") // reconnects and succeeds
  return { fallos, logs }
}

// Wraps the top-level await so the script also runs in CommonJS
async function principal() {
  const resultado = await ejecutarConsultas()
  console.log(resultado.fallos) // ["Conexión perdida"]
  console.log(resultado.logs)   // Resultado de: SELECT * FROM logs

  // here `ejecutarConsultas` already ended: asyncDispose ran on its own
  console.log(conn.conectada)  // false — the connection is closed
  console.log(conn.obtenerLog())
  // ["conectar", "consultar: SELECT * FROM usuarios", "reintento 1/3",
  //  "consultar: SELECT * FROM logs", "cerrar conexión"]
}

principal()
```

**Why does it work?** The first `consultar` fails on purpose (`modoFallar: 1`), the `catch` records the failure instead of rethrowing it, and the second `consultar` enters the `if (!this.conectada)` to reconnect before running — the retry is explicit and verifiable, no `Math.random()`. When `ejecutarConsultas` ends, the `await using` scope closes and `[Symbol.asyncDispose]` runs on its own: that is why, back in `principal`, `conn.conectada` is already `false` and the final log contains `"cerrar conexión"`. Why the retry works: reconnection detects the flag before running the query, not after — which is also why `fallos` only holds one message.
</details>

#### Exercise 3 (Advanced): connection pool with `await using`

**Objective**: manage several connections with a pool, a single-use `ReferenciaConexion` and verifiable statistics.

**Statement**: create a `PoolConexiones` that:
1. Has a configurable `tamanioMax` and hands out per-name connections, reusing the free ones (`reutilizadas` + `creadas` in the statistics).
2. Returns `ReferenciaConexion`, whose `consultar` works **only once** (it checks `usada`) and whose `[Symbol.asyncDispose]` returns the connection to the pool.
3. Throws `Error` when the pool is full (no free connection and `size >= tamanioMax`).
4. Has `limpiarInactivas()` with a timeout (without loose timers: give it a `cerrar()` to clean everything up) and `obtenerEstadisticas()`.
5. Test with a double `await using` so that at the end `activas === 0` and that a single-use `ReferenciaConexion` explodes if you query it twice.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. The `ReferenciaConexion` keeps a reference to the pool and an `id`; its `[Symbol.asyncDispose]` calls `pool.liberar(id)`.
2. The pool stores connections in a `Map` id → connection with an `estaLibre` flag.
3. For the `activas` statistic, count the connections with `estaLibre === false`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class ConexionSimulada {
  constructor(nombre) {
    this.nombre = nombre
  }

  async consultar(sql) {
    return `[${this.nombre}] ${sql}`
  }

  async cerrar() {
    // release of the real connection
  }
}

class ReferenciaConexion {
  constructor(pool, id) {
    this.pool = pool
    this.id = id
    this.usada = false
  }

  consultar(sql) {
    if (this.usada) {
      throw new Error("Esta conexión ya fue utilizada")
    }
    const conexion = this.pool.conexiones.get(this.id)
    this.usada = true
    return conexion.consultar(sql)
  }

  [Symbol.asyncDispose]() {
    this.pool.liberar(this.id)
    return Promise.resolve()
  }
}

class PoolConexiones {
  constructor({ tamanioMax = 5 } = {}) {
    this.tamanioMax = tamanioMax
    this.conexiones = new Map()
    this.ultimoId = 0
    this.estadisticas = { creadas: 0, reutilizadas: 0, cerradas: 0 }
  }

  async obtenerConexion(nombre) {
    for (const [id, conexion] of this.conexiones) {
      if (conexion.nombre === nombre && conexion.estaLibre) {
        conexion.estaLibre = false
        this.estadisticas.reutilizadas++
        return new ReferenciaConexion(this, id)
      }
    }

    if (this.conexiones.size >= this.tamanioMax) {
      throw new Error(`Pool de conexiones lleno (máximo ${this.tamanioMax})`)
    }

    const id = ++this.ultimoId
    const conexion = new ConexionSimulada(nombre)
    conexion.estaLibre = false
    conexion.creadaEn = Date.now()
    this.conexiones.set(id, conexion)
    this.estadisticas.creadas++
    return new ReferenciaConexion(this, id)
  }

  liberar(id) {
    const conexion = this.conexiones.get(id)
    if (conexion) {
      conexion.estaLibre = true
      conexion.liberadaEn = Date.now()
    }
  }

  limpiarInactivas(timeoutMs = 30000) {
    const ahora = Date.now()
    for (const [id, conexion] of this.conexiones) {
      if (conexion.estaLibre && ahora - conexion.liberadaEn > timeoutMs) {
        conexion.cerrar()
        this.conexiones.delete(id)
        this.estadisticas.cerradas++
      }
    }
  }

  cerrar() {
    for (const conexion of this.conexiones.values()) {
      conexion.cerrar()
    }
    this.conexiones.clear()
  }

  obtenerEstadisticas() {
    const activas = [...this.conexiones.values()].filter(c => !c.estaLibre).length
    return { ...this.estadisticas, activas, totales: this.conexiones.size }
  }
}

const pool = new PoolConexiones({ tamanioMax: 2 })

async function conDosConexiones() {
  await using conn1 = await pool.obtenerConexion("db1")
  await using conn2 = await pool.obtenerConexion("db2")
  console.log(await conn1.consultar("SELECT * FROM usuarios"))
  console.log(await conn2.consultar("SELECT * FROM productos"))
  console.log(pool.obtenerEstadisticas()) // creadas: 2, activas: 2
}

async function principal() {
  await conDosConexiones()
  console.log(pool.obtenerEstadisticas()) // activas: 0 — the await using released them

  const ref = await pool.obtenerConexion("db1")
  console.log(await ref.consultar("SELECT 1"))
  try {
    await ref.consultar("SELECT 2")
  } catch (error) {
    console.log(error.message) // Esta conexión ya fue utilizada
  }
  await ref[Symbol.asyncDispose]()
}

principal()
```

**Why does it work?** `await using conn1`/`conn2` release back to the pool automatically when the block exits, in reverse order, and hand the connection back with `estaLibre = true` (it gets `reutilizadas` on the next request for the same `db1`). The `ReferenciaConexion` is a *single-use permit*: its `consultar` checks `usada` and the flag explodes if someone queries twice — the manual guard `using` does not put in for you. The limit is also respected: with `tamanioMax: 2`, a third un-released request would throw `"Pool de conexiones lleno"`. Note: `limpiarInactivas` is only safe when the connection is **free** — never close something a `ReferenciaConexion` may be using.
</details>

## Comparison table across languages

| Aspect | JavaScript | Python | Java |
|---|---|---|---|
| Syntax | `using` / `await using` | `with` / `async with` | `try (…)` |
| Interface | `[Symbol.dispose]` / `[Symbol.asyncDispose]` | `__enter__`/`__exit__` (or `__aenter__`/`__aexit__`) | `AutoCloseable.close()` |
| Release order | LIFO (reverse declaration) | LIFO (nesting) + `ExitStack` | LIFO (reverse declaration) |
| Async | `Symbol.asyncDispose` in the standard | async `__aexit__` | None in the standard |
| Several resources | `using` and DisposableStack | nested or `ExitStack` | several in the same `try` |
| If the body and cleanup both fail | `SuppressedError` (cleanup wins) | The new one propagates; the original in `__context__` | The body wins; the other with `addSuppressed` |

In this chapter the three languages converge on the **same contract** under different names — and the error comparison is one of the asymmetric ones worth highlighting: each language decides who wins when the body and the cleanup fail at the same time.

## Chapter summary

1. **`using`/`await using`** (ES2027) guarantee resource release when the block exits: normal completion, exception, `return` or `break`.
2. The object must implement **`[Symbol.dispose]`** (synchronous) or **`[Symbol.asyncDispose]`** (asynchronous); without the contract, `TypeError`.
3. **Release happens in reverse order** of declaration (LIFO), exactly what dependent resources require.
4. `using` does **not freeze the object** after release — the later guard (`usada`, `eliminado`) is for your class to add.
5. Body and cleanup failing together → **`SuppressedError`**: `.error` belongs to the disposal, `.suppressed` to yours.
6. **Java** (`try-with-resources`, 2011) is the design's ancestor; **Python** (`with`, context managers) and JavaScript share LIFO; only JS has asynchronous release in the standard.
7. **Node.js already ships it**: real handles (`fs/promises`, `FileHandle`) implement the contract — you can release real resources without a polyfill.

## Next Chapter

→ **[Chapter 12: Modern APIs and TC39 Proposals](./cap-12)**: `using` is only a sample of how fast ECMAScript moves. The final chapter sweeps through the modern APIs (iterator helpers, `Promise.withResolvers`, `Error.isError`, import attributes) and how to read the proposals still on the way.