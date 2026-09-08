---
title: "Chapter 12: Modern APIs and TC39 Proposals (ES2025-ES2026)"
---

# Chapter 12: Modern APIs and TC39 Proposals (ES2025-ES2026)

> This chapter covers the TC39 APIs and proposals that are already available or entering the standard. It is not a list of curiosities — these are tools that replace code you write with your eyes closed every week.

## 1. Precise summation: not just a simple `reduce`

### The problem: a million disappears in the sum

```javascript
const mediciones = [1e16, 1, -1e16]
const naive = mediciones.reduce((a, b) => a + b, 0)
console.log(naive) // 0 — the 1 vanished completely
```

Three numbers. The correct result is 1. But the large value (`1e16`) swallows the small one (`1`) at every accumulation step, because floating-point `+` rounds intermediates. A precision error in a financial or scientific application is not a detail — it is a silent failure.

Compensated summation (the Neumaier algorithm) fixes this in linear time with no external dependencies:

```javascript
function sumaPrecisa(iterable) {
  let suma = 0, compensacion = 0
  for (const valor of iterable) {
    const t = suma + valor
    if (Math.abs(suma) >= Math.abs(valor)) {
      compensacion += (suma - t) + valor
    } else {
      compensacion += (valor - t) + suma
    }
    suma = t
  }
  return suma + compensacion
}

const total = sumaPrecisa([1e16, 1, -1e16])
console.log(total) // 1 — the correct value

const precios = [0.1, 0.2, 0.3]
console.log(sumaPrecisa(precios))               // 0.6
console.log(precios.reduce((a, b) => a + b, 0)) // 0.6000000000000001
```

`Math.sumPrecise` (standard **ES2026**; today: Chrome 137+, V8 14.6 with `--harmony`, not yet enabled in Node by default) implements this algorithm natively and accepts any iterable:

```javascript
// When it reaches your runtime today: Chrome 137+, V8 with --harmony;
// not yet enabled in Node by default. Detect before you use it:
if (typeof Math.sumPrecise === "function") {
  console.log(Math.sumPrecise([1e16, 1, -1e16]))   // 1
  console.log(Math.sumPrecise([0.1, 0.2, 0.3]))    // 0.6
  console.log(Math.sumPrecise([1e20, 0.1, -1e20])) // 0.1
  console.log(Math.sumPrecise([]))                  // -0
} else {
  console.log("Math.sumPrecise is not available in this runtime")
}
```

**Watch out**: `Math.sumPrecise` fixes error *accumulation*, not the binary representation of each value. `[0.1, 0.2].reduce` gives `0.30000000000000004` in any runtime (IEEE 754): `Math.sumPrecise([0.1, 0.2])` returns the same, because the literals `0.1` and `0.2` are already the nearest doubles to those decimals in binary. The improvement shows up when summing long sequences or sequences with very different magnitudes, like `[1e16, 1, -1e16]`.

### Connection with Python

**Literal translation**: `math.fsum(iterable)` uses the same compensated strategy as `sumaPrecisa` — it accepts any iterable and returns a stable floating-point sum. `Decimal` solves a stronger problem (exact precision, with configurable rounding) but is slower and requires building values from strings like `'0.1'` to be exact.

```python
from decimal import Decimal

naive_suma = sum([1e16, 1, -1e16])      # 0.0 — the 1 disappears
import math
fsum = math.fsum([1e16, 1, -1e16])     # 1.0 — compensated, stable

Decimal("0.1") + Decimal("0.2")         # Decimal("0.3") — exact, no rounding
0.1 + 0.2                                # 0.30000000000000004 — IEEE roundoff
```

**Change of scene**: Python has had `math.fsum` since 2005; JavaScript arrives 20 years later with `Math.sumPrecise`. Both accept iterables — the difference is how long the standard has existed.

### Connection with Java

