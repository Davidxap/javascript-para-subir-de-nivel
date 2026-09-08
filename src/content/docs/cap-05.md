---
title: "Capítulo 5: Estructuras de datos avanzadas e iteración"
---

# Capítulo 5: Estructuras de datos avanzadas e iteración

> Cuando un objeto y un array ya no son la mejor herramienta, el lenguaje te da el siguiente nivel de caja.

## Introducción

Aprendiste a guardar datos en objetos y arrays, y con ellos alcanza para mucho. Pero llegan los casos que esos dos no resuelven bien: un configuración donde las claves pueden ser funciones u objetos, una lista de elementos donde los duplicados estorban, o una secuencia tan larga que trayéndola toda a memoria se te va el equipo. Para esos casos JavaScript tiene `Map`, `Set`, `WeakMap` y `WeakSet`, y un sistema de iteración unificado que convierte cualquier cosa en algo repetible con `for...of`, spread y desestructuración.

En este capítulo vas a ver cuándo cada estructura gana frente a las otras, cómo funciona la iteración por dentro (con generadores incluidos), y por qué la inmutabilidad — no tocar lo que ya vives — te ahorra la clase de bugs que solo aparecen en producción.

---

## 1. `Map` y `Set`: cuando el objeto y el array se quedan cortos

### El problema: las claves de un objeto son siempre texto

Un objeto parece un diccionario, pero sus claves se **convierten en strings** en el momento en que las usas. Eso traiciona justo cuando más lo necesitas:

```javascript
const obj = {}
const claveObjeto = { id: 1 }

obj[claveObjeto] = "valor"      // la clave se convierte a "[object Object]"
obj["[object Object]"] = "x"    // ¡otro objeto vacío toca la misma casilla!

console.log(obj[{}])            // "x" — cualquier objeto vacío accede al mismo dato
console.log(Object.keys(obj))   // ["[object Object]"]
```

Si tus claves son strings, un objeto está bien y es lo más liviano. El momento en que necesitas claves que sean objetos, funciones o números distintos de strings, `Map` aparece como la respuesta: **acepta cualquier tipo de clave sin convertirlo a texto**.

```javascript
const mapa = new Map()
const claveObjeto = { id: 1 }
const claveFunc = () => {}

mapa.set("string", "valor")
mapa.set(claveObjeto, "objeto como clave")
mapa.set(claveFunc, "función como clave")
mapa.set(42, "número como clave")

console.log(mapa.size)                // 4 — tamaño O(1), sin Object.keys()
console.log(mapa.get(claveObjeto))    // "objeto como clave"
console.log(mapa.get({ id: 1 }))      // undefined — no es la MISMA referencia

for (const [clave, valor] of mapa) {
  console.log(clave, valor)           // recorre en orden de inserción
}
```

Dos detalles que pasan desapercibidos y valen oro: `Map` recorre en **orden de inserción** (garantizado), y `claveObjeto` no es igual a un objeto nuevo de contenido idéntico — aquí manda la **referencia**, no el valor.

### `Set`: unicidad sin escribir el bucle a mano

Deduplicar un array solía ser un pequeño poema de `filter` e `indexOf`:

```javascript
const duplicados = [1, 2, 2, 3, 3, 3, 4]
const unicos = duplicados.filter((v, i) => duplicados.indexOf(v) === i)
// Ok, funciona... pero es O(n²): para cada elemento vuelve a barrer toda la lista.
```

`Set` es una colección de **valores únicos** con búsqueda O(1):

```javascript
const set = new Set([1, 2, 3, 2, 1])   // Set { 1, 2, 3 } — duplicados fuera
set.add(4)
set.has(3)                             // true — O(1), no un barrido O(n)

const unicos = [...new Set(duplicados)]  // [1, 2, 3, 4] — una línea
```

**Ojo con la igualdad**: `Set` distingue por tipo, `1 !== "1"`. El `Set` siguiente tiene dos elementos:

```javascript
const setRaro = new Set([1, "1", 1])
console.log(setRaro.size)  // 2
```

### Cuándo usar cada uno

| Necesidad | Usar |
|---|---|
| Clave-valor con claves string | Objeto (más liviano, serializa a JSON) |
| Clave-valor con claves de otro tipo | `Map` |
| Valores únicos | `Set` |
| Preguntar "¿existe X?" con frecuencia | `Set` o `Map` (O(1)) |
| Respetar orden de inserción | `Map`/`Set` (garantizado) |
| Serializar a JSON | Objeto — `Map`/`Set` no serializan directo |

El punto de JSON es de esos que aparecen en el primer bug real: `JSON.stringify(new Map([["a", 1]]))` produce `{}`. Si necesitas enviarlo a una API, conviértelo antes: `JSON.stringify([...mapa])` o `JSON.stringify(Object.fromEntries(mapa))`.

### Conexión con Python

Python ya venía con este par: `dict` (clave-valor) y `set` (únicos).

```python
d = {"string": "valor", 42: "número"}   # claves hashables
s = set([1, 2, 3, 2, 1])                # {1, 2, 3}
print(3 in s)                            # True, O(1)
```

**Traduce exactamente**: `Map.set/get/has` ↔ `dict[key]`, `set.add` ↔ `set.add`, y ambos recorren en orden de inserción (los `dict` de Python garantizan orden desde 3.7). Deduplicar es la misma línea: `list(set(lista))` ↔ `[...new Set(lista)]`.

**Cambia de fondo**: en Python, las claves deben ser *hashables* (inmutables) — un `list` o un `dict` como clave es `TypeError`. En JavaScript, `Map` acepta **cualquier objeto por referencia**, un `dict`/`set` como clave es válido. Es la diferencia entre "identidad estructural estable" (Python) y "identidad por referencia" (JS). Además, Python no mezcla "objeto-diccionario" y "mapa" como JS: ahí `dict` ES el mapa, mientras JS tiene dos herramientas con reglas distintas.

### Conexión con Java

Java tiene `HashMap`, `LinkedHashMap`, `HashSet` y `TreeSet` desde los 90.

**Traduce exactamente**: `LinkedHashMap` mantiene orden de inserción, igual que `Map`; `HashSet` deduplica con O(1), igual que `Set`. La API es un espejo: `put`/`get` ↔ `set`/`get`; `contains` ↔ `has`.

