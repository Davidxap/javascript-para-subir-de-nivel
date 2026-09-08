---
title: "Capítulo 12: APIs modernas y propuestas TC39 (ES2025-ES2026)"
---

# Capítulo 12: APIs modernas y propuestas TC39 (ES2025-ES2026)

> Este capítulo cubre las APIs y propuestas del comité TC39 que ya están disponibles o entrando en el estándar. No es una lista de curiosidades — son herramientas que reemplazan código que escribes con los ojos cerrados cada semana.

## 1. Suma precisa: no todo es simple `reduce`

### El problema: un millón que desaparece en la suma

```javascript
const mediciones = [1e16, 1, -1e16]
const naive = mediciones.reduce((a, b) => a + b, 0)
console.log(naive) // 0 — el 1 desapareció por completo
```

Tres números. El resultado correcto es 1. Pero el valor grande (`1e16`) se come al pequeño (`1`) en cada paso de acumulación porque el `+` de punto flotante redondea intermedios. Un error de precisión en una aplicación financiera o científica no es un detalle — es un fallo silencioso.

La suma compensada (algoritmo de Neumaier) corrige esto en tiempo lineal sin bibliotecas externas:

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
console.log(total) // 1 — el valor correcto

const precios = [0.1, 0.2, 0.3]
console.log(sumaPrecisa(precios))      // 0.6
console.log(precios.reduce((a,b)=>a+b, 0)) // 0.6000000000000001
```

`Math.sumPrecise` (estándar **ES2026**; hoy: Chrome 137+, V8 14.6 con `--harmony`, pendiente en Node por defecto) implementa este algoritmo de forma nativa y acepta cualquier iterable:

```javascript
// Cuando llegue a tu runtime hoy: Chrome 137+, V8 con --harmony;
// aún no está activo en Node por defecto. Detección antes de usarlo:
if (typeof Math.sumPrecise === "function") {
  console.log(Math.sumPrecise([1e16, 1, -1e16]))   // 1
  console.log(Math.sumPrecise([0.1, 0.2, 0.3]))    // 0.6
  console.log(Math.sumPrecise([1e20, 0.1, -1e20])) // 0.1
  console.log(Math.sumPrecise([]))                  // -0
} else {
  console.log("Math.sumPrecise no está disponible en este runtime")
}
```

**Atención**: `Math.sumPrecise` corrige la acumulación de errores, no la representación binaria de cada valor. `[0.1, 0.2].reduce` da `0.30000000000000004` en cualquier runtime (IEEE 754): `Math.sumPrecise([0.1, 0.2])` devuelve lo mismo, porque los literales `0.1` y `0.2` ya son los dobles más próximos a esos decimales en binario. La mejora aparece al sumar cadenas largas o de magnitudes muy dispares, como `[1e16, 1, -1e16]`.

### Conexión con Python

**Traduce exactamente**: `math.fsum(iterable)` usa la misma estrategia compensada que `sumaPrecisa` — acepta cualquier iterable y devuelve la suma estable de punto flotante. `Decimal` resuelve un problema más fuerte (precisión exacta, con redondeo configurable) pero es más lento y requiere construir los valores desde cadenas `'0.1'` para ser exacto.

```python
from decimal import Decimal

naive_suma = sum([1e16, 1, -1e16])      # 0.0 — el 1 desaparece
import math
fsum = math.fsum([1e16, 1, -1e16])     # 1.0 — compensada, estable

