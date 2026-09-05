---
title: "Capítulo 12: APIs modernas y propuestas TC39 (ES2025-ES2026)"
---

# Capítulo 12: APIs modernas y propuestas TC39 (ES2025-ES2026)

> Este capítulo cubre las APIs y propuestas más recientes del comité TC39 que entran en ES2025-ES2026.

## Introducción

El comité TC39 continuously propone nuevas características para JavaScript. Este capítulo cubre las APIs y propuestas más recientes que están llegando o ya están disponibles en los entornos modernos.

**¿Por qué importa?** Porque mantenerse al día con las nuevas características te permite escribir código más limpio, eficiente y mantenible. Conocer el futuro del lenguaje te prepara para las mejores prácticas de mañana.

## 1. `Math.sumPrecise`

### Idea clave

`Math.sumPrecise` resuelve el problema clásico de precisión al sumar números de punto flotante.

### El problema

```javascript
// Suma normal: pérdida de precisión
const valores = [0.1, 0.2, 0.3]
const suma = valores.reduce((a, b) => a + b, 0)
console.log(suma) // 0.6000000000000001
```

### La solución

```javascript
// Math.sumPrecise: suma exacta
const valores = [0.1, 0.2, 0.3]
const suma = Math.sumPrecise(valores)
console.log(suma) // 0.6
```

### Comparación con Python

```python
# Python - También tiene problemas de precisión
valores = [0.1, 0.2, 0.3]
suma = sum(valores)
print(suma)  # 0.6000000000000001

# Solución en Python: Decimal
from decimal import Decimal
valores = [Decimal('0.1'), Decimal('0.2'), Decimal('0.3')]
suma = sum(valores)
print(suma)  # 0.6

# O usar math.fsum (similar a Math.sumPrecise)
import math
valores = [0.1, 0.2, 0.3]
suma = math.fsum(valores)
print(suma)  # 0.6
```

**Diferencias clave**:
- **JavaScript**: `Math.sumPrecise` (nueva API)
- **Python**: `math.fsum` o `Decimal`
- **Ambos**: Resuelven el mismo problema de precisión de punto flotante

## 2. `Error.isError`

### Idea clave

`Error.isError` permite verificar si un valor es una instancia de `Error` de forma fiable, incluso entre realms (iframes, workers).

### Ejemplo

```javascript
// Sin Error.isError: instanceof falla entre realms
const errorDeWorker = new Error("Error en worker")
console.log(errorDeWorker instanceof Error) // puede ser false en otro realm

// Con Error.isError
console.log(Error.isError(errorDeWorker)) // true, sin importar el realm
```

### Comparación con Python

```python
# Python - isinstance funciona de forma consistente
error = Exception("test")
print(isinstance(error, Exception))  # True

# Python no tiene el problema de realms porque no usa prototypes de la misma manera
# Pero sí tiene problemas con hierarquías de excepciones

# Verificar tipo exacto
print(type(error) is Exception)  # True
print(isinstance(error, (Exception, BaseException)))  # True
```

**Diferencias clave**:
- **JavaScript**: `Error.isError` para verificar entre realms
- **Python**: `isinstance()` funciona de forma consistente
- **JavaScript**: Problema único debido a múltiples contextos de ejecución

## 3. Iterator helpers

### Idea clave

Los Iterator helpers añaden métodos como `.map()`, `.filter()`, `.take()`, `.drop()` y `.reduce()` directamente a los iteradores, permitiendo procesamiento perezoso (lazy).

### Ejemplo

```javascript
// Generador infinito
function* naturales() {
  let n = 1
  while (true) yield n++
}

// Iterator helpers: procesamiento perezoso
const resultado = naturales()
  .filter(n => n % 2 === 0)    // Solo pares
  .map(n => n * n)             // Al cuadrado
  .take(5)                     // Primeros 5
  .toArray()

console.log(resultado) // [4, 16, 36, 64, 100]
```

### Comparación con Python

```python
# Python - Generadores y itertools
def naturales():
    n = 1
    while True:
        yield n
        n += 1

# Python no tiene iterator helpers nativos, pero tiene itertools
from itertools import islice, filterfalse

# Forma 1: Usar generadores encadenados
def pares():
    for n in naturales():
        if n % 2 == 0:
            yield n

def al_cuadrado(iterable):
    for n in iterable:
        yield n * n

resultado = list(islice(al_cuadrado(pares()), 5))
print(resultado)  # [4, 16, 36, 64, 100]

# Forma 2: Más funcional
from functools import reduce
from itertools import islice

resultado = list(islice(
    (n**2 for n in naturales() if n % 2 == 0),
    5
))
print(resultado)  # [4, 16, 36, 64, 100]

# Forma 3: Con iterpipes o toolz (librerías externas)
# pip install toolz
from toolz import pipe, map, filter, take

resultado = pipe(
    naturales(),
    filter(lambda n: n % 2 == 0),
    map(lambda n: n ** 2),
    take(5),
    list
)
print(resultado)  # [4, 16, 36, 64, 100]
```