**Cambia de fondo**: en Java las colecciones son genéricas y con **tipos obligatorios** (`Map<String, Integer>`), y solo puedes usar claves con `hashCode()`/`equals()` bien implementados — el momento en que los objetos mutables son claves es donde Java y JS se rompen distinto: Java rompe el *contrato* del hash (el objeto cambió su `hashCode` después de insertarlo), JavaScript no tiene hash, solo referencias, así que el equivalente "objeto como clave" raro para ti en Java es trivial en JS. El `Map` de JS tampoco tiene ordenación (`TreeMap`), ni iteradores con `Comparator`: si necesitas "más grande primero", eso no sale gratis aquí.

---

## 2. `WeakMap` y `WeakSet`: memoria que respira

### El problema: los metadatos que no se quieren ir nunca

Asocias datos a un elemento: cuántas veces se clickeó un botón, el último resultado de una consulta por objeto, qué archivos ya se procesaron. Si guardas eso en un `Map`, el `Map` **retiene la referencia** al objeto como clave para siempre, aunque en la página el botón ya no exista. Con el tiempo, una app que crea y destruye muchos elementos lenta pero seguramente se queda sin memoria — y no hay error que lo delate.

`WeakMap` existe para eso: sus **claves son referencias débiles**. Cuando no queda ninguna otra referencia al objeto, el recolector de basura puede liberarlo — y con él, los metadatos que viven en el `WeakMap`.

```javascript
const metadatos = new WeakMap()

const boton = document.createElement("button")
metadatos.set(boton, { vecesClickeado: 0, ultimoClick: null })

boton.addEventListener("click", () => {
  const dato = metadatos.get(boton)
  dato.vecesClickeado++
  dato.ultimoClick = new Date()
})

// Al eliminar el botón del DOM y quedar sin referencias,
// el GC libera EL BOTÓN y SUS METADATOS juntos.
// Con un Map normal, los metadatos se quedaban para siempre: memory leak.
```

Mismo patrón para saber si ya procesaste un objeto sin duplicar trabajo:

```javascript
const procesados = new WeakSet()

function procesarSiNecesario(objeto) {
  if (procesados.has(objeto)) {
    console.log("Ya procesado — no repito trabajo")
    return
  }
  // ... procesar el objeto ...
  procesados.add(objeto)
}

const item = { id: 1 }
procesarSiNecesario(item)   // procesa
procesarSiNecesario(item)   // "Ya procesado"
// cuando item pierde sus referencias, WeakSet lo olvida solo
```

### Las restricciones que vienen con la debilidad

Lo que le da su superpoder condiciona todo lo demás:

- Las claves de `WeakMap` (y los valores de `WeakSet`) **deben ser objetos**. Primitivos lanzan `TypeError` (`Invalid value used as weak map key`).
- **No son iterables**: nada de `for...of`, `.keys()`, `.values()`, ni `.size`.

¿Por qué? Piensa qué significaría poder iterar una colección cuyos elementos el GC está borrando en cualquier instante: podrías leer un objeto que "ya no existe", y el orden mismo dejaría de ser estable. JavaScript elige la coherencia: si no puedes medirlo, no puedes equivocarte con él.

¿Cuándo apelar a cada uno? `WeakMap` cuando los datos deben vivir y morir con la clave (metadatos de DOM, cachés por objeto). `Map` cuando necesitas iterar, conocer el tamaño, o usar claves primitivas.

### Conexión con Python

Python hace exactamente esto con el módulo `weakref`, y la sincronía de conceptos es sorprendente:

```python
import weakref

metadatos = weakref.WeakKeyDictionary()
boton = object()
metadatos[boton] = {"veces_clic": 0}

print(len(metadatos))        # 1
del boton                    # sin otras refs al objeto...
print(len(metadatos))        # 0 — el par entero desapareció
```

**Traduce exactamente**: `WeakKeyDictionary` ↔ `WeakMap` (las clave-vivas se llevan el valor); `weakref.WeakSet` ↔ `WeakSet`. Ambos prohíben claves no-objeto (primitivas).

**Cambia de fondo**: en Python la debilidad por defecto es de *objeto* a *objeto* vía referencias débiles explícitas y nada más; el lenguaje te da la pieza cruda (`weakref.ref`) y tú ensamblas la colección. JavaScript te da `WeakMap`/`WeakSet` como estructuras listas, pero **no** te deja iterar ni ver el tamaño, justo el poder que Python sí te da (`len(dicc)`). Comodidad vs. transparencia, elegida distinta en cada ecosistema.

### Conexión con Java

`WeakHashMap` ha estado en la librería estándar desde Java 2.

**Traduce exactamente**: `WeakHashMap` guarda el par clave-valor (clave débil, valor fuerte) y un `WeakHashMap` con claves sin otras referencias se purga solo de cara al exterior — exactamente la semántica de `WeakMap`.

**Cambia de fondo**: `WeakHashMap` nació para cachés, pero su uso directo es tan incómodo que hoy Java recomienda `Caffeine` o `Guava` como cachés reales: el `WeakHashMap` congestiona fácilmente y el valor fuerte retiene a la clave vía referencias internas, un detalle de implementación que a ti en JavaScript no te toca (el motor hace el trabajo sucio bien). Y ojo con el nombre: `WeakMap` de JS es débil en la **clave**; no existe equivalente nativo a un "mapa débil en el valor".

---

## 3. El protocolo de iteración: iterables e iteradores

### El problema: cada colección se recorría a su manera

Array se recorre con `for`, objeto con `for...in`, y cada librería inventaba su propia forma de "dar todos los elementos". La definición de "recorrer algo" era un caos. JavaScript unificó todo con **dos protocolos** que se encadenan:

- Un **iterable** es un objeto que responde a `Symbol.iterator`, y esa propiedad **devuelve un iterador**.
- Un **iterador** es un objeto con `next()`, que devuelve `{ value, done }`.

Con eso, `for...of`, el spread `[...]` y la desestructuración `const [a, b] =` funcionan sobre **cualquier cosa** que implemente el protocolo.

### Implementar un iterable propio

```javascript
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
      // Hacer el iterador también iterable permite reusar el objeto en for...of
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

const rango = new Rango(1, 10, 2)

for (const n of rango) console.log(n)   // 1, 3, 5, 7, 9
const array = [...rango]                // [1, 3, 5, 7, 9]
const [primero, segundo] = rango        // primero=1, segundo=3
```

### Los iterables que ya tienes

Son iterables nativos: `[1, 2, 3]` (Array), `"hola"` (String), `new Set([1,2,3])`, `new Map()` (iterando parejas `[clave, valor]`). El detalle que desconcierta: **los objetos NO son iterables por defecto** — recorrer un objeto plano sigue siendo `for...in`, `Object.keys()`, `Object.values()` o `Object.entries()` (que sí devuelven arrays iterables).