Decimal("0.1") + Decimal("0.2")         # Decimal("0.3") — exacto, sin redondeo
0.1 + 0.2                                # 0.30000000000000004 — flujo IEEE
```

**Cambia de fondo**: Python tiene `math.fsum` desde 2005; JavaScript llega 20 años después con `Math.sumPrecise`. La ventaja de JavaScript es que acepta **cualquier iterable** (incluido `generator`), mientras que `fsum` también acepta iterables — la diferencia es la duración del estándar.

### Conexión con Java

**Traduce exactamente**: `BigDecimal` resuelve el mismo problema con precisión configurable (`BigDecimal.valueOf(0.1)` es exacto; `new BigDecimal(0.1)` no lo es). Es más general pero más pesado que `Math.sumPrecise`.

**Cambia de fondo**: `DoubleStream.sum()` de Java **ya usa suma compensada** (Kahan implícito desde Java 8) — es la contraparte exacta de `Math.sumPrecise` para `double[]`. Si tu código JavaScript usa arrays de `Float64Array` para datos científicos, la traducción conceptual a Java es `DoubleStream.of(...).sum()`, no `BigDecimal`.

```java
// Java: Stream double compensado — misma idea que Math.sumPrecise
double[] mediciones = {1e16, 1, -1e16};
double total = Arrays.stream(mediciones).sum();  // 1.0 — Kahan implícito

// Java: BigDecimal — precisión decimal exacta
BigDecimal a = new BigDecimal("0.1");
BigDecimal b = new BigDecimal("0.2");
a.add(b)  // 0.3 — exacto, con redondeo configurable
```

---

## 2. `Error.isError`: errores que no cambian de identidad entre clases

### El problema: un Error que no pasa `instanceof`

```javascript
// Dos workers distintos crean errores
const workerA = new Worker("a.js")
const workerB = new Worker("b.js")

// En el worker principal, recibes un error del workerB
// instanceof Error puede ser false: mismo nombre, otra clase interna
// El realm (contexto de ejecución) construye su propio Error
```

En JavaScript, cada `iframe`, `Worker` y realm tiene su propio `Error` constructor. Un `Error` creado en el realm del worker **no es instancia** del `Error` del realm principal: `instanceof Error` puede fallar. `Error.isError` resuelve esto con una verificación fiable que no depende del realm:

```javascript
console.log(Error.isError(new Error("test")))         // true
console.log(Error.isError(new TypeError("test")))     // true (hereda de Error)
console.log(Error.isError({ message: "fake" }))       // false — no es Error
console.log(Error.isError(null))                      // false
```

### Conexión con Python

**Traduce exactamente**: Python no tiene el problema de realms porque no comparte el mismo mecanismo de prototipos heredados. `isinstance(error, Exception)` funciona siempre, sin importar el hilo o módulo.

```python
from concurrent.futures import ThreadPoolExecutor

def lanzar_error():
    raise ValueError("del hilo")

with ThreadPoolExecutor() as pool:
    futuro = pool.submit(lanzar_error)
    try:
        futuro.result()
    except ValueError as e:
        print(isinstance(e, Exception))  # True — siempre, sin realm
```

**Cambia de fondo**: en Python el equivalente conceptual es que un `Exception` importado de otro paquete sigue siendo `Exception`. En JavaScript, `Error.isError` reemplaza `instanceof` como verificación estándar precisamente porque los realm rompen la identidad de clase que `instanceof` asume.

### Conexión con Java

**Traduce exactamente**: Java no tiene el problema de realms en `instanceof` — pero tiene un problema análogo con **classloaders**. Si dos classloaders cargan una clase llamada `com.app.MyException`, son `Class` objetos distintos: `obj instanceof MyException` puede ser `false` si el `MyException` del catch y el del objeto vinieron de loaders diferentes (común en OSGi, servidores de aplicaciones, hot-reload en desarrollo).

```java
// Java: el problema equivalente (two classloaders)
// MyException de ClassLoader A vs ClassLoader B
// son distintas clases, aunque tengan el mismo FQN
obj.getClass().getName()         // "com.app.MyException"
obj instanceof MyException       // puede ser false (si el MyException del catch es otro loader)
```

**Cambia de fondo**: JavaScript resuelve la verificación a nivel de lenguaje (`Error.isError`); Java lo resuelve a nivel de reflection: `obj.getClass().isAssignableFrom(MyException.class)` o `obj.getClass().getName().equals("...")`. En la práctica rara vez necesitas esto porque en Java los classloaders aislados son patrón de despliegue; en JavaScript los realm son tan comunes como un `iframe` que no controlas.

---

## 3. Iterator helpers: secuencias perezosas sin arrays de por medio

### El problema: materializar secuencias enormes por accidente

```javascript
function* millions(n) {
  let i = 0
  while (i < n) yield i++
}

