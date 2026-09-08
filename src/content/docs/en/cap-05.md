---
title: "Chapter 5: Advanced Data Structures and Iteration"
---

# Chapter 5: Advanced Data Structures and Iteration

> When an object and an array are no longer the best tool, the language hands you the next level of toolbox.

## Introduction

You learned to store data in objects and arrays, and with those you get far. But the cases arrive where those two don't quite solve it: configuration where the keys can be functions or objects, a list where duplicates get in the way, or a sequence so long that pulling it all into memory tanks your machine. For those cases JavaScript has `Map`, `Set`, `WeakMap`, and `WeakSet`, plus a unified iteration system that turns almost anything into something repeatable with `for...of`, spread, and destructuring.

In this chapter you'll see when each structure beats the others, how iteration works under the hood (generators included), and why immutability — not touching what already lives — saves you the kind of bug that only shows up in production.

---

## 1. `Map` and `Set`: when the object and the array run out of road

### The problem: an object's keys are always text

An object looks like a dictionary, but its keys get **coerced into strings** the moment you use them. That betrays you exactly when you need it most:

```javascript
const obj = {}
const objectKey = { id: 1 }

obj[objectKey] = "value"          // the key becomes "[object Object]"
obj["[object Object]"] = "x"    // another empty object hits the same slot!

console.log(obj[{}])            // "x" — any empty object reads the same data
console.log(Object.keys(obj))   // ["[object Object]"]
```

When your keys are strings, an object is fine and is the lightest option. The moment you need keys that are objects, functions, or numbers that aren't strings, `Map` shows up as the answer: **it accepts any key type without converting it to text**.

```javascript
const map = new Map()
const objectKey = { id: 1 }
const functionKey = () => {}

map.set("string", "value")
map.set(objectKey, "object as key")
map.set(functionKey, "function as key")
map.set(42, "number as key")

console.log(map.size)                // 4 — O(1) size, no Object.keys() needed
console.log(map.get(objectKey))      // "object as key"
console.log(map.get({ id: 1 }))      // undefined — not the SAME reference

for (const [key, value] of map) {
  console.log(key, value)            // iterates in insertion order
}
```

Two details that slip by and are worth their weight in gold: `Map` iterates in **insertion order** (guaranteed), and `objectKey` doesn't equal a new object with identical content — here **reference** rules, not value.

### `Set`: uniqueness without hand-writing the loop

Deduplicating an array once meant writing a little poem of `filter` and `indexOf`:

```javascript
const duplicates = [1, 2, 2, 3, 3, 3, 4]
const unique = duplicates.filter((v, i) => duplicates.indexOf(v) === i)
// Okay, it works... but it's O(n²): for every item it sweeps the whole list again.
```

`Set` is a collection of **unique values** with O(1) lookup:

```javascript
const set = new Set([1, 2, 3, 2, 1])   // Set { 1, 2, 3 } — duplicates gone
set.add(4)
set.has(3)                             // true — O(1), not an O(n) sweep

const unique = [...new Set(duplicates)]  // [1, 2, 3, 4] — one line
```

**Watch out for equality**: `Set` distinguishes by type, so `1 !== "1"`. This `Set` has two elements:

```javascript
const weirdSet = new Set([1, "1", 1])
console.log(weirdSet.size)  // 2
```

### When to use which

| Need | Use |
|---|---|
| Key-value with string keys | Object (lighter, serializes to JSON) |
| Key-value with keys of another type | `Map` |
| Unique values | `Set` |
| Asking "does X exist?" often | `Set` or `Map` (O(1)) |
| Respecting insertion order | `Map`/`Set` (guaranteed) |
| Serializing to JSON | Object — `Map`/`Set` don't serialize directly |

The JSON point is one of those that show up in the first real bug: `JSON.stringify(new Map([["a", 1]]))` produces `{}`. If you need to send it to an API, convert it first: `JSON.stringify([...map])` or `JSON.stringify(Object.fromEntries(map))`.

### Connection with Python

Python already carried this pair: `dict` (key-value) and `set` (unique).

```python
d = {"string": "value", 42: "number"}   # hashable keys
s = set([1, 2, 3, 2, 1])                # {1, 2, 3}
print(3 in s)                            # True, O(1)
```

**Exact translation**: `Map.set/get/has` ↔ `dict[key]`, `set.add` ↔ `set.add`, and both iterate in insertion order (Python dicts have guaranteed order since 3.7). Deduplication is the same line: `list(set(lst))` ↔ `[...new Set(arr)]`.

**Underlying change**: in Python, keys must be *hashable* (immutable) — a `list` or `dict` as a key is a `TypeError`. In JavaScript, `Map` accepts **any object by reference**; a `dict`/`set` as a key is perfectly valid. That's the difference between "stable structural identity" (Python) and "reference identity" (JS). Python also doesn't split "object-dictionary" and "map" the way JS does: there `dict` IS the map, whereas JS has two tools with different rules.

### Connection with Java

Java has had `HashMap`, `LinkedHashMap`, `HashSet`, and `TreeSet` since the 90s.

**Exact translation**: `LinkedHashMap` keeps insertion order, just like `Map`; `HashSet` deduplicates with O(1), just like `Set`. The API mirrors itself: `put`/`get` ↔ `set`/`get`; `contains` ↔ `has`.

**Underlying change**: in Java, collections are generic and **typed** (`Map<String, Integer>`), and you can only use keys with well-implemented `hashCode()`/`equals()`. The moment mutable objects are keys is where Java and JS break differently: Java breaks the *hash contract* (the object changed its `hashCode` after insertion); JavaScript has no hash, only references, so the "object as key" thing that's painful in Java is trivial in JS. JS's `Map` also has no ordering (`TreeMap`), nor iterators with a `Comparator`: if you need "biggest first," that doesn't come free here.