### El iterador infinito

Un iterador puede ser perezoso e infinito: produce el siguiente valor solo cuando se lo pides, sin materializar nada de antemano.

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

// ⚠️ for (const n of naturales()) {} — NUNCA termina.
// Úsalo en combinación con take/limit (sección 5), nunca "a pelo".
```

### Conexión con Python

Python definió primero exactamente este protocolo, con nombres `__iter__`/`__next__`:

```python
class Rango:
    def __init__(self, inicio, fin, paso=1):
        self.inicio, self.fin, self.paso = inicio, fin, paso

    def __iter__(self):
        actual = self.inicio
        while actual <= self.fin:
            yield actual
            actual += self.paso

r = Rango(1, 10, 2)
print([n for n in r])   # [1, 3, 5, 7, 9]
```

**Traduce exactamente**: el protocolo es el mismo gesto con otro disfraz: `Symbol.iterator` ↔ `__iter__`; `next()` → `{value, done}` ↔ `__next__()` → valor/StopIteration. `for...of` ↔ `for x in`, y el iterador infinito funciona igual en ambos.

**Cambia de fondo**: en Python los *dunder methods* pueden vivir en la clase (`__iter__`) y la función que devuelve el iterador se llama igual; en JavaScript el símbolo `Symbol.iterator` es la llave explícita y el iterador es un objeto con `next()`, y `{ done }` reemplaza al `StopIteration`-como-excepción que Python usaba antes de PEP 479. En JS, marcar "se acabó" es un retorno normal; en Python, terminar es lanzar una excepción controlada — dos culturas del mismo "final de la fila".

### Conexión con Java

El viejo amigo `Iterator<E>`:

```java
Iterator<Integer> it = lista.iterator();
while (it.hasNext()) {
    Integer n = it.next();
    System.out.println(n);
}
```

**Traduce exactamente**: `hasNext()`+`next()` ↔ `done`+`value`: es el mismo protocolo de "pregunta si queda" y "dame el siguiente", con el par expuesto por `next()` en JS.

**Cambia de fondo**: en Java hay **dos responsabilidades separadas**: `Iterable<T>` (produce iteradores) y `Iterator<T>` (recorre), y el `for-each` de Java (el `:`) solo entiende la primera. En JavaScript, un objeto suele ser ambas cosas a la vez (su `[Symbol.iterator]` devuelve un iterador que a su vez es iterable), y el protocolo está completamente basado en estructuras de datos: `{ value, done }`. Java también arrastra su pasado checked-exception (`next()` puede lanzar `NoSuchElementException`); en JS, `next()` simplemente devuelve `{ done: true }`.

---

## 4. Generadores: `function*`, `yield`, `yield*`

### El problema: expresar secuencias que no caben en memoria

Calcular Fibonacci "hasta que el usuario lo pida" es imposible si lo generas todo de golpe en un array: la serie crece hasta el `Infinity` y te quedas sin RAM. Lo que necesitas es un **cálculo pausable**: producir el siguiente término solo cuando alguien lo pide, y quedarte dormido el resto del tiempo.

Un generador es una función especial que **pausa y reanuda** su ejecución. `yield` pausa y entrega un valor; la siguiente llamada a `.next()` reanuda exactamente donde se quedó.

```javascript
function* contador() {
  yield 1
  yield 2
  yield 3
  return "fin"              // termina: aparece una vez en {d one: true}
}

const gen = contador()
gen.next()   // { value: 1, done: false }
gen.next()   // { value: 2, done: false }
gen.next()   // { value: 3, done: false }
gen.next()   // { value: "fin", done: true }
gen.next()   // { value: undefined, done: true } — ya murió

// con for...of los valores de return se ignoran: para en done: true
for (const n of contador()) console.log(n)  // 1, 2, 3
```

El superpoder es la **bidireccionalidad**: puedes meter datos hacia adentro mientras el generador duerme. El valor que pasas a `.next(valor)` se convierte en lo que `yield` retorna.

```javascript
function* dialogo() {
  const nombre = yield "¿Cuál es tu nombre?"
  console.log(`Hola, ${nombre}`)
  const edad = yield "¿Cuántos años tienes?"
  console.log(`${nombre} tiene ${edad} años`)
}

const gen = dialogo()
gen.next().value         // "¿Cuál es tu nombre?"
gen.next("David").value  // "¿Cuántos años tienes?" — "David" llega al yield
gen.next(25)             // logs: "David tiene 25 años"
```

### `yield*`: delegar a otro generador

```javascript
function* interna() {
  yield 1
  yield 2
}

function* externa() {
  yield 0
  yield* interna()   // delega: todo lo que produzca interna() pasa como mío
  yield 3
}

console.log([...externa()])  // [0, 1, 2, 3]
```

### Fibonacci perezoso

```javascript
function* fibonacci() {
  let [a, b] = [0, 1]
  while (true) {
    yield a
    ;[a, b] = [b, a + b]
  }
}

const fib = fibonacci()
fib.next()  // { value: 0 }
fib.next()  // { value: 1 }
fib.next()  // { value: 1 }
fib.next()  // { value: 2 }
fib.next()  // { value: 3 }
fib.next()  // { value: 5 }
```

No calcula nada hasta que pides el siguiente valor: ahí vive el truco de las secuencias infinitas sin memoria desbordada.

### Los malentendidos que conviene zanjar

- **No son asíncronos**: son síncronos pausables. `yield` pausa tu función, pero **no** le cede el control al event loop. La asincronía real por generadores viene de los *async generators* (`async function*`), de los que hablaremos en el capítulo de asincronía.
- **Son de un solo uso**: el iterador de un generador se agota al llegar a `done: true`. Reiniciar = crear uno nuevo.

### Conexión con Python

Los generadores Python son el pariente directo — `yield` es igualito:

```python
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
print(next(fib))  # 0
print(next(fib))  # 1
```

**Traduce exactamente**: `function*` + `yield` ↔ `def` + `yield`, y ambos son Lazy: no ejecutan el cuerpo hasta el primer `next()`. El `yield*` de JS tiene espejo en `yield from` de Python, y el `return` que "mata" al generador también existe en ambos (en Python con el `StopIteration.value` igual de escondido).

**Cambia de fondo**: la sintaxis de generator en Python es *más callada* (no hay `function*`, solo `yield` dentro de una función normal - Python sabe por la presencia de `yield`). JavaScript lo hace explícito con el `*` para que no haya confusiones. Y en JS los generadores tienen la ruta `next(valor)` de dos vías que en Python se llama `.send(valor)` — mismo concepto, dos ortografías. El `diaLogo()` que acabas de ver, en Python sería idéntico con `.send()`.

### Conexión con Java

Java **no tiene generadores nativos** — no existe `yield` en el lenguaje.

**Traduce exactamente**: el espíritu de "secuencia perezosa de a poco" vive en los `Stream` (ver sección 5) y en `Stream.iterate`. Un generador de Fibonacci en Java iría vía iteradores anónimos o `Stream.generate`:

```java
Stream.iterate(new long[]{0,1}, f -> new long[]{f[1], f[0]+f[1]})
      .limit(10)
      .forEach(f -> System.out.println(f[0]));