// Esto carga todo en memoria:
const arr = [...millions(10_000_000)] // ~80 MB, luego filtras el 1%
const pocos = arr.filter(x => x % 100 === 0)
```

Los iterator helpers (`filter`, `map`, `take`, `drop`, `toArray`, `reduce`, `flatMap`) añaden métodos encadenables directamente sobre el iterador — los valores se producen bajo demanda, sin materializar arrays intermedios:

```javascript
function* naturales() {
  let n = 1
  while (true) yield n++
}

const cuadrados = naturales()
  .filter(n => n % 2 === 0)   // pares
  .map(n => n * n)             // al cuadrado
  .take(5)                     // solo 5
  .toArray()

console.log(cuadrados) // [4, 16, 36, 64, 100]
```

El generador `naturales()` es infinito, pero `.take(5)` detiene la ejecución después de 5 valores. Sin `take`, un `.toArray()` sobre un generador infinito **cuelga el proceso** (nunca termina de iterar).

Los helpers son `O(1)` en memoria: no crean arrays intermedios, no copian datos. Cada paso produce el siguiente valor en cuanto se necesita.

### Conexión con Python

**Traduce exactamente**: Python resuelve esto con `itertools` (módulo de stdlib): `islice` ≈ `take`, `map`/`filter` ≈ los helpers, encadenamiento manual de generadores ≈ `.map().filter().take()`. `itertools.chain` ≈ `Iterator.concat`.

```python
from itertools import islice, filterfalse

# Sin iterator helpers de Python (generadores encadenados):
def cuadrados_pares():
    for n in naturales():
        if n % 2 == 0:
            yield n * n

resultado = list(islice(cuadrados_pares(), 5))  # [4, 16, 36, 64, 100]

# Python 3.12+ tiene itertools.batched — no hay equivalente directo a .reduce
from functools import reduce
reduce(lambda a, b: a + b, islice(naturales(), 10))  # 55
```

**Cambia de fondo**: Python usa composición externa (`islice(map(..., filter(...)))`) con itertools; JavaScript usa métodos encadenables sobre el iterador mismo (`.filter().map().take().toArray()`). El estilo JavaScript es más legible en cadenas largas; el estilo Python es más composable con composición izquierda. Las dos funcionan con lazy evaluation.

### Conexión con Java

**Traduce exactamente**: Java `Stream` es la contraparte exacta: `.filter()`, `.map()`, `.limit()` ≈ `.take()`, `.toList()` ≈ `.toArray()`. Ambos son lazy y se materializan con `.collect()`/`.toList()`/`.toArray()`.

```java
// Java: lazy stream — misma pereza que Iterator helpers
Stream.iterate(1, n -> n + 1)       // iterador infinito
    .filter(n -> n % 2 == 0)         // lazy
    .map(n -> n * n)                 // lazy
    .limit(5)                        // toma 5
    .toList()                        // materializa — [4, 16, 36, 64, 100]
```

**Cambia de fondo**: `Iterator` de Java **no tiene helpers** — métodos como `map`/`filter`/`take` sobre el iterador son novedad de JavaScript. Si trabajas con un `Iterator<T>` puro de Java, necesitas `StreamSupport.stream(iterator, false)` para envolverlo antes de usar lazy ops. JavaScript te da los helpers directamente sobre el iterador: menos verboso, misma semántica.

---

## 4. `Map.getOrInsert`: el boilerplate que ya no necesitas

### El problema: la madriguera de `has/get/set`

```javascript
// Esto escribes cada vez que necesitas una entrada por defecto en un Map
if (!cache.has(clave)) {
  cache.set(clave, new Usuario(clave))
}
const usuario = cache.get(clave) // 3 líneas, 2 accesos al Map
```

`getOrInsert` y `getOrInsertComputed` colapsan el patrón en una sola línea. `getOrInsert(key, value)` inserta y devuelve el valor directo; `getOrInsertComputed(key, fn)` ejecuta la fábrica solo si la clave no existe:

```javascript
const cache = new Map()