### Ventaja sobre arrays

- No se materializa todo en memoria: los valores se producen bajo demanda.
- Ideal para secuencias grandes o infinitas.

## 4. `using` (Explicit Resource Management)

> Cubierto en detalle en el **Cap-11-Gestion-Asincrona-Recursos**.

## Errores Comunes

- Usar `reduce` sin valor inicial (puede causar errores con arrays vacíos).
- No entender la diferencia entre iteradores y arrays.
- Olvidar que los iterator helpers son lazy (no ejecutan hasta que se itere).

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Usar Math.sumPrecise para sumas precisas

**Ejercicio**: Crea una función que:
1. Reciba un array de números
2. Use `Math.sumPrecise` para sumarlos
3. Compare el resultado con `reduce`

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. `Math.sumPrecise` es una función estática
2. `reduce` con valor inicial 0
3. Compara los resultados con `===`

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
function compararSumas(numeros) {
  const sumaReduce = numeros.reduce((a, b) => a + b, 0);
  const sumaPrecisa = Math.sumPrecise(numeros);
  
  return {
    numeros,
    sumaReduce,
    sumaPrecisa,
    diferencia: Math.abs(sumaReduce - sumaPrecisa),
    sonIguales: sumaReduce === sumaPrecisa
  };
}

// Prueba
const numeros = [0.1, 0.2, 0.3, 0.4, 0.5];
console.log(compararSumas(numeros));
// {
//   numeros: [0.1, 0.2, 0.3, 0.4, 0.5],
//   sumaReduce: 1.5000000000000002,
//   sumaPrecisa: 1.5,
//   diferencia: 2.220446049250313e-16,
//   sonIguales: false
// }
```

</details>


### Nivel Intermedio

**Objetivo**: Implementar iterator helpers personalizados

**Ejercicio**: Crea un objeto `Iterator` con métodos personalizados que:
1. `.map(fn)` - Transforme cada elemento
2. `.filter(fn)` - Filtre elementos
3. `.take(n)` - Tome los primeros n elementos
4. `.toArray()` - Convierta a array

**Requisitos**:
1. Debe funcionar con generadores
2. Debe ser lazy (no ejecutar hasta que se itere)
3. Debe encadenarse

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un generador interno
2. Cada método devuelve un nuevo iterador
3. `toArray()` es el que ejecuta todo

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class Iterator {
  constructor(generator) {
    this.generator = generator;
  }
  
  map(fn) {
    const self = this;
    return new Iterator(function* () {
      for (const item of self.generator) {
        yield fn(item);
      }
    });
  }
  
  filter(fn) {
    const self = this;
    return new Iterator(function* () {
      for (const item of self.generator) {
        if (fn(item)) {
          yield item;
        }
      }
    });
  }
  
  take(n) {
    const self = this;
    return new Iterator(function* () {
      let count = 0;
      for (const item of self.generator) {
        if (count >= n) break;
        yield item;
        count++;
      }
    });
  }
  
  toArray() {
    return [...this.generator];
  }
  
  // Método estático para crear desde un iterable
  static from(iterable) {
    return new Iterator(function* () {
      yield* iterable;
    });
  }
  
  // Método estático para infinitos
  static infinite(start = 1) {
    return new Iterator(function* () {
      let n = start;
      while (true) yield n++;
    });
  }
}

// Uso
const resultado = Iterator.infinite(1)
  .filter(n => n % 2 === 0)
  .map(n => n ** 2)
  .take(5)
  .toArray();

console.log(resultado); // [4, 16, 36, 64, 100]
```

</details>


### Nivel Avanzado

**Objetivo**: Implementar sistema de iteradores con caché

**Ejercicio**: Crea un sistema que:
1. Use iterator helpers para procesamiento lazy
2. Implemente caché para resultados computados costosos
3. Soporte paralelización de iteraciones
4. Maneje errores en el pipeline

**Especificaciones**:
1. Caché con TTL (Time To Live)
2. Paralelización con Promise.all
3. Error handling en cada paso
4. Métricas de rendimiento

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa WeakMap para caché (permite garbage collection)
2. Implementa un patrón Pipeline
3. Usa AbortController para cancelación

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class CachedIterator {
  constructor(generator, config = {}) {
    this.generator = generator;
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 60000;
    this.metrics = {
      hits: 0,
      misses: 0,
      computed: 0
    };
  }
  
  getCacheKey(item, fn) {
    return `${JSON.stringify(item)}_${fn.toString()}`;
  }
  
  cachedMap(fn) {
    const self = this;
    return new CachedIterator(function* () {
      for (const item of self.generator) {
        const cacheKey = self.getCacheKey(item, fn);
        const cached = self.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < self.cacheTTL) {
          self.metrics.hits++;
          yield cached.result;
        } else {
          self.metrics.misses++;
          const result = fn(item);
          self.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
          });
          self.metrics.computed++;
          yield result;
        }
      }
    });
  }
  
  filter(fn) {
    const self = this;
    return new CachedIterator(function* () {
      for (const item of self.generator) {
        if (fn(item)) {
          yield item;
        }
      }
    });
  }
  
  take(n) {
    const self = this;
    return new CachedIterator(function* () {
      let count = 0;
      for (const item of self.generator) {
        if (count >= n) break;
        yield item;
        count++;
      }
    });
  }
  
  async toArrayParallel(concurrency = 4) {
    const items = [];
    const promises = [];
    
    for (const item of this.generator) {
      promises.push(Promise.resolve(item));
      
      if (promises.length >= concurrency) {
        const results = await Promise.all(promises);
        items.push(...results);
        promises.length = 0;
      }
    }
    
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      items.push(...results);
    }
    
    return items;
  }
  
  toArray() {
    return [...this.generator];
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Uso con funciones costosas
function computoCostoso(n) {
  // Simular computación costosa
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.sqrt(n + i);
  }
  return result;
}