```

**Cambia de fondo**: en Java, "posponer el cálculo" es laborioso: escribes `iterator()` + `hasNext()` + `next()` a mano o montas streams. En JavaScript, `function*` es azúcar nativa que te da pausa/reanuda bidireccional gratis. El costo de esa facilidad: JavaScript no tiene *generadores con tipos* y el stack del generador puede ser más liviano pero con overhead si abusas; Java te hace escribirlo todo pero con garantías de compilación.

---

## 5. Iterator helpers (ES2025): proceduralizando encadenamientos con corte

### El problema: `[...].map().filter()` materializa arrays intermedios

Encadenar arrays está genial, pero cada método de array **crea un array nuevo completo**:

```javascript
const resultado = lista.map(f).filter(g)   // 1° crea array completo, 2° crea otro
```

Para 100 elementos, inofensivo. Para 10 millones, dos copias completas en memoria. Y para una secuencia **infinita**, `[...naturales()]` es imposible — no hay array que construir.

Los **iterator helpers** (estándar ES2025) añaden métodos sobre los iteradores: `map`, `filter`, `take`, `drop`, `reduce`, `toArray` y `forEach` (más `flatMap`, `some`, `every`, `find`), y son **lazy**: no calculan nada hasta que pides el resultado.

```javascript
function* naturales() {
  let n = 1
  while (true) yield n++
}

const pares = naturales()
  .filter(n => n % 2 === 0)   // lazy: nada se calcula todavía
  .take(5)                     // lazy: sigue sin calcularse
  .toArray()                   // aquí sí: [2, 4, 6, 8, 10]

// Sin helpers, habría que escribir el bucle a mano:
const paresManual = []
for (const n of naturales()) {
  if (n % 2 === 0) {
    paresManual.push(n)
    if (paresManual.length === 5) break
  }
}
```

Fíjate en el salto conceptual: sobre una fuente **infinita**, el `filter`+`take` solo pidió los valores que hacían falta. No hubo "array de todos los pares" — ese array no existe en ningún momento.

### Combinar con `reduce` para no materializar nada

```javascript
// Suma de los primeros 100 múltiplos de 3 — sin crear un array intermedio
const suma = naturales()
  .filter(n => n % 3 === 0)
  .take(100)
  .reduce((a, b) => a + b, 0)

console.log(suma)  // 3 + 6 + ... + 300 = 15150
```

### Disponibilidad

Iterator helpers es **ES2025** (Stage 4, finalizado). Disponible en Node.js 22+ y Chrome 122+ (navegadores modernos). En entornos viejos, hay que polyfill (p. ej. `es-iterator-helpers`) o usar la librería `iter-tools` mientras tanto.

### Conexión con Python

`itertools` es el *namesake* del concepto desde los 90:

```python
import itertools

def naturales():
    n = 1
    while True:
        yield n

pares = itertools.islice(
    (n for n in naturales() if n % 2 == 0),  # filter lazy
    5,                                        # take 5
)
print(list(pares))  # [2, 4, 6, 8, 10]
```

**Traduce exactamente**: `filter`+`take` en un iterador JS es `filter` de la comprensión + `itertools.islice`. Ambos son lazy y consumen una fuente infinita sin materializar.

**Cambia de fondo**: en Python las herramientas son **funciones sueltas** (`itertools.islice(x, 5)`) que envuelven iteradores; en JS son **métodos encadenables** sobre el iterador mismo (`x.take(5)`). El estilo Python es composición explícita hacia afuera; el estilo JS es cadena sobre el objeto — la misma semántica, dos experiencias de lectura. Python además tiene `takewhile`, `dropwhile`, `chain`, `product` que JS no duplica; JS trae `toArray` (instantáneo) que Python no necesita.

### Conexión con Java

`Stream` le da a Java exactamente este superpoder, y el nombre *stream* = *iterador lazy con operaciones*:

```java
List<Integer> pares = IntStream.iterate(1, n -> n + 1)
    .filter(n -> n % 2 == 0)
    .limit(5)
    .boxed()
    .toList();
// [2, 4, 6, 8, 10] — mismo pipeline lazy
```

**Traduce exactamente**: `filter`+`take`+`toArray` ↔ `filter`+`limit`+`toList`. Los dos pipelines NO materializan hasta el momento de la recolección, y en ambos puedes disparar una fuente infinita sin miedo porque el `take`/`limit` corta.

**Cambia de fondo**: los streams Java son **una sola pasada**: lo que ya consumiste no se puede volver a recorrer (igual que un iterador JS), y para paralelismo necesitas `.parallel()` explícito. Los iterator helpers de JS no ofrecen `sorted()` ni `distinct()` nativos (para eso toca envolver con un `Set`), y en Java `Stream` es parte integral de toda la API — en JS, los helpers son nuevos (ES2025) y siguen conviviendo con array-methods que materializan.

---

## 6. Desestructuración: sacar valores sin escribir veinte líneas

### El problema: `usuario.direccion.ciudad` repetido diez veces

Acceder a propiedades anidadas es ergonómico hasta que llenas la función de `usuario.direccion.ciudad` y `usuario.direccion.pais` y te toca renombrar. La **desestructuración** extrae exactamente lo que necesitas en variables locales: menos ficho tipográfico, menos rupturas al cambiar el shape.

```javascript
const usuario = {
  nombre: "David",
  edad: 25,
  direccion: { ciudad: "Medellín", pais: "Colombia" },
  hobbies: ["programar", "leer", "correr"],
}

// Básica: crea las variables nombre y edad
const { nombre, edad } = usuario

// Renombrar: ahora se llama userNombre
const { nombre: userNombre } = usuario

// Default: si no existe la propiedad, usa el valor de respaldo
const { telefono = "N/A" } = usuario

// Anidada: solo crea la variable ciudad, NO direccion
const { direccion: { ciudad } } = usuario