// Primera llamada: crea, inserta, devuelve
const u1 = cache.getOrInsert("ana", { nombre: "Ana", rol: "admin" })
console.log(u1.nombre) // "Ana"

// Segunda llamada: devuelve la existente, no toca nada
const u2 = cache.getOrInsert("ana", { nombre: "Ana2", rol: "user" })
console.log(u2 === u1) // true — misma referencia

// Con fábrica: solo ejecuta si la clave no está
const perfil = cache.getOrInsertComputed("david", () => {
  console.log("fábrica ejecutada una vez") // se ejecuta solo la primera vez
  return { nombre: "David", rol: "dev" }
})

// WeakMap también las tiene (pero WeakMap solo acepta objetos como clave)
const ref = new WeakMap()
ref.getOrInsert({}, { datos: "ocultos" }) // funciona, el objeto es la clave
```

### Conexión con Python

**Traduce exactamente**: `dict.setdefault(key, value)` es el equivalente exacto de `getOrInsert` — inserta y devuelve el valor existente o el nuevo. `collections.defaultdict(factory)` resuelve el caso de `getOrInsertComputed`: crea automáticamente la entrada al acceder a una clave ausente.

```python
cache = {}

# setdefault — misma idea que getOrInsert
usuario = cache.setdefault("ana", {"nombre": "Ana", "rol": "admin"})
usuario2 = cache.setdefault("ana", {"nombre": "Ana2"})
assert usuario is usuario2  # True — misma referencia

from collections import defaultdict
perfiles = defaultdict(lambda: {"nombre": "desconocido", "rol": "guest"})
perfiles["david"]  # ejecuta la fábrica: {"nombre": "desconocido", "rol": "guest"}
```

**Cambia de fondo**: `defaultdict` crea la entrada **al acceder** (incluso con `perfiles["no_existe"]`), mientras que `getOrInsertComputed` requiere invocación explícita. En Python `defaultdict` es más cómodo para agrupación; en JavaScript `getOrInsertComputed` es más explícito (no crea entradas fantasma).

### Conexión con Java

**Traduce exactamente**: `ConcurrentHashMap.computeIfAbsent(key, mappingFunction)` es la contraparte exacta — ejecuta la función solo si la clave no existe y es thread-safe (lo que `Map` de JavaScript no es por defecto).

```java
Map<String, Usuario> cache = new ConcurrentHashMap<>();