**Literal translation**: `BigDecimal` solves the same problem with configurable precision (`BigDecimal.valueOf(0.1)` is exact; `new BigDecimal(0.1)` is not). It is more general but heavier than `Math.sumPrecise`.

**Change of scene**: `DoubleStream.sum()` in Java **already uses compensated summation** (implicit Kahan since Java 8) — it is the exact counterpart of `Math.sumPrecise` for `double[]`. If your JavaScript code uses `Float64Array` arrays for scientific data, the conceptual translation to Java is `DoubleStream.of(...).sum()`, not `BigDecimal`.

```java
// Java: compensated double stream — same idea as Math.sumPrecise
double[] mediciones = {1e16, 1, -1e16};
double total = Arrays.stream(mediciones).sum();  // 1.0 — implicit Kahan

// Java: BigDecimal — exact decimal precision
BigDecimal a = new BigDecimal("0.1");
BigDecimal b = new BigDecimal("0.2");
a.add(b)  // 0.3 — exact, with configurable rounding
```

---

## 2. `Error.isError`: errors that keep their identity across realms

### The problem: an Error that fails `instanceof`

```javascript
// Two different workers create errors
const workerA = new Worker("a.js")
const workerB = new Worker("b.js")

// In the main worker, you receive an error from workerB
// instanceof Error can be false: same name, another internal class
// The realm (execution context) builds its own Error
```

In JavaScript, each `iframe`, `Worker` and realm has its own `Error` constructor. An `Error` created in the worker's realm is **not an instance** of the main realm's `Error`: `instanceof Error` can fail. `Error.isError` solves this with a reliable check that does not depend on the realm:

```javascript
console.log(Error.isError(new Error("test")))        // true
console.log(Error.isError(new TypeError("test")))    // true (inherits from Error)
console.log(Error.isError({ message: "fake" }))      // false — not an Error
console.log(Error.isError(null))                     // false
```

### Connection with Python

**Literal translation**: Python does not have the realms problem because it does not rely on the same prototype-inheritance mechanism. `isinstance(error, Exception)` always works, no matter the thread or module.

```python
from concurrent.futures import ThreadPoolExecutor

def lanzar_error():
    raise ValueError("from the thread")

with ThreadPoolExecutor() as pool:
    futuro = pool.submit(lanzar_error)
    try:
        futuro.result()
    except ValueError as e:
        print(isinstance(e, Exception))  # True — always, no realm
```

**Change of scene**: in Python the conceptual equivalent is that an `Exception` imported from another package is still an `Exception`. In JavaScript, `Error.isError` replaces `instanceof` as the standard check precisely because realms break the class identity that `instanceof` assumes.

### Connection with Java

**Literal translation**: Java does not have the realms problem with `instanceof` — but it has an analogous one with **classloaders**. If two classloaders load a class named `com.app.MyException`, they are distinct `Class` objects: `obj instanceof MyException` can be `false` when the `MyException` in the catch and the one on the object come from different loaders (common in OSGi, application servers, development hot-reload).

```java
// Java: the equivalent problem (two classloaders)
// MyException from ClassLoader A vs ClassLoader B
// are different classes, even with the same FQN
obj.getClass().getName()         // "com.app.MyException"
obj instanceof MyException       // can be false (catch is from another loader)
```

**Change of scene**: JavaScript resolves the check at the language level (`Error.isError`); Java resolves it at the reflection level: `MyException.class.isAssignableFrom(obj.getClass())` or `obj.getClass().getName().equals("...")`. You rarely need this in practice because isolated classloaders are a deployment pattern in Java, while realms are as common as an `iframe` you do not control in JavaScript.

---

## 3. Iterator helpers: lazy sequences without intermediate arrays

### The problem: materializing huge sequences by accident

```javascript
function* millions(n) {
  let i = 0
  while (i < n) yield i++
}

// This loads everything in memory:
const arr = [...millions(10_000_000)] // ~80 MB, then you filter 1%
const pocos = arr.filter(x => x % 100 === 0)
```

