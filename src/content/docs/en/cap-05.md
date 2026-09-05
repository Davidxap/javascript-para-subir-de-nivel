---
title: "Chapter 5: Advanced Structures and Iteration"
---

# Chapter 5: Advanced Structures and Iteration

> Modern JavaScript has data structures beyond basic objects and arrays.

## Introduction

Modern JavaScript has data structures beyond basic objects and arrays: `Map`, `Set`, `WeakMap`, `WeakSet`. It also has a unified iteration system based on the iteration protocol, with generators and iterator helpers (ES2025+). Understanding these tools allows you to write more expressive, more efficient, and safer code in terms of memory management.

**Why does it matter?** Because these structures are essential for efficient algorithms, design patterns, and data handling in modern applications. Many design patterns rely on collections and iterators.

## 1. `Map` and `Set` vs Objects and Arrays

### Key Idea

`Map` is a collection of key-value pairs where keys can be of any type (not just strings). `Set` is a collection of unique values. Unlike objects, `Map` preserves insertion order, has no prototype (no collisions with inherited properties), and has an O(1) size with `.size`.

### `Map` vs Object

```javascript
// Map: keys can be any type
const map = new Map()
const objKey = { id: 1 }
const funcKey = () => {}

map.set("string", "valor")
map.set(objKey, "objeto como clave")
map.set(funcKey, "función como clave")
map.set(42, "número como clave")

console.log(map.size)  // 4
console.log(map.get(objKey))  // "objeto como clave"

// Iteration in insertion order
for (const [clave, valor] of map) {
  console.log(clave, valor)
}

// Object: keys are only strings/symbols
const obj = {}
obj[objKey] = "valor"  // the key is converted to "[object Object]"
console.log(obj[{}])  // "valor" — any empty object accesses the same one!
console.log(Object.keys(obj))  // ["[object Object]"]
```

### `Set` vs Array

```javascript
// Set: unique values, O(1) lookup
const set = new Set([1, 2, 3, 2, 1])  // Set { 1, 2, 3 } — removes duplicates
console.log(set.size)  // 3
set.add(4)
set.has(3)  // true — O(1), faster than array.includes() which is O(n)

// Remove duplicates from an array
const duplicados = [1, 2, 2, 3, 3, 3, 4]
const unicos = [...new Set(duplicados)]  // [1, 2, 3, 4]

// Array to remove duplicates (slower):
const unicosArray = duplicados.filter((v, i) => duplicados.indexOf(v) === i)
```

### When to Use Each

| Need | Use |
|-----------|------|
| Key-value with string keys | Object (lighter) |
| Key-value with non-string keys | `Map` |
| Unique values | `Set` |
| Frequent existence lookup | `Set` (O(1)) or `Map` (O(1)) |
| Insertion order is important | `Map` or `Set` (guaranteed) |
| JSON serialization | Object (Map does not serialize directly) |

### Think Critically

- Why doesn't `Map` serialize with `JSON.stringify`? Because `JSON.stringify` only works with strings and objects. To serialize a Map, convert it to an array of pairs: `JSON.stringify([...map])`.
- Is `Map` slower than an object? In basic operations, they are comparable. `Map` is slightly slower in creation but faster in frequent insertion/deletion. For static data, an object is lighter.
- Does `Set` maintain order? Yes, Sets preserve insertion order, just like Maps.

## 2. `WeakMap` and `WeakSet` — Memory Management

### Key Idea

`WeakMap` and `WeakSet` are like `Map` and `Set` but with one crucial difference: the keys (in WeakMap) or values (in WeakSet) are weak references. If there are no other references to the object, the garbage collector can remove it. This prevents memory leaks when you associate data with DOM elements or other short-lived objects.

### WeakMap: Associated Data Without Leaks

```javascript
// Use case: metadata associated with DOM elements
const metadatos = new WeakMap()

const boton = document.createElement("button")
metadatos.set(boton, { vecesClickeado: 0, ultimoClick: null })

boton.addEventListener("click", () => {
  const data = metadatos.get(boton)
  data.vecesClickeado++
  data.ultimoClick = new Date()
})

// When the button is removed from the DOM and there are no more references,
// the garbage collector can remove both the button and its metadata.
// With a normal Map, the metadata would remain forever (memory leak).
```

### WeakSet: Tracking Processed Objects

```javascript
const procesados = new WeakSet()

function procesarSiNecesario(objeto) {
  if (procesados.has(objeto)) {
    console.log("Ya procesado")
    return
  }
  // process...
  procesados.add(objeto)
}

const item = { id: 1 }
procesarSiNecesario(item)  // processes
procesarSiNecesario(item)  // "Ya procesado"
// When item no longer has references, the WeakSet automatically releases it
```

