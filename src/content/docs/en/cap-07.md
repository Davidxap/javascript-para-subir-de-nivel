---
title: "Chapter 7: Creational Patterns (Factory, Singleton, Builder)"
---

# Chapter 7: Creational Patterns (Factory, Singleton, Builder)

## Introduction

So far you learned how to organize data (chapter 5) and how to fail on purpose (chapter 6). But there is something you do in every example without a second thought: create objects. And the most direct way — manual `new` everywhere, with every piece of configuration repeated — becomes a problem as the code grows: you change the constructor and have to hunt down every call site, or two instances of the same thing coexist without you noticing and the state starts to drift.

**Creational patterns** attack exactly that: they decouple creation from use. They are not magic, they are answers to concrete problems:

- **Factory**: decides which concrete object gets created based on a criterion.
- **Singleton**: guarantees that a thing exists once, and only once.
- **Builder**: assembles complex objects piece by piece, instead of one giant constructor.

In this chapter you will see the problem behind each one, its implementation in modern JavaScript, and the version Python and Java give to the same idea — because all three languages solve the same thing with different tools.

## 1. Factory

### The problem: `new` repeated across the codebase

When you create an object by hand, every site repeats the same wiring:

```javascript
const admin = {
  nombre,
  rol: "admin",
  permisos: ["leer", "escribir", "eliminar"],
  describir() { return `Admin ${this.nombre} con permisos completos` }
}
```

You duplicate that logic in every module that needs an admin, and the day permissions gain a new field you have to chase it through every copy. The **Factory** centralizes that decision: a function (or class) that receives a criterion and returns the right object shape.

```javascript
function crearUsuario(tipo, nombre) {
  switch (tipo) {
    case "admin":
      return {
        nombre,
        rol: "admin",
        permisos: ["leer", "escribir", "eliminar"],
        describir() {
          return `Admin ${this.nombre} con permisos completos`
        }
      }
    case "editor":
      return {
        nombre,
        rol: "editor",
        permisos: ["leer", "escribir"],
        describir() {
          return `Editor ${this.nombre} con permisos de lectura y escritura`
        }
      }
    default:
      return {
        nombre,
        rol: "user",
        permisos: ["leer"],
        describir() {
          return `Usuario ${this.nombre} con permisos de solo lectura`
        }
      }
  }
}

const admin = crearUsuario("admin", "David")
const editor = crearUsuario("editor", "Ana")
```

The caller stops knowing which concrete shape it receives — it only knows it got a user that knows how to `describir` itself. If you take the same idea to classes, the factory lets you return real **subtypes** based on the condition, and the decision logic lives in a single place.

### When to use it

- When the creation logic can vary based on a criterion.
- When you want to centralize creation so a single piece decides.
- When the caller should not be coupled to a concrete class.

### Connection with Python

**Translates directly**: Python has no special tool for this either — the pattern is a function that decides which instance to build.

```python
def crear_usuario(tipo, nombre):
    if tipo == "admin":
        return Usuario(nombre, rol="admin", permisos=["leer", "escribir", "eliminar"])
    if tipo == "editor":
        return Usuario(nombre, rol="editor", permisos=["leer", "escribir"])
    return Usuario(nombre, rol="user", permisos=["leer"])
```

**Change of scene**: Python usually goes one step further and skips the function entirely: named constructors via `@classmethod` (`Usuario.admin("David")`) put the criterion directly on the class, and creation becomes self-documenting. JavaScript has no `classmethod` — the factory function is the natural equivalent.

### Connection with Java

**Translates directly**: Java is the home of the pattern (it came from *Design Patterns*); here the typical factory is a `static` method:

```java
public static Usuario crear(String tipo, String nombre) {
    return switch (tipo) {
        case "admin" -> new Usuario(nombre, "admin", List.of("leer", "escribir", "eliminar"));
        case "editor" -> new Usuario(nombre, "editor", List.of("leer", "escribir"));
        default -> new Usuario(nombre, "user", List.of("leer"));
    };
}
```

**Change of scene**: in Java the factory is not a luxury — `new` always returns the exact class you named, so "returning a subtype based on a condition" is only possible through a factory. In JavaScript, with functions and object literals, the pattern sometimes shrinks to three lines; if that is your case, three lines are just fine.

- Is a factory worth it if you create the object in a single place? No: the pattern pays off when creation is repeated or the criterion changes. Otherwise it is over-abstraction.
- Does the factory have to return classes? No. It returns whatever the rest of the code needs — what matters is that the criterion lives in one place.

## 2. Singleton

### The problem: two connections that should be one

