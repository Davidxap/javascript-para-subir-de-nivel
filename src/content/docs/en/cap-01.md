---
title: "Chapter 1: Modern Functions, Destructuring, and Lexical Scope"
---

# Chapter 1: Modern Functions, Destructuring, and Lexical Scope

> Understanding the internal mechanics of execution contexts, closures, and lexical scope is the dividing line between writing JavaScript by guessing and writing JavaScript with precision.

## Introduction

JavaScript functions are not merely blocks of reusable logic: they are **first-class objects** that carry their surrounding lexical scope wherever they go.

Many elusive bugs in modern applications—unintended memory retention, loss of `this` context across asynchronous boundaries, variables overwritten due to scoping confusion—stem from relying on superficial intuitions rather than mastering the execution model.

---

## 1. Fundamentals: Declarations, Expressions, and Scope

### The problem: How Do We Structure and Isolate Logic?

When structuring code, deciding between a function declaration and a function expression changes how the JavaScript engine reads your file before executing a single line.

```javascript
// Function Declaration: fully hoisted
function calculateTotal(items) {
  return items.reduce((acc, item) => acc + item.price, 0)
}

// Function Expression: variable declaration is hoisted, but not the function assignment
const calculateTax = function(total, rate = 0.19) {
  return total * rate
}
```

### Function declaration vs. function expression

```javascript
// 1. Function Declaration
// The engine registers it fully before executing the first line of code (hoisting)
console.log(sumar(5, 3)) // 8 (works even though it sits before its definition)

function sumar(a, b) {
  return a + b
}

// 2. Function Expression
// Only the variable 'restar' is declared; the function is assigned when execution reaches this line
// console.log(restar(5, 3)) // ReferenceError (with let/const) or TypeError (with var)

const restar = function (a, b) {
  return a - b
}
console.log(restar(5, 3)) // 2
```