// ComputeIfAbsent — misma lógica que getOrInsertComputed
Usuario u = cache.computeIfAbsent("ana", k -> new Usuario(k, "admin"));
// Primera vez: crea y devuelve
// Segunda vez: devuelve la existente, la fábrica no corre
```

**Cambia de fondo**: `computeIfAbsent` es la opción segura en concurrencia; `getOrInsert` de JavaScript opera en un solo hilo (no hay race condition en el event loop). Si migras un patrón de `ConcurrentHashMap.computeIfAbsent` a `Map.getOrInsert`, la semántica es idéntica siempre que tu JS sea single-threaded.

---

## Depuración en la práctica

### Señales y soluciones

| Señal | Qué buscar | Herramienta / API |
|---|---|---|
| `0.1+0.2+0.3 !== 0.6` | Redondeo de intermediarios | `sumaPrecisa()` o `Math.sumPrecise` |
| `instanceof Error` da `false` | Realm (iframe, worker, eval) | `Error.isError` |
| Proceso cuelga al iterar generador infinito | Materialización accidental | `.take(n)` antes de `.toArray()` |
| Tres líneas `has/set/get` cada vez | Boilerplate de Map | `getOrInsert` / `getOrInsertComputed` |
| Suma de grandes + pequeños = 0 | `+` pierde magnitudes pequeñas | Suma compensada |

### Escenario 1: `Math.sumPrecise` no existe en tu runtime

Tu código corre en Node 22 LTS o Safari. `Math.sumPrecise` no está disponible y el polyfill no está en bundle. ¿Qué haces?

**Diagnóstico**: Feature-detect primero; cae en suma compensada manual. La función `sumaPrecisa` es ~10 líneas, sin dependencias, y funciona en cualquier entorno. La segunda alternativa es `core-js` polyfill (`import "core-js/actual/math/sum-precise"`), que es útil cuando el polyfill ya está en tu bundle.

**Solución**:

```javascript
// Preferencia: Math.sumPrecise nativo, fallback a Kahan
const sumar = typeof Math.sumPrecise === "function"
  ? (it) => Math.sumPrecise(it)
  : sumaPrecisa // la función manual del inicio de este capítulo
```

### Escenario 2: iterator infinito, `toArray` y el proceso que cuelga

Alguien escribió `resultado = datos.filter(x => x.activo).toArray()` sin saber que `datos` era un iterador infinito. El proceso no responde, sin error, sin stack.

**Diagnóstico**: Mira si `toArray` fue llamado sobre algo que puede ser infinito. `Iterator`, generadores `function*`, `stream` de datos — todos pueden devolver `toArray` que nunca termina. Sin `.take()`, no hay salida.

**Solución**: Añade `.take(límiteRazonable)` antes de `.toArray()`. En producción, sustituye `.toArray()` por `.forEach()` o un `for...of` que procesa bajo demanda.

```javascript
// Peligroso: puede ser infinito
const todo = stream.filter(x => x.activo).toArray()

// Seguro: bajo demanda, termina siempre
for (const item of stream.filter(x => x.activo)) {
  procesar(item)
}
```

---

## Práctica y ejercicios

### 1. Preguntas de repaso

Antes de seguir, responde estas preguntas de memoria (no busques en el capítulo):

1. ¿Por qué `[1e16, 1, -1e16].reduce((a,b)=>a+b, 0)` da 0 en vez de 1?
2. ¿Qué ventaja tiene `Error.isError` sobre `instanceof Error`?
3. ¿Qué ocurre si llamas a `.toArray()` sobre un generador infinito sin `.take()`?
4. ¿En qué se diferencia `getOrInsertComputed` de `getOrInsert`?
5. ¿Por qué `Math.sumPrecise([0.1, 0.2])` puede devolver `0.30000000000000004`?

### 2. Explicarlo con tus palabras

Elige uno de estos y explica en voz alta como si le hablaras a alguien que solo sabe HTML:

- **[Suma precisa](#1-suma-precisa-no-todo-es-simple-reduce)**: ¿por qué el `+` de JavaScript pierde valores en secuencias largas y cómo la suma compensada lo resuelve?
- **[Error.isError](#2-erroriserror-errores-que-no-cambian-de-identidad-entre-clases)**: ¿qué pasa con `instanceof Error` cuando un error viene de un worker y cómo se resuelve?
- **[Iterator helpers](#3-iterator-helpers-secuencias-perezosas-sin-arrays-de-por-medio)**: ¿por qué `.toArray()` sobre un iterador infinito cuelga el proceso?

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): compararSumas

Crea una función `compararSumas(numeros)` que:
1. Use `reduce` con valor inicial 0.
2. Use `sumaPrecisa` (la función Kahan de este capítulo).
3. Devuelva `{ naive, preciso, diferencia, sonIguales }`.

Uso esperado:

```javascript
const r = compararSumas([1e16, 1, -1e16])
console.log(r.naive)       // 0
console.log(r.preciso)     // 1
console.log(r.diferencia)  // 1
console.log(r.sonIguales)  // false
```

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. `reduce` es `arr.reduce((a, b) => a + b, 0)`
2. Llama a `sumaPrecisa(numeros)`
3. `diferencia = Math.abs(naive - preciso)`

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function compararSumas(numeros) {
  const naive = numeros.reduce((a, b) => a + b, 0)
  const preciso = sumaPrecisa(numeros)
  const diferencia = Math.abs(naive - preciso)
  return { naive, preciso, diferencia, sonIguales: naive === preciso }
}

// Prueba
const r1 = compararSumas([1e16, 1, -1e16])
console.log(r1.naive)       // 0
console.log(r1.preciso)     // 1
console.log(r1.sonIguales)  // false

const r2 = compararSumas([1, 2, 3])
console.log(r2.sonIguales)  // true — aquí reduce y Kahan coinciden
```