Iterator helpers (`filter`, `map`, `take`, `drop`, `toArray`, `reduce`, `flatMap`) add chainable methods directly on the iterator — values are produced on demand, without materializing intermediate arrays:

```javascript
function* naturales() {
  let n = 1
  while (true) yield n++
}

const cuadrados = naturales()
  .filter(n => n % 2 === 0)   // evens
  .map(n => n * n)            // squared
  .take(5)                    // only 5
  .toArray()

console.log(cuadrados) // [4, 16, 36, 64, 100]
```

The generator `naturales()` is infinite, but `.take(5)` stops execution after 5 values. Without `take`, calling `.toArray()` on an infinite generator **hangs the process** (it never finishes iterating).

The helpers are `O(1)` in memory: they do not build intermediate arrays and do not copy data. Each step produces the next value as soon as it is needed.

### Connection with Python

**Literal translation**: Python solves this with `itertools` (stdlib module): `islice` ≈ `take`, `map`/`filter` ≈ the helpers, hand-chained generators ≈ `.map().filter().take()`. `itertools.chain` ≈ `Iterator.concat`.

```python
from itertools import islice, filterfalse

# Without Python iterator helpers (chained generators):
def cuadrados_pares():
    for n in naturales():
        if n % 2 == 0:
            yield n * n

resultado = list(islice(cuadrados_pares(), 5))  # [4, 16, 36, 64, 100]

# Python 3.12+ has itertools.batched — no direct .reduce equivalent
from functools import reduce
reduce(lambda a, b: a + b, islice(naturales(), 10))  # 55
```

**Change of scene**: Python uses external composition (`islice(map(..., filter(...)))`) with itertools; JavaScript uses chainable methods on the iterator itself (`.filter().map().take().toArray()`). The JavaScript style reads better in long chains; the Python style composes better with left-to-right composition. Both work with lazy evaluation.

### Connection with Java

**Literal translation**: Java `Stream` is the exact counterpart: `.filter()`, `.map()`, `.limit()` ≈ `.take()`, `.toList()` ≈ `.toArray()`. Both are lazy and materialize with `.collect()`/`.toList()`/`.toArray()`.

```java
// Java: lazy stream — same laziness as Iterator helpers
Stream.iterate(1, n -> n + 1)       // infinite iterator
    .filter(n -> n % 2 == 0)         // lazy
    .map(n -> n * n)                 // lazy
    .limit(5)                        // take 5
    .toList()                        // materialize — [4, 16, 36, 64, 100]
```

**Change of scene**: Java's `Iterator` **has no helpers** — methods like `map`/`filter`/`take` on the iterator are a JavaScript novelty. If you work with a plain `Iterator<T>` in Java, you need `StreamSupport.stream(iterator, false)` to wrap it before using lazy ops. JavaScript gives you the helpers directly on the iterator: less verbose, same semantics.

---

## 4. `Map.getOrInsert`: the boilerplate you no longer need

### The problem: the has/get/set burrow

```javascript
// You write this every time you need a default entry in a Map
if (!cache.has(clave)) {
  cache.set(clave, new Usuario(clave))
}
const usuario = cache.get(clave) // 3 lines, 2 Map lookups
```

`getOrInsert` and `getOrInsertComputed` collapse the pattern into one line. `getOrInsert(key, value)` inserts and returns the direct value; `getOrInsertComputed(key, fn)` runs the factory only if the key is absent:

```javascript
const cache = new Map()

// First call: creates, inserts, returns
const u1 = cache.getOrInsert("ana", { nombre: "Ana", rol: "admin" })
console.log(u1.nombre) // "Ana"

// Second call: returns the existing one, touches nothing
const u2 = cache.getOrInsert("ana", { nombre: "Ana2", rol: "user" })
console.log(u2 === u1) // true — same reference

// With a factory: only runs if the key is absent
const perfil = cache.getOrInsertComputed("david", () => {
  console.log("factory ran once") // runs only the first time
  return { nombre: "David", rol: "dev" }
})

// WeakMap also has them (but WeakMap only accepts objects as keys)
const ref = new WeakMap()
ref.getOrInsert({}, { datos: "ocultos" }) // works, the object is the key
```

