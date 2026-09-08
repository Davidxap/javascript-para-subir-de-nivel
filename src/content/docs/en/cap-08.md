---
title: "Chapter 8: Behavioral Patterns and Events (Observer, Mediator, Strategy)"
---

# Chapter 8: Behavioral Patterns and Events (Observer, Mediator, Strategy)

## Introduction

In chapter 7 you learned to control how objects are created. Now the objects exist and have to talk to each other — and that is where systems turn into a knot: every component knows every component, nobody ever unsubscribes, and changing an algorithm means touching ten places.

**Behavioral patterns** attack communication and the delegation of responsibilities:

- **Observer**: a state change notifies all the interested parties, without them knowing each other.
- **Mediator**: communication between many pieces goes through a central point, instead of wiring everyone to everyone.
- **Strategy**: a behavior becomes an algorithm that can be swapped at runtime.

They are the foundation of event-driven systems (the DOM, Node.js, reactive architectures). As always, you will see the problem behind each one, its implementation in modern JavaScript, and the version Python and Java give to the same idea.

## 1. Observer

### The problem: your component finds out about changes by asking

The naive way to know if something changed is to ask yourself, over and over:

```javascript
setInterval(() => {
  if (servidor.estado !== ultimoEstado) {
    actualizarUI(servidor.estado)
    ultimoEstado = servidor.estado
  }
}, 1000)
```

That is called **polling**: you burn CPU every second, the UI updates late and, worst of all, the component that asks has to know `servidor`'s internals. The **Observer** flips the flow: the thing that changes *notifies*, and the interested parties subscribe to receive the alert. Nobody asks, nobody knows each other.

```javascript
class EventEmitter {
  constructor() {
    this.eventos = new Map()
  }

  on(evento, callback) {
    if (!this.eventos.has(evento)) {
      this.eventos.set(evento, [])
    }
    this.eventos.get(evento).push(callback)
    return this
  }

  emit(evento, ...args) {
    const callbacks = this.eventos.get(evento)
    if (callbacks) {
      callbacks.forEach(cb => cb(...args))
    }
    return this
  }

  off(evento, callback) {
    const callbacks = this.eventos.get(evento)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) callbacks.splice(index, 1)
    }
    return this
  }
}

const notificaciones = new EventEmitter()

const onMensaje = (texto) => console.log(`Nuevo mensaje: ${texto}`)
const onAlerta = (texto) => console.log(`Alerta: ${texto}`)

notificaciones.on("mensaje", onMensaje)
notificaciones.on("alerta", onAlerta)

notificaciones.emit("mensaje", "Hola David")
notificaciones.emit("alerta", "Servidor caído")
```

The subject (`EventEmitter`) only knows a list of callbacks per event: it does not know who the subscribers are, and they do not know about each other. That decoupling is what makes it useful.

### When to use it

- When a change must notify a (possibly varying) list of interested parties.
- When the emitter and the receivers should not know each other.
- Real examples: Node's `events` module, `addEventListener` in the DOM, pub/sub systems.

### Connection with Python

**Translates directly**: Python has no `EventEmitter` in its standard library, but the pattern is implemented the same way, with a dictionary of lists:

```python
class EventEmitter:
    def __init__(self):
        self.eventos = {}

    def on(self, evento, callback):
        self.eventos.setdefault(evento, []).append(callback)
        return self

    def emit(self, evento, *args):
        for callback in self.eventos.get(evento, []):
            callback(*args)

    def off(self, evento, callback):
        if evento in self.eventos and callback in self.eventos[evento]:
            self.eventos[evento].remove(callback)
        return self
```

