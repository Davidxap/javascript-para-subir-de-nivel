---
title: "Capítulo 5: Estructuras avanzadas e iteración"
---

# Capítulo 5: Estructuras avanzadas e iteración

> JavaScript moderno tiene estructuras de datos más allá de los objetos y arrays básicos.

## Introducción

JavaScript moderno tiene estructuras de datos más allá de los objetos y arrays básicos: `Map`, `Set`, `WeakMap`, `WeakSet`. También tiene un sistema de iteración unificado basado en el protocolo de iteración, con generadores e iterator helpers (ES2025+). Entender estas herramientas te permite escribir código más expresivo, más eficiente y más seguro en términos de gestión de memoria.

**¿Por qué importa?** Porque estas estructuras son esenciales para algoritmos eficientes, patrones de diseño y manejo de datos en aplicaciones modernas. Muchos patrones de diseño dependen de colecciones y iteradores.

## 1. `Map` y `Set` vs objetos y arrays

### Idea clave

`Map` es una colección de pares clave-valor donde las claves pueden ser cualquier tipo (no solo strings). `Set` es una colección de valores únicos. A diferencia de los objetos, `Map` preserva el orden de inserción, no tiene prototipo (no hay colisiones con propiedades heredadas), y tiene un tamaño O(1) con `.size`.

### `Map` vs objeto

```javascript
// Map: claves pueden ser cualquier tipo
const map = new Map()
const objKey = { id: 1 }
const funcKey = () => {}

map.set("string", "valor")
map.set(objKey, "objeto como clave")
map.set(funcKey, "función como clave")
map.set(42, "número como clave")

console.log(map.size)  // 4
console.log(map.get(objKey))  // "objeto como clave"

// Iteración en orden de inserción
for (const [clave, valor] of map) {
  console.log(clave, valor)
}

// Objeto: las claves son solo strings/symbols
const obj = {}
obj[objKey] = "valor"  // la clave se convierte a "[object Object]"
console.log(obj[{}])  // "valor" — ¡cualquier objeto vacío accede al mismo!
console.log(Object.keys(obj))  // ["[object Object]"]
```

### `Set` vs array

```javascript
// Set: valores únicos, búsqueda O(1)
const set = new Set([1, 2, 3, 2, 1])  // Set { 1, 2, 3 } — elimina duplicados
console.log(set.size)  // 3
set.add(4)
set.has(3)  // true — O(1), más rápido que array.includes() que es O(n)

// Eliminar duplicados de un array
const duplicados = [1, 2, 2, 3, 3, 3, 4]
const unicos = [...new Set(duplicados)]  // [1, 2, 3, 4]

// Array para eliminar duplicados (más lento):
const unicosArray = duplicados.filter((v, i) => duplicados.indexOf(v) === i)
```

### Cuándo usar cada uno

| Necesidad | Usar |
|-----------|------|
| Clave-valor con claves string | Objeto (más ligero) |
| Clave-valor con claves no-string | `Map` |
| Valores únicos | `Set` |
| Búsqueda frecuente de existencia | `Set` (O(1)) o `Map` (O(1)) |
| Orden de inserción importante | `Map` o `Set` (garantizado) |
| Serialización a JSON | Objeto (Map no se serializa directamente) |

### Piensa críticamente

- ¿Por qué `Map` no se serializa con `JSON.stringify`? Porque `JSON.stringify` solo funciona con strings y objects. Para serializar un Map, conviértelo a array de pares: `JSON.stringify([...map])`.
- ¿`Map` es más lento que un objeto? En operaciones básicas, son comparables. `Map` es ligeramente más lento en creación pero más rápido en inserción/eliminación frecuente. Para datos estáticos, un objeto es más ligero.
- ¿`Set` mantiene el orden? Sí, los Sets preservan el orden de inserción, al igual que los Maps.

## 2. `WeakMap` y `WeakSet` — gestión de memoria

### Idea clave

`WeakMap` y `WeakSet` son como `Map` y `Set` pero con una diferencia crucial: las claves (en WeakMap) o valores (en WeakSet) son referencias débiles. Si no hay otras referencias al objeto, el garbage collector puede eliminarlo. Esto previene memory leaks cuando asocias datos a objetos del DOM u otros objetos de vida corta.

### WeakMap: datos asociados sin leaks

```javascript
// Caso de uso: metadatos asociados a elementos del DOM
const metadatos = new WeakMap()

const boton = document.createElement("button")
metadatos.set(boton, { vecesClickeado: 0, ultimoClick: null })

boton.addEventListener("click", () => {
  const data = metadatos.get(boton)
  data.vecesClickeado++
  data.ultimoClick = new Date()
})

// Cuando el botón se elimina del DOM y no hay más referencias,
// el garbage collector puede eliminar tanto el botón como sus metadatos.
// Con un Map normal, los metadatos permanecerían para siempre (memory leak).
```