If every module opens its own database connection, you end up with two connections, two states, and nobody synchronizing them:

```javascript
const con1 = crearConexion()
const con2 = crearConexion()
con1 === con2 // false — two connections, two threads of state
```

The **Singleton** guarantees that an operation always returns the same instance: a single access point for something that should exist only once (configuration, connection pool, one-entry cache).

### Implementation with a closure

```javascript
const crearConexionBD = (function () {
  let instancia = null

  return function () {
    if (instancia) return instancia

    instancia = {
      host: "localhost",
      puerto: 5432,
      conectar() {
        console.log(`Conectado a ${this.host}:${this.puerto}`)
      }
    }

    return instancia
  }
})()

const con1 = crearConexionBD()
const con2 = crearConexionBD()

console.log(con1 === con2) // true
```

The `instancia` variable stays trapped inside the closure: no one outside that IIFE can touch it, and the only way to get the connection is through the function.

### Implementation with a class

```javascript
class Configuracion {
  static instancia = null

  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = new Configuracion()
    }
    return Configuracion.instancia
  }

  constructor() {
    this.entorno = "produccion"
    this.apiURL = "https://api.ejemplo.com"
  }
}

const config1 = Configuracion.obtenerInstancia()
const config2 = Configuracion.obtenerInstancia()

console.log(config1 === config2) // true
```

### When to be careful

- A Singleton is a disguised global state: if the tests use this class and leave modified values behind, the next test starts contaminated.
- In a `worker_threads` environment, each thread loads its own module registry: the Singleton lives per thread and is not shared.

### Connection with Python

**Change of scene**: Python has no private constructors, so the classic class-based Singleton is not the idiom. The common approach is a module-level object, which by definition exists only once:

```python
# conexion.py
conexion = {"host": "localhost", "puerto": 5432}
```

**Translates directly**: if you really want the class version, a `@singleton` decorator or a metaclass can do it — but in practice the module is the Pythonic answer: `import` already gives you the "global access point" with zero extra code.

### Connection with Java

**Translates directly**: Java is the canonical case — private constructor plus a `static` method that always returns the same instance:

```java
public class Config {
    private static Config instancia;
    private Config() {}

    public static Config obtener() {
        if (instancia == null) instancia = new Config();
        return instancia;
    }
}
```

**Change of scene**: in Java the private constructor really blocks `new` from outside — the pattern is an actual language barrier. In JavaScript there is no private constructor by default (`#private` fields do not block `new`), so the JS Singleton is more of a **convention** than a guarantee. And *Effective Java* recommends skipping even that: use an `enum` with a single value. Same as in Python: unless you truly need the class, a single object is enough.

- What is the threshold for a legitimate Singleton? Global configuration, a pool, a cache — things that *must* be one. If it is any class that "probably will be one", you are likely creating hidden state.
- How do you escape the tests problem? Inject the instance into whoever uses it and let tests replace it, instead of having everyone import the Singleton directly.

## 3. Builder

### The problem: the constructor with ten parameters

When an object needs many pieces, the positional constructor becomes unreadable. What does this call mean?

```javascript
const objeto = new Configurable("leer", "escribir", true, 10, "asc", "usuarios")
```

You cannot tell what that `true` or that `"asc"` is without reading the signature. The **Builder** replaces it with named steps: every piece of the object is configured with a method that says what it does, and a final `construir()` operation assembles the result.

```javascript
class ConsultaSQL {
  constructor() {
    this._select = "*"
    this._from = ""
    this._where = ""
    this._orderBy = ""
    this._limit = ""
  }

  select(campos) {
    this._select = campos
    return this
  }

  from(tabla) {
    this._from = tabla
    return this
  }

  where(condicion) {
    this._where = `WHERE ${condicion}`
    return this
  }

  orderBy(campo) {
    this._orderBy = `ORDER BY ${campo}`
    return this
  }

  limit(n) {
    this._limit = `LIMIT ${n}`
    return this
  }

  construir() {
    return `SELECT ${this._select} FROM ${this._from} ${this._where} ${this._orderBy} ${this._limit}`.replace(/\s+/g, " ").trim()
  }
}

const consulta = new ConsultaSQL()
  .select("nombre, email")
  .from("usuarios")
  .where("activo = true")
  .orderBy("nombre ASC")
  .limit(10)
  .construir()

// SELECT nombre, email FROM usuarios WHERE activo = true ORDER BY nombre ASC LIMIT 10
```

### Advantages

- Every step is optional and named: it reads like a sentence, not a pile of arguments.
- The same construction process can produce different configurations depending on which steps you chain.
- If a step is missing, it is easy to validate in `construir()` and fail with a clear error (remember chapter 6).