### Connection with Python

**Literal translation**: `dict.setdefault(key, value)` is the exact equivalent of `getOrInsert` — it inserts and returns the existing value or the new one. `collections.defaultdict(factory)` covers the `getOrInsertComputed` case: it creates the entry automatically when you access an absent key.

```python
cache = {}

# setdefault — same idea as getOrInsert
usuario = cache.setdefault("ana", {"nombre": "Ana", "rol": "admin"})
usuario2 = cache.setdefault("ana", {"nombre": "Ana2"})
assert usuario is usuario2  # True — same reference

from collections import defaultdict
perfiles = defaultdict(lambda: {"nombre": "desconocido", "rol": "guest"})
perfiles["david"]  # runs the factory: {"nombre": "desconocido", "rol": "guest"}
```

**Change of scene**: `defaultdict` creates the entry **on access** (even with `perfiles["no_existe"]`), while `getOrInsertComputed` requires an explicit call. In Python `defaultdict` is more convenient for grouping; in JavaScript `getOrInsertComputed` is more explicit (it does not create phantom entries).

### Connection with Java

**Literal translation**: `ConcurrentHashMap.computeIfAbsent(key, mappingFunction)` is the exact counterpart — it runs the function only if the key is absent and is thread-safe (which a JavaScript `Map` is not by default).

```java
Map<String, Usuario> cache = new ConcurrentHashMap<>();

// ComputeIfAbsent — same logic as getOrInsertComputed
Usuario u = cache.computeIfAbsent("ana", k -> new Usuario(k, "admin"));
// First time: creates and returns
// Second time: returns the existing one, the factory does not run
```

**Change of scene**: `computeIfAbsent` is the safe concurrent option; `getOrInsert` in JavaScript runs in a single thread (no race condition in the event loop). If you port a `ConcurrentHashMap.computeIfAbsent` pattern to `Map.getOrInsert`, the semantics are identical as long as your JS stays single-threaded.

---

## Debugging in practice

### Signals and solutions

| Signal | What to look for | Tool / API |
|---|---|---|
| `0.1+0.2+0.3 !== 0.6` | Rounding of intermediates | `sumaPrecisa()` or `Math.sumPrecise` |
| `instanceof Error` gives `false` | Realm (iframe, worker, eval) | `Error.isError` |
| Process hangs while iterating an infinite generator | Accidental materialization | `.take(n)` before `.toArray()` |
| Three lines of `has/set/get` every time | Map boilerplate | `getOrInsert` / `getOrInsertComputed` |
| Sum of big + small = 0 | `+` loses small magnitudes | Compensated summation |

### Scenario 1: `Math.sumPrecise` does not exist in your runtime

Your code runs on Node 22 LTS or Safari. `Math.sumPrecise` is not available and the polyfill is not in your bundle. What do you do?

**Diagnosis**: Feature-detect first; fall back to manual compensated summation. The `sumaPrecisa` function is ~10 lines, has no dependencies, and works in any environment. The second alternative is a `core-js` polyfill (`import "core-js/actual/math/sum-precise"`), which is useful when the polyfill is already in your bundle.

**Solution**:

```javascript
// Prefer native Math.sumPrecise, fall back to Kahan
const sumar = typeof Math.sumPrecise === "function"
  ? (it) => Math.sumPrecise(it)
  : sumaPrecisa // the manual function from the start of this chapter
```

### Scenario 2: infinite iterator, `toArray` and the hanging process

Someone wrote `resultado = datos.filter(x => x.activo).toArray()` without knowing `datos` was an infinite iterator. The process stops responding, with no error and no stack trace.

