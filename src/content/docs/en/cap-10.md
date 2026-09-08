---
title: "Chapter 10: Defensive Security (Prototype Pollution, OWASP)"
---

# Chapter 10: Defensive Security (Prototype Pollution, OWASP)

## Introduction

In chapter 9 you saw the model, the controller and the service pass user data between layers. Now for the missing question: **at what point do you trust that data?** The uncomfortable answer is that you never do — the boundary where your application receives external input is the front line of an attack, and defensive security means treating everything external as suspicious until it proves otherwise.

JavaScript, because of its dynamic nature and prototype model, has vulnerabilities that other languages do not have. This chapter covers the two most important:

1. **Prototype Pollution**: poisoning `Object.prototype` to slip properties into every object.
2. **Input sanitization and validation**: what "do not trust" really means, and how to do it for real under the **OWASP** rules (in particular A03:2021 *Injection* and A08:2021 *Software and Data Integrity Failures*).

As always you'll see the Python and Java versions — and here is an honest surprise: this is one of the few chapters where Java's equivalent is *literally* "it does not exist", for design reasons that are worth understanding.

## 1. Prototype Pollution

### The problem: a data merge that poisons every object

A recursive merge (the favorite utility for combining configuration) copies properties from `source` to `target`:

```javascript
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object") {
      merge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}
```

The problem: it does not protect the special `__proto__` key. If the `source` comes from a `JSON.parse`, the `__proto__` key travels as an own property of the object — and in the recursion, `target["__proto__"]` reads as *the prototype of target*, that is `Object.prototype`. Mutating it poisons the prototype chain of **every** object in the process:

```javascript
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
merge({}, payload)

const objetoNormal = {}
console.log(objetoNormal.isAdmin) // true — every object inherits isAdmin without ever declaring it
```

That is Prototype Pollution. With a `merge` exposed to a user request, a single `{"__proto__": {...}}` field grants privileges to any object that later checks permissions through inheritance.

Important nuance: writing `{ __proto__: {...} }` as a literal in your code does **not** create an own property — the literal triggers the prototype setter only on that object. The real threat is the one arriving via `JSON.parse` (the attacker does not write in your code, they send you bytes): there `__proto__` travels as an own enumerable property and does reach the prototype chain in the merge.

### Mitigation

Two defenses, complementary:

**1. Validate dangerous keys in the merge.**

```javascript
function esClaveSegura(clave) {
  return clave !== "__proto__" && clave !== "constructor" && clave !== "prototype"
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) continue
    if (source[key] !== null && typeof source[key] === "object") {
      mergeSeguro(target[key] ??= {}, source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

const payload2 = JSON.parse('{"__proto__": {"isAdmin": true}}')
mergeSeguro({}, payload2)
const limpio = {}
console.log(limpio.isAdmin) // undefined — the key is ignored
```

**2. Use `Object.create(null)` for containers that should not inherit from anyone.**

```javascript
const mapa = Object.create(null)

mapa.__proto__ = "malicioso" // creates an own property called __proto__; nothing to do with the real prototype
console.log(mapa.__proto__)  // "malicioso" (data property), not the prototype
console.log({}.__proto__)    // Object.prototype is still intact
```

### Connection with Python

**Change of scene**: Python has no shortcut equivalent. Its lookup chain is not a mutable object pointed at by `target["__proto__"]`; instance attributes live in `obj.__dict__` and the class is not changed by assigning into it (try `obj.__class__ = X` and you will see the descriptor refuses). The analogous risk does not come from the language but from **unsafe deserialization**:

```python
import pickle, yaml

pickle.load(file_con_datos)       # executes arbitrary objects if the file comes from an attacker
yaml.load(datos, Loader=yaml.FullLoader)  # classic arbitrary-code-execution vectors
```

**Literal translation**: the lesson is the same under another name — "do not merge or deserialize data you cannot verify". In JavaScript the merge is the attack surface; in Python it is loading `pickle`/YAML of unknown origin.

### Connection with Java