---

## 2. `WeakMap` and `WeakSet`: memory that breathes

### The problem: the metadata that never wanted to leave

You attach data to an element: how many times a button got clicked, the last result of a lookup keyed by object, which files have been processed. If you store that in a `Map`, the `Map` **holds the reference** to the object key forever, even when the button no longer exists on the page. Over time, an app that creates and destroys many elements slowly but surely runs out of memory — and no error gives it away.

`WeakMap` exists for that: its **keys are weak references**. When no other reference to the object remains, the garbage collector can free it — and with it, the metadata living in the `WeakMap`.

```javascript
const metadata = new WeakMap()

const button = document.createElement("button")
metadata.set(button, { clickCount: 0, lastClick: null })

button.addEventListener("click", () => {
  const data = metadata.get(button)
  data.clickCount++
  data.lastClick = new Date()
})

// When the button is removed from the DOM and has no more references,
// the GC frees THE BUTTON and ITS METADATA together.
// With a regular Map, the metadata stayed forever: memory leak.
```

The same pattern for knowing whether you processed an object without duplicated work:

```javascript
const processed = new WeakSet()

function processIfNeeded(object) {
  if (processed.has(object)) {
    console.log("Already processed — not repeating work")
    return
  }
  // ... process the object ...
  processed.add(object)
}

const item = { id: 1 }
processIfNeeded(item)   // processes
processIfNeeded(item)   // "Already processed"
// when item loses its references, WeakSet forgets it on its own
```

### The restrictions that come with weakness

What gives it its superpower conditions everything else:

- `WeakMap` keys (and `WeakSet` values) **must be objects**. Primitives throw a `TypeError` (`Invalid value used as weak map key`).
- **They're not iterable**: no `for...of`, no `.keys()`, no `.values()`, no `.size`.

Why? Think about what iterating a collection whose elements the GC is deleting at any instant would mean: you could read an object that "no longer exists," and the order itself would stop being stable. JavaScript chooses coherence: if you can't measure it, you can't get it wrong.

Which one do you lean on when? `WeakMap` when the data must live and die with the key (DOM metadata, per-object caches). `Map` when you need to iterate, know the size, or use primitive keys.

### Connection with Python

Python does exactly this with the `weakref` module, and the conceptual symmetry is striking:

```python
import weakref

metadata = weakref.WeakKeyDictionary()
button = object()
metadata[button] = {"clicks": 0}

print(len(metadata))        # 1
del button                  # no other refs to the object...
print(len(metadata))        # 0 — the whole pair vanished
```

**Exact translation**: `WeakKeyDictionary` ↔ `WeakMap` (the live keys carry off the value); `weakref.WeakSet` ↔ `WeakSet`. Both forbid non-object keys (primitives).

**Underlying change**: in Python, weakness by default is *object*-to-*object* via explicit weak references and nothing else; the language hands you the raw piece (`weakref.ref`) and you assemble the collection. JavaScript gives you `WeakMap`/`WeakSet` as ready-made structures, but **doesn't** let you iterate or see the size — the very power Python does give you (`len(dict)`). Convenience vs. transparency, chosen differently in each ecosystem.

### Connection with Java

`WeakHashMap` has lived in the standard library since Java 2.

**Exact translation**: `WeakHashMap` keeps the key-value pair (weak key, strong value) and a `WeakHashMap` whose keys have no other references purges itself to the outside world — exactly the semantics of `WeakMap`.

**Underlying change**: `WeakHashMap` was born for caches, but direct use is so awkward that today Java recommends `Caffeine` or `Guava` as real caches: the `WeakHashMap` congests easily and the strong value can hold the key via internal references, an implementation detail you don't touch on the JS side (the engine does the dirty work well). And beware the name: JS's `WeakMap` is weak in the **key**; there's no native equivalent of a "value-weak map."

---

## 3. The iteration protocol: iterables and iterators

### The problem: every collection visited its own way

Arrays were visited with `for`, objects with `for...in`, and every library invented its own way to "give all the elements." The definition of "iterating over something" was a mess. JavaScript unified everything with **two protocols** that chain together:

- An **iterable** is an object that responds to `Symbol.iterator`, and that property **returns an iterator**.
- An **iterator** is an object with `next()`, which returns `{ value, done }`.

With that, `for...of`, spread `[...]`, and destructuring `const [a, b] =` all work over **anything** that implements the protocol.

### Implementing your own iterable

```javascript
class Range {
  constructor(start, end, step = 1) {
    this.start = start
    this.end = end
    this.step = step
  }

  [Symbol.iterator]() {
    let current = this.start
    const end = this.end
    const step = this.step

    return {
      next() {
        if (current <= end) {
          const value = current
          current += step
          return { value, done: false }
        }
        return { done: true }
      },
      // Making the iterator iterable too lets you reuse it in for...of
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

const range = new Range(1, 10, 2)

for (const n of range) console.log(n)   // 1, 3, 5, 7, 9
const array = [...range]                // [1, 3, 5, 7, 9]
const [first, second] = range           // first=1, second=3
```

### The iterables you already have

These are native iterables: `[1, 2, 3]` (Array), `"hello"` (String), `new Set([1,2,3])`, `new Map()` (iterating `[key, value]` pairs). The detail that confuses people: **objects are NOT iterable by default** — walking a plain object is still `for...in`, `Object.keys()`, `Object.values()`, or `Object.entries()` (which do return iterable arrays).