**Change of scene**: the difference here is ecosystem, not pattern. In Node.js the `EventEmitter` comes in the standard library (`require("node:events")`); in Python you write it by hand or reach for a library (for example `pyee`, a port of Node's). The dictionary-of-callbacks mechanism is identical.

### Connection with Java

**Translates directly**: Java handles the Observer with listener interfaces. The old version (`java.util.Observable`/`Observer`) has been deprecated since Java 9; the modern approach is listener interfaces and `PropertyChangeSupport`:

```java
class Usuario {
    private final PropertyChangeSupport cambios = new PropertyChangeSupport(this);

    public void onEstadoCambia(PropertyChangeListener listener) {
        cambios.addPropertyChangeListener(listener);
    }
}
```

**Change of scene**: in Java notification goes through interfaces — a class must `implements ActionListener`, and adding/removing listeners is managed by hand. In JavaScript a callback is a first-class function: you subscribe by passing the function directly. The DOM does the same thing as your `EventEmitter` with an `addEventListener` you can also cancel with an `AbortController`.

## 2. Mediator

### The problem: the components all know each other

Imagine a chat with three users. The naive approach wires every user to the rest: `ana.enviar(mensaje, david)`, `luis.enviar(mensaje, ana)`... with ten users that is ninety connections, and every change (new recipient type, moderation) touches everyone. The **Mediator** acts as a switchboard: the users do not know each other, they only know the mediator, and it decides who gets what.

```javascript
class ChatMediator {
  constructor() {
    this.usuarios = new Map()
  }

  registrar(usuario) {
    this.usuarios.set(usuario.nombre, usuario)
    usuario.mediator = this
  }

  enviar(mensaje, de, para) {
    const destinatario = this.usuarios.get(para)
    if (destinatario) {
      destinatario.recibir(mensaje, de)
    }
  }
}

class Usuario {
  constructor(nombre) {
    this.nombre = nombre
    this.mediator = null
  }

  enviar(mensaje, para) {
    this.mediator.enviar(mensaje, this.nombre, para)
  }

  recibir(mensaje, de) {
    console.log(`${this.nombre} recibió de ${de}: ${mensaje}`)
  }
}

const chat = new ChatMediator()

const david = new Usuario("David")
const ana = new Usuario("Ana")

chat.registrar(david)
chat.registrar(ana)

david.enviar("Hola Ana, ¿cómo vas?", "Ana")
// Ana recibió de David: Hola Ana, ¿cómo vas?
```

### When to use it

- When many objects interact and direct coupling becomes unsustainable.
- When you want to reuse components that should not know their collaborators.
- The trade-off: the mediator can grow too big (we see it in the debugging scenario).

### Connection with Python

**Translates directly**: the implementation is identical, with a dictionary and an instance attribute:

```python
class ChatMediator:
    def __init__(self):
        self.usuarios = {}

    def registrar(self, usuario):
        self.usuarios[usuario.nombre] = usuario
        usuario.mediator = self

    def enviar(self, mensaje, de, para):
        destinatario = self.usuarios.get(para)
        if destinatario:
            destinatario.recibir(mensaje, de)

class Usuario:
    def __init__(self, nombre):
        self.nombre = nombre
        self.mediator = None

    def enviar(self, mensaje, para):
        self.mediator.enviar(mensaje, self.nombre, para)

    def recibir(self, mensaje, de):
        print(f"{self.nombre} recibió de {de}: {mensaje}")
```

**Change of scene**: none in the mechanics — in both languages the users do not know anyone else and everything goes through the mediator. The only practical difference is that in Python the real-world "mediator" is usually a queue or a message bus (see the Java connection), while in JavaScript you find it written by hand in every chat or board architecture.

### Connection with Java

**Translates directly**: there is no mediator in the Java standard library, but the skeleton is the same with interfaces:

```java
interface Componente {
    void recibir(String mensaje, String de);
}

class MediadorChat {
    Map<String, Componente> usuarios = new HashMap<>();

    void registrar(String nombre, Componente c) {
        usuarios.put(nombre, c);
    }

    void enviar(String mensaje, String de, String para) {
        Componente destino = usuarios.get(para);
        if (destino != null) destino.recibir(mensaje, de);
    }
}
```

**Change of scene**: in the Java world this pattern is rarely written by hand — it is solved with infrastructure: event buses, queues, and message brokers (JMS), where the "mediator" is a server. The concept is the same — a central point that forwards, and the parties do not know each other — but the scale is different. In JavaScript the pattern usually fits in half a page, and that is its charm.

## 3. Strategy

### The problem: one `if/else` per variant of the algorithm

As validation rules grow, every method fills with branches:

```javascript
function validar(tipo, valor) {
  if (tipo === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
  } else if (tipo === "telefono") {
    return /^\+?[\d\s-]{7,15}$/.test(valor)
  } else if (tipo === "obligatorio") {
    return valor !== null && valor !== undefined && valor !== ""
  }
}
```

Each new rule adds another branch to the same method, and the day you want to validate with a different rule in one specific form, you have to touch the shared function. The **Strategy** extracts each algorithm into its own piece and groups them in a map: changing behavior is no longer editing branches, it is *choosing a strategy*.

```javascript
const estrategias = {
  email: (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
  telefono: (valor) => /^\+?[\d\s-]{7,15}$/.test(valor),
  obligatorio: (valor) => valor !== null && valor !== undefined && valor !== "" && valor !== 0
}

class Validador {
  constructor(estrategia) {
    this.estrategias = estrategias
    this.setEstrategia(estrategia)
  }

  setEstrategia(nombre) {
    if (!estrategias[nombre]) {
      throw new RangeError(`Estrategia desconocida: '${nombre}'`)
    }
    this.estrategia = estrategias[nombre]
  }

  validar(valor) {
    return this.estrategia(valor)
  }
}

const validador = new Validador("email")

validador.validar("david@ejemplo.com") // true
validador.setEstrategia("telefono")
validador.validar("+57 300 123 4567") // true
validador.setEstrategia("obligatorio")
validador.validar("") // false
```

### Advantages

- Every algorithm is isolated and can be tested separately.
- Changing strategy does not modify the context using it (open/closed principle).
- An unknown strategy now fails with a clear, early error (chapter 6).

### Connection with Python

**Translates directly**: Python callables are first-class functions, so the strategy map is just as direct:

```python
import re

def validar_email(valor):
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', valor))

def validar_obligatorio(valor):
    return valor is not None and valor != ""

estrategias = {
    "email": validar_email,
    "obligatorio": validar_obligatorio,
}
```

**Change of scene**: none in the idea. The subtle difference is idiomatic: in Python each strategy is more often a named function (or a class with `__call__`), and in JavaScript anonymous closures in an object literal — but both store the strategies as values and swap them at runtime.

### Connection with Java

**Translates directly**: the canonical Strategy example in Java is *in the standard library*: `Comparator<T>`. Sorting with a concrete strategy is passing one as an argument:

```java
Collections.sort(usuarios, Comparator.comparing(Usuario::getNombre));
```

**Change of scene**: in Java strategies are declared as **interfaces** — each algorithm is a class implementing `compare` — and in JavaScript they are functions in a map. Both allow swapping the algorithm without touching the code that uses it; JavaScript's gain is that you do not need to declare a type or a class for each strategy: a function is enough.

## Debugging in practice

### When each pattern goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| The UI updates late and with delay | Polling is used instead of an Observer | Notify with an `EventEmitter`/`addEventListener` |
| `TypeError: validador.estrategia is not a function` | `setEstrategia` got a name that is not in the map | Validate the name and fail with a `RangeError` in the `set` |
| The mediator has twenty methods and the tests explode | It became a "God Object" that knows every detail | Split it into per-domain mediators, or move to events |

### Scenario 1: an Observer that leaks memory

```javascript
class SistemaNotificaciones {
  constructor() {
    this.suscriptores = new Map()
  }

  on(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, new Set())
    }
    this.suscriptores.get(evento).add(callback)
    return () => this.suscriptores.get(evento)?.delete(callback)
  }
}

const sistema = new SistemaNotificaciones()
const suscriptor = () => console.log("aviso")
sistema.on("mensaje", suscriptor)
```

Do you see the problem? `sistema` holds a strong reference to `suscriptor` as long as it lives. If the component that subscribed mounts and unmounts (SPA screens, DOM listeners), the callbacks nobody unsubscribes **accumulate references** and the garbage collector cannot free anything. The fix is twofold:

1. Make `on` **return the unsubscribe function** (like in this code) and have whoever subscribes call it when they stop caring.
2. In the DOM, use `AbortController`: `addEventListener(evento, fn, { signal })` and `controller.abort()` takes the listener down with its context.

As a bonus in class-heavy code, `WeakMap`/`WeakSet` as the subscriber store also lets the GC clean up when the *emitter* dies — but it does not replace unsubscribing: the strong reference can be in the other direction.

### Scenario 2: the mediator that became a god

A mediator starts out "just ordering the communication", and over time it ends up with business rules, validation, and persistence:

```javascript
class MediadorCreciente {
  enviar() { /* forwards messages */ }
  moderar() { /* moderation rules */ }
  persistir() { /* saves to the DB */ }
  notificarAdmin() { /* alerts */ }
  // ...20 more methods that know every component by name
}
```

The signs that it got out of hand: more than ten methods, it knows implementation details of its collaborators, and the tests require building it with half the app. The fix is not deleting it — it is **splitting the mediator by domain** (a `ChatMediator`, a `ModeracionMediator`), or moving the heavy logic to events: the mediator only forwards, and each subscriber decides. If the pattern centralizes too much, the problem is not the pattern — it is the size of what it centralizes.

## Practice and exercises

### 1. Review questions

<details>
<summary><b>1. What concrete problem does the Observer solve, and why does it avoid polling?</b></summary>

**Explanation**: the interested party stops asking whether something changed and instead gets notified when it changes. The emitter alerts its list of callbacks and the subscriber does not know the emitter's internals; nobody wastes CPU asking at intervals.
</details>

<details>
<summary><b>2. Why does an Observer without unsubscription leak memory?</b></summary>

**Explanation**: the emitter holds a strong reference to every callback while it lives. If the object that subscribed disappears, the emitter's list still holds its function and the garbage collector cannot free anything. Unsubscribing (returning a function that deletes the callback) cuts that reference.
</details>

<details>
<summary><b>3. What does the chat gain from a Mediator versus each user knowing the others?</b></summary>

**Explanation**: with N users, direct coupling creates N×N connections; with the mediator, each user only knows the mediator, and adding a new recipient does not touch the existing ones. Centralization puts the routing logic in a single place.
</details>

<details>
<summary><b>4. How does Strategy improve on the classic `if/else` of algorithms?</b></summary>

**Explanation**: each variant is isolated in its own function and grouped in a map; adding a new rule is adding an entry, not nesting another branch. Switching behavior at runtime is choosing another strategy, without touching the context that uses it.
</details>

<details>
<summary><b>5. What is the Observer version in Node's standard library and in the DOM?</b></summary>

**Explanation**: the `events` module (the official `EventEmitter`) in Node, and `addEventListener`/`removeEventListener` (plus `AbortController`) in the DOM. Both are the same pattern: you subscribe with a function and get notified when the event fires.
</details>

### 2. Explain it in your own words

> **Challenge**: explain these three patterns to a friend coming from Python using the **radio** metaphor: the **Observer** is the station that broadcasts and anyone who tunes in receives it without knowing each other; the **Mediator** is a building's switchboard — to call someone you go through the switchboard, you do not shout at your neighbor; the **Strategy** is changing the antenna filter: the receiver stays the same, you only swap the piece that processes the signal. Then explain what happens to each metaphor if you forget to unsubscribe, if the switchboard grows without limit, and if you pick a filter that does not exist.
> *Hint: if in doubt, reread [Section 1](#1-observer), [Section 2](#2-mediator) and [Section 3](#3-strategy).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): notification system with unsubscription

**Goal**: implement your own Observer with `on`, `off`, and `emit`, and prove that unsubscribing really cuts the alert.

**Statement**: create a class `SistemaNotificaciones` where:
1. `on(evento, callback)` registers the callback per event and **returns a function** that unsubscribes it.
2. `off(evento, callback)` removes only that callback.
3. `emit(evento, ...args)` runs the callbacks in order.
4. Check that after unsubscribing, a new `emit` no longer notifies.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use a `Map` of event → array (or `Set`) of callbacks.
2. `on` must return `return () => this.off(evento, callback)` so the subscriber can keep the unsubscribe function.
3. `emit` walks a copy of the array and calls each callback with the extra arguments (`callback(...args)`).

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class SistemaNotificaciones {
  constructor() {
    this.suscriptores = new Map()
  }

  on(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, new Set())
    }
    this.suscriptores.get(evento).add(callback)
    return () => this.off(evento, callback)
  }

  off(evento, callback) {
    this.suscriptores.get(evento)?.delete(callback)
  }

  emit(evento, ...args) {
    this.suscriptores.get(evento)?.forEach(callback => callback(...args))
  }
}