**Literally, there is no equivalent**: Java has no Prototype Pollution because it has no prototypes — the class hierarchy is fixed and cannot be mutated by assignment from an object. Writing the attack is impossible by design:

```java
// In Java there is no "obj.__proto__ = {...}" nor "Object.prototype.x = 1"
// The class of an object is not modified from an instance.
```

**Change of scene**: that does not make Java immune to the same *family* of attacks: its analogous surface is **unsafe deserialization** (the `readObject` gadget chains that made Log4Shell famous) and abuse through reflection. The OWASP rule that reminds you of this is the same one as before: **A08:2021 — Software and Data Integrity Failures** (verify the integrity of what you receive, data and code). Where JavaScript is vulnerable through dynamic mutation, Java is through trusting binaries and dependencies.

### Applicable OWASP rules

- **A03:2021 — Injection**: validate and sanitize all user input.
- **A08:2021 — Software and Data Integrity Failures**: verify the integrity of data, configurations and deserializations.

## 2. Input sanitization and validation

### The problem: trusting the user's payload

Everything that reaches your API — query params, body, headers, cookies — is text chosen by a stranger. If you store it as-is, a comment like `Hola <script>...` or an email with quotes can become injected HTML (XSS) or a break in your own validation. The OWASP starting principle: **never trust; separate validation, sanitization and output escaping**.

**Validation** decides whether the data *may* come in (type, length, format). **Sanitization** cleans it before storing. **Output escaping** neutralizes it when rendering (HTML, JS, URL). The three are not the same:

```javascript
function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
  return String(texto).replace(/[&<>"']/g, c => mapa[c])
}

function validarEntrada(datos, esquema) {
  const errores = []
  const limpio = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push(`${campo} es obligatorio`)
      continue
    }

    if (valor === undefined || valor === null) continue

    if (reglas.tipo && typeof valor !== reglas.tipo) {
      errores.push(`${campo} debe ser de tipo ${reglas.tipo}`)
      continue
    }

    if (reglas.max && String(valor).length > reglas.max) {
      errores.push(`${campo} excede el máximo de ${reglas.max} caracteres`)
      continue
    }

    limpio[campo] = typeof valor === "string" ? escaparHtml(valor).trim() : valor
  }

  return { valido: errores.length === 0, errores, datos: limpio }
}

const esquema = {
  nombre: { requerido: true, tipo: "string", max: 100 },
  email: { requerido: true, tipo: "string", max: 200 }
}

const resultado = validarEntrada(
  { nombre: "  David  ", email: "<script>alert(1)</script>" },
  esquema
)

// resultado.datos.email => "&lt;script&gt;alert(1)&lt;/script&gt;" — neutralized
```

Notice the order in `escaparHtml`: `&` is escaped first and then `<`/`>`; if you did it the other way round, the `<` inside `&lt;` would be escaped again and you would end up with `&amp;lt;`.

### Additional OWASP practices

- Use battle-tested validation libraries (Zod, Joi) — do not reinvent email regexes.
- For database queries, **parameterize**, do not sanitize: prepared statements kill SQL injection at the root.
- Apply CSP (Content Security Policy) on the server.
- Escape output according to the context (HTML, JS, URL) — the right escape for one does not work for another.

### Connection with Python

**Literal translation**: Python solves the same thing with Pydantic, which does validation and typing in a single model (the declarative equivalent of a schema):

```python
from pydantic import BaseModel, EmailStr, field_validator, ValidationError

class DatosEntrada(BaseModel):
    nombre: str
    email: EmailStr

    @field_validator("nombre")
    def limpiar_nombre(cls, v):
        if len(v) > 100:
            raise ValueError("El nombre no puede superar 100 caracteres")
        return v.replace("<", "&lt;").replace(">", "&gt;").strip()

try:
    datos = DatosEntrada(nombre="David", email="david@ejemplo.com")
    print(datos.model_dump())
except ValidationError as error:
    print(error.errors())
```