### Connection with Python

**Change of scene**: in Python the Builder is rare — and for a good reason. Keyword arguments with defaults already solve the "constructor with ten parameters":

```python
@dataclass
class Consulta:
    select: str = "*"
    from_: str = ""
    donde: str = ""
    orden: str = ""
    limite: int | None = None

consulta = Consulta(select="nombre, email", from_="usuarios", donde="activo = true")
```

**Translates directly**: if the object is not a simple data holder but its construction has rules (mandatory steps, valid orders), the Builder does make sense in Python — it just is not the default idiom.

### Connection with Java

**Translates directly**: in Java you do not even need to invent the Builder — it is in the standard library and you have probably used it:

```java
String sql = new StringBuilder()
        .append("SELECT ")
        .append(nombre)
        .append(" FROM usuarios")
        .toString();
```

**Change of scene**: step-by-step construction is so common in Java that frameworks like Lombok generate builders from a single annotation, because long constructors are the daily pain. In JavaScript the natural idiom for data objects is the object literal and spread — the Builder makes sense when construction has logic, not to group fields together.

- Builder or object literal + `Object.assign`? If you are only grouping data, a literal with spread is more idiomatic JavaScript. The builder wins when there are mandatory steps, validation, or different representations from the same template.
- Why does every method return `this`? Because without it the chain breaks: `consultar.select(...).from(...)` would return `undefined`, and the next `.from` throws a `TypeError`.

## Debugging in practice

### When each pattern goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `TypeError: consulta.from is not a function` | A Builder method forgot `return this` and the chain broke | Return `this` in every step |
| "Different" configuration in two files | Each file created its own instance instead of going through the Singleton | Centralize access in `obtenerInstancia()` |
| The factory does nothing but `new` | The pattern was added without any decision criterion to justify it | Add the decision or drop the pattern |

### Scenario 1: the Singleton that ruins your tests

```javascript
class Configuracion {
  static instancia = null
  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = new Configuracion()
    }
    return Configuracion.instancia
  }
  constructor() { this.modo = "produccion" }
}

// test 1
Configuracion.obtenerInstancia().modo = "test"
// test 2
console.log(Configuracion.obtenerInstancia().modo) // "test" — leak
```

The Singleton is a module with state, and the state survives between tests. The fix is not "delete the Singleton" but to control its lifecycle: a `Configuracion.reiniciar()` method for tests, or — better — receive the instance as a parameter (dependency injection) and reserve the Singleton for whoever boots the program.

### Scenario 2: the factory that decides nothing

```javascript
function crearRepositorio(tipo) {
  return new Repositorio(tipo) // just wraps `new` — no decision
}
```

If the factory does not receive a criterion that changes the result, it is a pointless extra layer: callers gain a function that saves them nothing and hides the real class. Before creating a factory, ask yourself what *decisions* it encapsulates. If the answer is "none", plain `new` is more honest.

## Practice and exercises

### 1. Review questions

<details>
<summary><b>1. What concrete problem does the Factory solve, and what is the sign that you are using it without need?</b></summary>

**Explanation**: it solves duplicated creation logic and the caller's coupling to a concrete class, centralizing the "which instance to return" decision. If you create the thing in one place or there is no varying criterion, the sign is clear: you do not need it.
</details>

<details>
<summary><b>2. Why is `con1 === con2` in the closure-based Singleton?</b></summary>

**Explanation**: the `instancia` variable lives inside the closure of the IIFE; the first call creates it and the rest return it without recreating. Since the object is created once and stored there, every later call returns the same reference.
</details>

<details>
<summary><b>3. What role does `return this` play in the Builder, and what error does forgetting it cause?</b></summary>

**Explanation**: `return this` gives you back the same builder so the next call in the chain works. Without it, the method returns `undefined`, the next `.from(...)` is called on `undefined`, and a `TypeError: Cannot read properties of undefined` is thrown.
</details>

<details>
<summary><b>4. Why can a Singleton not be shared across `worker_threads`?</b></summary>

**Explanation**: each worker loads its own module registry, so the module holding the instance is evaluated again in every thread. The Singleton lives per thread, not per process — it is not a magic cross-thread communication channel.
</details>

<details>
<summary><b>5. What is the Pythonic equivalent of a Singleton, and why does it usually not need a class?</b></summary>

**Explanation**: a module-level object. Python has no private constructors and an `import` already guarantees a single copy per process; the classic Singleton class is unnecessary for the typical case — just like in JavaScript a module-level `const` usually suffices before you write a class.
</details>