### Restrictions of WeakMap/WeakSet

- WeakMap keys must be objects (not primitives).
- They are not iterable (no `for...of`, no `.keys()`, no `.size`).
- You cannot know how many elements they have.

### Think Critically

- Why isn't WeakMap iterable? Because objects can be removed at any time by the GC. If you could iterate, you might see objects that should already be removed, which would break the semantics of weak references.
- When should I use WeakMap vs Map? Use WeakMap when the associated data must live and die with the key object (DOM metadata, function caches). Use Map when you need to iterate, know the size, or use primitive keys.

## 3. The Iteration Protocol: Iterables and Iterators

### Key Idea

JavaScript has two iteration protocols. An **iterable** is an object with a `Symbol.iterator` method that returns an **iterator**. An iterator is an object with a `next()` method that returns `{ value, done }`. This unifies `for...of`, spread, destructuring, and more.

### Implementing an Iterable

```javascript
// Custom iterable object
class Rango {
  constructor(inicio, fin, paso = 1) {
    this.inicio = inicio
    this.fin = fin
    this.paso = paso
  }

  [Symbol.iterator]() {
    let actual = this.inicio
    const fin = this.fin
    const paso = this.paso

    return {
      next() {
        if (actual <= fin) {
          const valor = actual
          actual += paso
          return { value: valor, done: false }
        }
        return { done: true }
      },
      // Make the iterator also iterable (for reuse)
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

const rango = new Rango(1, 10, 2)

// for...of uses the iteration protocol
for (const n of rango) {
  console.log(n)  // 1, 3, 5, 7, 9
}

// Spread also uses it
const array = [...rango]  // [1, 3, 5, 7, 9]

// Destructuring also uses it
const [primero, segundo] = rango  // primero=1, segundo=3
```

### Built-in Iterables

```javascript
// These are native iterables:
[1, 2, 3]          // Array
"hola"             // String
new Set([1, 2, 3])  // Set
new Map([...])      // Map
// NOT iterable:
// { a: 1 }          // Plain object (use for...in instead)
// new Number(42)    // Number
```

### Infinite Iterator

```javascript
function naturales() {
  let n = 0
  return {
    next() { return { value: n++, done: false } },
    [Symbol.iterator]() { return this },
  }
}

const nums = naturales()
nums.next()  // { value: 0, done: false }
nums.next()  // { value: 1, done: false }
nums.next()  // { value: 2, done: false }
// Never ends — be careful with for...of
```

### Think Critically

- Why aren't objects iterable by default? Because there is no guaranteed order of properties (historically). `Object.entries()`, `Object.keys()`, and `Object.values()` return arrays, which are iterable.
- Can an iterator be reset? It depends. If the iterator is also iterable (`[Symbol.iterator]() { return this }`), resetting it means creating a new one. An iterator consumes its state.

## 4. Generators: `function*`, `yield`, `yield*`

### Key Idea

Generators are functions that can pause and resume their execution. `yield` pauses the function and returns a value. The next call to `.next()` resumes from where it was paused. They are the simplest way to implement custom iterables.

### Basic Generator

```javascript
function* contador() {
  yield 1
  yield 2
  yield 3
  return "fin"
}

const gen = contador()
gen.next()  // { value: 1, done: false }
gen.next()  // { value: 2, done: false }
gen.next()  // { value: 3, done: false }
gen.next()  // { value: "fin", done: true }
gen.next()  // { value: undefined, done: true }

// Use with for...of (ignores return, stops at done: true)
for (const n of contador()) {
  console.log(n)  // 1, 2, 3
}
```

### Generator with Pause and Resume

```javascript
function* dialogo() {
  const pregunta = yield "¿Cuál es tu nombre?"  // pauses here
  console.log(`Hola, ${pregunta}`)  // resumes with the value passed to next()
  const edad = yield "¿Cuántos años tienes?"
  console.log(`${pregunta} tiene ${edad} años`)
}

const gen = dialogo()
gen.next().value  // "¿Cuál es tu nombre?"
gen.next("David").value  // "¿Cuántos años tienes?" — "David" is assigned to 'pregunta'
gen.next(25)  // logs: "David tiene 25 años"
```

### `yield*` — Delegation

```javascript
function* inner() {
  yield 1
  yield 2
}

function* outer() {
  yield 0
  yield* inner()  // delegates to another generator/iterable
  yield 3
}

[...outer()]  // [0, 1, 2, 3]
```

### Infinite Generator with Lazy Evaluation