**Change of scene**: Pydantic validates and types at instantiation (`EmailStr` checks the format, not just the `str` type), and the `@field_validator` decorators centralize sanitization. In JavaScript you have Zod with the same declarative philosophy and no class design: you define the schema as an object and `safeParse` returns typed data or errors.

### Connection with Java

**Literal translation**: Java's declarative validation is Bean Validation (`jakarta.validation`), applied to DTOs with annotations and triggered in Spring MVC with `@Valid`:

```java
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DatosEntrada {
    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String nombre;

    @NotBlank
    @Email
    private String email;
}

// In the controller:
public ResponseEntity<?> crear(@Valid @RequestBody DatosEntrada datos) { ... }
```

**Change of scene**: in Java the validation is *in the contract*: `@Valid` fires every annotation before the method runs and the framework returns the errors with a 400 automatically. In JavaScript you build that validation yourself (Zod at the boundary, or the `validarEntrada` above) because nothing enforces it in the signature. And Java has a layer you get by default that JavaScript does not: parameterized queries and the security injection policy of the web container — remember that in JS the discipline is yours.

## Debugging in practice

### When security fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `objetoNormal.isAdmin === true` after a merge | `__proto__`/`constructor` keys not filtered | Validate keys and use `Object.create(null)` |
| An `email` field arrives with double-escaped `&lt;` | Sanitizing already-sanitized data | Escape only at the output boundary, store the original clean value |
| Endpoint A validates and endpoint B does not | Validation scattered and forgotten | Middleware + shared schemas |
| A new library brings a vulnerability | Dependency without review | Dependency mapping and OWASP rule A08 |

### Scenario 1: inconsistent validation

Your API validates with a Zod schema at `/usuarios` but not at `/comentarios`. The day someone posts `<script>` in a comment and it runs in another user's browser, nobody knows where it started: the security rule "applies somewhere" does not exist. The cause is not malice, it is **lack of a standard** — validation was born in the endpoint that needed it and never generalized.

The real fix is centralizing: an Express middleware that validates with shared schemas before reaching the controller (like the advanced exercise below) guarantees that *every* route goes through the same door. A rule that only applies "sometimes" is a rule you might as well not have.

### Scenario 2: the abstraction leak in validation

Two validation libraries coexist in the same app because each team picked its own: errors in different formats, duplicated rules, and nobody knows which schema wins when the same field is validated in two places with conflicting criteria. On top of that, rewriting complex regexes by hand (emails, URLs) to avoid dependencies is where false positives and holes are born.

The fix is a single provider: an adapter wrapping the chosen library (the Strategy pattern from chapter 8) that every endpoint imports. If you switch libraries tomorrow, only the adapter changes. And for the critical cases — emails, URLs, passwords — let a battle-tested, maintained library do the work; your hand-made regex does not have its bug history.

## Practice and exercises

### 1. Review questions

<details>
<summary><b>1. How does Prototype Pollution make every object inherit a property?</b></summary>

**Explanation**: in a recursive `merge`, the `__proto__` key from a `JSON.parse` travels as an own property. When merging, `target["__proto__"]` is read as the target's prototype (that is `Object.prototype`) and the recursion mutates that shared prototype: `Object.prototype.isAdmin = true` is left for every object in the process.
</details>

<details>
<summary><b>2. What two countermeasures exist against Prototype Pollution and what does each bring?</b></summary>

**Explanation**: validating the merge keys (`__proto__`, `constructor`, `prototype`) so they are ignored before touching anything, and `Object.create(null)` for containers whose prototype you do not want to inherit — there, assigning `mapa.__proto__` creates a harmless own property. The first is the active defense; the second, the design one.
</details>

<details>
<summary><b>3. How do validating, sanitizing and escaping differ?</b></summary>

**Explanation**: validating decides whether the data may come in (type, length, format); sanitizing cleans it before storing (removing malformed content); escaping neutralizes it when rendering according to the context (HTML, JS, URL). Over-sanitizing can break legitimate data; under-escaping leaves XSS open.
</details>

<details>
<summary><b>4. Why is inconsistent validation worse than having no validation?</b></summary>