**¿Por qué funciona?** `reduce` acumula con el `+` del lenguaje, que en cada paso redondea a 53 bits de precisión: el `1` se pierde contra `1e16`. La suma compensada mantiene una variable `compensacion` que recupera los residuos de redondeo de cada paso — por eso devuelve `1`. En secuencias cortas sin grandes diferencias de magnitud, ambos coinciden.

</details>

#### Ejercicio 2 (Intermedio): Iterator personalizado

Implementa una clase `IteradorPersonalizado` que:
1. Reciba un generador en el constructor.
2. Tenga métodos `.map(fn)`, `.filter(fn)`, `.take(n)` que devuelvan un **nuevo** `IteradorPersonalizado` (lazy).
3. Tenga `.toArray()` que materialice.
4. Añada `.reduce(fn, init)` que procese bajo demanda (sin materializar todo).

Uso esperado:

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
<summary>💡 Ver pistas</summary>

1. Cada método devuelve `new IteradorPersonalizado(this)` con un generador interno que `yield` el paso.
2. `.reduce` hace `for (const item of this.generator)` sin crear array.
3. `take` corta la cadena tras `n` elementos — comprueba el límite **antes** de pedir el siguiente valor al generador.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

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

// Uso
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

**¿Por qué funciona?** Cada método crea un **nuevo** iterador que envuelve al anterior: `.filter()` no ejecuta nada hasta que `toArray()` o `reduce` invocan `next()` sobre el primer generador. `take(n)` añade un contador que ejecuta `break` después de `n` iteraciones, deteniendo la cadena completa (nunca llega al infinito) — por eso `suma` termina aunque `contar()` sea infinito. `reduce` itera directamente sobre el generador sin crear array intermedio.

</details>

#### Ejercicio 3 (Avanzado): caché con TTL sobre un generador lento

Crea una función `conCacheLento(numeros, TTL)` que:
1. Reciba un iterable `numeros` (puede ser infinito) y un `TTL` en milisegundos.
2. Calcule `Math.sqrt(n)` para cada número, pero **solo almacene el resultado en caché** la primera vez que aparezca cada valor.
3. Si el valor está en caché y el TTL no ha expirado, reutilice; si expiró, recalcule.
4. Devuelva `{ resultado, metricas: { cacheHits, cacheMisses } }`.

Ejemplo con valores que se repiten después de una pausa artificial:

```javascript
function* fuenteLenta() {
  yield* [1, 2, 3, 1, 2, 3, 1]  // los tres primeros son nuevos; luego repite
}

const { resultado, metricas } = conCacheLento(fuenteLenta(), 50)
console.log(resultado.map(x => x.toFixed(3)))
// ["1.000", "1.414", "1.732", "1.000", "1.414", "1.732", "1.000"]
console.log(metricas)
// { cacheHits: 4, cacheMisses: 3 } — los repetidos reutilizan caché
```

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa un `Map` donde la clave es el número de entrada y el valor es `{ valor, timestamp }`.
2. Antes de calcular, verifica si `cache.has(n)` y `Date.now() - timestamp < TTL`.
3. Para el generador infinito, usa `.take()` antes de `.toArray()` para evitar cuelgue.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

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