const sistema = new SistemaNotificaciones()

const desuscribir = sistema.on("mensaje", (texto) => {
  console.log(`Mensaje recibido: ${texto}`)
})

sistema.emit("mensaje", "Hola mundo") // Mensaje recibido: Hola mundo

desuscribir()
sistema.emit("mensaje", "Este ya no se ve") // nothing happens
```

**Why does it work?** `on` returns a function that captures the event and the callback, and `off` deletes them from the `Set`. By keeping that return, whoever subscribed holds the key to unsubscribe without needing to remember the original callback: it is the same mechanism you will later see in real APIs like React cleanup functions. The `emit` with `forEach` guarantees order and, by traversing a copy under the hood, subscription changes during an `emit` do not break the iteration.

</details>

#### Exercise 2 (Intermediate): chat with Mediator, private messages, and broadcast

**Goal**: extend the chapter's chat so the mediator supports private messages, broadcasting to everyone, and history.

**Statement**: implement a `ChatMediator` that:
1. Registers users and tells everyone "X se ha unido al chat".
2. `enviar(mensaje, de, para = null)` sends privately if `para` has a value, or broadcasts to everyone except the sender if it is `null`.
3. Stores every message (with a `timestamp`) in a history accessible through `obtenerHistorial()`.
4. Has the users delegate their sending to the mediator, without knowing each other.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. The history is an array of objects `{ de, para, mensaje, timestamp }`.
2. The broadcast walks `this.usuarios` and skips the sender with `nombre !== de`.
3. `recibir` prints with the format `[nombre] De origen: mensaje`, and `registrar` must assign `usuario.mediator = this` before any use.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class ChatMediator {
  constructor() {
    this.usuarios = new Map()
    this.historial = []
  }

  registrar(usuario) {
    this.usuarios.set(usuario.nombre, usuario)
    usuario.mediator = this
    const aviso = `${usuario.nombre} se ha unido al chat`
    this.historial.push({ de: "Sistema", para: null, mensaje: aviso, timestamp: new Date() })
    this.difundir(aviso, "Sistema")
  }

  enviar(mensaje, de, para = null) {
    this.historial.push({ de, para, mensaje, timestamp: new Date() })

    if (para) {
      this.usuarios.get(para)?.recibir(mensaje, de)
    } else {
      this.difundir(mensaje, de)
    }
  }

  difundir(mensaje, de) {
    this.usuarios.forEach((usuario, nombre) => {
      if (nombre !== de) usuario.recibir(mensaje, de)
    })
  }

  obtenerHistorial() {
    return [...this.historial]
  }
}

class UsuarioChat {
  constructor(nombre) {
    this.nombre = nombre
    this.mediator = null
  }

  enviar(mensaje, para = null) {
    if (this.mediator) {
      this.mediator.enviar(mensaje, this.nombre, para)
    }
  }

  recibir(mensaje, de) {
    console.log(`[${this.nombre}] De ${de}: ${mensaje}`)
  }
}

const chat = new ChatMediator()
const david = new UsuarioChat("David")
const ana = new UsuarioChat("Ana")
const luis = new UsuarioChat("Luis")

chat.registrar(david) // [David] De Sistema: David se ha unido al chat
chat.registrar(ana)
chat.registrar(luis)

david.enviar("Hola a todos") // broadcast
ana.enviar("Hola David", "David") // private
console.log(chat.obtenerHistorial().length) // 5
```