**Diagnosis**: Check whether `toArray` was called on something that could be infinite. `Iterator`, generator functions (`function*`), and data streams can all return a `toArray` that never finishes. Without `.take()`, there is no exit.

**Solution**: Add `.take(razonableLimit)` before `.toArray()`. In production, replace `.toArray()` with `.forEach()` or a `for...of` that processes on demand.

```javascript
// Dangerous: could be infinite
const todo = stream.filter(x => x.activo).toArray()

// Safe: on demand, always terminates
for (const item of stream.filter(x => x.activo)) {
  procesar(item)
}
```

---

## Practice and exercises

### 1. Review questions

Before continuing, answer these from memory (do not check the chapter):

1. Why does `[1e16, 1, -1e16].reduce((a,b)=>a+b, 0)` give 0 instead of 1?
2. What advantage does `Error.isError` have over `instanceof Error`?
3. What happens if you call `.toArray()` on an infinite generator without `.take()`?
4. How is `getOrInsertComputed` different from `getOrInsert`?
5. Why can `Math.sumPrecise([0.1, 0.2])` return `0.30000000000000004`?

### 2. Explain it in your own words

Pick one of these and explain it out loud as if to someone who only knows HTML:

- **[Precise summation](#1-precise-summation-not-just-a-simple-reduce)**: why does JavaScript's `+` lose values in long sequences and how does compensated summation solve it?
- **[Error.isError](#2-erroriserror-errors-that-keep-their-identity-across-realms)**: what happens to `instanceof Error` when an error comes from a worker and how is it solved?
- **[Iterator helpers](#3-iterator-helpers-lazy-sequences-without-intermediate-arrays)**: why does `.toArray()` on an infinite iterator hang the process?

### 3. Progressive coding exercises

#### Exercise 1 (Basic): compararSumas

Create a `compararSumas(numeros)` function that:
1. Uses `reduce` with an initial value of 0.
2. Uses `sumaPrecisa` (the Kahan function from this chapter).
3. Returns `{ naive, preciso, diferencia, sonIguales }`.

Expected usage:

```javascript
const r = compararSumas([1e16, 1, -1e16])
console.log(r.naive)       // 0
console.log(r.preciso)     // 1
console.log(r.diferencia)  // 1
console.log(r.sonIguales)  // false
```

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. `reduce` is `arr.reduce((a, b) => a + b, 0)`
2. Call `sumaPrecisa(numeros)`
3. `diferencia = Math.abs(naive - preciso)`

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function compararSumas(numeros) {
  const naive = numeros.reduce((a, b) => a + b, 0)
  const preciso = sumaPrecisa(numeros)
  const diferencia = Math.abs(naive - preciso)
  return { naive, preciso, diferencia, sonIguales: naive === preciso }
}

// Test
const r1 = compararSumas([1e16, 1, -1e16])
console.log(r1.naive)       // 0
console.log(r1.preciso)     // 1
console.log(r1.sonIguales)  // false

const r2 = compararSumas([1, 2, 3])
console.log(r2.sonIguales)  // true — here reduce and Kahan agree
```

**Why does it work?** `reduce` accumulates with the language's `+`, which rounds to 53 bits of precision at every step: the `1` is lost against `1e16`. Compensated summation keeps a `compensacion` variable that recovers the rounding residuals of each step — that is why it returns `1`. On short sequences without large magnitude differences, both agree.

</details>

#### Exercise 2 (Intermediate): custom `IteradorPersonalizado`

Implement a class `IteradorPersonalizado` that:
1. Takes a generator in the constructor.
2. Has `.map(fn)`, `.filter(fn)`, `.take(n)` methods that return a **new** `IteradorPersonalizado` (lazy).
3. Has `.toArray()` that materializes.
4. Adds `.reduce(fn, init)` that processes on demand (without materializing everything).

Expected usage:

```javascript
function* contar() { let i = 1; while (true) yield i++ }

const r = new IteradorPersonalizado(contar())
  .filter(n => n % 3 === 0)
  .map(n => n * 2)
  .take(4)
  .toArray()

console.log(r) // [6, 12, 18, 24]

const suma = new IteradorPersonalizado(contar())
  .filter(n => n <= 5)
  .take(5)
  .reduce((a, b) => a + b, 0)

console.log(suma) // 15
```

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Each method returns `new IteradorPersonalizado(this)` with an internal generator that `yield`s the step.
2. `.reduce` does `for (const item of this.generator)` without building an array.
3. `take` cuts the chain after `n` elements — check the limit **before** asking the generator for the next value.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class IteradorPersonalizado {
  constructor(generator) {
    this.generator = generator
  }

  map(fn) {
    const gen = this.generator
    return new IteradorPersonalizado((function* () {
      for (const item of gen) yield fn(item)
    })())
  }

  filter(fn) {
    const gen = this.generator
    return new IteradorPersonalizado((function* () {
      for (const item of gen) {
        if (fn(item)) yield item
      }
    })())
  }

  take(n) {
    const gen = this.generator
    const it = gen[Symbol.iterator] ? gen[Symbol.iterator]() : gen
    return new IteradorPersonalizado((function* () {
      let count = 0
      while (count < n) {
        const paso = it.next()
        if (paso.done) return
        yield paso.value
        count++
      }
      if (typeof it.return === "function") it.return()
    })())
  }

  toArray() {
    return [...this.generator]
  }

  reduce(fn, init) {
    let acumulador = init
    for (const item of this.generator) {
      acumulador = fn(acumulador, item)
    }
    return acumulador
  }
}

// Usage
function* contar() { let i = 1; while (true) yield i++ }

console.log(
  new IteradorPersonalizado(contar())
    .filter(n => n % 3 === 0)
    .map(n => n * 2)
    .take(4)
    .toArray()
) // [6, 12, 18, 24]

console.log(
  new IteradorPersonalizado(contar())
    .filter(n => n <= 5)
    .take(5)
    .reduce((a, b) => a + b, 0)
) // 15
```

**Why does it work?** Each method creates a **new** iterator wrapping the previous one: `.filter()` runs nothing until `toArray()` or `reduce` calls `next()` on the first generator. `take(n)` adds a counter that `break`s after `n` iterations, stopping the whole chain (it never reaches the infinite part) — that is why `suma` terminates even though `contar()` is infinite. `reduce` iterates the generator directly without building an intermediate array.

</details>

#### Exercise 3 (Advanced): TTL cache over a slow generator

Create a `conCacheLento(numeros, TTL)` function that:
1. Takes an iterable `numeros` (possibly infinite) and a `TTL` in milliseconds.
2. Computes `Math.sqrt(n)` for each number, but **only caches the result** the first time each value appears.
3. If the value is cached and the TTL has not expired, reuse it; if it expired, recompute.
4. Returns `{ resultado, metricas: { cacheHits, cacheMisses } }`.

With repeated values after an artificial pause:

```javascript
function* fuenteLenta() {
  yield* [1, 2, 3, 1, 2, 3, 1]  // the first three are new; then they repeat
}

const { resultado, metricas } = conCacheLento(fuenteLenta(), 50)
console.log(resultado.map(x => x.toFixed(3)))
// ["1.000", "1.414", "1.732", "1.000", "1.414", "1.732", "1.000"]
console.log(metricas)
// { cacheHits: 4, cacheMisses: 3 } — repeated ones reuse the cache
```

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use a `Map` where the key is the input number and the value is `{ valor, timestamp }`.
2. Before computing, check `cache.has(n)` and `Date.now() - timestamp < TTL`.
3. For the infinite generator, use `.take()` before `.toArray()` to avoid hanging.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function conCacheLento(numeros, TTL) {
  const cache = new Map()
  let cacheHits = 0
  let cacheMisses = 0
  const resultado = []

  for (const n of numeros) {
    const entrada = cache.get(n)
    if (entrada && Date.now() - entrada.timestamp < TTL) {
      resultado.push(entrada.valor)
      cacheHits++
    } else {
      const valor = Math.sqrt(n)
      cache.set(n, { valor, timestamp: Date.now() })
      resultado.push(valor)
      cacheMisses++
    }
  }

  return { resultado, metricas: { cacheHits, cacheMisses } }
}

// Test — repeat values to trigger the cache
const { resultado, metricas } = conCacheLento([1, 2, 3, 1, 2, 3, 1], 5000)
console.log(metricas) // { cacheHits: 4, cacheMisses: 3 }
console.log(resultado.length) // 7

// Careful: if `numeros` were an infinite generator, this `for...of` would
// never finish — the cache does not limit it; you must bound the source
// before (take, slice, etc.)
```

**Why does it work?** The `for...of` over `numeros` consumes the iterator on demand: each `yield` produces a value, it is looked up in the cache, and the next one is only produced when the loop advances. With repeated values inside the TTL, the `Math.sqrt` factory does not run — it just reuses. `cacheHits` and `cacheMisses` measure the real cache effectiveness without external telemetry.

</details>

---

## Comparison table across languages

| JS (ES2025-2026) | Python | Java |
|---|---|---|
| `sumaPrecisa(arr)` / `Math.sumPrecise(arr)` | `math.fsum(iter)` | `DoubleStream.of(doubles).sum()` / `BigDecimal` |
| `Error.isError(val)` | `isinstance(val, Exception)` | `obj.getClass().isAssignableFrom(...)` |
| Iterator helpers `.map().filter().take().toArray()` | `itertools.islice`, `map`, `filter` chained | `Stream.iterate(...).map().limit().toList()` |
| `map.getOrInsert(k, v)` / `getOrInsertComputed(k, fn)` | `dict.setdefault(k, v)` / `defaultdict(fn)` | `ConcurrentHashMap.computeIfAbsent(k, fn)` |
| `using` / `await using` | `with` / context managers | `try-with-resources` (Java 7+) |

---

## Chapter summary

1. **Compensated summation** fixes the silent error of `reduce` on sequences with large magnitude differences. `Math.sumPrecise` arrives in runtimes as a native alternative.
2. **`Error.isError`** reliably checks errors across realms — a problem `instanceof` cannot solve in environments with multiple execution contexts.
3. **Iterator helpers** enable lazy processing over potentially infinite sequences without intermediate arrays. `.take()` is the safeguard that prevents hangs.
4. **`Map.getOrInsert`** and `getOrInsertComputed` eliminate the `has/set/get` pattern that has existed since ES6.
5. **Python** offers stdlib equivalents that have been the reference for years — `math.fsum` since 2005, `setdefault` since 2001, `itertools` since 2003. JavaScript arrives with slightly better ergonomics (iterables, chainable methods), but the concept is the same.
6. **Java** has `DoubleStream.sum()` as the compensated-summation equivalent and `computeIfAbsent` as the `getOrInsert` equivalent, both thread-safe (JavaScript does not have that concern thanks to the event loop).

---

## The road ahead: a language in motion

This chapter closes the technical part of the book, but not the road. The APIs in this chapter are already available (some with a polyfill) and keep reaching more runtimes every month. The knowledge is not about the specific API — it is about **recognizing the pattern** each one replaces: naive `reduce`, `instanceof` across realms, unnecessary materialization, cache boilerplate.

Continue from here:

- **Practice the exercises in every chapter** — repeating and explaining sticks more than reading.
- **Check TC39** ([tc39.es](https://tc39.es/ecma262/)) when you want to see what is coming — the stages tell you whether something is imminent or speculative.
- **Contribute to open-source projects** — that is where new APIs first meet real problems.