```javascript
function* fibonacci() {
  let [a, b] = [0, 1]
  while (true) {
    yield a
    ;[a, b] = [b, a + b]
  }
}

const fib = fibonacci()
fib.next()  // 0
fib.next()  // 1
fib.next()  // 1
fib.next()  // 2
fib.next()  // 3
fib.next()  // 5

// Generators are lazy: they only calculate the next value when requested
// This allows infinite sequences without exhausting memory
```

### Think Critically

- Are generators asynchronous? No. They are synchronous but pausable. `yield` pauses, but does not yield control to the Event Loop. For asynchrony with generators, you need `co` or async generators (`async function*`).
- What about `return` in a generator? It terminates the generator. The return value appears in `{ value, done: true }` but `for...of` ignores it.
- Can you pass a generator to `Promise.all`? Not directly, because `Promise.all` expects an iterable of promises. If the generator yields promises, yes: `Promise.all(generadorDePromesas())`.

## 5. Iterator Helpers (ES2025+: `map`, `filter`, `take`, `drop`)

### Key Idea

ES2025 adds methods directly to iterators: `.map()`, `.filter()`, `.take()`, `.drop()`, `.reduce()`, `.toArray()`, `.forEach()`. These are lazy — they do not materialize the entire array. They allow processing infinite or very large sequences without exhausting memory.

### Examples

```javascript
// Iterator helpers — ES2025+
function* naturales() {
  let n = 1
  while (true) yield n++
}

// Take the first 5 even numbers
const pares = naturales()
  .filter(n => n % 2 === 0)  // lazy: only filters when requested
  .take(5)                    // lazy: only takes 5
  .toArray()                  // materializes: [2, 4, 6, 8, 10]

// Without iterator helpers, you would need a manual loop:
const paresManual = []
for (const n of naturales()) {
  if (n % 2 === 0) {
    paresManual.push(n)
    if (paresManual.length === 5) break
  }
}
```

### Lazy Evaluation with Infinite Sequences

```javascript
// Sum the first 100 multiples of 3
const suma = naturales()
  .filter(n => n % 3 === 0)
  .take(100)
  .reduce((a, b) => a + b, 0)
// Only processes what is necessary — does not attempt to iterate the infinite sequence
```

### Proposal Status

- Iterator helpers is part of **ES2025** (Stage 4, finalized).
- Available in Node.js 22+ and modern browsers (Chrome 131+).
- In unsupported environments, you can polyfill or use libraries like iter-tools.

### Think Critically

- Why are iterator helpers important? Because they allow functional style (`map`, `filter`, `reduce`) on iterables without materializing intermediate arrays. `[...iterable].map().filter()` creates temporary arrays; helpers are lazy.
- Can they be chained with generators? Yes. Generators return iterators, and helpers work with iterators.

## 6. Advanced Destructuring (rest, spread, nested, defaults)

### Key Idea

Destructuring extracts values from objects and arrays into variables. The spread operator (`...`) expands iterables. The rest operator (`...`) gathers the remaining elements. These are the most widely used patterns in modern JavaScript.

### Object Destructuring

```javascript
const usuario = {
  nombre: "David",
  edad: 25,
  direccion: {
    ciudad: "Medellín",
    pais: "Colombia",
  },
  hobbies: ["programar", "leer", "correr"],
}

// Basic
const { nombre, edad } = usuario

// Rename
const { nombre: userNombre } = usuario  // userNombre = "David"

// Default
const { telefono = "N/A" } = usuario  // "N/A" (property does not exist)

// Nested
const { direccion: { ciudad } } = usuario  // "Medellín"
// ⚠️ 'direccion' is not defined as a variable, only 'ciudad'

// Rest
const { nombre, ...resto } = usuario
// nombre = "David", resto = { edad: 25, direccion: {...}, hobbies: [...] }
```

### Array Destructuring

```javascript
const [a, b, c] = [1, 2, 3]  // a=1, b=2, c=3
const [primero, ...resto] = [1, 2, 3, 4]  // primero=1, resto=[2,3,4]
const [, , tercero] = [1, 2, 3]  // tercero=3 (skip elements)
const [x = 0, y = 0] = [1]  // x=1, y=0 (default)

// Variable swapping
let a = 1, b = 2
;[a, b] = [b, a]  // a=2, b=1
```

### Spread in Functions and Arrays