### WeakSet: tracking de objetos procesados

```javascript
const procesados = new WeakSet()

function procesarSiNecesario(objeto) {
  if (procesados.has(objeto)) {
    console.log("Ya procesado")
    return
  }
  // procesar...
  procesados.add(objeto)
}

const item = { id: 1 }
procesarSiNecesario(item)  // procesa
procesarSiNecesario(item)  // "Ya procesado"
// Cuando item ya no tiene referencias, el WeakSet lo libera automáticamente
```

### Restricciones de WeakMap/WeakSet

- Las claves de WeakMap deben ser objetos (no primitivos).
- No son iterables (no `for...of`, no `.keys()`, no `.size`).
- No se puede saber cuántos elementos tienen.

### Piensa críticamente

- ¿Por qué WeakMap no es iterable? Porque los objetos pueden ser eliminados en cualquier momento por el GC. Si pudieras iterar, podrías ver objetos que ya deberían estar eliminados, lo que rompería la semántica de referencias débiles.
- ¿Cuándo usar WeakMap vs Map? Usa WeakMap cuando los datos asociados deben vivir y morir con el objeto clave (metadatos de DOM, caches de funciones). Usa Map cuando necesitas iterar, saber el tamaño, o usar claves primitivas.

## 3. El protocolo de iteración: iterables e iteradores

### Idea clave

JavaScript tiene dos protocolos de iteración. Un **iterable** es un objeto con `Symbol.iterator` que devuelve un **iterador**. Un iterador es un objeto con `next()` que devuelve `{ value, done }`. Esto unifica `for...of`, spread, destructuración y más.

### Implementar un iterable

```javascript
// Objeto iterable personalizado
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
      // Hacer el iterador también iterable (para reutilizar)
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

const rango = new Rango(1, 10, 2)

// for...of usa el protocolo de iteración
for (const n of rango) {
  console.log(n)  // 1, 3, 5, 7, 9
}

// Spread también lo usa
const array = [...rango]  // [1, 3, 5, 7, 9]

// Destructuración también
const [primero, segundo] = rango  // primero=1, segundo=3
```

### Iterables built-in

```javascript
// Estos son iterables nativos:
[1, 2, 3]          // Array
"hola"             // String
new Set([1, 2, 3])  // Set
new Map([...])      // Map
// NO son iterables:
// { a: 1 }          // Objeto plano (usa for...in en su lugar)
// new Number(42)    // Number
```

### Iterador infinito

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
// Nunca termina — cuidado con for...of
```

### Piensa críticamente

- ¿Por qué los objetos no son iterables por defecto? Porque no hay un orden garantizado de propiedades (históricamente). `Object.entries()`, `Object.keys()`, `Object.values()` devuelven arrays que sí son iterables.
- ¿Un iterador se puede reiniciar? Depende. Si el iterador es también iterable (`[Symbol.iterator]() { return this }`), reiniciarlo significa crear uno nuevo. Un iterador agota su estado.

## 4. Generadores: `function*`, `yield`, `yield*`

### Idea clave

Los generadores son funciones que pueden pausar y reanudar su ejecución. `yield` pausa la función y devuelve un valor. La próxima llamada a `.next()` reanuda desde donde se pausó. Son la forma más sencilla de implementar iterables personalizados.

### Generador básico

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

// Usar con for...of (ignora el return, para en done: true)
for (const n of contador()) {
  console.log(n)  // 1, 2, 3
}
```

### Generador con pausa y reanudación

```javascript
function* dialogo() {
  const pregunta = yield "¿Cuál es tu nombre?"  // pausa aquí
  console.log(`Hola, ${pregunta}`)  // se reanuda con el valor pasado a next()
  const edad = yield "¿Cuántos años tienes?"
  console.log(`${pregunta} tiene ${edad} años`)
}

const gen = dialogo()
gen.next().value  // "¿Cuál es tu nombre?"
gen.next("David").value  // "¿Cuántos años tienes?" — "David" se asigna a 'pregunta'
gen.next(25)  // logs: "David tiene 25 años"
```

### `yield*` — delegación

```javascript
function* inner() {
  yield 1
  yield 2
}

function* outer() {
  yield 0
  yield* inner()  // delega a otro generador/iterable
  yield 3
}

[...outer()]  // [0, 1, 2, 3]
```

### Generador infinito con lazy evaluation

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