### The infinite iterator

An iterator can be lazy and infinite: it produces the next value only when you ask for it, materializing nothing up front.

```javascript
function naturals() {
  let n = 0
  return {
    next() { return { value: n++, done: false } },
    [Symbol.iterator]() { return this },
  }
}

const nums = naturals()
nums.next()  // { value: 0, done: false }
nums.next()  // { value: 1, done: false }

// ⚠️ for (const n of naturals()) {} — NEVER finishes.
// Use it with take/limit (section 5), never raw.
```

### Connection with Python

Python defined exactly this protocol first, with the names `__iter__`/`__next__`:

```python
class Range:
    def __init__(self, start, end, step=1):
        self.start, self.end, self.step = start, end, step

    def __iter__(self):
        current = self.start
        while current <= self.end:
            yield current
            current += self.step

r = Range(1, 10, 2)
print([n for n in r])   # [1, 3, 5, 7, 9]
```

**Exact translation**: the protocol is the same gesture in another costume: `Symbol.iterator` ↔ `__iter__`; `next()` → `{value, done}` ↔ `__next__()` → value/StopIteration. `for...of` ↔ `for x in`, and the infinite iterator works the same in both.

**Underlying change**: in Python the *dunder methods* can live on the class (`__iter__`) and the function that yields the iterator is the iterator itself; in JavaScript `Symbol.iterator` is the explicit key and the iterator is a separate object with `next()`, with `{ done }` replacing the `StopIteration`-as-exception Python used before PEP 479. In JS, "it's over" is a normal return; in Python, ending means throwing a controlled exception — two cultures of the same "end of the line."

### Connection with Java

The old friend `Iterator<E>`:

```java
Iterator<Integer> it = list.iterator();
while (it.hasNext()) {
    Integer n = it.next();
    System.out.println(n);
}
```

**Exact translation**: `hasNext()`+`next()` ↔ `done`+`value`: it's the same protocol of "ask if something remains" and "give me the next one," with the pair exposed by `next()` in JS.

**Underlying change**: in Java there are **two separate responsibilities**: `Iterable<T>` (produces iterators) and `Iterator<T>` (walks), and Java's for-each (the `:` loop) only understands the first. In JavaScript, an object is usually both at once (its `[Symbol.iterator]` returns an iterator that is itself iterable), and the protocol is entirely data-structure-based: `{ value, done }`. Java also drags its checked-exception past (`next()` can throw `NoSuchElementException`); in JS, `next()` simply returns `{ done: true }`.

---

## 4. Generators: `function*`, `yield`, `yield*`

### The problem: expressing sequences that don't fit in memory

Computing Fibonacci "until the user asks for it" is impossible if you generate it all into an array at once: the series grows toward `Infinity` and eats your RAM. What you need is a **pausable computation**: produce the next term only when someone asks, and sleep the rest of the time.

A generator is a special function that **pauses and resumes** its execution. `yield` pauses and hands out a value; the next call to `.next()` resumes exactly where it left off.

```javascript
function* counter() {
  yield 1
  yield 2
  yield 3
  return "done"                // terminates: shows up once in { done: true }
}

const gen = counter()
gen.next()   // { value: 1, done: false }
gen.next()   // { value: 2, done: false }
gen.next()   // { value: 3, done: false }
gen.next()   // { value: "done", done: true }
gen.next()   // { value: undefined, done: true } — it's dead now

// with for...of the return value is ignored: it stops at done: true
for (const n of counter()) console.log(n)  // 1, 2, 3
```

The superpower is **bidirectionality**: you can push data in while the generator sleeps. The value you pass to `.next(value)` becomes what `yield` returns.

```javascript
function* dialogue() {
  const name = yield "What's your name?"
  console.log(`Hello, ${name}`)
  const age = yield "How old are you?"
  console.log(`${name} is ${age} years old`)
}

const gen = dialogue()
gen.next().value         // "What's your name?"
gen.next("David").value  // "How old are you?" — "David" arrives at the yield
gen.next(25)             // logs: "David is 25 years old"
```

### `yield*`: delegating to another generator

```javascript
function* inner() {
  yield 1
  yield 2
}

function* outer() {
  yield 0
  yield* inner()   // delegates: everything inner() produces passes through me
  yield 3
}

console.log([...outer()])  // [0, 1, 2, 3]
```

### Lazy Fibonacci

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

It calculates nothing until you ask for the next value: that's where infinite sequences live without overflowing memory.

### The misunderstandings worth settling

- **They're not asynchronous**: they're synchronous and pausable. `yield` pauses your function, but it does **not** hand control over to the event loop. Real async through generators comes from *async generators* (`async function*`), which we'll cover in the concurrency chapter.
- **They're single-use**: a generator's iterator is exhausted once it reaches `done: true`. Restarting = creating a new one.

### Connection with Python

Python generators are the direct relative — `yield` is identical:

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

**Exact translation**: `function*` + `yield` ↔ `def` + `yield`, and both are lazy: they don't run the body until the first `next()`. JS's `yield*` has a mirror in Python's `yield from`, and the `return` that "kills" the generator exists in both (in Python it's the hidden `StopIteration.value`, just as hidden).

**Underlying change**: Python's generator syntax is *quieter* (no `function*`; Python just knows from the presence of `yield`). JavaScript makes it explicit with the `*` so there's no confusion. And in JS, generators have the two-way `next(value)` route, which in Python is called `.send(value)` — same concept, two spellings. The `dialogue()` you just saw, in Python, would be identical with `.send()`.

### Connection with Java

Java **has no native generators** — there's no `yield` in the language.

