---
title: "Chapter 12: Modern APIs and TC39 Proposals (ES2025-ES2026)"
---

# Chapter 12: Modern APIs and TC39 Proposals (ES2025-ES2026)

> This chapter covers the latest APIs and proposals from the TC39 committee coming in ES2025-ES2026.

## Introduction

The TC39 committee continuously proposes new features for JavaScript. This chapter covers the latest APIs and proposals that are arriving or are already available in modern environments.

**Why does it matter?** Because keeping up with new features allows you to write cleaner, more efficient, and more maintainable code. Knowing the future of the language prepares you for tomorrow's best practices.

## 1. `Math.sumPrecise`

### Key idea

`Math.sumPrecise` solves the classic precision problem when adding floating-point numbers.

### The problem

```javascript
// Normal addition: loss of precision
const valores = [0.1, 0.2, 0.3]
const suma = valores.reduce((a, b) => a + b, 0)
console.log(suma) // 0.6000000000000001
```

### The solution

```javascript
// Math.sumPrecise: exact addition
const valores = [0.1, 0.2, 0.3]
const suma = Math.sumPrecise(valores)
console.log(suma) // 0.6
```

### Comparison with Python

```python
# Python - Also has precision issues
valores = [0.1, 0.2, 0.3]
suma = sum(valores)
print(suma)  # 0.6000000000000001

# Python solution: Decimal
from decimal import Decimal
valores = [Decimal('0.1'), Decimal('0.2'), Decimal('0.3')]
suma = sum(valores)
print(suma)  # 0.6

# Or use math.fsum (similar to Math.sumPrecise)
import math
valores = [0.1, 0.2, 0.3]
suma = math.fsum(valores)
print(suma)  # 0.6
```

**Key differences**:
- **JavaScript**: `Math.sumPrecise` (new API)
- **Python**: `math.fsum` or `Decimal`
- **Both**: Solve the same floating-point precision problem

## 2. `Error.isError`

### Key idea

`Error.isError` allows you to reliably check if a value is an instance of `Error`, even across realms (iframes, workers).

### Example

```javascript
// Without Error.isError: instanceof fails across realms
const errorDeWorker = new Error("Error en worker")
console.log(errorDeWorker instanceof Error) // can be false in another realm

// With Error.isError
console.log(Error.isError(errorDeWorker)) // true, regardless of the realm
```

### Comparison with Python

```python
# Python - isinstance works consistently
error = Exception("test")
print(isinstance(error, Exception))  # True

# Python doesn't have the realms issue because it doesn't use prototypes the same way
# But it does have issues with exception hierarchies

# Check exact type
print(type(error) is Exception)  # True
print(isinstance(error, (Exception, BaseException)))  # True
```

**Key differences**:
- **JavaScript**: `Error.isError` to check across realms
- **Python**: `isinstance()` works consistently
- **JavaScript**: Unique issue due to multiple execution contexts

## 3. Iterator helpers

### Key idea

Iterator helpers add methods like `.map()`, `.filter()`, `.take()`, `.drop()`, and `.reduce()` directly to iterators, enabling lazy processing.

### Example

```javascript
// Infinite generator
function* naturales() {
  let n = 1
  while (true) yield n++
}

// Iterator helpers: lazy processing
const resultado = naturales()
  .filter(n => n % 2 === 0)    // Even only
  .map(n => n * n)             // Squared
  .take(5)                     // First 5
  .toArray()

console.log(resultado) // [4, 16, 36, 64, 100]
```

### Comparison with Python

```python
# Python - Generators and itertools
def naturales():
    n = 1
    while True:
        yield n
        n += 1

# Python doesn't have native iterator helpers, but it has itertools
from itertools import islice, filterfalse

# Way 1: Using chained generators
def pares():
    for n in naturales():
        if n % 2 == 0:
            yield n

def al_cuadrado(iterable):
    for n in iterable:
        yield n * n

resultado = list(islice(al_cuadrado(pares()), 5))
print(resultado)  # [4, 16, 36, 64, 100]

# Way 2: More functional
from functools import reduce
from itertools import islice

resultado = list(islice(
    (n**2 for n in naturales() if n % 2 == 0),
    5
))
print(resultado)  # [4, 16, 36, 64, 100]

# Way 3: With iterpipes or toolz (external libraries)
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

### Advantage over arrays

- Not everything is materialized in memory: values are produced on demand.
- Ideal for large or infinite sequences.

## 4. `using` (Explicit Resource Management)

> Covered in detail in **[Chapter 11: Asynchronous resource management](./cap-11)**.

## Common Errors

- Using `reduce` without an initial value (can cause errors with empty arrays).
- Not understanding the difference between iterators and arrays.
- Forgetting that iterator helpers are lazy (they do not execute until iterated).

---

## Practical Exercises

### Basic Level

**Objective**: Use Math.sumPrecise for precise additions

**Exercise**: Create a function that:
1. Receives an array of numbers
2. Uses `Math.sumPrecise` to add them
3. Compares the result with `reduce`

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. `Math.sumPrecise` is a static function
2. `reduce` with an initial value of 0
3. Compare the results with `===`

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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

// Test
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


### Intermediate Level

**Objective**: Implement custom iterator helpers

**Exercise**: Create an `Iterator` object with custom methods that:
1. `.map(fn)` - Transforms each element
2. `.filter(fn)` - Filters elements
3. `.take(n)` - Takes the first n elements
4. `.toArray()` - Converts to an array

**Requirements**:
1. Must work with generators
2. Must be lazy (does not execute until iterated)
3. Must be chainable

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use an internal generator
2. Each method returns a new iterator
3. `toArray()` is what executes everything

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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
  
  // Static method to create from an iterable
  static from(iterable) {
    return new Iterator(function* () {
      yield* iterable;
    });
  }
  
  // Static method for infinite sequences
  static infinite(start = 1) {
    return new Iterator(function* () {
      let n = start;
      while (true) yield n++;
    });
  }
}

// Usage
const resultado = Iterator.infinite(1)
  .filter(n => n % 2 === 0)
  .map(n => n ** 2)
  .take(5)
  .toArray();

console.log(resultado); // [4, 16, 36, 64, 100]
```