> **Engine note**: this difference comes from **hoisting**, which we examine in depth in [Section 7](#7-execution-contexts-and-hoisting).

### Scope: where variables live and die

JavaScript has three layers of scope:
1. **Global Scope**: Accessible everywhere.
2. **Function Scope**: Created when a function executes.
3. **Block Scope** (`let` / `const`): Enclosed by curly braces `{ ... }`.

```javascript
function processOrder() {
  if (true) {
    var legacyVar = "I leak outside this block"
    let modernLet = "I am strictly block-scoped"
  }
  console.log(legacyVar) // "I leak outside this block"
  // console.log(modernLet) // ReferenceError: modernLet is not defined
}
```

---

## 2. Destructuring and Rest/Spread Operators

### The problem: Verbose and Repetitive Data Extraction

Extracting values from complex configuration objects or API payloads manually results in brittle, repetitive boilerplate:

```javascript
// Verbose approach
function setupDatabase(config) {
  const host = config.host || "localhost"
  const port = config.port || 5432
  const user = config.credentials ? config.credentials.user : "root"
}
```

### The declarative solution: Destructuring with Safe Defaults

```javascript
function setupDatabase({
  host = "localhost",
  port = 5432,
  credentials: { user = "root" } = {}
} = {}) {
  return `Connecting to ${host}:${port} as ${user}`
}

console.log(setupDatabase()) // "Connecting to localhost:5432 as root"
```

### Rest (`...`) vs. Spread (`...`)

- **Rest (`...`)**: Gathers multiple elements into a single array structure (in function parameters or destructuring patterns).
- **Spread (`...`)**: Expands an iterable into individual elements (in array literals, object clones, or function calls).

```javascript
// Rest operator gathers arguments
function logEvents(category, ...events) {
  console.log(`[${category}] Events:`, events)
}

// Spread operator expands objects
const baseConfig = { env: "production", retries: 3 }
const appConfig = { ...baseConfig, debug: false }
```

---

## 3. Arrow Functions and Lexical `this`

### The problem: Dynamic and Unpredictable `this`

In traditional functions, `this` is bound dynamically based on **how** and **where** the function is invoked, leading to context loss inside callbacks and event handlers:

```javascript
function Timer() {
  this.seconds = 0
  
  // Traditional function inside setInterval loses 'this' context
  setInterval(function() {
    // this.seconds++ // 'this' binds to window/global in non-strict mode
  }, 1000)
}
```

### The solution: Arrow Functions (`=>`)

Arrow functions do **not** define their own `this`, `arguments`, `super`, or `new.target`. Instead, they inherit `this` lexically from their enclosing parent execution context:

```javascript
function ModernTimer() {
  this.seconds = 0
  
  setInterval(() => {
    this.seconds++ // 'this' predictably references the ModernTimer instance
  }, 1000)
}
```

### When NOT to Use Arrow Functions

1. **Object Methods** that need dynamic `this` referencing the calling instance.
2. **DOM Event Listeners** where `this` is expected to bind to `event.currentTarget`.
3. **Constructor Functions**: Arrow functions lack a `[[Construct]]` internal method and cannot be called with `new`.

### Connection with Python

```python
# Python - Lambdas and Explicit Methods
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def display(self):
        print(f"Owner: {self.owner}, Balance: {self.balance}")

# Python lambdas are concise single-expression anonymous functions
double = lambda x: x * 2
```

**Translates exactly**: Python lambdas and JavaScript arrow functions are both lightweight anonymous functions primarily used as callbacks.  
**Core difference**: In Python, method binding is explicit via `self`. Python methods never lose their context regardless of where they are passed.

### Connection with Java

```java
// Java 8+ - Lambda Expressions with Functional Interfaces
import java.util.function.Function;

public class LambdaDemo {
    public static void main(String[] args) {
        Function<Integer, Integer> doubleNum = x -> x * 2;
        System.out.println(doubleNum.apply(5)); // 10
    }
}
```

**Translates exactly**: Java lambdas and JS arrow functions both capture effectively final variables from their surrounding scope.  
**Core difference**: Java lambdas compile down to functional interfaces (`Function`, `Consumer`, etc.) with strict compile-time types. In JavaScript, arrow functions are first-class callable objects without nominal interfaces.

---

## 4. Higher-Order Functions (HOF)

### The problem: Duplication of Control Flow Patterns

Manually looping through collections with `for` loops duplicates index management, state mutations, and boundary checks across the entire codebase.

### The declarative solution: Functions Accepting or Returning Functions

```javascript
const transactions = [
  { id: 1, amount: 150, category: "books" },
  { id: 2, amount: -40, category: "food" },
  { id: 3, amount: 300, category: "electronics" }
]

// Pure data transformation pipeline using HOFs
const totalIncome = transactions
  .filter(t => t.amount > 0)
  .map(t => t.amount)
  .reduce((sum, amount) => sum + amount, 0)

console.log("Total Income:", totalIncome) // 450
```

### Receiving functions as arguments

```javascript
const precios = [100, 250, null, 400, undefined, 80]

const preciosValidos = precios
  .filter(p => typeof p === "number")
  .map(p => +(p * 1.19).toFixed(2))
  .filter(p => p > 150)

console.log(preciosValidos) // [ 297.5, 476 ]
```

### Functions that return functions (logic generators)

```javascript
// Validator generator
const crearFiltroRango = (min, max) => valor => valor >= min && valor <= max

const esPrecioMedio = crearFiltroRango(100, 300)
console.log(esPrecioMedio(150)) // true
console.log(esPrecioMedio(50))  // false
```

### Function composition (pipeline)

Composition lets you chain small, pure functions to build complex data flows:

```javascript
// Generic composition function (right to left)
const componer = (...funciones) => valorInicial =>
  funciones.reduceRight((acumulado, fn) => fn(acumulado), valorInicial)

// Small, testable building blocks
const limpiarTexto = str => str.trim()
const aMayusculas = str => str.toUpperCase()
const agregarPrefijo = str => `[LOG]: ${str}`

// Create a reusable pipeline
const formatearMensaje = componer(agregarPrefijo, aMayusculas, limpiarTexto)

console.log(formatearMensaje("   error en base de datos   "))
// Output: "[LOG]: ERROR EN BASE DE DATOS"
```

---

## 5. Closures: Lexical Closures

### What Is a Closure?

A **closure** is the combination of a function and the **lexical environment** within which that function was declared. In simple terms: an inner function always retains access to the variables of its outer function, even after the outer function has completed execution.

### Example 1: Encapsulation and Private State

```javascript
function createCounter(initialValue = 0) {
  let count = initialValue // Private state protected by closure

  return {
    increment() {
      count++
      return count
    },
    decrement() {
      count--
      return count
    },
    getValue() {
      return count
    }
  }
}

const counter = createCounter(10)
console.log(counter.increment()) // 11
console.log(counter.increment()) // 12
console.log(counter.getValue())  // 12
// 'count' is completely inaccessible from the outside scope
```

### Example 2: The Classic Loop Trap (`var` vs. `let`)

```javascript
// Broken with 'var': single shared binding in function scope
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 100) // Prints: 3, 3, 3
}

// Fixed with 'let': creates a fresh lexical binding per iteration
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 100) // Prints: 0, 1, 2
}
```

### Connection with Python

```python
# Python - Closures with the 'nonlocal' keyword
def make_counter(start=0):
    count = start

    def increment():
        nonlocal count # Required in Python to reassign outer scope variables
        count += 1
        return count

    return increment

c = make_counter(5)
print(c()) # 6
print(c()) # 7
```

**Translates exactly**: Inner functions in both languages remember outer scope variables across executions.  
**Core difference**: In Python, you must explicitly declare `nonlocal` to mutate an outer variable. In JavaScript, mutation of enclosed variables is implicit.

### Connection with Java

```java
// Java - Anonymous Classes / Lambdas and Effectively Final Variables
import java.util.function.Supplier;

public class ClosureDemo {
    public static Supplier<Integer> makeCounter(final int start) {
        // Java requires enclosed local variables to be 'final' or 'effectively final'
        return () -> start + 1; // Cannot directly mutate primitive 'start'
    }
}
```

**Translates exactly**: Java lambdas can capture state from their enclosing method scope.  
**Core difference**: Java **forbids** mutating local variables captured in a lambda (`effectively final` constraint). In JavaScript, closures maintain a direct live reference to the heap-allocated lexical environment, allowing unrestricted reads and writes.

---

## 6. Currying and Partial Application

### The problem: Repetitive Arguments in Reusable Functions

```javascript
// Without currying
function log(date, level, message) {
  console.log(`[${date.toISOString()}] [${level}] ${message}`)
}

// Repetitive calls
log(new Date(), "ERROR", "Failed to connect to database")
log(new Date(), "ERROR", "Failed to load user profile")
```

### The solution: Transforming Multi-Argument Functions

Currying transforms a function `f(a, b, c)` into a sequence of unary functions `f(a)(b)(c)`:

```javascript
const curryLog = date => level => message => {
  console.log(`[${date.toISOString()}] [${level}] ${message}`)
}

// Create specialized logger presets
const logToday = curryLog(new Date())
const logErrorToday = logToday("ERROR")

logErrorToday("Database timeout")
logErrorToday("Missing auth token")
```

---

## 7. Execution Contexts and Hoisting

### How JavaScript Reads Your Code

The engine processes code in two distinct phases:

1. **Creation Phase**:
   - Creates the Global Object (`window` or `global`).
   - Sets up the `this` binding.
   - Registers variables and function declarations in memory (**Hoisting**).
2. **Execution Phase**:
   - Executes code line by line, assigning values and invoking functions.

### Hoisting and the Temporal Dead Zone (TDZ)

- `var`: Initialized with `undefined` during creation phase.
- `let` and `const`: Registered in memory during creation phase, but **uninitialized**. Accessing them before their declaration line throws a `ReferenceError` because they sit in the **Temporal Dead Zone (TDZ)**.

```javascript
// console.log(a) // ReferenceError: Cannot access 'a' before initialization (TDZ)
let a = 10

console.log(b) // undefined (Hoisted and initialized with undefined)
var b = 20
```

---

## 8. Memory Management: Stack, Heap, and Garbage Collection

### Where Do Variables Live?

- **Call Stack**: Fast, contiguous memory storing primitive values and execution frames.
- **Memory Heap**: Unstructured memory pool for complex data (Objects, Arrays, Closures).

```
CALL STACK                         MEMORY HEAP
┌───────────────────────────┐      ┌───────────────────────────────┐
│ Execution Context (Frame) │      │ Object: { name: "David" }    │
│ ptr ──────────────────────┼─────►│                               │
│ primitive: 42             │      │ Closure Lexical Environment   │
└───────────────────────────┘      └───────────────────────────────┘
```

### Garbage Collection: Mark-and-Sweep

The engine's Garbage Collector periodically traverses memory starting from **Roots** (global variables, current call stack frames). Any object unreachable from the root set is marked and reclaimed.

### Connection with Java

**Literal translation**: Both the Java JVM and the JavaScript V8 engine use automatic garbage collectors with tracing algorithms based on reachability roots (*GC Roots*).  
**Change of scene**: In Java you can tune the collector (G1, ZGC) and monitor memory with native JVM tools. In JavaScript, GC runs completely opaquely in the background with no direct developer control.

---

## 9. The Event Loop and Non-Blocking Concurrency

### The problem: JavaScript is single-threaded

JavaScript operates on a single main thread. Asynchronous I/O operations are offloaded to host environment Web APIs / C++ threads (in Node.js via `libuv`).

```
┌─────────────────┐       ┌─────────────────┐
│   CALL STACK    │       │    WEB APIs     │
│ (synchronous)   │──────►│ (Timer/Fetch)   │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ checks                  ▼
┌────────┴────────┐       ┌─────────────────┐
│   EVENT LOOP    │◄──────│ MICROTASK QUEUE │ (Promises, queueMicrotask)
└─────────────────┘       ├─────────────────┤
                          │ MACROTASK QUEUE │ (setTimeout, setInterval, I/O)
                          └─────────────────┘
```

### Priority Rule: Microtasks vs. Macrotasks

The Event Loop **always exhausts the entire Microtask Queue** before picking the next Macrotask from the Macrotask Queue.

```javascript
console.log("1: Synchronous")

setTimeout(() => {
  console.log("4: Macrotask (setTimeout)")
}, 0)

Promise.resolve().then(() => {
  console.log("2: Microtask 1 (Promise)")
}).then(() => {
  console.log("3: Microtask 2 (Promise chained)")
})

console.log("5: Synchronous End")

// Output:
// 1: Synchronous
// 5: Synchronous End
// 2: Microtask 1 (Promise)
// 3: Microtask 2 (Promise chained)
// 4: Macrotask (setTimeout)
```

### Connection with Python

```python
import asyncio

async def tarea():
    print("1. Start")
    # asyncio simulates the cooperative event queue
    await asyncio.sleep(0)
    print("2. Resumed after event loop cycle")

# asyncio.run(tarea())
```

**Literal translation**: Both use an *event loop* to coordinate asynchronous tasks without blocking the main thread.  
**Change of scene**: In JavaScript the Event Loop is the heart of the runtime and is always active. In Python the event loop is a library (`asyncio`) that you must instantiate and run explicitly.

### Connection with Java

```java
// Java: traditional blocking multi-thread model
public class ServidorDeHilos {
    public static void main(String[] args) {
        // Each request usually runs on its own OS thread (or a Virtual Thread with Java 21+)
        Thread hilo = new Thread(() -> {
            System.out.println("Processing on thread: " + Thread.currentThread().getName());
        });
        hilo.start();
    }
}
```

**Literal translation**: Both can process multiple concurrent input/output (I/O) operations.  
**Change of scene**: Java traditionally uses operating-system threads that can safely block without stopping other threads. JavaScript never blocks its single main thread; it delegates I/O to the OS through callbacks on the Event Loop.

---

## Practice and exercises

Test your understanding mentally and in code **before** expanding solutions.

### 1. Review questions

<details>
<summary><b>1. Why does <code>const</code> not prevent modifying the internal properties of an object?</b></summary>

**Explanation**: `const` protects the **variable binding**, not the value it points to in memory. The variable stores a reference pointer to an address in the Heap. Modifying a property changes the Heap payload, but the pointer held by the variable remains unchanged. To enforce immutability, use `Object.freeze()`.
</details>

<details>
<summary><b>2. If an outer function finishes executing, why is its lexical scope not garbage-collected when a closure exists?</b></summary>

**Explanation**: Because the Mark-and-Sweep garbage collector traces references from active roots. As long as the returned inner function remains accessible in the program, it holds a direct reference to its outer lexical environment in the Heap, keeping it reachable and alive.
</details>

<details>
<summary><b>3. In the Event Loop, what happens if a Microtask continuously schedules another Microtask recursively?</b></summary>

**Explanation**: It starves the Event Loop (*Microtask Starvation*). Because the engine must completely empty the Microtask Queue before rendering the UI or picking the next Macrotask, timers, UI rendering, and user input events will freeze completely.
</details>

---

### 2. Explain it in your own words

> **Challenge**: Explain what a *closure* is to a colleague who only knows basic Java or Python, without using the words "lexical environment" or "scope chain". Use a real-world backpack analogy.  
> *If you hesitate on how values travel in memory, review [Section 5](#5-closures-lexical-closures).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): Clean Configuration with Destructuring

**Objective**: Refactor a verbose configuration function into a declarative, error-safe pattern with defaults.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Destructure right in the signature: `({ port = 8080, host = "localhost", ... } = {})`.
2. For nesting, destructure `security: { ssl = false }`.
3. The trailing `= {}` (on the signature) and the nested `= {}` prevent a `TypeError` when the object or `security` is missing.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
const configureServer = ({
  port = 8080,
  host = "localhost",
  security: { ssl = false } = {}
} = {}) => {
  const protocol = ssl ? "https" : "http"
  const sslStatus = ssl ? "active" : "inactive"
  return `Server running on ${protocol}://${host}:${port} (SSL: ${sslStatus})`
}

console.log(configureServer()) 
// "Server running on http://localhost:8080 (SSL: inactive)"

console.log(configureServer({ port: 3000, security: { ssl: true } }))
// "Server running on https://localhost:3000 (SSL: active)"
```

**Why does it work?** The double `= {}` — one on the signature and one in the nested `security` destructuring — makes everything optional. Calling `configureServer()` with no arguments, or without `security`, falls back to the defaults instead of throwing a `TypeError` while reading properties of `undefined`.
</details>

---

#### Exercise 2 (Intermediate): Encapsulated Shopping Cart (Closure)

**Objective**: Implement a shopping cart module that keeps its internal items completely private without using classes or `this`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Declare `const items = []` **inside** `createCart`; since you never return it, it stays inaccessible (hidden by the closure).
2. The returned methods reach `items` through lexical closure, not `this`.
3. For `list()`, return a new array of new objects: `items.map(item => ({ ...item }))`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function createCart() {
  const items = [] // Private state protected by closure

  return {
    add(name, price, quantity = 1) {
      if (!name || price <= 0) throw new Error("Invalid item data")
      items.push({ name, price, quantity })
    },
    getTotal() {
      return items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      )
    },
    list() {
      // Return shallow copies to prevent external mutations
      return items.map(item => ({ ...item }))
    }
  }
}

const cart = createCart()
cart.add("Laptop", 1200)
cart.add("Mouse", 25, 2)

console.log("Total:", cart.getTotal()) // 1250
const productList = cart.list()
productList[0].price = 0 // Attempt external tampering
console.log("Real Total:", cart.getTotal()) // 1250 (Intact!)
```

**Why does it work?** `items` lives in `createCart`'s lexical environment and is never exposed: only the returned methods see it by closure. `list()` returns copies (`map` + spread), so mutating `productList[0].price` changes the copy, not the private state — which `getTotal()`'s `reduce` still reads intact.
</details>

---

#### Exercise 3 (Advanced): Middleware pipeline with Currying and Composition

**Objective**: Design an HTTP request-processing system inspired by modern frameworks (Express/Koa) using functional composition.

**Requirements**:
1. Each middleware is a function `context => newContext`.
2. Implement `createPipeline(...middlewares)` that runs the middlewares in order (left to right).
3. Each middleware must be immutable: it returns a new context object with its changes, without mutating the original.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. `createPipeline` reduces to a `reduce` over the middlewares: each step is `fn(ctx)` on the accumulated context.
2. Each middleware returns a **new** object via spread (`{ ...ctx, ... }`), never mutating `ctx`.
3. Chain in order: the context one produces feeds the next.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
// A 'pipe' function (left-to-right composition)
const createPipeline = (...middlewares) => initialContext =>
  middlewares.reduce((ctx, fn) => fn(ctx), initialContext)

// Pure, individual middlewares
const withTimestamp = ctx => ({
  ...ctx,
  timestamp: Date.now()
})

const withAuthentication = validToken => ctx => ({
  ...ctx,
  user: ctx.headers?.authorization === validToken ? { id: 1, role: "admin" } : null
})

const withNormalizedRoute = ctx => ({
  ...ctx,
  path: ctx.path.toLowerCase().trim()
})

// Assembling the pipeline
const pipeline = createPipeline(
  withTimestamp,
  withNormalizedRoute,
  withAuthentication("secret_token_123")
)

const incomingRequest = {
  path: "  /API/V1/USERS  ",
  headers: { authorization: "secret_token_123" }
}

const processedRequest = pipeline(incomingRequest)
console.log(processedRequest)
/*
{
  path: '/api/v1/users',
  headers: { authorization: 'secret_token_123' },
  timestamp: 1784800000000,
  user: { id: 1, role: 'admin' }
}
*/
```

**Why does it work?** `createPipeline` is left-to-right composition: `reduce` passes the initial context to the first middleware, and each result feeds the next. Each middleware is pure and immutable — it returns `{ ...ctx, newField }` — so the order is respected and the original `incomingRequest` stays untouched. The currying of `withAuthentication("secret_token_123")` preconfigures the token to build a middleware ready to assemble.
</details>

---

## Debugging in practice

### Scenario 1: Context Loss in Asynchronous Callbacks

**Situation**: A payment processing module invokes a callback after a network delay, but fails with `TypeError: Cannot read properties of undefined (reading 'currency')`.

**Diagnosis**:
- Passing a method like `processor.charge` directly as a callback detaches the function from its object instance, resetting `this` to `undefined` in strict mode.
- **Fix**: Use an arrow function wrapper `() => processor.charge()` or explicitly bind the method using `.bind(processor)`.

---

### Scenario 2: Memory Retention via Accidental Closures

**Situation**: A single-page application experiences gradual memory bloat after rendering and unmounting UI panels repeatedly.

**Diagnosis**:
- Long-lived event listeners or intervals hold references to inner functions that close over large data structures from parent scopes.
- **Fix**: Always tear down event listeners and intervals on component unmount, setting unused references to `null`.

---

## Comparison

### JavaScript vs. Python

| Feature | JavaScript | Python |
|---|---|---|
| **Anonymous Functions** | Arrow functions with full lexical scope (`() => {}`). | `lambda` restricted to a single expression. |
| **Closure Mutation** | Implicit lexical mutation. | Requires explicit `nonlocal` declaration. |
| **Hoisting** | Functions and `var` hoisted; `let`/`const` in TDZ. | No hoisting: definitions must precede usage. |
| **Concurrency** | Single-threaded Event Loop with Microtask Queue. | Synchronous by default; `asyncio` loop. |

### JavaScript vs. Java

| Feature | JavaScript | Java |
|---|---|---|
| **Functions as Types** | First-class objects. | Lambda expressions bound to Functional Interfaces. |
| **Variable Capture** | Live lexical reference in Heap. | Captured variables must be `final` / `effectively final`. |
| **Context (`this`)** | Lexical in arrow functions, dynamic in declarations. | Fixed instance reference in non-static methods. |

---

## Chapter summary

1. **Declarations are hoisted; expressions preserve sequential order**: Prefer `const fn = () => ...` for predictability.
2. **Arrow functions solve dynamic `this`**: They inherit context lexically from their parent scope.
3. **Closures preserve lexical state**: Functions retain access to their birth scope in the Heap.
4. **The Event Loop prioritizes Microtasks**: All Promise callbacks execute before the next Macrotask or render tick.
5. **Clean destructuring guarantees defensive defaults**: Prevent `TypeError` by setting defaults on nested parameters.

---

## Next Chapter

→ **[Chapter 2: Objects, Prototypes, and Classes](./cap-02)**: Now that you master lexical scope and execution contexts, we will explore JavaScript's prototype delegation model, property descriptors, and modern class architecture.