// Los generadores son lazy: solo calculan el siguiente valor cuando se pide
// Esto permite secuencias infinitas sin agotar memoria
```

### Piensa críticamente

- ¿Los generadores son asíncronos? No. Son síncronos pero pausables. `yield` pausa, pero no cede el control al Event Loop. Para asincronía con generadores, se necesita `co` o async generators (`async function*`).
- ¿`return` en un generador? Termina el generador. El valor de return aparece en `{ value, done: true }` pero `for...of` lo ignora.
- ¿Se puede pasar un generador a `Promise.all`? No directamente, porque `Promise.all` espera un iterable de promesas. Si el generador produce promesas, sí: `Promise.all(generadorDePromesas())`.

## 5. Iterator helpers (ES2025+: `map`, `filter`, `take`, `drop`)

### Idea clave

ES2025 añade métodos a los iteradores directamente: `.map()`, `.filter()`, `.take()`, `.drop()`, `.reduce()`, `.toArray()`, `.forEach()`. Estos son lazy — no materializan el array completo. Permiten procesar secuencias infinitas o muy grandes sin agotar memoria.

### Ejemplos

```javascript
// Iterator helpers — ES2025+
function* naturales() {
  let n = 1
  while (true) yield n++
}

// Tomar los primeros 5 números pares
const pares = naturales()
  .filter(n => n % 2 === 0)  // lazy: solo filtra cuando se pide
  .take(5)                    // lazy: solo toma 5
  .toArray()                  // materializa: [2, 4, 6, 8, 10]

// Sin iterator helpers, necesitarías un bucle manual:
const paresManual = []
for (const n of naturales()) {
  if (n % 2 === 0) {
    paresManual.push(n)
    if (paresManual.length === 5) break
  }
}
```

### Lazy evaluation con secuencias infinitas

```javascript
// Sumar los primeros 100 múltiplos de 3
const suma = naturales()
  .filter(n => n % 3 === 0)
  .take(100)
  .reduce((a, b) => a + b, 0)
// Solo procesa lo necesario — no intenta iterar la secuencia infinita
```

### Estado de la propuesta

- Iterator helpers es parte de **ES2025** (Stage 4, finalizada).
- Disponible en Node.js 22+ y navegadores modernos (Chrome 131+).
- En entornos sin soporte, se puede polyfill o usar librerías como iter-tools.

### Piensa críticamente

- ¿Por qué los iterator helpers son importantes? Porque permiten el estilo funcional (`map`, `filter`, `reduce`) en iterables sin materializar arrays intermedios. `[...iterable].map().filter()` crea arrays temporales; los helpers son lazy.
- ¿Se pueden encadenar con generadores? Sí. Los generadores devuelven iteradores, y los helpers trabajan con iteradores.

## 6. Desestructuración avanzada (rest, spread, nested, defaults)

### Idea clave

La desestructuración extrae valores de objetos y arrays en variables. El spread (`...`) expande iterables. El rest (`...`) recoge el resto. Estos son los patrones más usados en JavaScript moderno.

### Desestructuración de objetos

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

// Básica
const { nombre, edad } = usuario

// Renombrar
const { nombre: userNombre } = usuario  // userNombre = "David"

// Default
const { telefono = "N/A" } = usuario  // "N/A" (no existe la propiedad)

// Nested
const { direccion: { ciudad } } = usuario  // "Medellín"
// ⚠️ 'direccion' no se define como variable, solo 'ciudad'

// Rest
const { nombre, ...resto } = usuario
// nombre = "David", resto = { edad: 25, direccion: {...}, hobbies: [...] }
```

### Desestructuración de arrays

```javascript
const [a, b, c] = [1, 2, 3]  // a=1, b=2, c=3
const [primero, ...resto] = [1, 2, 3, 4]  // primero=1, resto=[2,3,4]
const [, , tercero] = [1, 2, 3]  // tercero=3 (saltar elementos)
const [x = 0, y = 0] = [1]  // x=1, y=0 (default)

// Intercambio de variables
let a = 1, b = 2
;[a, b] = [b, a]  // a=2, b=1
```

### Spread en funciones y arrays

```javascript
// Spread en llamadas
function sumar(a, b, c) { return a + b + c }
const nums = [1, 2, 3]
sumar(...nums)  // 6

// Spread en arrays
const arr1 = [1, 2]
const arr2 = [3, 4]
const combinado = [...arr1, ...arr2]  // [1, 2, 3, 4]

// Spread en objetos (ES2018+)
const defaults = { tema: "oscuro", idioma: "es" }
const override = { idioma: "en" }
const config = { ...defaults, ...override }  // { tema: "oscuro", idioma: "en" }

// Rest en parámetros
function log(tag, ...args) {
  console.log(`[${tag}]`, ...args)
}
log("INFO", "mensaje", 42, { key: "value" })  // [INFO] mensaje 42 { key: "value" }
```