</details>


### Advanced Level

**Objective**: Implement an iterator system with caching

**Exercise**: Create a system that:
1. Uses iterator helpers for lazy processing
2. Implements caching for expensive computed results
3. Supports parallelization of iterations
4. Handles errors in the pipeline

**Specifications**:
1. Cache with TTL (Time To Live)
2. Parallelization with Promise.all
3. Error handling at each step
4. Performance metrics

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use WeakMap for cache (allows garbage collection)
2. Implement a Pipeline pattern
3. Use AbortController for cancellation

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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

// Usage with expensive functions
function computoCostoso(n) {
  // Simulate expensive computation
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
console.log('Result:', resultado);
console.log('Metrics:', iterator.getMetrics());
```

</details>


---

## Critical Thinking

### Problem 1: Numerical precision in financial applications

**Situation**: Your financial application uses floating-point additions and the results are not precise.

**Guiding questions**:
1. Why is `0.1 + 0.2 !== 0.3` in JavaScript?
2. How do you solve this in production?
3. When should you use `Math.sumPrecise` vs `Decimal`?

**Analysis**:
- **Cause**: Binary representation of decimal numbers
- **Solution**: `Math.sumPrecise` for additions, `BigInt` for large integers
- **Alternatives**: Libraries like `decimal.js` or `bignumber.js`

### Problem 2: Infinite iterators and memory

**Situation**: Your application processes infinite sequences and runs out of memory.

**Guiding questions**:
1. How do you handle infinite sequences without consuming all the memory?
2. What are iterator helpers and how do they help?
3. When should you materialize an iterator vs keeping it lazy?

**Analysis**:
- **Problem**: Memory consumption when materializing large sequences
- **Solution**: Iterator helpers with `take()` and lazy processing
- **Patterns**: Lazy Evaluation, Pipeline

---

## Connection with Python

### Iterators in Python vs JavaScript

```python
# Python - Generators and itertools
from itertools import islice, chain, filterfalse

# Infinite generator
def naturales():
    n = 1
    while True:
        yield n
        n += 1

# Equivalent iterator helpers
def mi_map(fn, iterable):
    for item in iterable:
        yield fn(item)

def mi_filter(fn, iterable):
    for item in iterable:
        if fn(item):
            yield item

# Usage with itertools
resultado = list(islice(
    map(lambda n: n ** 2, 
        filter(lambda n: n % 2 == 0, naturales())),
    5
))
print(resultado)  # [4, 16, 36, 64, 100]

# Functional pipelines with toolz
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

### Comparison of Modern APIs

| API | JavaScript | Python |
|-----|------------|--------|
| **Precise addition** | `Math.sumPrecise` | `math.fsum` |
| **Error checking** | `Error.isError` | `isinstance()` |
| **Iterator helpers** | `.map()`, `.filter()`, `.take()` | `itertools`, `toolz` |
| **Resource management** | `using` | `with` |

---

## Summary

1. **`Math.sumPrecise`** eliminates precision loss in floating-point additions
2. **`Error.isError`** reliably checks errors across realms
3. **Iterator helpers** enable lazy processing on iterators
4. **`using`** guarantees automatic resource release
5. **Python** offers equivalents like `math.fsum`, `itertools`, and `with`
6. **Modern APIs** make code cleaner and more maintainable

---

## Book Conclusion

This chapter closes the book "Advanced JavaScript" with the latest tools of the language. Throughout the 12 chapters, we have covered everything from fundamentals like functions and objects to advanced patterns, architectures, and modern APIs. The knowledge acquired will allow you to write more robust, maintainable, and efficient JavaScript code.

**Next steps**:
1. Practice with the exercises in each chapter
2. Explore the APIs in your favorite development environment
3. Contribute to open-source projects to apply what you have learned
4. Stay updated with TC39 proposals