// Prueba — repite valores para activar caché
const { resultado, metricas } = conCacheLento([1, 2, 3, 1, 2, 3, 1], 5000)
console.log(metricas) // { cacheHits: 4, cacheMisses: 3 }
console.log(resultado.length) // 7

// Ojo: si `numeros` fuera un generador infinito, este `for...of` no terminaría nunca —
// la caché no le pone límite, tienes que limitar la fuente antes (take, slice, etc.)
```

**¿Por qué funciona?** El `for...of` sobre `numeros` consume el iterador bajo demanda: cada `yield` produce un valor, se busca en caché, y el siguiente solo se produce cuando el loop avanza. Con valores repetidos dentro del TTL, la fábrica `Math.sqrt` no corre — solo reutiliza. `cacheHits` y `cacheMisses` miden la efectividad real del caché sin telemetría externa.

</details>

---

## Tabla comparativa entre lenguajes

| JS (ES2025-2026) | Python | Java |
|---|---|---|
| `sumaPrecisa(arr)` / `Math.sumPrecise(arr)` | `math.fsum(iter)` | `DoubleStream.of(doubles).sum()` / `BigDecimal` |
| `Error.isError(val)` | `isinstance(val, Exception)` | `obj.getClass().isAssignableFrom(...)` |
| Iterator helpers `.map().filter().take().toArray()` | `itertools.islice`, `map`, `filter` encadenados | `Stream.iterate(...).map().limit().toList()` |
| `map.getOrInsert(k, v)` / `getOrInsertComputed(k, fn)` | `dict.setdefault(k, v)` / `defaultdict(fn)` | `ConcurrentHashMap.computeIfAbsent(k, fn)` |
| `using` / `await using` | `with` / context managers | `try-with-resources` (Java 7+) |

---

## Resumen del capítulo

1. **Suma compensada** corrige el error silencioso de `reduce` en secuencias con grandes diferencias de magnitud. `Math.sumPrecise` llega a los runtimes como alternativa nativa.
2. **`Error.isError`** verifica errores de forma fiable entre realms — un problema que `instanceof` no puede resolver en entornos con múltiples contextos de ejecución.
3. **Iterator helpers** permiten procesamiento perezoso sobre secuencias potencialmente infinitas, sin crear arrays intermedios. `.take()` es la salvaguarda que evita cuelgues.
4. **`Map.getOrInsert`** y `getOrInsertComputed` eliminan el patrón `has/set/get` que existía desde ES6.
5. **Python** ofrece equivalentes en stdlib que llevan años siendo la referencia — `math.fsum` desde 2005, `setdefault` desde 2001, `itertools` desde 2003. JavaScript llega con ergonomía ligeramente mejor (iterables, métodos encadenables) pero el concepto es el mismo.
6. **Java** tiene `DoubleStream.sum()` como equivalente de suma compensada y `computeIfAbsent` como equivalente de `getOrInsert`, ambos thread-safe (JavaScript no tiene ese problema gracias al event loop).

---

## Siguiente camino: un lenguaje en movimiento

Este capítulo cierra la parte técnica del libro, pero no el camino. Las APIs de este capítulo ya están disponibles (algunas con polyfill) y van llegando a más runtimes cada mes. El conocimiento no es sobre la API concreta — es sobre **reconocer el patrón** que cada una reemplaza: `reduce` ingenuo, `instanceof` entre realms, materialización innecesaria, boilerplate de caché.

Sigue desde aquí:

- **Practica los ejercicios de cada capítulo** — repetir y explicar fija más que solo leer.
- **Revisa TC39** ([tc39.es](https://tc39.es/ecma262/)) cuando quieras ver qué viene — los stages te dicen si algo es inminente o speculativo.
- **Contribuye a proyectos open source** — es donde las APIs nuevas se encuentran por primera vez con problemas reales.