**Why does it work?** The users never store references to each other: `enviar` only knows the mediator, and the mediator's map decides the destination. The broadcast rule (skip the sender) lives in a single place, and the history centralizes auditing without every user having to keep their own messages — exactly the pattern's advantage: N×N coupling becomes N toward one.

</details>

#### Exercise 3 (Advanced): compression with swappable strategies and real statistics

**Goal**: combine Strategy with real measurement: switch algorithms on the fly and compare truthful statistics for each one.

**Statement**: implement a `SistemaCompresion` that:
1. Offers three strategies (`gzip`, `brotli`, `deflate`), each with a `comprimir(datos)` method returning `{ datos, ratio }`.
2. `setEstrategia(nombre)` swaps the algorithm and throws a `RangeError` if the name does not exist.
3. `comprimir(datos)` measures the real time (`Date.now()` before/after) and accumulates actual input and output bytes.
4. `obtenerEstadisticas()` returns `operaciones`, `bytesEntrada`, `bytesSalida`, `ratioPromedio` (output bytes over input bytes) and `tiempoPromedio`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Store the strategies in an object literal `estrategias` and use it both for the constructor and for `setEstrategia`.
2. The ratio **is calculated**, not invented: `ratioPromedio = bytesSalida / bytesEntrada`.
3. Accumulate `tiempoTotal` to be able to average; abstract the stats delivery in the `estadisticas` object.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
const estrategias = {
  gzip: { comprimir: (datos) => ({ datos: `gzip:${datos}`, ratio: 0.3 }) },
  brotli: { comprimir: (datos) => ({ datos: `brotli:${datos}`, ratio: 0.25 }) },
  deflate: { comprimir: (datos) => ({ datos: `deflate:${datos}`, ratio: 0.35 }) },
}