### Piensa críticamente

- ¿Spread copia profundamente? No. El spread hace una copia superficial. Los objetos anidados se comparten por referencia.
- ¿El orden del spread importa en objetos? Sí. Las propiedades posteriores sobrescriben las anteriores: `{ ...a, ...b }` — las propiedades de `b` ganan sobre `a`.
- ¿Se puede desestructurar null? No. `const { a } = null` lanza TypeError. Usa default: `const { a } = obj || {}`.

## 7. Estructuras de datos inmutables

### Idea clave

La inmutabilidad significa que un objeto no cambia después de crearse. En JavaScript, los strings y numbers son inmutables por naturaleza. Los objetos y arrays son mutables, pero puedes usar patrones de inmutabilidad para prevenir bugs.

### Copia superficial vs profunda

```javascript
// Copia superficial (shallow)
const original = { a: 1, b: { c: 2 } }
const copia = { ...original }
copia.a = 10  // no afecta original
copia.b.c = 20  // ¡SÍ afecta original! (b se comparte por referencia)
console.log(original.b.c)  // 20

// Copia profunda (deep)
const copiaProfunda = structuredClone(original)  // ES2022+
copiaProfunda.b.c = 30
console.log(original.b.c)  // 20 — no afecta
```

### Patrón: actualización inmutable

```javascript
// En lugar de mutar:
const estado = { contador: 0, lista: [1, 2] }
// ❌ Mutación
estado.contador++
estado.lista.push(3)

// ✅ Inmutable
const nuevoEstado = {
  ...estado,
  contador: estado.contador + 1,
  lista: [...estado.lista, 3],
}
// El estado original no cambia
```

### `structuredClone` (ES2022+)

```javascript
// Copia profunda nativa
const obj = {
  fecha: new Date(),
  mapa: new Map(**"a", 1**),
  regex: /patrón/g,
  arr: [{ x: 1 }],
}
const copia = structuredClone(obj)
// Funciona con Date, Map, Set, Array, RegExp, etc.
// No funciona con funciones, DOM nodes, o class instances (pierden prototipo)
```

### `Object.freeze` recursivo

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
config.api.url = "hack"  // TypeError en modo estricto
```

### Piensa críticamente

- ¿La inmutabilidad es más lenta? Crear copias tiene un costo, pero los motores modernos optimizan patrones inmutables. En React/Redux, la inmutabilidad es la base del change detection.
- ¿`structuredClone` vs `JSON.parse(JSON.stringify())`? `structuredClone` preserva Date, Map, Set, RegExp, tipos especiales. `JSON` los pierde (Date se convierte a string, Map se vacía).
- ¿`Object.freeze` recursivo es práctico? Para datos pequeños, sí. Para datos grandes, es lento. Considera librerías como Immutable.js o Immer.

## Errores Comunes

### Mapa de depuración del capítulo

- Si un `Map` se serializa como `{}` en JSON → conviértelo a array de pares: `JSON.stringify([...map])`.
- Si un `Set` tiene duplicados → verifica que los valores sean del mismo tipo (1 !== "1").
- Si `for...of` no funciona con un objeto → no es iterable. Usa `Object.entries()` o implementa `Symbol.iterator`.
- Si un generador se agota después de una iteración → los generadores son de un solo uso. Crea uno nuevo para reiniciar.
- Si `structuredClone` falla con una función → no soporta funciones. Usa una copia manual o una librería.
- Si la copia con spread modifica el original → es una copia superficial. Usa `structuredClone` para copia profunda.
- Si los iterator helpers no están disponibles → actualiza a Node.js 22+ o usa polyfill.

## Resumen

- `Map` permite claves de cualquier tipo; `Set` almacena valores únicos. Ambos preservan orden de inserción.
- `WeakMap`/`WeakSet` usan referencias débiles para prevenir memory leaks; no son iterables.
- El protocolo de iteración (`Symbol.iterator` + `next()`) unifica `for...of`, spread y destructuración.
- Los generadores (`function*`) pausan y reanudan ejecución; son la forma más simple de crear iterables.
- Iterator helpers (ES2025+) permiten `map`, `filter`, `take`, `drop` de forma lazy sobre iterables.
- La desestructuración extrae valores; el spread expande; el rest recoge.
- `structuredClone` (ES2022+) hace copia profunda nativa.
- La inmutabilidad previene bugs de estado compartido; `Object.freeze` y patrones de copia son las herramientas principales.

## Siguiente Capítulo

En el próximo capítulo veremos el manejo de errores y depuración, incluyendo try/catch, error chaining, y patrones de error personalizados.