// Rest: "todo lo demás" como un objeto nuevo
const { nombre, ...resto } = usuario
// resto = { edad: 25, direccion: {...}, hobbies: [...] }
```

### Desestructuración de arrays

```javascript
const [a, b, c] = [1, 2, 3]               // a=1, b=2, c=3
const [primero, ...resto] = [1, 2, 3, 4]  // primero=1, resto=[2,3,4]
const [, , tercero] = [1, 2, 3]           // tercero=3 — saltas con comas
const [x = 0, y = 0] = [1]                // x=1, y=0 — default en arrays

// Intercambio de variables sin auxiliar
let a = 1, b = 2
;[a, b] = [b, a]                          // a=2, b=1
```

### Spread: desparramar

```javascript
function sumar(a, b, c) { return a + b + c }
const nums = [1, 2, 3]
sumar(...nums)                            // 6

const combinado = [...[1, 2], ...[3, 4]]  // [1, 2, 3, 4]

const defaults = { tema: "oscuro", idioma: "es" }
const override = { idioma: "en" }
const config = { ...defaults, ...override }  // { tema: "oscuro", idioma: "en" }
```

Dos reglas que marcan la diferencia en producción:

1. **El spread es superficial**: `{ ...original }` copia el primer nivel; los objetos anidados se comparten por **referencia**. (Lo vemos a fondo en la sección 7.)
2. **El orden del spread importa**: las propiedades posteriores ganan. Si inviertes `{ ...override, ...defaults }`, el resultado sería `idioma: "es"` otra vez.

### Conexión con Python

Python desparcha la vida igual desde los 90, con unpacking:

```python
primero, *resto = [1, 2, 3, 4]     # primero=1, resto=[2,3,4]
a, b = b, a                        # intercambio en una línea
def log(tag, *args, **kwargs):     # *args y **kwargs
    print(tag, args, kwargs)
```

**Traduce exactamente**: el *unpacking* de tuplas Python es **el mismo gesto**: `[a, b] = [1, 2]` ↔ `a, b = 1, 2`; `*resto` ↔ `...resto`; el intercambio `[a, b] = [b, a]` se traduce igual.

**Cambia de fondo**: Python desestructura **tuplas y cualquier secuencia** por posición, pero no "objetos" con nombres de propiedad dentro de una asignación (eso llega con los `dataclasses`-remaches o match de Python 3.10). JavaScript desestructura **objetos por clave** (`const { nombre, edad } = usuario`) por defecto, algo que Python no te da sin librería. Y cuidado con el default: en Python `*args` solo viene al final; en JS `...resto` también, en ambos un `...` en el medio es error.

### Conexión con Java

Los *records* (Java 16+) y el pattern matching (Java 16+, madurado en 21) acercan la idea:

```java
record Usuario(String nombre, int edad) {}

var u = new Usuario("David", 25);
String nombre = u.nombre();      // accesor generado, más corto
int edad = u.edad();

// Desconstructor (Java 21 preview): espejo de la desestructuración
// if (u instanceof Usuario(var nombre, var edad)) { ... }
```

**Traduce exactamente**: `const { nombre } = usuario` se parece a lo que te ahorran los `record` (getters automáticos) y, con patrón de construcción, al `destructuring` por posición.

**Cambia de fondo**: en JavaScript la desestructuración es un **destructor de valores en runtime** sin tipos: renombras (`{ nombre: userNombre }`), pones defaults y extraes de cualquier shape. Java no tiene "extraer a variables por nombre de propiedad" — los records te generan acceso. Pero en Java, **"renombrar a otra variable" es solo otra asignación local**: no hay spread para "copia con cambio", y propagar defaults se hace con constructores. JavaScript da más flexibilidad a costa de menos garantías: ninguna de estas rutas verifica tipos, mientras que el compilador de Java lo haría.

---

## 7. Inmutabilidad: no tocar lo que ya vive

### El problema: dos objetos comparten la misma piedra

Cuando pasas un objeto a una función y la función lo muta, el objeto **fuera** de la función también cambió — porque es el mismo. Y cuando haces `const copia = { ...original }`, hay una trampa: la copia es nueva por fuera, pero sus objetos internos **se comparten por referencia** con el original.

```javascript
const original = { a: 1, b: { c: 2 } }
const copia = { ...original }

copia.a = 10         // no afecta al original
copia.b.c = 20       // ¡SÍ afecta al original! b es la MISMA referencia
console.log(original.b.c)  // 20 — bug clásico de "copia superficial"
```

La inmutabilidad — no modificar objetos existentes, sino crear estados nuevos a partir de ellos — es el antídoto: quien recibe el objeto puede jugar sin romperle el universo a nadie.

### Copia superficial vs. profunda

```javascript
// shallow: el primer nivel se copia, el segundo se comparte
const profunda = structuredClone(original)   // ES2022+, copia profunda nativa
profunda.b.c = 30
console.log(original.b.c)  // 20 — sin efecto colateral

// structuredClone también maneja Date, Map, Set, RegExp:
const obj = {
  fecha: new Date(),
  mapa: new Map([["a", 1]]),
  regex: /patrón/g,
  arr: [{ x: 1 }],
}
const clon = structuredClone(obj)
console.log(clon.mapa instanceof Map)   // true
```

**Límites honestos**: `structuredClone` no copia **funciones**, ni nodos del DOM, ni pierde el prototipo de instancias de clases (clona plain data). Para esos, copia manual o librería.

### Actualización inmutable al cambiar estado

```javascript
const estado = { contador: 0, lista: [1, 2] }

// ❌ Mutación a pelo: rompe a quien tenga la referencia vieja
estado.contador++
estado.lista.push(3)

// ✅ Nuevo objeto, mismo contenido, código compartido hasta donde puedes:
const nuevoEstado = {
  ...estado,
  contador: estado.contador + 1,
  lista: [...estado.lista, 3],
}
```

Este patrón es la base del *change detection* en React/Redux y en Vue con `reactive` — comparar por referencia es barato; comparar contenido profundo es caro.

### `Object.freeze` (y su límite)

```javascript
const config = Object.freeze({ api: { url: "https://api.ejemplo.com" } })
config.api.url = "hack"    // ✅ NO lanza: freeze es superficial y esto es modo no estricto silencioso
// en modo estricto: TypeError

// congelar recursivo:
function congelarProfundo(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      congelarProfundo(obj[key])
    }
  }
  return Object.freeze(obj)
}

const configSegura = congelarProfundo({
  api: { url: "https://api.ejemplo.com", timeout: 5000 },
  debug: true,
})
configSegura.api.url = "hack"  // TypeError: object is not extensible
```

### Conexión con Python

Python te la trae servida con tuplas y `copy`:

```python
import copy