class SistemaCompresion {
  constructor(estrategiaInicial = "gzip") {
    this.estrategia = estrategias[estrategiaInicial]
    this.estadisticas = { bytesEntrada: 0, bytesSalida: 0, tiempoTotal: 0, operaciones: 0 }
  }

  setEstrategia(nombre) {
    if (!estrategias[nombre]) {
      throw new RangeError(`Estrategia '${nombre}' no disponible`)
    }
    this.estrategia = estrategias[nombre]
  }

  comprimir(datos) {
    const inicio = Date.now()
    const resultado = this.estrategia.comprimir(datos)
    const tiempoReal = Date.now() - inicio

    this.estadisticas.bytesEntrada += datos.length
    this.estadisticas.bytesSalida += resultado.datos.length
    this.estadisticas.tiempoTotal += tiempoReal
    this.estadisticas.operaciones++

    return { ...resultado, tiempoReal }
  }

  obtenerEstadisticas() {
    const { bytesEntrada, bytesSalida, tiempoTotal, operaciones } = this.estadisticas
    return {
      operaciones,
      bytesEntrada,
      bytesSalida,
      ratioPromedio: bytesEntrada > 0 ? +(bytesSalida / bytesEntrada).toFixed(4) : 0,
      tiempoPromedio: operaciones > 0 ? +(tiempoTotal / operaciones).toFixed(1) + "ms" : "0ms",
    }
  }
}