**Exact translation**: the spirit of "lazy sequence, bit by bit" lives in `Stream` (section 5) and in `Stream.iterate`. A Fibonacci generator in Java would go via anonymous iterators or `Stream.generate`:

```java
Stream.iterate(new long[]{0,1}, f -> new long[]{f[1], f[0]+f[1]})
      .limit(10)
      .forEach(f -> System.out.println(f[0]));
```

**Underlying change**: in Java, "postpone the computation" is laborious: you hand-write `iterator()` + `hasNext()` + `next()`, or assemble streams. In JavaScript, `function*` is native sugar that gives you pause/resume both ways for free. The cost of that ease: JavaScript has no *typed generators*, and the generator's stack may be lighter but with overhead if you abuse it; Java makes you write it all but with compile-time guarantees.

---

## 5. Iterator helpers (ES2025): procedural chaining with a cutoff

### The problem: `[...].map().filter()` materializes intermediate arrays

Chaining arrays is great, but every array method **creates a brand-new full array**:

```javascript
const result = list.map(f).filter(g)   // 1st creates a full array, 2nd creates another
```

For 100 elements, harmless. For 10 million, two full copies in memory. And for an **infinite** sequence, `[...naturals()]` is impossible — there's no array to build.

**Iterator helpers** (standard ES2025) add methods *over iterators*: `map`, `filter`, `take`, `drop`, `reduce`, `toArray`, and `forEach` (plus `flatMap`, `some`, `every`, `find`) — and they're **lazy**: nothing computes until you ask for the result.

```javascript
function* naturals() {
  let n = 1
  while (true) yield n++
}

const evens = naturals()
  .filter(n => n % 2 === 0)   // lazy: nothing computed yet
  .take(5)                    // lazy: still nothing
  .toArray()                  // here: [2, 4, 6, 8, 10]

// Without helpers, you'd have to write the loop by hand:
const manualEvens = []
for (const n of naturals()) {
  if (n % 2 === 0) {
    manualEvens.push(n)
    if (manualEvens.length === 5) break
  }
}
```

Notice the conceptual leap: over an **infinite** source, `filter`+`take` only asked for the values it needed. There was no "array of all evens" — that array never exists.

### Combine with `reduce` to materialize nothing

```javascript
// Sum of the first 100 multiples of 3 — without creating an intermediate array
const sum = naturals()
  .filter(n => n % 3 === 0)
  .take(100)
  .reduce((a, b) => a + b, 0)

console.log(sum)  // 3 + 6 + ... + 300 = 15150
```

### Availability

Iterator helpers is **ES2025** (Stage 4, finalized). Available in Node.js 22+ and Chrome 122+ (modern browsers). On older environments, polyfill (e.g. `es-iterator-helpers`) or use the `iter-tools` library meanwhile.

### Connection with Python

`itertools` is the same concept going back to the 90s:

```python
import itertools

def naturals():
    n = 1
    while True:
        yield n

evens = itertools.islice(
    (n for n in naturals() if n % 2 == 0),  # lazy filter
    5,                                       # take 5
)
print(list(evens))  # [2, 4, 6, 8, 10]
```

**Exact translation**: `filter`+`take` on a JS iterator is `filter` in a comprehension + `itertools.islice`. Both are lazy and consume an infinite source without materializing.

**Underlying change**: in Python the tools are **standalone functions** (`itertools.islice(x, 5)`) that wrap iterators; in JS they're **chainable methods** on the iterator itself (`x.take(5)`). Python style is explicit composition outward; JS style is a chain on the object — the same semantics, two reading experiences. Python also has `takewhile`, `dropwhile`, `chain`, `product` that JS doesn't duplicate; JS brings `toArray` (instant) that Python doesn't need.

### Connection with Java

`Stream` gives Java exactly this superpower, and the name *stream* = *lazy iterator with operations*:

```java
List<Integer> evens = IntStream.iterate(1, n -> n + 1)
    .filter(n -> n % 2 == 0)
    .limit(5)
    .boxed()
    .toList();
// [2, 4, 6, 8, 10] — same lazy pipeline
```

**Exact translation**: `filter`+`take`+`toArray` ↔ `filter`+`limit`+`toList`. Both pipelines DON'T materialize until the collection moment, and in both you can fire an infinite source safely because `take`/`limit` cuts it off.

**Underlying change**: Java streams are **single-pass**: what you've consumed can't be re-walked (just like a JS iterator), and parallelism needs explicit `.parallel()`. JS's iterator helpers don't offer native `sorted()` or `distinct()` (for that you wrap with a `Set`), and in Java `Stream` is an integral part of the whole API — in JS, the helpers are new (ES2025) and still coexist with materializing array methods.

---

## 6. Destructuring: pulling values without writing twenty lines

### The problem: `user.address.city` repeated ten times

Accessing nested properties is ergonomic until your function is full of `user.address.city` and `user.address.country` and you have to rename. **Destructuring** pulls exactly what you need into local variables: less typing, fewer breakages when the shape changes.

```javascript
const user = {
  name: "David",
  age: 25,
  address: { city: "Medellín", country: "Colombia" },
  hobbies: ["coding", "reading", "running"],
}

// Basic: creates the variables name and age
const { name, age } = user

// Renaming: now it's called userName
const { name: userName } = user

// Default: if the property doesn't exist, use the fallback
const { phone = "N/A" } = user

// Nested: only creates the variable city, NOT address
const { address: { city } } = user

// Rest: "everything else" as a new object
const { name, ...rest } = user
// rest = { age: 25, address: {...}, hobbies: [...] }
```

### Array destructuring