**Explanation**: a rule that applies in some endpoints and not others gives a false sense of security: the attacker looks for the route without a door. The fix is centralizing in a middleware with shared schemas so every input crosses the same boundary.
</details>

<details>
<summary><b>5. Can Java suffer Prototype Pollution? And what is the Python equivalent?</b></summary>

**Explanation**: Java cannot — its class hierarchy is fixed and is not mutated from an instance; its analogous family is unsafe deserialization (`readObject` gadgets) and dependency integrity (A08). Python does not have the `__proto__` shortcut either; its equivalent surface is unsafe deserialization (`pickle`, `yaml.load`) of data you cannot verify.
</details>

### 2. Explain it in your own words

> **Challenge**: imagine your application is an office building with restricted floors (the models and databases). Explain to a friend coming from Java how JavaScript's defensive security works using the **reception access control**: the **visitor** arrives with their data (the user's payload), and nobody gets to the floors just by saying so — the **receptionist validates** their document (type, length, format), **sanitizes** it if needed and **escapes** anything that could run when it comes back out on screen. Then clarify the odd case: someone trying to change the "all doors" sign themselves (Prototype Pollution) — and how the merge must not allow it.
> *Hint: if you hesitate, re-read [Section 1](#1-prototype-pollution) and [Section 2](#2-input-sanitization-and-validation).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): a poisoning-proof merge

**Objective**: detect and prevent Prototype Pollution in a recursive merge.

**Statement**: create a `mergeSeguro` function that:
1. Validates all keys before merging.
2. Blocks `__proto__`, `constructor` and `prototype`.
3. Works with nested objects and does not pollute `Object.prototype` (check it with `{}.isAdmin`).

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use `for...in` to iterate the own and inherited keys of the source object.
2. Check every key with an `includes` against the dangerous-keys list before using it.
3. For the test: `mergeSeguro({}, JSON.parse('{"__proto__": {"isAdmin": true}}'))` and confirm `{}.isAdmin` is still `undefined`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function esClaveSegura(clave) {
  const clavesPeligrosas = ["__proto__", "constructor", "prototype"]
  return !clavesPeligrosas.includes(clave)
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) {
      console.warn(`Clave peligrosa ignorada: ${key}`)
      continue
    }

    if (typeof source[key] === "object" && source[key] !== null) {
      if (typeof target[key] !== "object" || target[key] === null) {
        target[key] = Object.create(null)
      }
      mergeSeguro(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// Test
const seguro = Object.create(null)
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
mergeSeguro(seguro, payload)
console.log({}.isAdmin) // undefined — the global prototype stays clean
```

**Why does it work?** The `esClaveSegura` filter runs before `target[key]` can trade places with the prototype in the recursion. The nested — non-`__proto__` — subkeys merge just the same, and `Object.create(null)` on the subobjects stops a merged object from inheriting `Object.prototype` properties. The `console.warn` leaves a trail of attempts without breaking the merge.
</details>

#### Exercise 2 (Intermediate): complete validation and sanitization

**Objective**: build a per-type validation system with sanitization and descriptive error messages.

**Statement**: create a validator with:
1. Support for the `string`, `number` and `email` types (with `requerido`, `min`, `max` rules).
2. Sanitization that escapes HTML characters before storing.
3. Rejection with per-field errors, without throwing exceptions (returns `{ valido, errores, datos }`).
4. As an optional extension, note why for SQL the real fix is parameterizing, not sanitizing.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. A `validadores` object with one function per type receives `(valor, reglas)` and returns `null` or a message.
2. For emails use a simple regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` — and save the robust ones for battle-tested libraries.
3. The character-map sanitizer avoids the double-escaping bug (`&amp;lt;`): escape `&` first.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
const validadores = {
  string: (valor, reglas) => {
    if (typeof valor !== "string") return "Debe ser texto"
    if (reglas.min && valor.length < reglas.min) return `Mínimo ${reglas.min} caracteres`
    if (reglas.max && valor.length > reglas.max) return `Máximo ${reglas.max} caracteres`
    return null
  },

  number: (valor, reglas) => {
    if (typeof valor !== "number") return "Debe ser número"
    if (reglas.min !== undefined && valor < reglas.min) return `Mínimo ${reglas.min}`
    if (reglas.max !== undefined && valor > reglas.max) return `Máximo ${reglas.max}`
    return null
  },

  email: (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(valor)) return "Email inválido"
    return null
  }
}

function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
  return String(texto).replace(/[&<>"']/g, c => mapa[c])
}

function validar(datos, esquema) {
  const errores = []
  const datosSanitizados = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push({ campo, error: `${campo} es requerido` })
      continue
    }

    if (valor === undefined || valor === null) continue

    const validador = validadores[reglas.tipo]
    if (validador) {
      const error = validador(valor, reglas)
      if (error) {
        errores.push({ campo, error })
        continue
      }
    }

    datosSanitizados[campo] = typeof valor === "string" ? escaparHtml(valor).trim() : valor
  }

  return { valido: errores.length === 0, errores, datos: datosSanitizados }
}

const esquema = {
  nombre: { requerido: true, tipo: "string", min: 2, max: 100 },
  email: { requerido: true, tipo: "email" },
  edad: { tipo: "number", min: 0, max: 150 }
}

const resultado = validar(
  { nombre: "David", email: "david@ejemplo.com", edad: 25 },
  esquema
)
console.log(resultado.valido) // true

const resultado2 = validar({ nombre: "x", email: "mal", edad: 200 }, esquema)
console.log(resultado2.errores)
// [{ campo: "nombre", error: "Mínimo 2 caracteres" },
//  { campo: "email", error: "Email inválido" },
//  { campo: "edad", error: "Máximo 150" }]
```

**Why does it work?** The validators return `null` (ok) or the message (failure), and the loop accumulates every error without stopping at the first one: the user sees the full list at once. The sanitizer escapes `&` before `<`/`>` so it does not double the escapes, and the output is a stable `{ valido, errores, datos }` that any layer from chapter 9 can consume. About SQL: sanitizing quotes does not reliably stop injection — **parameterize** (prepared statements) and you will not need to sanitize anything.
</details>

#### Exercise 3 (Advanced): Express security middleware

**Objective**: centralize security at the boundary with Prototype Pollution detection, suspicious-event logging and basic rate limiting.

**Statement**: build a `SecurityMiddleware` that:
1. Detects and blocks `__proto__`, `constructor` and `prototype` at any depth of the `req.body`.
2. Logs the detected attempts (and the rate-limit rejections) in a queryable log.
3. Applies per-IP rate limiting (max 100 requests / 60 s) answering `429` when exceeded.
4. Lets the rest through with `next()`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. The recursive detection walks `Object.keys` recording the path (`usuario.perfil.__proto__`).
2. Remember the chapter 6 pattern: no `try`/`catch` needed here — the middleware responds and stops, or calls `next()`.
3. The rate limit: a `Map` ip → `{ count, inicio }`; when the window expires, reset `count` to 1.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class SecurityMiddleware {
  constructor() {
    this.eventos = []
    this.rateLimits = new Map()
  }

  detectarPrototypePollution(objeto) {
    const clavesPeligrosas = ["__proto__", "constructor", "prototype"]
    const detectadas = []

    function revisar(nodo, ruta = "") {
      for (const clave of Object.keys(nodo)) {
        const rutaCompleta = ruta ? `${ruta}.${clave}` : clave

        if (clavesPeligrosas.includes(clave)) {
          detectadas.push(rutaCompleta)
        }
        if (typeof nodo[clave] === "object" && nodo[clave] !== null) {
          revisar(nodo[clave], rutaCompleta)
        }
      }
    }

    revisar(objeto)
    return detectadas
  }

  registrarEvento(tipo, detalles) {
    this.eventos.push({ timestamp: new Date().toISOString(), tipo, detalles })
  }

  rateLimit(ip, maxRequests = 100, windowMs = 60000) {
    const ahora = Date.now()
    const ventana = this.rateLimits.get(ip) || { count: 0, inicio: ahora }

    if (ahora - ventana.inicio > windowMs) {
      ventana.count = 1
      ventana.inicio = ahora
    } else {
      ventana.count++
    }

    this.rateLimits.set(ip, ventana)
    return ventana.count <= maxRequests
  }

  middleware() {
    return (req, res, next) => {
      if (!this.rateLimit(req.ip)) {
        this.registrarEvento("RATE_LIMIT", { ip: req.ip, path: req.path })
        return res.status(429).json({ error: "Demasiadas peticiones" })
      }

      if (req.body && typeof req.body === "object") {
        const clavesDetectadas = this.detectarPrototypePollution(req.body)

        if (clavesDetectadas.length > 0) {
          this.registrarEvento("POLLUTION_ATTEMPT", {
            ip: req.ip,
            path: req.path,
            claves: clavesDetectadas
          })

          return res.status(400).json({ error: "Petición rechazada por razones de seguridad" })
        }
      }

      next()
    }
  }

  obtenerEventos() {
    return [...this.eventos]
  }
}

// Usage in Express
const seguridad = new SecurityMiddleware()
app.use(seguridad.middleware())
```

**Why does it work?** The middleware acts at the boundary: every `req.body` goes through `detectarPrototypePollution` (a recursive walk with `Object.keys`, which works with own keys even when the body arrives with `__proto__`), and if a dangerous key shows up it is logged and the middleware answers `400` without ever reaching the chapter 9 controller. The per-IP `Map` rate limit catches bursts with a sliding 60 s window. In production, the `Map` of IPs should be pruned (or use a TTL store) so it does not grow without bound.
</details>

## Comparison table across languages

| Aspect | JavaScript (Express) | Python (Django/Pydantic) |
|---|---|---|
| Prototype Pollution | Possible via `__proto__` in merges | Nonexistent (`__dict__`/fixed classes) |
| Analogous risk | Merge/deserialization of the body | Unsafe deserialization (`pickle`, `yaml.load`) |
| Validation | Manual with schemas (Zod) or your own | Declarative Pydantic with types and validators |
| Sanitization | By hand; escape per context | `@field_validator` decorators |
| Queries | Manual parameters (your discipline) | ORM with prepared querysets |

| Aspect | JavaScript (Express) | Java (Spring/Bean Validation) |
|---|---|---|
| Prototype Pollution | Possible and common in merge utils | Impossible by design (fixed classes) |
| Analogous risk | — (same as the analysis column on the right) | Unsafe deserialization (`readObject` gadgets) |
| Validation | At the boundary, written by you | `@Valid` + Bean Validation annotations on each DTO |
| The front door | Manual middleware | The framework enforces it in the signature |
| Output escaping | Manual (templates, `res.json`) | Templates with escaping by default (Thymeleaf) |

## Chapter summary

1. **Prototype Pollution**: a `__proto__` key in a recursive merge mutates `Object.prototype` and slips properties into every object in the process.
2. The **two defenses** are filtering dangerous keys and using `Object.create(null)` for containers that should not inherit.
3. **Java is immune by design** (no mutable prototypes); its analogous family is unsafe deserialization. Python has no `__proto__` either; its equivalent risk is `pickle`/`yaml.load` from untrusted sources.
4. **Validating, sanitizing and escaping are three different operations**; mixing them causes broken data or open XSS.
5. Validation must be **centralized at the boundary** (middleware, shared schemas) — a rule that applies sometimes is a rule that does not exist.
6. For SQL the answer is not sanitizing but **parameterizing**; for HTML it is **escaping at the output** per context.
7. OWASP sums up the criteria: **validate all input (A03)** and **data and dependency integrity (A08)**.

## Next Chapter

→ **[Chapter 11: Asynchronous Resource Management](./cap-11)**: security teaches you to close the front door; the next chapter teaches you to close the back door — how to free resources (files, connections) with `using` and Explicit Resource Management.