original = {"a": 1, "b": {"c": 2}}
copia = copy.deepcopy(original)     # copia profunda (vs copy.copy superficial)
copia["b"]["c"] = 30
print(original["b"]["c"])           # 2 — no se movió

punto = (1, 2)                      # tupla: inmutable por construcción
```

**Traduce exactamente**: `structuredClone` ↔ `copy.deepcopy`, y `Object.freeze` ↔ `types.MappingProxyType` o `copy.deepcopy` combinado con clases `@dataclass(frozen=True)`. La actualización inmutable (`{ ...estado, contador: +1 }`) es el mismo `replace` de `dataclasses.replace(estado, contador=estado.contador+1)`.

**Cambia de fondo**: en Python la inmutabilidad **por construcción** existe (`tuple`, `frozenset`, strings): no puedes "heredar" mutabilidad accidentalmente. En JavaScript, nada es inmutable por defecto: `Object.freeze` es *a posteriori* y superficial. `structuredClone` copia estructuras de datos, pero `deepcopy` también clona **instancias de clases** y funciones no lo copia en Python (falla o da warning), igual que JS rechaza funciones. La diferencia práctica: los dicts de Python se comparan por contenido (`==`), los objetos de JS por referencia — así que "¿cambió algo?" es trivial de detectar en Python y obliga a copiar+comparar en JS.

### Conexión con Java

Java es el abuelo de la inmutabilidad defensiva: `java.util.Collections.unmodifiableList`, `List.of`, records:

```java
List<String> inmutable = List.of("a", "b");   // lista inmutable nativa
inmutable.add("c");                           // UnsupportedOperationException
```

**Traduce exactamente**: `List.of` y `Set.of` dan colecciones inmutables de facto, como `Object.freeze` — pero a nivel de contenedor (Java no congela los elementos que contiene, igual que `freeze` congelante superficial).

**Cambia de fondo**: en Java la "copia con cambio" se hace con *copy-on-write* (`withEmail` en records) y los records son **inmutables por diseño** (campos `final`). JavaScript gana con `structuredClone` (en Java no hay un clon profundo estructural sin librerías como Jackson) y pierde porque No te ofrece una clase tipo `record`: tienes que autocontrolarte. Además, en Java es *común* que el compilador te obligue a declarar "esta cosa es inmutable"; en JS la única protección en runtime es `Object.freeze`, con su límite superficial.

---

## Práctica y ejercicios

Intenta resolver cada desafío mentalmente o en código **antes** de abrir las soluciones desplegables.

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Por qué `new Map()`, `map.set(clave, valor)` y luego `map.get({ id: 1 })` devuelve `undefined` aunque insertaste `{ id: 1 }` como clave?</b></summary>

**Explicación**: Porque `Map` usa **igualdad por referencia** (SameValueZero), no por contenido. El `{ id: 1 }` que pasas a `get` es un objeto **distinto** en memoria del que usaste en `set`, así que no existe como clave. En un objeto plano ocurriría lo contrario: las claves se convierten a string y `obj[{a:1}]` y `obj[{a:1}]` chocarían en la misma casilla `"[object Object]"`.
</details>

<details>
<summary><b>2. ¿Por qué `WeakMap` no permite iterar con `for...of`, ni `.size`, ni claves primitivas?</b></summary>

**Explicación**: Porque sus claves son **referencias débiles**: el GC puede liberar el objeto y su entrada asociada en cualquier instante. Si pudieras iterar o conocer el tamaño, estarías leyendo una colección cuyo contenido cambia por debajo de ti (objetos ya recolectados, orden inestable). Restringirlo a objeto como clave garantiza que "la referencia que usas" es la misma que "la referencia débil" — con primitivas (siempre presentes) no tendría sentido ser débil.
</details>

<details>
<summary><b>3. `for...of` de un iterador que nunca devuelve `{ done: true }` — ¿qué pasa?</b></summary>

**Explicación**: Esa es la definición de un **bucle infinito**: `for...of` seguirá pidiendo `next()` sin parar hasta que el proceso muera o el usuario lo cancele. Los generadores "infinitos" son seguros solo cuando se combinan con `take`/`limit` (iterator helpers, `itertools.islice`, `Stream.limit`) que cortan el consumo tras N valores.
</details>

<details>
<summary><b>4. `const a = { x: 1 }; const b = { ...a }; b.x = 2;` ¿`a.x` cambia? ¿Y si `a` fuera `{ x: { y: 1 } }` y mutaras `b.x.y`?</b></summary>

**Explicación**: Con `b.x = 2` no cambia `a.x`: el spread copia el primer nivel, así que `a` y `b` tienen objetos propios en `x`. Pero si `a.x` es un objeto y haces `b.x.y = 5`, **sí** cambia `a.x.y`, porque `b.x` y `a.x` apuntan a **la misma referencia**: el spread fue superficial. Para cortar esa compartición hace falta `structuredClone`.
</details>

---

### 2. Explicarlo con tus palabras

> **Reto**: Explica a un amigo que viene de Python la diferencia entre **iterable** e **iterador**, y por qué los generadores pueden ser infinitos sin agotar la memoria, usando la metáfora de un **grifo de agua** (el generador es el grifo: gotea solo cuando giras la perilla, no almacena el río entero). Luego di en qué se parece y en qué se diferencia eso de un `yield` de Python.
> *Pista: si dudas, relee la [Sección 4](#4-generadores-function-yield-yield) y la Conexión con Python de la [Sección 3](#3-el-protocolo-de-iteración-iterables-e-iteradores).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): Caché con `Map` y conteo con `Set`

**Objetivo**: Encapsular dos de las utilidades de `Map`/`Set` en una función que un paquete de utilidades usaría.

**Enunciado**:
1. Escribe `crearCache()` que devuelva un objeto con `poner(clave, valor)` y `obtener(clave)` usando un `Map` interno, permitiendo claves de **cualquier tipo** (incluye objetos por referencia).
2. Escribe `soloUnicos(lista)` que devuelva los elementos únicos de un array **respetando el orden de aparición** — pista: `[...new Set(lista)]`.
3. Escribe `contar(lista)` que devuelva un `Map` con la frecuencia de cada elemento (`["a","b","a","c","a"]` → `Map { "a" => 3, "b" => 1, "c" => 1 }`).

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. `crearCache` guarda en un `Map` interno; las claves se comparan por **referencia**, no por valor.
2. `soloUnicos` es literalmente `[...new Set(lista)]`: el `Set` deduplica y el spread respeta el orden.
3. `contar` acumula con `frecuencias.set(item, (frecuencias.get(item) ?? 0) + 1)`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearCache() {
  const datos = new Map()
  return {
    poner(clave, valor) {
      datos.set(clave, valor)
      // Map NO convierte las claves a string:
      // { id: 1 } es una clave distinta de { id: 1 } nuevo.
    },
    obtener(clave) {
      return datos.get(clave)
    },
    tamano() {
      return datos.size   // O(1) — no hay que contar con Object.keys
    },
  }
}

const cache = crearCache()
const ref = { usuario: 7 }
cache.poner(ref, "perfil cargado")
console.log(cache.obtener(ref))              // "perfil cargado"
console.log(cache.obtener({ usuario: 7 }))   // undefined — otra referencia

function soloUnicos(lista) {
  return [...new Set(lista)]   // Set deduplica, spread respeta orden
}
console.log(soloUnicos(["a", "b", "a", "c", "a"]))  // ["a", "b", "c"]

function contar(lista) {
  const frecuencias = new Map()
  for (const item of lista) {
    frecuencias.set(item, (frecuencias.get(item) ?? 0) + 1)
  }
  return frecuencias
}
console.log([...contar(["a", "b", "a", "c", "a"])])
// [["a", 3], ["b", 1], ["c", 1]]
```