const iterator = CachedIterator.infinite(1)
  .filter(n => n % 2 === 0)
  .cachedMap(computoCostoso)
  .take(3);

const resultado = iterator.toArray();
console.log('Resultado:', resultado);
console.log('Métricas:', iterator.getMetrics());
```

</details>


---

## Pensamiento Crítico

### Problema 1: Precisión numérica en aplicaciones financieras

**Situación**: Tu aplicación financiera usa sumas de punto flotante y los resultados no son precisos.

**Preguntas guía**:
1. ¿Por qué `0.1 + 0.2 !== 0.3` en JavaScript?
2. ¿Cómo solucionas esto en producción?
3. ¿Cuándo usar `Math.sumPrecise` vs `Decimal`?

**Análisis**:
- **Causa**: Representación binaria de números decimales
- **Solución**: `Math.sumPrecise` para sumas, `BigInt` para enteros grandes
- **Alternativas**: Librerías como `decimal.js` o `bignumber.js`

### Problema 2: Iteradores infinitos y memoria

**Situación**: Tu aplicación procesa secuencias infinitas y se queda sin memoria.

**Preguntas guía**:
1. ¿Cómo manejas secuencias infinitas sin consumir toda la memoria?
2. ¿Qué son los iterator helpers y cómo ayudan?
3. ¿Cuándo materializar un iterator vs mantenerlo lazy?

**Análisis**:
- **Problema**: Consumo de memoria al materializar secuencias grandes
- **Solución**: Iterator helpers con `take()` y procesamiento lazy
- **Patrones**: Lazy Evaluation, Pipeline

---

## Conexión con Python

### Iteradores en Python vs JavaScript

```python
# Python - Generadores e itertools
from itertools import islice, chain, filterfalse

# Generador infinito
def naturales():
    n = 1
    while True:
        yield n
        n += 1

# Iterator helpers equivalentes
def mi_map(fn, iterable):
    for item in iterable:
        yield fn(item)

def mi_filter(fn, iterable):
    for item in iterable:
        if fn(item):
            yield item

# Uso con itertools
resultado = list(islice(
    map(lambda n: n ** 2, 
        filter(lambda n: n % 2 == 0, naturales())),
    5
))
print(resultado)  # [4, 16, 36, 64, 100]

# Pipelines funcionales con toolz
from toolz import pipe, map, filter, take

resultado = pipe(
    naturales(),
    filter(lambda n: n % 2 == 0),
    map(lambda n: n ** 2),
    take(5),
    list
)
print(resultado)  # [4, 16, 36, 64, 100]
```

### Comparación de APIs modernas

| API | JavaScript | Python |
|-----|------------|--------|
| **Suma precisa** | `Math.sumPrecise` | `math.fsum` |
| **Error checking** | `Error.isError` | `isinstance()` |
| **Iterator helpers** | `.map()`, `.filter()`, `.take()` | `itertools`, `toolz` |
| **Resource management** | `using` | `with` |

---

## Resumen

1. **`Math.sumPrecise`** elimina la pérdida de precisión en sumas de punto flotante
2. **`Error.isError`** verifica errores de forma fiable entre realms
3. **Los Iterator helpers** permiten procesamiento perezoso sobre iteradores
4. **`using`** garantiza la liberación automática de recursos
5. **Python** ofrece equivalentes como `math.fsum`, `itertools` y `with`
6. **Las APIs modernas** hacen el código más limpio y mantenible

---

## Conclusión del Libro

Este capítulo cierra el libro "JavaScript Avanzado" con las herramientas más recientes del lenguaje. A lo largo de los 12 capítulos, hemos cubierto desde fundamentos como funciones y objetos hasta patrones avanzados, arquitecturas y APIs modernas. El conocimiento adquirido te permitirá escribir código JavaScript más robusto, mantenible y eficiente.

**Próximos pasos**:
1. Practica con los ejercicios de cada capítulo
2. Explora las APIs en tu entorno de desarrollo favorito
3. Contribuye a proyectos open source para aplicar lo aprendido
4. Mantente actualizado con las propuestas TC39