```javascript
// Spread in calls
function sumar(a, b, c) { return a + b + c }
const nums = [1, 2, 3]
sumar(...nums)  // 6

// Spread in arrays
const arr1 = [1, 2]
const arr2 = [3, 4]
const combinado = [...arr1, ...arr2]  // [1, 2, 3, 4]

// Spread in objects (ES2018+)
const defaults = { tema: "oscuro", idioma: "es" }
const override = { idioma: "en" }
const config = { ...defaults, ...override }  // { tema: "oscuro", idioma: "en" }

// Rest in parameters
function log(tag, ...args) {
  console.log(`[${tag}]`, ...args)
}
log("INFO", "mensaje", 42, { key: "value" })  // [INFO] mensaje 42 { key: "value" }
```

### Think Critically

- Does spread perform a deep copy? No. Spread performs a shallow copy. Nested objects are shared by reference.
- Does the order of spread matter in objects? Yes. Later properties overwrite earlier ones: `{ ...a, ...b }` — properties of `b` win over `a`.
- Can you destructure null? No. `const { a } = null` throws a TypeError. Use a default: `const { a } = obj || {}`.

## 7. Immutable Data Structures

### Key Idea

Immutability means that an object does not change after it is created. In JavaScript, strings and numbers are immutable by nature. Objects and arrays are mutable, but you can use immutability patterns to prevent bugs.

### Shallow vs Deep Copy

```javascript
// Shallow copy
const original = { a: 1, b: { c: 2 } }
const copia = { ...original }
copia.a = 10  // does not affect original
copia.b.c = 20  // YES affects original! (b is shared by reference)
console.log(original.b.c)  // 20

// Deep copy
const copiaProfunda = structuredClone(original)  // ES2022+
copiaProfunda.b.c = 30
console.log(original.b.c)  // 20 — unaffected
```

### Pattern: Immutable Update

```javascript
// Instead of mutating:
const estado = { contador: 0, lista: [1, 2] }
// ❌ Mutation
estado.contador++
estado.lista.push(3)

// ✅ Immutable
const nuevoEstado = {
  ...estado,
  contador: estado.contador + 1,
  lista: [...estado.lista, 3],
}
// The original state does not change
```

### `structuredClone` (ES2022+)

```javascript
// Native deep copy
const obj = {
  fecha: new Date(),
  mapa: new Map(**"a", 1**),
  regex: /patrón/g,
  arr: [{ x: 1 }],
}
const copia = structuredClone(obj)
// Works with Date, Map, Set, Array, RegExp, etc.
// Does not work with functions, DOM nodes, or class instances (they lose prototype)
```

### Recursive `Object.freeze`

```javascript
function congelarProfundo(obj) {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      congelarProfundo(obj[key])
    }
  })
  return Object.freeze(obj)
}

const config = congelarProfundo({
  api: { url: "https://api.ejemplo.com", timeout: 5000 },
  debug: true,
})
config.api.url = "hack"  // TypeError in strict mode
```

### Think Critically

- Is immutability slower? Creating copies has a cost, but modern engines optimize immutable patterns. In React/Redux, immutability is the foundation of change detection.
- `structuredClone` vs `JSON.parse(JSON.stringify())`? `structuredClone` preserves Date, Map, Set, RegExp, and special types. `JSON` loses them (Date becomes a string, Map becomes empty).
- Is recursive `Object.freeze` practical? For small data, yes. For large data, it is slow. Consider libraries like Immutable.js or Immer.

## Common Mistakes

### Chapter Debugging Map

- If a `Map` serializes as `{}` in JSON → convert it to an array of pairs: `JSON.stringify([...map])`.
- If a `Set` has duplicates → verify that the values are of the same type (1 !== "1").
- If `for...of` does not work with an object → it is not iterable. Use `Object.entries()` or implement `Symbol.iterator`.
- If a generator is exhausted after one iteration → generators are single-use. Create a new one to restart.
- If `structuredClone` fails with a function → it does not support functions. Use a manual copy or a library.
- If copying with spread modifies the original → it is a shallow copy. Use `structuredClone` for a deep copy.
- If iterator helpers are not available → upgrade to Node.js 22+ or use a polyfill.

## Summary

- `Map` allows keys of any type; `Set` stores unique values. Both preserve insertion order.
- `WeakMap`/`WeakSet` use weak references to prevent memory leaks; they are not iterable.
- The iteration protocol (`Symbol.iterator` + `next()`) unifies `for...of`, spread, and destructuring.
- Generators (`function*`) pause and resume execution; they are the simplest way to create iterables.
- Iterator helpers (ES2025+) allow `map`, `filter`, `take`, and `drop` lazily over iterables.
- Destructuring extracts values; spread expands; rest gathers.
- `structuredClone` (ES2022+) performs native deep copying.
- Immutability prevents shared-state bugs; `Object.freeze` and copy patterns are the primary tools.

## Next Chapter

In the next chapter, we will look at error handling and debugging, including try/catch, error chaining, and custom error patterns.