const sistema = new SistemaCompresion("gzip")
const datos = "Datos de prueba para compresión".repeat(100)

console.log(sistema.comprimir(datos).datos.slice(0, 5)) // gzip:
console.log(sistema.comprimir(datos).datos.slice(0, 7)) // brotli:

sistema.setEstrategia("brotli")
console.log(sistema.obtenerEstadisticas())
// { operaciones: 2, bytesEntrada: ..., bytesSalida: ..., ratioPromedio: ~0.34, tiempoPromedio: "0.0ms" }

try {
  sistema.setEstrategia("lz4")
} catch (error) {
  console.log(error instanceof RangeError) // true
}
```

**Why does it work?** The strategies are values in the map, so `this.estrategia` is always an object with `comprimir` — swapping algorithms is reassigning that reference. The statistics measure what actually happened (`datos.length` in against `resultado.datos.length` out), not a decorative number, so the comparison between `gzip`, `brotli`, and `deflate` is honest. And the `RangeError` reuses the lesson from chapter 6: a misspelled name fails early with a message that says exactly what happened.

</details>

## Comparison table across languages

| Aspect | JavaScript | Python |
|---|---|---|
| Standard Observer | `EventEmitter` in `node:events`, `addEventListener` in the DOM | Not in the stdlib; implemented with dictionaries (or `pyee`) |
| Mediator | Hand-written class in half a page | Hand-written class, identical; or external queues/buses |
| Strategy | Functions in an object literal | Functions/callables in a dictionary |
| Unsubscription | Function returned by `on`, or `AbortController` | `remove` over the list, or context managers |
| Real-world event logic | First-class (Node, DOM, reactive) | External libraries and frameworks |

| Aspect | JavaScript | Java |
|---|---|---|
| Observer | First-class callbacks | Listener interfaces + `PropertyChangeSupport` |
| Mediator | Manual, minimal | Event buses, queues, JMS brokers |
| Strategy | Functions in a map | `Comparator<T>` in the stdlib, interfaces |
| Notification template | Direct notification to functions | Adding/removing listeners from an object by hand |
| Boilerplate | None — a function is enough | High — delegates and interfaces |

## Chapter summary

1. **Observer** inverts the flow: the thing that changes notifies, and interested parties subscribe — the emitter and the receivers never know each other.
2. Unsubscription is mandatory: if `on` does not return a way to cancel, you accumulate references and leak memory.
3. **Mediator** reduces N×N coupling to N toward a central point that decides who gets what.
4. The mediator's trade-off is that it grows without limit; split it by domain or move to events before it becomes a God Object.
5. **Strategy** turns each algorithm variant into a piece of the map, and hot-swapping it does not touch the context.
6. In all three, the pattern is real: `EventEmitter` and `addEventListener`, `Comparator` in Java, callables in Python.
7. The over-engineering sign stays the same: a pattern without a concrete problem to solve.

## Next Chapter

→ **[Chapter 9: State Architectures (MVC and Derivatives in Node.js)](./cap-09)**: Now that you know how behavioral patterns communicate, we move to organizing application state: who keeps the data, who updates the view, and who tells the rest — with the MVC architecture and its variants in Node.