```javascript
const [a, b, c] = [1, 2, 3]               // a=1, b=2, c=3
const [first, ...rest] = [1, 2, 3, 4]     // first=1, rest=[2,3,4]
const [, , third] = [1, 2, 3]             // third=3 — you skip with commas
const [x = 0, y = 0] = [1]                // x=1, y=0 — defaults in arrays

// Swapping variables without a temp
let a = 1, b = 2
;[a, b] = [b, a]                          // a=2, b=1
```

### Spread: spreading out

```javascript
function add(a, b, c) { return a + b + c }
const nums = [1, 2, 3]
add(...nums)                              // 6

const combined = [...[1, 2], ...[3, 4]]   // [1, 2, 3, 4]

const defaults = { theme: "dark", language: "es" }
const override = { language: "en" }
const config = { ...defaults, ...override }  // { theme: "dark", language: "en" }
```

Two rules that make all the difference in production:

1. **Spread is shallow**: `{ ...original }` copies the first level; nested objects are shared by **reference**. (We dig into this in section 7.)
2. **Spread order matters**: later properties win. If you invert `{ ...override, ...defaults }`, the result would be `language: "es"` again.

### Connection with Python

Python unpacks life the same way since the 90s, with tuple unpacking:

```python
first, *rest = [1, 2, 3, 4]     # first=1, rest=[2,3,4]
a, b = b, a                    # swap in one line
def log(tag, *args, **kwargs): # *args and **kwargs
    print(tag, args, kwargs)
```

**Exact translation**: Python tuple unpacking is **the same gesture**: `[a, b] = [1, 2]` ↔ `a, b = 1, 2`; `*rest` ↔ `...rest`; the swap `[a, b] = [b, a]` translates one-to-one.