**¿Por qué funciona?** `Map` acepta cada clave por **referencia** (el `cache.get({usuario:7})` falla justo para mostrarlo), `Set` deduplica en O(n) total (no O(n²) como el `filter+indexOf`), y el `?? 0` en `contar` es el default para claves que aún no existen. El resultado: tres utilidades que en objetos planos serían más frágiles o lentas.
</details>

---

#### Ejercicio 2 (Intermedio): Página "perezosa" de resultados con generador + iterator helpers

**Objetivo**: Simular paginación sobre una fuente grande con generadores y `take`/`drop` sin traer todo a memoria.

**Specs**:
1. `generarFilas(n)` : un generador que produce `{ id, nombre }` del `1` al `n`.
2. `pagina(paginaNumero, porPagina)` : usando `drop` y `take` con iterator helpers, devuelve solo la página pedida como array.
3. Verifica: `pagina(2, 3)` sobre 10 filas → filas 4, 5, 6.
4. Reflexión: ¿qué pasó en memoria? ¿cuánto "calculó" realmente el generador?

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. `function* generarFilas(n)` produce `{ id, nombre }` del `1` al `n` con un bucle y `yield`.
2. `pagina(paginaNumero, porPagina)` = `generarFilas(...).drop((paginaNumero - 1) * porPagina).take(porPagina).toArray()`.
3. `drop` y `take` son **lazy**: el generador solo produce lo que toca, no materializa las filas previas.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function* generarFilas(n) {
  for (let id = 1; id <= n; id++) {
    yield { id, nombre: `Fila ${id}` }
  }
}

function pagina(paginaNumero, porPagina) {
  const saltar = (paginaNumero - 1) * porPagina
  return generarFilas(10)
    .drop(saltar)   // descarta las anteriores (lazy)
    .take(porPagina) // toma solo las de esta página (lazy)
    .toArray()      // aquí materializa, y solo las `porPagina`
}

console.log(pagina(2, 3))
// [{ id: 4, nombre: "Fila 4" }, { id: 5, nombre: "Fila 5" }, { id: 6, nombre: "Fila 6" }]

// Sin iterator helpers tendrías que hacerlo a mano:
function paginaManual(paginaNumero, porPagina) {
  const inicio = (paginaNumero - 1) * porPagina
  const resultado = []
  let indice = 0
  for (const fila of generarFilas(10)) {
    if (indice >= inicio && indice < inicio + porPagina) resultado.push(fila)
    if (resultado.length === porPagina) break
    indice++
  }
  return resultado
}
```

**¿Por qué funciona?** `drop` y `take` son **lazy**: el generador solo avanza lo que toca (4 peticiones de `next()` para página 2 de 3). La memoria usada es `porPagina` filas, no las 10. La versión manual es la "implementación de referencia": si alguna vez dudas de qué hace el pipeline, la comparas con ella.
</details>

---

#### Ejercicio 3 (Avanzado): Metadatos vivos con `WeakMap` y (bonus) delegación `yield*`

**Objetivo**: Combina `WeakMap` para metadatos que no filtran memoria, un `WeakSet` para "ya procesado", y un generador delegado para recorrer resultados.

**Requisitos**:
1. `crearRastreador()` : devuelve objetos `{ registrar(item), esNuevo(item) }` internos con `WeakSet` — un objeto registrado es "no nuevo".
2. `crearContadorVisitas()` : `WeakMap` clave-objeto a número — `sumar(objeto)` incrementa concurrencias seguras, `obtener(objeto)` devuelve 0 si no se visitó.
3. Una función `recorrerMerge(...colecciones)` que con `yield*` itere todas las colecciones pasadas en una sola secuencia.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. `WeakSet` para `registrar`/`esNuevo`: no itera y no impide que el GC libere el objeto clave.
2. `WeakMap` para el contador de visitas: `obtener(obj)` devuelve `visitas.get(obj) ?? 0`.
3. `recorrerMerge` = `for (const col of colecciones) yield* col` — `yield*` delega en cada iterable.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearRastreador() {
  const vistos = new WeakSet()
  return {
    registrar(item) {
      vistos.add(item)
    },
    esNuevo(item) {
      return !vistos.has(item)   // WeakSet no filtra memoria: cuando item muera, sale solo
    },
  }
}

const rastro = crearRastreador()
const a = { id: 1 }, b = { id: 2 }
console.log(rastro.esNuevo(a))   // true
rastro.registrar(a)
console.log(rastro.esNuevo(a))   // false
console.log(rastro.esNuevo(b))   // true — otro objeto, otra referencia

function crearContadorVisitas() {
  const visitas = new WeakMap()
  return {
    sumar(objeto) {
      visitas.set(objeto, (visitas.get(objeto) ?? 0) + 1)
    },
    obtener(objeto) {
      return visitas.get(objeto) ?? 0
    },
  }
}

const contador = crearContadorVisitas()
contador.sumar(a)
contador.sumar(a)
contador.sumar(b)
console.log(contador.obtener(a))  // 2
console.log(contador.obtener(b))  // 1
// Si algún día `a` o `b` desaparecen, sus contadores se van con ellos: sin leak.

function* recorrerMerge(...colecciones) {
  for (const coleccion of colecciones) {
    yield* coleccion          // delega: vuelco todo lo de esta colección
  }
}

console.log([...recorrerMerge([1, 2], new Set([3, 4]), "ab")])
// [1, 2, 3, 4, "a", "b"] — generador, Set y string, todos iterables
```