### 2. Explain it in your own words

> **Challenge**: explain these three patterns to a friend coming from Python using the **restaurant** metaphor: the **Factory** is the chef who takes your order ("something with chicken") and decides which concrete dish you get; the **Singleton** is the one key to the storeroom — a single copy for the whole venue; the **Builder** is assembling the burger step by step instead of ordering it in one giant line. Then explain when each stops being useful and turns into over-engineering.
> *Hint: if in doubt, reread [Section 1](#1-factory), [Section 2](#2-singleton) and [Section 3](#3-builder).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): `crearNotificacion` with different channels

**Goal**: implement your first Factory without classes, with objects sharing the same interface.

**Statement**: write a function `crearNotificacion(tipo, mensaje)` that returns:
1. For `"email"`: an object with `canal: "email"` and a `enviar()` method that does `console.log("Enviando email: " + mensaje)`.
2. For `"sms"`: the same with `canal: "sms"` and an SMS message.
3. For any other type: `canal: "push"` by default.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use `switch (tipo)` or `if/else` and return an object in each branch.
2. The three objects must share the same shape (`canal` + `enviar`), even if the internal message changes.
3. Test the three outputs: `crearNotificacion("email", "Hola")`, `crearNotificacion("sms", "Código 1234")` and `crearNotificacion("weird", "Hola")` — the last one must fall into `push`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function crearNotificacion(tipo, mensaje) {
  switch (tipo) {
    case "email":
      return {
        canal: "email",
        mensaje,
        enviar() { console.log(`Enviando email: ${this.mensaje}`) }
      }
    case "sms":
      return {
        canal: "sms",
        mensaje,
        enviar() { console.log(`Enviando SMS: ${this.mensaje}`) }
      }
    default:
      return {
        canal: "push",
        mensaje,
        enviar() { console.log(`Enviando push: ${this.mensaje}`) }
      }
  }
}
```

**Why does it work?** The caller asks for "a notification" and gets an object with the `{ canal, mensaje, enviar }` interface without knowing which one it is. The criterion ("which channel") lives in a single place: instead of repeating the creation all over the app, one `crearNotificacion` centralizes the decision, and the day a new channel appears you touch a single spot.

</details>

#### Exercise 2 (Intermediate): Singleton with frozen configuration

**Goal**: turn a class into a Singleton and protect its state with `Object.freeze`.

**Statement**: implement a class `Configuracion` that:
1. Has a static method `obtenerInstancia()` that always returns the same instance (static field `instancia`).
2. Initializes `puerto = 8080` and `debug = false` in the constructor.
3. Freezes the instance **before** returning it with `Object.freeze`, so nobody can reassign its properties.
4. Check that `Configuracion.obtenerInstancia() === Configuracion.obtenerInstancia()` is `true`, and that trying `config.puerto = 9090` changes nothing.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use the pattern from the chapter: `static instancia = null` + a condition in `obtenerInstancia()`.
2. Apply `Object.freeze(new Configuracion())` and store *that* as the instance, not the raw object.
3. Freezing is shallow: it only blocks reassigning existing properties; it does not make a `this.debug` nested object immutable.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class Configuracion {
  static instancia = null

  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = Object.freeze(new Configuracion())
    }
    return Configuracion.instancia
  }

  constructor() {
    this.puerto = 8080
    this.debug = false
  }
}

const a = Configuracion.obtenerInstancia()
const b = Configuracion.obtenerInstancia()
console.log(a === b) // true

try {
  a.puerto = 9090
} catch (error) {
  console.log(error instanceof TypeError) // true — your code is a module (strict mode)
}
console.log(a.puerto) // 8080
```

**Why does it work?** `obtenerInstancia()` guarantees uniqueness (it always returns the same reference) and `Object.freeze` turns it from "single" into "read-only": nobody can overwrite `puerto` or `debug` by accident. Beware of a mode detail: in a module (strict mode), writing to a frozen object throws `TypeError`; in non-strict code it is silently ignored. Either way the value stays at `8080` — what changes is the warning. *`Object.freeze` is also shallow: a nested object would still be mutable.*

</details>

#### Exercise 3 (Advanced): `Consulta` builder with validation and multiple `WHERE`s

**Goal**: build a Builder that not only chains steps but **validates** in `construir()` and combines several conditions.

**Statement**: implement a class `Consulta` that:
1. Has methods `select(campos)`, `from(tabla)`, `where(condicion)` (accumulating several), `orderBy(campo)`, `limit(n)` — all returning `this`.
2. In `construir()` throws a `RangeError` with a clear message if `from()` was never called (remember chapter 6).
3. Combines several conditions with ` AND `: `where("activo = true").where("edad > 18")` must produce `WHERE activo = true AND edad > 18`.
4. Produces exactly: `SELECT nombre FROM usuarios WHERE activo = true AND edad > 18 ORDER BY nombre ASC LIMIT 10`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Store the conditions in an array (`this._where = []`) and join them with `.join(" AND ")` when building.
2. The `RangeError` is only thrown in `construir()`, not before: the builder is assembled piece by piece and only at the end do you know if something is missing.
3. Start with a single-condition builder (the one from the chapter) and then scale to several: first `select + from + where`, then the rest.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class Consulta {
  constructor() {
    this._select = "*"
    this._from = ""
    this._where = []
    this._orderBy = ""
    this._limit = ""
  }

  select(campos) {
    this._select = campos
    return this
  }

  from(tabla) {
    this._from = tabla
    return this
  }

  where(condicion) {
    this._where.push(condicion)
    return this
  }

  orderBy(campo) {
    this._orderBy = `ORDER BY ${campo}`
    return this
  }

  limit(n) {
    this._limit = `LIMIT ${n}`
    return this
  }

  construir() {
    if (!this._from) {
      throw new RangeError("Consulta sin tabla: llama a .from() antes de construir")
    }

    const where = this._where.length > 0
      ? `WHERE ${this._where.join(" AND ")}`
      : ""

    const sql = `SELECT ${this._select} FROM ${this._from} ${where} ${this._orderBy} ${this._limit}`
    return sql.replace(/\s+/g, " ").trim()
  }
}

const sql = new Consulta()
  .select("nombre")
  .from("usuarios")
  .where("activo = true")
  .where("edad > 18")
  .orderBy("nombre ASC")
  .limit(10)
  .construir()

console.log(sql)
// SELECT nombre FROM usuarios WHERE activo = true AND edad > 18 ORDER BY nombre ASC LIMIT 10

try {
  new Consulta().select("nombre").construir()
} catch (error) {
  console.log(error instanceof RangeError) // true
  console.log(error.message) // Consulta sin tabla: llama a .from() antes de construir
}
```

**Why does it work?** The `_where` array accumulates conditions and `.join(" AND ")` combines them at the exact moment the SQL is built; because the steps are named and `construir()` validates, an incomplete SQL fails **with a clear, early error** instead of producing a `SELECT * FROM  ` that the database rejects with a confusing message. Notice how the `RangeError` reuses the lesson from chapter 6: fail with the right type and an actionable message.

</details>

## Comparison table across languages

| Aspect | JavaScript | Python |
|---|---|---|
| Idiomatic Factory | Function that returns based on a criterion | Named `@classmethod` (`Usuario.admin(...)`) |
| Idiomatic Singleton | Module-level `const`, or a class with `obtenerInstancia()` | Module-level object |
| Long constructor | Object literal, spread, or Builder | Keyword arguments + `@dataclass` |
| Pattern in the stdlib? | No | No (but `functools` and `dataclasses` cover 90 % of it) |
| Construction validation | In `construir()` | In `__post_init__` of dataclasses |

| Aspect | JavaScript | Java |
|---|---|---|
| Factory | Simple function, no boilerplate | `static` method where `new` is not enough |
| Builder | Implemented by hand with `return this` | `StringBuilder`, `StringBuffer`, and frameworks (Lombok) |
| Singleton guaranteed by the language | No (it is a convention) | Yes, with a private constructor (or an `enum`) |
| Boilerplate | Minimal — object literals are cheap | High — the pattern is almost mandatory for subtypes |

## Chapter summary

1. **Factory** centralizes the decision of what to create: callers stop being coupled to a concrete class.
2. **Singleton** guarantees a single instance with a global access point — but it is global state, and as such it contaminates tests if you do not control its lifecycle.
3. **Builder** replaces the ten-parameter constructor with named steps that return `this`.
4. In JavaScript, object literals and spread already solve half of what demands a Builder in Java; use it when there is real logic or validation in the construction.
5. **Python** solves the same things with modules, `@classmethod`, and `@dataclass`; **Java** needs the patterns more often because `new` is rigid.
6. In all three, the sign of over-engineering is the pattern with no decision to justify it.

## Next Chapter

→ **[Chapter 8: Behavioral Patterns and Events (Observer, Mediator, Strategy)](./cap-08)**: Now that you can control how objects are created, we move to how they communicate: who listens to events, who delegates tasks, and who picks which strategy to use — with their Python and Java counterparts in view.