**Underlying change**: Python destructures **tuples and any sequence** by position, but not "objects by property name" inside an assignment (that arrives with dataclass tricks or Python 3.10's `match`). JavaScript destructures **objects by key** (`const { name, age } = user`) by default, something Python doesn't give you without a library. And careful with defaults: in Python `*args` only comes at the end; in JS `...rest` too — in both, a `...` in the middle is an error.

### Connection with Java

*Records* (Java 16+) and pattern matching (Java 16+, matured in 21) bring the idea closer:

```java
record User(String name, int age) {}

var u = new User("David", 25);
String name = u.name();          // generated accessor, shorter
int age = u.age();

// Deconstructor (Java 21 preview): mirror of destructuring
// if (u instanceof User(var name, var age)) { ... }
```

**Exact translation**: `const { name } = user` resembles what `record` saves you (automatic getters) and, with deconstruction patterns, the positional destructuring.

**Underlying change**: in JavaScript, destructuring is a **runtime value extractor** without types: you rename (`{ name: userName }`), set defaults, and pull from any shape. Java has no "extract into variables by property name" — records just give you generated access. But in Java, **"renaming to another variable" is only another local assignment**: there's no spread for "copy with a tweak," and defaults are propagated with constructors. JavaScript gives more flexibility at the price of fewer guarantees: none of these paths check types, while the Java compiler would.

---

## 7. Immutability: not touching what already lives

### The problem: two objects sharing the same stone

When you pass an object into a function and the function mutates it, the object **outside** the function changed too — because it's the same one. And when you do `const copy = { ...original }`, there's a trap: the copy is new on the outside, but its inner objects **are shared by reference** with the original.

```javascript
const original = { a: 1, b: { c: 2 } }
const copy = { ...original }

copy.a = 10         // doesn't affect the original
copy.b.c = 20       // DOES affect the original! b is the SAME reference
console.log(original.b.c)  // 20 — classic "shallow copy" bug
```

Immutability — not mutating existing objects, but creating new states from them — is the antidote: whoever receives the object can play without breaking anyone else's universe.

### Shallow vs. deep copy

```javascript
// shallow: the first level is copied, the second is shared
const deep = structuredClone(original)   // ES2022+, native deep copy
deep.b.c = 30
console.log(original.b.c)  // 20 — no side effect

// structuredClone also handles Date, Map, Set, RegExp:
const obj = {
  date: new Date(),
  map: new Map([["a", 1]]),
  regex: /pattern/g,
  arr: [{ x: 1 }],
}
const clone = structuredClone(obj)
console.log(clone.map instanceof Map)   // true
```

**Honest limits**: `structuredClone` doesn't copy **functions**, DOM nodes, and loses the prototype of class instances (it clones plain data). For those, manual copy or a library.

### Immutable update when state changes

```javascript
const state = { counter: 0, list: [1, 2] }

// ❌ Mutation at will: breaks whoever holds the old reference
state.counter++
state.list.push(3)

// ✅ New object, same content, code shared as much as you can:
const newState = {
  ...state,
  counter: state.counter + 1,
  list: [...state.list, 3],
}
```

This pattern is the basis of *change detection* in React/Redux and Vue's `reactive`: comparing by reference is cheap; deep content comparison is expensive.

### `Object.freeze` (and its limit)

```javascript
const config = Object.freeze({ api: { url: "https://api.example.com" } })
config.api.url = "hack"    // ✅ doesn't throw: freeze is shallow and this is silent non-strict mode
// in strict mode: TypeError

// recursive freeze:
function deepFreeze(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      deepFreeze(obj[key])
    }
  }
  return Object.freeze(obj)
}

const safeConfig = deepFreeze({
  api: { url: "https://api.example.com", timeout: 5000 },
  debug: true,
})
safeConfig.api.url = "hack"  // TypeError: object is not extensible
```

### Connection with Python

Python serves it up with tuples and `copy`:

```python
import copy

original = {"a": 1, "b": {"c": 2}}
copied = copy.deepcopy(original)        # deep copy (vs copy.copy shallow)
copied["b"]["c"] = 30
print(original["b"]["c"])               # 2 — untouched

point = (1, 2)                          # tuple: immutable by construction
```

**Exact translation**: `structuredClone` ↔ `copy.deepcopy`, and `Object.freeze` ↔ `types.MappingProxyType` or combined `@dataclass(frozen=True)`. The immutable update (`{ ...state, counter: +1 }`) is the same `dataclasses.replace(state, counter=state.counter+1)`.

**Underlying change**: in Python, immutability **by construction** exists (`tuple`, `frozenset`, strings): you can't *accidentally* inherit mutability. In JavaScript, nothing is immutable by default: `Object.freeze` is *after the fact* and shallow. `structuredClone` copies data structures, but `deepcopy` also clones **class instances** — and refuses functions (or warns), just as JS rejects functions. The practical difference: Python dicts compare by *content* (`==`), JS objects by reference — so "did it change?" is trivial to detect in Python and forces copy+compare in JS.

### Connection with Java

Java is the grandfather of defensive immutability: `java.util.Collections.unmodifiableList`, `List.of`, records:

```java
List<String> immutable = List.of("a", "b");   // natively immutable list
immutable.add("c");                           // UnsupportedOperationException
```

**Exact translation**: `List.of` and `Set.of` give de facto immutable collections, like `Object.freeze` — but at the container level (Java doesn't freeze the elements it holds, same as `freeze` freezing shallowly).

**Underlying change**: in Java, "copy with a change" happens via *copy-on-write* (`withEmail` on records), and records are **immutable by design** (`final` fields). JavaScript wins with `structuredClone` (Java has no structural deep clone without libraries like Jackson) and loses because it offers you nothing like a `record` type: you have to self-police. Also, in Java it's *common* for the compiler to force you to declare "this thing is immutable"; in JS the only runtime shield is `Object.freeze`, with its shallow limit.

---

## Practice and exercises

Try to solve each challenge mentally or in code **before** opening the collapsible solutions.

### 1. Review questions

<details>
<summary><b>1. Why does `new Map()`, `map.set(key, value)`, then `map.get({ id: 1 })` return `undefined` even though you inserted `{ id: 1 }` as a key?</b></summary>

**Explanation**: Because `Map` uses **reference equality** (SameValueZero), not content equality. The `{ id: 1 }` you pass to `get` is a **different object** in memory from the one you used in `set`, so it doesn't exist as a key. In a plain object the opposite happens: keys are coerced to strings and `obj[{a:1}]` and `obj[{a:1}]` collide in the same `"[object Object]"` slot.
</details>

<details>
<summary><b>2. Why does `WeakMap` forbid iterating with `for...of`, having `.size`, and using primitive keys?</b></summary>

**Explanation**: Because its keys are **weak references**: the GC can free the object and its associated entry at any instant. If you could iterate or know the size, you'd be reading a collection whose contents change underneath you (already-collected objects, unstable order). Restricting keys to objects guarantees that "the reference you use" is the same as "the weak reference" — with primitives (always present) there'd be no point being weak.
</details>

<details>
<summary><b>3. `for...of` over an iterator that never returns `{ done: true }` — what happens?</b></summary>

**Explanation**: That's the definition of an **infinite loop**: `for...of` keeps calling `next()` without stopping until the process dies or the user cancels it. "Infinite" generators are safe only when combined with `take`/`limit` (iterator helpers, `itertools.islice`, `Stream.limit`) that cut off consumption after N values.
</details>

<details>
<summary><b>4. `const a = { x: 1 }; const b = { ...a }; b.x = 2;` Does `a.x` change? And what if `a` were `{ x: { y: 1 } }` and you mutated `b.x.y`?</b></summary>

**Explanation**: With `b.x = 2`, `a.x` doesn't change: spread copies the first level, so `a` and `b` have their own objects at `x`. But if `a.x` is an object and you do `b.x.y = 5`, **yes**, `a.x.y` changes, because `b.x` and `a.x` point at the **same reference**: the spread was shallow. To break that sharing you need `structuredClone`.
</details>

---

### 2. Explain it in your own words

> **Challenge**: Explain to a friend coming from Python the difference between **iterable** and **iterator**, and why generators can be infinite without running out of memory, using the metaphor of a **water tap** (the generator is the tap: it drips only when you turn the handle, it doesn't store the whole river). Then say how that is like and unlike a Python `yield`.
> *Hint: if you hesitate, reread [Section 4](#4-generators-function-yield-yield) and the Python connection in [Section 3](#3-the-iteration-protocol-iterables-and-iterators).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): `Map` cache, `Set` uniques, and counting

**Goal**: Encapsulate three of the `Map`/`Set` utilities into a small functions file a utils package would ship.

**Statement**:
1. Write `createCache()` returning an object with `put(key, value)` and `get(key)` using an internal `Map`, allowing keys of **any type** (including objects by reference).
2. Write `uniqueOnly(list)` that returns the unique elements of an array **respecting first-appearance order** — hint: `[...new Set(list)]`.
3. Write `count(list)` returning a `Map` of the frequency of each item (`["a","b","a","c","a"]` → `Map { "a" => 3, "b" => 1, "c" => 1 }`).

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. `createCache` keeps an internal `Map`; keys compare by **reference**, not by value.
2. `uniqueOnly` is literally `[...new Set(list)]`: `Set` dedups and spread preserves order.
3. `count` accumulates with `freq.set(item, (freq.get(item) ?? 0) + 1)`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function createCache() {
  const data = new Map()
  return {
    put(key, value) {
      data.set(key, value)
      // Map does NOT coerce keys to strings:
      // { id: 1 } is a different key from a new { id: 1 }.
    },
    get(key) {
      return data.get(key)
    },
    size() {
      return data.size   // O(1) — no Object.keys counting
    },
  }
}

const cache = createCache()
const ref = { user: 7 }
cache.put(ref, "profile loaded")
console.log(cache.get(ref))              // "profile loaded"
console.log(cache.get({ user: 7 }))      // undefined — another reference

function uniqueOnly(list) {
  return [...new Set(list)]   // Set dedupes, spread respects order
}
console.log(uniqueOnly(["a", "b", "a", "c", "a"]))  // ["a", "b", "c"]

function count(list) {
  const frequencies = new Map()
  for (const item of list) {
    frequencies.set(item, (frequencies.get(item) ?? 0) + 1)
  }
  return frequencies
}
console.log([...count(["a", "b", "a", "c", "a"])])
// [["a", 3], ["b", 1], ["c", 1]]
```

**Why does it work?** `Map` accepts each key by **reference** (`cache.get({user:7})` fails precisely to show it), `Set` dedupes in O(n) total (not O(n²) like `filter+indexOf`), and the `?? 0` in `count` is the default for keys that don't exist yet. The result: three utilities that would be more fragile or slower on plain objects.
</details>

---

#### Exercise 2 (Intermediate): Lazy "paged" results with generator + iterator helpers

**Goal**: simulate pagination over a large source with generators and `take`/`drop` without bringing everything into memory.

**Specs**:
1. `generateRows(n)`: a generator producing `{ id, name }` from `1` to `n`.
2. `page(pageNumber, perPage)`: using `drop` and `take` with iterator helpers, returns only the requested page as an array.
3. Verify: `page(2, 3)` over 10 rows → rows 4, 5, 6.
4. Reflection: what happened in memory? How much did the generator really "compute"?

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. `function* generateRows(n)` yields `{ id, name }` from `1` to `n`.
2. `page(pageNumber, pageSize)` = `generateRows(...).drop((pageNumber - 1) * pageSize).take(pageSize).toArray()`.
3. `drop` and `take` are **lazy**: the generator only produces what's asked, not the earlier rows.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function* generateRows(n) {
  for (let id = 1; id <= n; id++) {
    yield { id, name: `Row ${id}` }
  }
}

function page(pageNumber, perPage) {
  const skip = (pageNumber - 1) * perPage
  return generateRows(10)
    .drop(skip)       // discards the earlier ones (lazy)
    .take(perPage)    // takes only this page's rows (lazy)
    .toArray()        // materializes here, and only `perPage` rows
}

console.log(page(2, 3))
// [{ id: 4, name: "Row 4" }, { id: 5, name: "Row 5" }, { id: 6, name: "Row 6" }]

// Without iterator helpers you'd have to do it by hand:
function manualPage(pageNumber, perPage) {
  const start = (pageNumber - 1) * perPage
  const result = []
  let index = 0
  for (const row of generateRows(10)) {
    if (index >= start && index < start + perPage) result.push(row)
    if (result.length === perPage) break
    index++
  }
  return result
}
```

**Why does it work?** `drop` and `take` are **lazy**: the generator only advances as far as needed (4 `next()` calls for page 2 of 3). Memory used is `perPage` rows, not 10. The manual version is the "reference implementation": if you ever doubt what the pipeline does, compare it against this.
</details>

---

#### Exercise 3 (Advanced): Living metadata with `WeakMap` and (bonus) `yield*` delegation

**Goal**: combine a `WeakMap` for metadata that doesn't leak memory, a `WeakSet` for "already processed," and a delegating generator to walk results.

**Requirements**:
1. `createTracker()`: returns `{ register(item), isNew(item) }` backed by a `WeakSet` — a registered object is "not new."
2. `createVisitCounter()`: `WeakMap` keyed by object to a number — `add(object)` increments safely, `get(object)` returns 0 if never visited.
3. A `mergeWalk(...collections)` function that with `yield*` iterates all passed collections as one sequence.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. `WeakSet` for `register`/`isNew`: it doesn't iterate and lets the GC free the key object.
2. `WeakMap` for the visit counter: `get(obj)` returns `visits.get(obj) ?? 0`.
3. `mergeWalk` = `for (const col of collections) yield* col` — `yield*` delegates to each iterable.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function createTracker() {
  const seen = new WeakSet()
  return {
    register(item) {
      seen.add(item)
    },
    isNew(item) {
      return !seen.has(item)   // WeakSet doesn't leak: when item dies, it leaves on its own
    },
  }
}

const tracker = createTracker()
const a = { id: 1 }, b = { id: 2 }
console.log(tracker.isNew(a))   // true
tracker.register(a)
console.log(tracker.isNew(a))   // false
console.log(tracker.isNew(b))   // true — another object, another reference

function createVisitCounter() {
  const visits = new WeakMap()
  return {
    add(object) {
      visits.set(object, (visits.get(object) ?? 0) + 1)
    },
    get(object) {
      return visits.get(object) ?? 0
    },
  }
}

const counter = createVisitCounter()
counter.add(a)
counter.add(a)
counter.add(b)
console.log(counter.get(a))  // 2
console.log(counter.get(b))  // 1
// If one day `a` or `b` disappear, their counters go with them: no leak.

function* mergeWalk(...collections) {
  for (const collection of collections) {
    yield* collection          // delegates: pours everything from this collection
  }
}

console.log([...mergeWalk([1, 2], new Set([3, 4]), "ab")])
// [1, 2, 3, 4, "a", "b"] — generator, Set and string, all iterable
```

**Why does it work?** `WeakSet`/`WeakMap` tie life to the life of the key object — no manual cleanup. `yield*` shows the iteration protocol being a **universal citizen**: it walks generators, sets, and strings alike because they all implement `Symbol.iterator`. Note: with `WeakMap` you can't iterate the counters at the end — if you need to "enumerate visits," make the key an object that lives (your domain), not fleeting data.
</details>

---

## Debugging in practice

### Scenario 1: The memory that kept climbing in a management SPA

**Situation**: A web admin app keeps a "tasks" view open for hours. Each card's detail holds interaction metadata. Your team notices RAM growing steadily until the browser freezes. Why?

**Diagnosis**:
- **Likely cause**: metadata is stored in a global `Map` keyed by card (object). Every time the user opens another view, the old card stops existing for the DOM… but the `Map` **holds the reference strongly**: because the `Map` has the key, that card can never be collected, and with it its metadata and whatever data it drags along.
- **Debugging**: check how many "dead" objects remain in the `Map`. The inspector's memory heap will tell you: thousands of surviving cards with strong references.
- **Solution**: move the metadata to a `WeakMap`. When the card leaves the DOM and loses its references, the GC frees the whole pair. The counters that "get lost" are exactly the ones you wanted to lose: data about things that no longer exist. "Collector" in the name isn't decoration — it's a promise `Map` doesn't keep and `WeakMap` does.

---

### Scenario 2: The `for...of` that devoured the server

**Situation**: In a processing script you write `for (const item of products()) total += item.price` and the server runs out of CPU. `products()` is a function that "should" give N products.

**Diagnosis**:
- **Likely cause**: `products()` is an **infinite generator or iterable** with no `take`. It walks forever: with no limit, the `for...of` never sees `done` flip to true and burns the CPU looking for… more.
- **Debugging**: check whether the function returns an iterable that actually terminates (`done: true`) or one of the "yield forever" kind. Distrust any `while (true)` with no exit condition.
- **Solution**: go with `take(N)` (iterator helpers), e.g. `for (const item of products().take(1000))`, or force a limit in the generator. Get in the habit of asking: *"if this loop has no explicit exit condition, who stops it?"*

---

## Comparison table across languages

### JavaScript vs. Python

| Feature | JavaScript | Python |
|---|---|---|
| **Key-value with non-string keys** | `Map` (objects by reference). | `dict` requires *hashable* keys. `{id:1}` as key = TypeError. |
| **Unique values** | `Set` (O(1), insertion order). | `set` (O(1), unordered). |
| **Weak keys/values** | `WeakMap`/`WeakSet` (not iterable). | `weakref.WeakKeyDictionary`/`WeakSet` (iterable, with `len`). |
| **Unified iteration** | `Symbol.iterator` + `next()` → `{value, done}`. | `__iter__`/`__next__` + StopIteration. |
| **Generators** | `function*`/`yield` (lazy, two-way `next(v)`). | `def`/`yield` (lazy, `.send(v)` two-way). |
| **Lazy pipelines** | Iterator helpers ES2025 (`.filter().take()`). | `itertools.islice/takewhile/chain`. |
| **Destructuring** | Objects by key + arrays by position. | Tuples/position + `*rest`, not by name. |
| **Deep copy / immutability** | `structuredClone`; nothing immutable by default. | `copy.deepcopy`; `tuple`/`frozenset` by design. |

### JavaScript vs. Java

| Feature | JavaScript | Java |
|---|---|---|
| **Ordered map** | `Map` (keeps insertion). | `LinkedHashMap`; `HashMap` order not guaranteed. |
| **Weak key-value** | `WeakMap` (weak key). | `WeakHashMap` (same scheme, limited use). |
| **Unified iteration** | `Symbol.iterator` + `next()`. | `Iterator<E>` with `hasNext`/`next`. |
| **Generators** | `function*`/`yield` (native). | None; streams/iterators by hand. |
| **Lazy pipelines** | Iterator helpers (ES2025). | `Stream` (`filter`/`limit`/`toList`, optional `.parallel()`). |
| **Destructuring** | By name/property at runtime. | Records + pattern matching (Java 21). |
| **Immutability** | Copy + `Object.freeze` (shallow). | `List.of`, records (immutable by design). |

---

## Chapter summary

1. **`Map` accepts keys of any type** (by reference) and keeps insertion order; an object only accepts strings as keys.
2. **`Set` is an array without duplicates** with O(1) lookup: dedup is `[...new Set(arr)]`, and beware type equality (`1 !== "1"`).
3. **`WeakMap`/`WeakSet` use weak references**: associated data freed when its key dies. In exchange, not iterable, no `.size`, and only objects as keys.
4. **The iteration protocol (iterable → `Symbol.iterator` → iterator with `next()`) unifies** `for...of`, spread, and destructuring over arrays, strings, maps, sets, and your own objects.
5. **Generators pause and resume**: infinite sequences without exhausting memory, with `yield*` to delegate and `next(value)` to push data inward.
6. **Iterator helpers (ES2025) make lazy pipelines**: `filter().take().reduce()` without materializing intermediate arrays.
7. **Destructuring extracts by name or position**; spread copies **shallow** (nested objects are shared), and `structuredClone` gives the native deep copy.

---

## Next Chapter

→ **[Chapter 6: Error Handling and Debugging](./cap-06)**: Now that you know how to organize and walk through data, we move to errors: how to throw them, wrap them with context, and make debugging something you can control — with their Python and Java counterparts in view.