**¿Por qué funciona?** `WeakSet`/`WeakMap` asocian vida a la vida del objeto clave — nada de limpieza manual. `yield*` demuestra el protocolo de iteración siendo un **ciudadano universal**: recorre generadores, sets y strings por igual porque todos implementan `Symbol.iterator`. Ojo: al final, con `WeakMap` no puedes iterar los contadores: si necesitas "enumerar visitas", que la clave sea un objeto que vive (tu dominio), no un dato fugaz.
</details>

---

## Depuración en la práctica

### Escenario 1: La memoria que subía en un SPA de gestión

**Situación**: Una app de administración web mantiene abierta una vista de "tareas" durante horas. El detalle de cada tarjeta guarda metadatos de interacción. Tu equipo nota que la RAM crece de forma constante hasta que se traba el navegador. ¿Por qué?

**Diagnóstico**:
- **Causa probable**: los metadatos se guardan en un `Map` global con clave = tarjeta (objeto). Cada vez que el usuario abre otra vista, la vieja tarjeta deja de existir para el DOM… pero el `Map` **retiene la referencia débil... no, fuerte**: como el `Map` tiene la clave, esa tarjeta jamás puede ser recolectada, y con ella sus metadatos y cualquier dato que arrastre.
- **Depuración**: revisa cuántos objetos "muertos" quedan en el `Map`. El heap del inspector de memoria te dirá: miles de tarjetas con referencias fuertes sobrevivientes.
- **Solución**: pasar los metadatos a un `WeakMap`. Cuando la tarjeta salga del DOM y pierda sus referencias, el GC libera el par completo. Los contadores que "se pierden" son justo los que querías perder: datos de cosas que ya no existen. «Recolector» en el nombre no es decoración: es una promesa que el `Map` no cumple y el `WeakMap` sí.

---

### Escenario 2: El `for...of` que se comió el servidor

**Situación**: En un script de procesamiento, escribes `for (const item of productos()) total += item.precio` y el servidor se queda sin CPU. `productos()` es una función que "debería" dar N productos.

**Diagnóstico**:
- **Causa probable**: `productos()` es un **generador o iterable infinito** sin `take`. Recorre indefinidamente: sin límite, el `for...of` jamás cambia el estado de `done` y hornea la CPU buscando... más.
- **Depuración**: revisa si la función retorna un iterable que realmente termina (`done: true`) o si es de los que "yield para siempre". Desconfía de cualquier `while (true)` sin condición de salida.
- **Solución**: ir con `take(N)` (iterator helpers), `for (const item of productos().take(1000))`, o forzar un límite en el generador. Acostúmbrate a pensar: *"si este bucle no tiene condición de salida explícita, ¿quién lo detiene?"*

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Característica | JavaScript | Python |
|---|---|---|
| **Clave-valor con claves no-string** | `Map` (objetos por referencia). | `dict` exige claves *hashables*. `{id:1}` como clave = TypeError. |
| **Valores únicos** | `Set` (O(1), orden de inserción). | `set` (O(1), sin orden). |
| **Claves/vidas débiles** | `WeakMap`/`WeakSet` (no iterables). | `weakref.WeakKeyDictionary`/`WeakSet` (iterables, con `len`). |
| **Iteración unificada** | `Symbol.iterator` + `next()` → `{value, done}`. | `__iter__`/`__next__` + StopIteration. |
| **Generadores** | `function*`/`yield` (Lazy, `next(v)` bidireccional). | `def`/`yield` (Lazy, `.send(v)` bidireccional). |
| **Pipeline lazy** | Iterator helpers ES2025 (`.filter().take()`). | `itertools.islice/takewhile/chain`. |
| **Desestructuración** | Objetos por clave + arrays por posición. | Tuplas/posición + `*rest`, no por nombre. |
| **Copia profunda / inmutabilidad** | `structuredClone`; nada inmutable por defecto. | `copy.deepcopy`; `tuple`/`frozenset` por diseño. |

### JavaScript vs. Java

| Característica | JavaScript | Java |
|---|---|---|
| **Mapa con orden** | `Map` (mantiene inserción). | `LinkedHashMap`; `HashMap` no garantiza orden. |
| **Clave-valor débil** | `WeakMap` (clave débil). | `WeakHashMap` (mismo esquema, uso limitado). |
| **Iteración unificada** | `Symbol.iterator` + `next()`. | `Iterator<E>` con `hasNext`/`next`. |
| **Generadores** | `function*`/`yield` (nativo). | No existe; streams/iteradores a mano. |
| **Pipeline lazy** | Iterator helpers (ES2025). | `Stream` (`filter`/`limit`/`toList`, `.parallel()` opcional). |
| **Desestructuración** | Por nombre/propiedad en runtime. | Records + pattern matching (Java 21). |
| **Inmutabilidad** | Copia + `Object.freeze` (superficial). | `List.of`, records (inmutable por diseño). |

---

## Resumen del capítulo

1. **`Map` acepta claves de cualquier tipo** (por referencia) y mantiene orden de inserción; un objeto solo acepta strings como claves.
2. **`Set` es un array sin duplicados** con búsqueda O(1): deduplicar es `[...new Set(arr)]`, y ojo con la igualdad por tipo (`1 !== "1"`).
3. **`WeakMap`/`WeakSet` usan referencias débiles**: datos asociados que se liberan cuando su clave muere. A cambio, no iterables, sin `.size`, y solo objetos como claves.
4. **El protocolo de iteración (iterable → `Symbol.iterator` → iterador con `next()`) unifica** `for...of`, spread y desestructuración sobre arrays, strings, maps, sets y tus objetos.
5. **Los generadores pausan y reanudan**: secuencias infinitas sin agotar memoria, con `yield*` para delegar y `next(valor)` para enviar datos hacia adentro.
6. **Los iterator helpers (ES2025) hacen pipelines lazy**: `filter().take().reduce()` sin materializar arrays intermedios.
7. **La desestructuración extrae por nombre o posición**; el spread copia **superficial** (los objetos anidados se comparten), y `structuredClone` da la copia profunda nativa.

---

## Siguiente Capítulo

→ **[Capítulo 6: Manejo de errores y depuración](./cap-06)**: Ahora que sabes organizar datos y recorrerlos, pasamos a los errores: cómo lanzarlos, envolverlos con contexto y hacer que la depuración sea algo que puedas controlar — con sus versiones Python y Java a la vista.