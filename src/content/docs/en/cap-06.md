---
title: "Chapter 6: Error handling and debugging"
---

# Chapter 6: Error handling and debugging

> Error handling in JavaScript is not just catching exceptions with `try/catch`.

## Introduction

In a production environment (Node.js, Deno, Bun), errors decide whether your system recovers or goes down. This chapter covers the language's error model, building custom error hierarchies, debugging strategies with `node --inspect`, structured logging, observability, and catching unhandled errors at the process level.

**Why it matters**: because proper error handling is the difference between an application that recovers from unexpected problems and one that fails catastrophically. By the end of the chapter you'll know not just *how to catch* errors, but how to decide what to do with each one based on its nature.

---

## 1. `try/catch/finally` and `throw` — the basic model

### The problem: one invalid value in the middle of the function crashes the whole script

Without error handling, a single call with bad data stops execution right where it happens — and the whole script dies without you knowing *what* failed or *where*. JavaScript uses a synchronous exception model: when you throw an error with `throw`, the engine halts normal execution and looks for the nearest `catch` in the call stack. If it finds none, the error propagates to the global context and, in Node.js, can terminate the process. `finally` always runs — error or not — and is the right place to release resources.

### Flow mechanics

1. Code enters the `try` block.
2. If there is **no error**: `try` completes, `catch` is skipped, `finally` runs.
3. If there **is an error**: `try` stops on the error line, `catch` handles the error, `finally` runs.
4. If `finally` has a `return`, it **overrides** any earlier `return` or `throw` — this is a classic bug.

### Example with line-by-line explanation

```javascript
// Function that simulates an operation that can fail
function processPayment(amount, method) {
  if (typeof amount !== "number" || amount <= 0) {
    // We throw an error with a descriptive message
    // 'throw' interrupts execution immediately
    throw new TypeError("The amount must be a positive number")
  }

  if (!method) {
    throw new Error("No payment method specified")
  }

  return { success: true, amount, method }
}

// Usage with try/catch/finally
function tryPayment() {
  let connection

  try {
    // We simulate opening a connection (a resource that must be closed)
    connection = { open: true, close() { this.open = false; console.log("Connection closed") } }

    // This line can throw an error
    const result = processPayment(-100, "card")
    console.log("Payment successful:", result)

  } catch (error) {
    // 'error' is the value thrown by 'throw'
    // Here we decide what to do: log, retry, propagate...
    console.error(`Error caught: ${error.message}`)
    console.error(`Type: ${error.name}`)
    console.error(`Stack:\n${error.stack}`)

    // We can rethrow the error if we don't know how to handle it
    // throw error  // <-- uncomment to propagate

  } finally {
    // finally ALWAYS runs, error or not
    // It is the right place to release resources
    if (connection && connection.open) {
      connection.close()
    }
  }

  // If the error was caught (not rethrown), execution continues here
  console.log("Payment attempt finished")
}

tryPayment()
// Output:
// Error caught: The amount must be a positive number
// Type: TypeError
// Stack: TypeError: The amount must be a positive number\n    at processPayment ...
// Connection closed
// Payment attempt finished
```

### The classic `return` in `finally` bug

```javascript
function calculate() {
  try {
    return 42  // This return should be the result
  } finally {
    return 0   // But finally overrides the try's return!
  }
}

calculate() // 0, not 42

// This also applies to throw:
function launch() {
  try {
    throw new Error("Original error")
  } finally {
    return "recovered"  // Overrides the throw! The error disappears
  }
}

launch() // "recovered" — the error was silently swallowed
```

- Why is `return` in `finally` dangerous? Because it silently swallows errors: if `try` throws and `finally` has a `return`, the error disappears without any outer `catch` ever seeing it.
- Is a parameterless `catch` valid? Yes, since ES2019: `try { ... } catch { ... }` is valid when you don't need the error object.
- What happens if you throw something that isn't an `Error`? `throw "something"` works, but you lose the stack trace. Always throw `Error` instances.

### Connection with Python

Python uses the same trio, with a different name for the second part:

```python
def process_payment(amount, method):
    if amount <= 0:
        raise ValueError("The amount must be a positive number")
    return {"success": True, "amount": amount, "method": method}

try:
    result = process_payment(-100, "card")
except ValueError as e:
    print(f"Error caught: {e}")
finally:
    print("Cleanup always runs")
```

**Translate exactly**: `try/catch/finally` ↔ `try/except/finally`; `throw` ↔ `raise`; `error.message` ↔ `str(e)` or `e.args`; rethrowing `throw error` ↔ a bare `raise` (rethrows the current exception). In both, `finally` always runs.

**Change of scene**: Python adds an `else` block that runs **only when there was no error** (nothing like it in JS: you'd put your code after the `try`). Also, Python catches by *type* (`except ValueError`), while JS's `catch` receives everything and you decide inside. And note: the `return`-in-`finally` gotcha exists in both languages — it's a trap of the model, not a JavaScript bug.

### Connection with Java

Java also has `try/catch/finally`, plus a piece JS doesn't have:

```java
try {
    ProcessPayment.process(-100, "card");
} catch (IllegalArgumentException e) {
    System.out.println("Error caught: " + e.getMessage());
} finally {
    System.out.println("Cleanup always runs");
}

// try-with-resources: closes the resource automatically
try (Connection c = new Connection()) {
    c.use();
}
```

**Translate exactly**: `try/catch/finally` and `throw` are the same verb in Java; catching by type in JS (`catch (TypeError e)`) matches `catch (IllegalArgumentException e)`. The `finally` in your payment example (closing `connection`) is exactly what Java does with *try-with-resources*: closing the resource without you writing the `finally`.

**Change of scene**: Java **forces** the compiler to deal with *checked* exceptions (declare them with `throws` or catch them) — if you don't handle them, the code doesn't compile. JavaScript and Python leave handling to your judgment at runtime, which is more flexible but easier to forget. Java also has no optional parameterless `catch`: you always need the binding `catch (Exception e)`.

---

## 2. Native error types and when each appears

### The problem: the same error message shows up for very different reasons

`TypeError` appears both when you access `null.foo` and when you call something that isn't a function; `ReferenceError` means "that variable doesn't exist", not "that variable failed". If you don't tell the native types apart, every diagnosis becomes a guessing game. The classic list has 7 types that inherit from `Error`; JS added an eighth in ES2021.

### Table of native types

| Type | When it appears | Typical example |
|------|-----------------|-----------------|
| `Error` | Generic error, base of all the others | `throw new Error("something")` |
| `TypeError` | Operation on a wrong type | `null.foo`, `undefined()` |
| `RangeError` | Value out of allowed range | Stack overflow, `Array(-1)` |
| `SyntaxError` | Syntactically invalid code | `eval("var x =")` |
| `ReferenceError` | Variable not defined in scope | `console.log(x)` where x doesn't exist |
| `URIError` | Misuse of `decodeURI`/`encodeURI` | `decodeURIComponent("%")` |
| `EvalError` | Obsolete (no longer thrown in ES5+) | — |
| `AggregateError` | Groups several causes (ES2021) | `Promise.any` when all fail |

### Real examples of each type

```javascript
// TypeError: accessing a property of null/undefined
let user = null
user.name  // TypeError: Cannot read properties of null (reading 'name')

// TypeError: calling something that isn't a function
const obj = {}
obj()  // TypeError: obj is not a function

// RangeError: infinite recursion (stack overflow)
function infinite() { return infinite() }
infinite()  // RangeError: Maximum call stack size exceeded

// RangeError: array with invalid length
new Array(-1)  // RangeError: Invalid array length

// SyntaxError: invalid code (only in eval or parsing)
eval("const x =")  // SyntaxError: Unexpected end of input

// ReferenceError: variable not defined
console.log(undefinedVariable)  // ReferenceError: undefinedVariable is not defined

// URIError: misuse of decodeURIComponent
decodeURIComponent("%")  // URIError: URI malformed

// AggregateError: Promise.any fails and groups all the reasons
Promise.any([Promise.reject(new Error("a")), Promise.reject(new TypeError("b"))])
  .catch(e => e.errors)  // [Error: a, TypeError: b]
```

### Inspecting an Error object

```javascript
const error = new TypeError("Descriptive message")

// Standard properties of every Error:
error.name     // "TypeError" — the constructor's name
error.message  // "Descriptive message" — the message passed to the constructor
error.stack    // "TypeError: Descriptive message\n    at ..." — stack trace

// The stack is NOT part of the ECMAScript standard, but every engine implements it.
// In V8 (Node.js/Chrome), the stack includes the message + the call frames.
// In Node.js, you can access the stack without the message with:
error.stack.split("\n").slice(1).join("\n")  // only the frames
```

- Why does `SyntaxError` only appear in `eval()` or when parsing invalid JSON? Because syntax errors in source code are caught at compile time, before the code runs. If you have a `SyntaxError` in your `.js` file, Node.js won't start.
- Do `ReferenceError` and `TypeError` get confused? Yes: `let a = b` where `b` doesn't exist throws `ReferenceError`, but `let a = null; a.x` throws `TypeError`. The difference is whether the variable exists or not.
- Can native errors be extended? Yes: `class MyError extends TypeError {}` creates a subtype that `instanceof TypeError` detects.

### Connection with Python

Python brings the same idea, but **more finely grained**:

```python
try:
    data = {"a": 1}
    print(data["b"])          # KeyError
    print(int("x"))           # ValueError
except KeyError as e:
    print("Key that doesn't exist:", e)
except ValueError as e:
    print("Invalid value:", e)
```

**Translate exactly**: `TypeError` ↔ `TypeError`; `RangeError` (stack overflow) ↔ `RecursionError`; the `RangeError` for values ↔ `ValueError`/`IndexError`; catching by type (`catch (TypeError e)`) ↔ `except TypeError as e`. All native JS errors live in Python's `Exception` hierarchy.

**Change of scene**: Python distinguishes *accessing a missing dictionary key* with `KeyError`, something JS resolves by returning `undefined` — in JS "the key doesn't exist" rarely throws. And Python organizes the entry point: `BaseException` (where `KeyboardInterrupt` lives, which you almost never want to catch) is separate from `Exception` (what you actually catch). In JS, anything you throw lands in `catch`, no matter what, and it always catches.

### Connection with Java

Java has dozens of native exceptions and a hierarchy with a split JS doesn't have:

```java
Integer.parseInt("x");              // NumberFormatException (a RuntimeException)
int[] arr = new int[3]; arr[9];     // ArrayIndexOutOfBoundsException
String s = null; s.length();        // NullPointerException
```

**Translate exactly**: `TypeError` for `null.foo` ↔ `NullPointerException`; `RangeError` for an out-of-range index ↔ `IndexOutOfBoundsException`; `TypeError` for an unexpected type ↔ `ClassCastException`/`NumberFormatException`. Same diagnosis, different name.

**Change of scene**: Java separates *checked* exceptions (required to be declared) from *unchecked* ones (`RuntimeException` and its children, optional). The `TypeError`/`RangeError` of JS would be *unchecked* in Java. Also, Java reports the stack trace on standard output with the detail of *every* frame (class, method, line), while JS's `stack` is a non-standard property of the object — weaker by contract, though today every engine implements it.

---

## 3. `Error.cause` and error chaining (ES2022+)

### The problem: when you rethrow with a clearer message, the original error is lost

When an inner module fails and the outer layer rethrows with its own message, the original error — the network `TypeError`, the `HTTP 404` — disappears from the trace. In production you end up knowing *what* failed (the new message) but not *why* (the cause). `Error.cause` (ES2022) solves this: the new error carries the original error that caused it, preserving the full context.

### The problem without `Error.cause`

```javascript
async function getUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    // We rethrow with a more descriptive message, but LOSE the original error
    throw new Error(`Could not get user ${id}`)
    // The original fetch stack trace is lost
    // We don't know if it was a network error, a 404, or a timeout
  }
}
```

### The solution with `Error.cause`

```javascript
async function getUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    // The second argument { cause } preserves the original error
    throw new Error(`Could not get user ${id}`, { cause: error })
    // Now error.cause holds the original error with its stack trace
  }
}

// At the top level, we can walk the whole chain:
try {
  await getUser(42)
} catch (error) {
  console.error(error.message)        // "Could not get user 42"
  console.error(error.cause.message)   // "HTTP 404" or "fetch failed"
  console.error(error.cause.cause)     // Possible underlying network error
}
```

### Pattern: recursive logging of the cause chain

```javascript
function logErrorChain(error, depth = 0) {
  const prefix = "  ".repeat(depth)
  console.error(`${prefix}→ ${error.name}: ${error.message}`)

  if (error.cause instanceof Error) {
    logErrorChain(error.cause, depth + 1)
  }
}

// Usage:
// → Error: Could not get user 42
//   → Error: HTTP 404
//     → TypeError: fetch failed
```

### When to use it

- When you translate a low-level error (network, database) into a clearer domain error.
- When an error propagates through multiple layers (API → service → repository) and you want to preserve the original context.
- In libraries: the consumer can inspect `error.cause` to decide whether to retry, cache, or propagate.

- Does `Error.cause` appear in the stack trace automatically? No. The stack trace of the new error starts where it was created. `cause` is a separate property you must inspect manually.
- Can it be chained indefinitely? Yes, but in practice 2-3 levels is enough to diagnose any problem.
- Do all environments support `cause`? Node.js 16.9+, Deno, Bun, and all modern browsers. Older environments silently ignore the second argument.

### Connection with Python

Python has been chaining exceptions since 2003, with a dedicated keyword:

```python
def get_user(id):
    try:
        response = fetch(f"/api/users/{id}")
    except NetworkError as e:
        raise ValueError(f"Could not get user {id}") from e
        # e stays available as __cause__ of the new error
```

**Translate exactly**: `throw new Error(msg, { cause: error })` ↔ `raise ValueError(msg) from error`. To walk the chain: follow `error.cause` in JS ↔ `e.__cause__` (and `e.__context__`) in Python. Rethrowing without losing the cause (with a bare `raise`) exists in both too.

**Change of scene**: in Python the chain is also built **implicitly**: if you rethrow inside an `except` without `from`, Python keeps the context in `__context__` anyway. In JS the cause must be **explicit**: if you don't pass `{ cause }`, it is lost, period. Also, in Python `raise ... from None` deliberately *suppresses* the cause; in JS the equivalent is rethrowing without the second argument.

### Connection with Java

Java has chained causes since JDK 1.4, so established it's rarely discussed:

```java
try {
    fetchUser(id);
} catch (IOException e) {
    throw new ApiException("Could not get user " + id, e);
    // 'e' stays as the cause; e.getCause() retrieves it
}
```

**Translate exactly**: `new Error(msg, { cause })` ↔ `new ApiException(msg, e)` — the cause constructor is a Java standard. Walking the chain: `error.cause` ↔ `e.getCause()`, or `ExceptionUtils.getRootCause(e)` (Apache Commons) to jump straight to the root.

**Change of scene**: in Java, chaining is **practically mandatory** for the stack trace to make sense (each `printStackTrace()` shows cause after cause), while in JS it was an optional property that arrived with ES2022. But Java only preserves the cause if your exception's constructor receives it (same as JS), and in JS `cause` serializes poorly to JSON — in Java it doesn't travel on its own either; in both, structured logs are what document the chain for the observability system.

---

## 4. `Error.isError` — reliable cross-realm checking (ES2026+)

### The problem: `instanceof Error` lies when the error comes from another realm

`instanceof Error` can fail when an error comes from another "realm" (iframe, worker, vm context). Each realm has its own `Error` constructor, and objects don't share the prototype chain across realms. `Error.isError()` solves this by checking whether a value is genuinely an `Error` regardless of which realm it came from — the same internal-marking trick as `Array.isArray`.

### The problem across realms

```javascript
// In Node.js with worker_threads:
const { Worker } = require("worker_threads")

const worker = new Worker(`
  throw new Error("Error from the worker")
`, { eval: true })

worker.on("error", (error) => {
  // 'error' was created in the worker, which has its own Error constructor
  console.log(error instanceof Error)  // can be false in some environments
  console.log(error.message)            // "Error from the worker" (works)
  console.log(error.stack)              // works, but instanceof is unreliable
})

// In browsers with iframes:
const iframe = document.createElement("iframe")
document.body.appendChild(iframe)
const errorFromIframe = new iframe.contentWindow.Error("Error from the iframe")

console.log(errorFromIframe instanceof Error)  // false — different constructor
console.log(errorFromIframe instanceof iframe.contentWindow.Error)  // true
```

### The solution with `Error.isError`

```javascript
// Error.isError checks whether a value is a genuine Error,
// regardless of which realm it came from
console.log(Error.isError(new Error("test")))         // true
console.log(Error.isError(new TypeError("test")))      // true (inherits from Error)
console.log(Error.isError(new AggregateError([], ""))) // true
console.log(Error.isError({ message: "fake" }))        // false
console.log(Error.isError(null))                       // false
console.log(Error.isError("string"))                   // false

// Bonus: a fake Error that mimics the prototype does NOT pass
console.log(Error.isError({ __proto__: Error.prototype }))  // false

// In the worker case:
worker.on("error", (error) => {
  console.log(Error.isError(error))  // true — reliable across realms
})
```

### Proposal status

- `Error.isError` is part of **ES2026** (it reached Stage 4 in May 2025; the spec was published in the June 2026 edition).
- Available in **Node.js 24+** and modern browsers (**Chrome 134+, Edge 134+, Firefox 138+**). Safari has only partial support. Older environments simply don't have the function.
- Useful detail: `Error.isError(new DOMException())` returns `true` — `DOMException` objects count as errors for this check.
- If you need to support older environments, a **heuristic approximation** (not exact): `const isError = (v) => v instanceof Error || (v && typeof v === "object" && v.name && v.message && v.stack)`. It works for most cases but can produce false positives with objects that merely "look like" errors.

- Why not use `typeof error === "object" && error instanceof Error`? Because `instanceof` fails across realms. `Error.isError` uses an internal engine mark (`[[ErrorData]]`), a private slot the `Error` constructor initializes that doesn't depend on the prototype chain.
- Does `Error.isError` detect subclasses of Error? Yes. If `class MyError extends Error {}`, then `Error.isError(new MyError())` returns `true`.
- Can you forge an Error that passes `Error.isError`? Not easily. The check uses the engine's internal `[[ErrorData]]` slot, which isn't accessible from JavaScript — a plain object has no way to mark it.

### Connection with Python

Python has no direct equivalent, because its architecture doesn't create the problem:

```python
import concurrent.futures as cf

def task():
    raise ValueError("boom")

with cf.ThreadPoolExecutor() as pool:
    future = pool.submit(task)
    try:
        future.result()
    except ValueError as e:
        print("It is an exception:", isinstance(e, ValueError))  # True
```

**Translate exactly**: there's no syntactic correspondence. The conceptual gesture is `isinstance(e, Exception)` — checking that what you caught is truly an exception.

**Change of scene**: Python has no *realms*: `isinstance(e, ValueError)` works whether the exception comes from `concurrent.futures`, a thread, or a compiled C library. The problem `Error.isError` solves is **physically nonexistent** in Python — in JS it exists because workers, iframes, and `vm.createContext` each create distinct constructors per environment.

### Connection with Java

Java doesn't need an equivalent either, but shares the internal reflection:

```java
Throwable e = ...;
if (e instanceof RuntimeException) {   // type check, always local
  ...
}
```

**Translate exactly**: `Error.isError(x)` ↔ `x instanceof Throwable` — the analogue of "is it truly an error, and if so, from which family?"

**Change of scene**: in Java the *classloader* can create two distinct `MyError` classes from two loads, but in practice `instanceof Throwable` works 99% of the time; reliably checking "is an error" is built into the language because `Throwable` is a real class with real inheritance. In JS the error prototype is *another* piece that every realm duplicates, so `instanceof` stopped being reliable and the standard had to add `Error.isError` (ES2026) to regain the guarantee Java has had since the 90s.

---

## 5. Custom error hierarchies

### The problem: a single `Error` type doesn't say who can fix it or what to do with it

In real applications, a single `Error` type isn't enough. You need to distinguish a validation error (the client can fix it), an authentication error (requires re-login), and a database error (requires a retry). Custom error hierarchies let you catch by type and respond differently to each case.

### Pattern: base hierarchy

```javascript
// Base class for all application errors
class AppError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    // Needed so 'instanceof' works correctly when extending Error
    this.name = this.constructor.name

    // Preserve the prototype chain (needed in some environments)
    Object.setPrototypeOf(this, new.target.prototype)

    // Custom properties
    this.code = options.code || "APP_ERROR"
    this.context = options.context || {}
    this.isOperational = options.isOperational ?? true  // true = expected error, false = bug
  }
}

// Domain-specific errors
class ValidationError extends AppError {
  constructor(message, field, options = {}) {
    super(message, { ...options, code: "VALIDATION_ERROR" })
    this.field = field
  }
}

class AuthError extends AppError {
  constructor(message, options = {}) {
    super(message, { ...options, code: "AUTH_ERROR" })
  }
}

class DatabaseError extends AppError {
  constructor(message, options = {}) {
    super(message, { ...options, code: "DATABASE_ERROR" })
    this.isOperational = false  // DB errors are usually bugs or infra issues
  }
}

class NotFoundError extends AppError {
  constructor(resource, id, options = {}) {
    super(`${resource} with id ${id} not found`, { ...options, code: "NOT_FOUND" })
    this.resource = resource
    this.id = id
  }
}
```

### Usage in an Express controller

```javascript
async function handler(req, res) {
  try {
    const user = await findUser(req.params.id)
    if (!user) throw new NotFoundError("User", req.params.id)

    if (!user.active) throw new AuthError("Inactive user")

    if (!req.body.email) throw new ValidationError("Email required", "email")

    res.json(user)
  } catch (error) {
    // Centralized handling by error type
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message, code: error.code })
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, field: error.field })
    }
    if (error instanceof AuthError) {
      return res.status(401).json({ error: error.message })
    }
    if (error instanceof DatabaseError) {
      console.error("DB error:", error)
      return res.status(503).json({ error: "Service unavailable" })
    }
    // Unknown error — probably a bug
    console.error("Unhandled error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
```

### Why `Object.setPrototypeOf(this, new.target.prototype)` is necessary

```javascript
// Without this line, when extending Error in TypeScript/ES6 with some transpilers:
class MyError extends Error {
  constructor(message) {
    super(message)
    // Without setPrototypeOf:
    // this.__proto__ points to Error.prototype instead of MyError.prototype
    // instanceof MyError fails
  }
}

const e = new MyError("test")
e instanceof MyError  // can be false without setPrototypeOf
e instanceof Error     // true (always works)
```

- Why separate operational errors from bugs? Operational errors (validation, not found, auth) are expected and should reach the client with a clear message. Bugs (unexpected TypeError, ReferenceError) must not expose details to the client and should be logged for debugging.
- When to use `error.code` instead of `instanceof`? When errors cross process boundaries (microservices, IPC). `instanceof` doesn't work across processes, but a string code (`"VALIDATION_ERROR"`) is always serializable.
- How many hierarchy levels are reasonable? 2-3 maximum. More levels make the code hard to maintain.

### Connection with Python

Python does the same with `Exception` inheritance — and its `raise` handles the hierarchy order for you:

```python
class ErrorAPI(Exception):
    def __init__(self, message, code, cause=None):
        super().__init__(message)
        self.code = code
        self.cause = cause          # or use 'raise ... from cause' outside

class ErrorAutenticacion(ErrorAPI):
    def __init__(self, message="Not authenticated", cause=None):
        super().__init__(message, 401, cause)

try:
    raise ErrorAutenticacion("Token expired")
except ErrorAutenticacion as e:
    print("401:", e.code)
except ErrorAPI as e:               # the base catches what the children didn't
    print("Other API error:", e.code)
```

**Translate exactly**: `class X extends Error` ↔ `class X(Exception)`; `class X extends AppError` ↔ `class X(ErrorAPI)`. The JS `catch` that discriminates by type (`if (error instanceof ValidationError)`) is already native in Python as `except ValidationError:` — the syntax has caught by type since forever.

**Change of scene**: in Python `super().__init__(message)` only stores the message, and for *extra context* (your `code` or `field`) you use your own attributes — same as JS. The difference: Python's `raise ... from` leaves the cause *intact and serialized* (the previous exception stays alive in the traceback), while in JS passing it via `{ cause }` is optional and easy to forget. Also in Python, *order matters*: `except ErrorAutenticacion` must come **before** `except ErrorAPI`; in JS there's no order — each `instanceof` is evaluated separately.

### Connection with Java

Java made the pattern of *hierarchies* of exceptions famous:

```java
class ErrorAPI extends RuntimeException {
    private final int code;
    ErrorAPI(String message, int code) { super(message); this.code = code; }
    public int getCode() { return code; }
}

class ErrorAutenticacion extends ErrorAPI {
    ErrorAutenticacion(String message) { super(message, 401); }
}

try {
    throw new ErrorAutenticacion("Token expired");
} catch (ErrorAutenticacion e) {
    System.out.println("401: " + e.getCode());
} catch (ErrorAPI e) {
    System.out.println("Other API error: " + e.getCode());
}
```

**Translate exactly**: inheritance is the same verb (`extends` in both); `error.code` ↔ `e.getCode()` (attribute + getter); the Express handler by type is exactly Java's `catch (ErrorAutenticacion e)`.

**Change of scene**: in Java, if your *checked* errors (not `RuntimeException`) cross layers, every method must declare them (`throws ErrorAPI`) or the compiler fails — in exchange, knowing what needs handling is explicit. In JS and Python, the hierarchy is pure runtime policy: nobody forces you, and technically you can catch "everything". The `isOperational` skeleton of the section is the JS version of the distinction Java already implies with checked vs. unchecked.

---

## 6. Debugging strategies in Node.js (`node --inspect`, breakpoints, sourcemaps)

### The problem: `console.log` tells you neither where nor why

`console.log` is fine for quick debugging, but in production or with complex bugs you need stronger tools. Node.js integrates with Chrome DevTools via the inspection protocol, giving you breakpoints, variable inspection, watch expressions, and CPU/memory profiling.

### Debugging with Chrome DevTools

```bash
# Start Node.js in inspection mode
node --inspect server.js
# Or pause on the first line:
node --inspect-brk server.js

# Then open chrome://inspect in Chrome and click "inspect"
```

### Programmatic debugging with `debugger`

```javascript
function calculateTotal(items) {
  let total = 0

  for (const item of items) {
    // The engine pauses here if in inspection mode
    debugger  // Pauses execution — inspect variables in DevTools
    total += item.price * item.quantity
  }

  return total
}
```

### Sourcemaps in TypeScript and bundlers

```javascript
// When you use TypeScript, the code Node.js runs is the compiled .js,
// not the original .ts. Sourcemaps map the .js back to the .ts.

// tsconfig.json:
// { "compilerOptions": { "sourceMap": true } }

// Compiling generates file.js + file.js.map
// Node.js uses the sourcemaps automatically with --inspect:
node --inspect dist/server.js

// The debugger shows the original TypeScript code, not the compiled output
```

### Inspecting memory leaks with heap snapshots

```bash
# 1. Start in inspection mode
node --inspect server.js

# 2. Open chrome://inspect → inspect
# 3. Memory tab → Take heap snapshot
# 4. Run the operation you suspect leaks
# 5. Take another heap snapshot
# 6. Compare: "Objects allocated between snapshot 1 and 2"
# 7. If there are many objects of one type that never get released, there's a leak
```

### Programmatic detection of memory leaks

```javascript
const { writeHeapSnapshot } = require("node:v8")

// In a diagnostic endpoint or timer:
setInterval(() => {
  const used = process.memoryUsage()
  console.log({
    rss: `${(used.rss / 1024 / 1024).toFixed(1)} MB`,
    heapUsed: `${(used.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    heapTotal: `${(used.heapTotal / 1024 / 1024).toFixed(1)} MB`,
  })

  // If heapUsed grows without bound, take a snapshot to investigate
  if (used.heapUsed > 500 * 1024 * 1024) {  // 500 MB
    writeHeapSnapshot(`./heap-${Date.now()}.heapsnapshot`)
  }
}, 60000)  // every minute
```

- `console.log` vs `debugger`? `console.log` is faster for simple cases but modifies the code and can have side effects in production. `debugger` doesn't affect production code (it's ignored when there's no inspector) and enables interactive inspection.
- Do sourcemaps expose source code in production? Yes, if the `.map` files are accessible. In production, serve the sourcemaps on a protected route or don't serve them at all, but keep them for debugging.
- When to use CPU profiling instead of heap snapshots? When the app is slow but doesn't leak memory. The CPU profile shows where the engine spends its time.

### Connection with Python

Python has its long-standing debugger, plus the `breakpoint()` function (Python 3.7+):

```python
def calculate_total(items):
    total = 0
    for item in items:
        breakpoint()          # equivalent to `import pdb; pdb.set_trace()`
        total += item["price"] * item["quantity"]
    return total

# Interactive pdb console: (Pdb) total, (Pdb) item, (Pdb) n  # next
```

**Translate exactly**: `node --inspect-brk` ↔ `python -m pdb script.py` or `breakpoint()`; JS's `debugger;` ↔ `breakpoint()`. Seeing inspection in DevTools ↔ pdb's interactive console, and for simple cases `python -m trace`/`logging` plays the `console.log` role.

**Change of scene**: Node gives you a **graphical** debugger (Chrome DevTools) via the inspection protocol; Python by default gives you `pdb`, plain text (IDEs add the graphics on top). Compiled JavaScript (TypeScript) needs **sourcemaps** to show the original code; Python runs your source directly, so the debugger always sees what you wrote — Python's "sourcemap" analogue only exists for compiled C extensions.

### Connection with Java

Java has been debuggable since forever because the bytecode stores debugging metadata:

```bash
# JVM with remote debugging (the analogue of node --inspect)
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 MyApp
# Then connect from an IDE (IntelliJ, Eclipse) via JDWP
```

**Translate exactly**: `node --inspect` (inspection protocol) ↔ the JDWP harness (`-agentlib:jdwp`); breakpoints and watch expressions in DevTools ↔ the same buttons in IntelliJ; DevTools' heap snapshot ↔ **JFR**/`jmap` or MAT for memory.

**Change of scene**: Java compiles to bytecode and embeds the *debug info* (line table) in the `.class`: the IDE shows you the original class with no sourcemaps needed. JavaScript loses that link when it compiles, and recovers it with the `.map` files. Also, in Java profiling (JFR) comes built-in and cheap; in Node you import CPU profiles into DevTools the same way you import heap snapshots — same gesture, different engine.

---

## 7. Structured logging and observability

### The problem: a log without structure can't be searched or correlated

`console.log` isn't enough in production. You need structured logs (JSON) that tools like Datadog, Grafana Loki, or ELK can search, filter, and correlate. Structured logging turns every log into an event with defined fields.

### From console.log to structured logging

```javascript
// ❌ Bad: unstructured log, hard to search
console.log(`User ${userId} bought ${product} for ${price}`)
// Output: "User 42 bought laptop for 1500"
// How do you search for all the errors of one specific user? You can't.

// ✅ Good: structured log in JSON
const log = {
  level: "info",
  timestamp: new Date().toISOString(),
  event: "purchase",
  userId: userId,
  product: product,
  price: price,
  currency: "USD",
  requestId: req.id  // To correlate logs from the same request
}
console.log(JSON.stringify(log))
// Output: {"level":"info","timestamp":"2026-07-21T15:00:00Z","event":"purchase",...}
// Now you can filter by userId, event, level, etc.
```

### Structured logger with levels

```javascript
class Logger {
  constructor(service = "app") {
    this.service = service
  }

  log(level, message, context = {}) {
    const entry = {
      level,                    // "debug" | "info" | "warn" | "error" | "fatal"
      timestamp: new Date().toISOString(),
      service: this.service,
      message,
      ...context,
    }

    // In production: stdout in JSON so the log system picks it up
    // In development: readable format
    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entry))
    } else {
      const color = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" }[level] || ""
      console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${message}`, context)
    }
  }

  debug(message, context) { this.log("debug", message, context) }
  info(message, context) { this.log("info", message, context) }
  warn(message, context) { this.log("warn", message, context) }
  error(message, context) { this.log("error", message, context) }
}

// Usage
const logger = new Logger("user-api")

logger.info("Usuario creado", { usuarioId: 42, email: "david@ejemplo.com" })

try {
  throw new Error("ECONNREFUSED")
} catch (error) {
  logger.error("Database error", { operation: "SELECT", table: "users", error: error.message })
}
```

### Logging errors with context

```javascript
async function handler(req, res) {
  const logger = new Logger("api")
  const requestId = crypto.randomUUID()

  try {
    logger.info("Request received", { requestId, path: req.path, method: req.method })

    const result = await processRequest(req.body)

    logger.info("Request successful", { requestId, durationMs: Date.now() - req.startTime })
    res.json(result)
  } catch (error) {
    // Log the error with all the context needed to diagnose
    logger.error("Request failed", {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message,
      type: error.name,
      stack: error.stack,
      cause: error.cause?.message,  // If there's an Error.cause
      body: req.body,               // Careful with sensitive data
    })

    res.status(500).json({ error: "Internal error", requestId })
  }
}
```

- Which fields should you never log? Passwords, tokens, sensitive personal data (PII). Use a redaction function that removes sensitive fields before logging.
- Log levels: when to use each? `debug` = development only, `info` = normal events, `warn` = unusual but not critical, `error` = failure that needs attention, `fatal` = process must die.
- Why is `requestId` important? Because in distributed systems, one request can generate logs across multiple services. The `requestId` lets you follow the complete trace.

### Connection with Python

Python has logging **in the standard library**, with severity levels and handlers sharing those names:

```python
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("user-api")
log.info("User created", extra={"user_id": 42})
log.error("Database error", exc_info=True)   # adds the traceback

# Structured JSON: needs a formatter as in this section
import json, logging

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname.lower(),
            "timestamp": self.formatTime(record),
            "message": record.getMessage(),
            **record.__dict__.get("extra_data", {}),
        })
```

**Translate exactly**: the `debug/info/warn/error/fatal` levels ↔ `logging.debug/info/warning/error/critical`; the per-service logger (`new Logger("user-api")`) ↔ `logging.getLogger("user-api")`; structured JSON ↔ a JSON `Formatter` (`structlog` if you want the full pipeline experience with redaction).

**Change of scene**: in Python, logging **is standard**: levels, logger hierarchy, file rotation, and multiple destinations come free. JavaScript has no logger in the standard library: `console.*`, then pick among `pino`, `winston`, etc. Python's `extra={...}` is the cousin of your `{ ...context }`; and `exc_info=True` logs the full traceback including the cause — the equivalent of logging `error.stack` + `error.cause` by hand.

### Connection with Java

Java has the most mature logging ecosystem of the three — and invented the `requestId` pattern:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

Logger log = LoggerFactory.getLogger("user-api");
MDC.put("requestId", requestId);      // MDC = Mapped Diagnostic Context
try {
    log.info("Request received");
} catch (Exception e) {
    log.error("Request failed", e);  // SLF4J adds the stack trace + the cause
} finally {
    MDC.remove("requestId");
}
```

**Translate exactly**: `new Logger("api")` ↔ `LoggerFactory.getLogger("api")`; the levels ↔ the same SLF4J/Logback levels; logging `{ requestId, ... }` ↔ exactly what SLF4J's **MDC** does — except your `requestId` travels as a JSON field while MDC's is a thread-local value that every log from the thread inherits.

**Change of scene**: Java separates *API* (`SLF4J`) from *implementation* (`Logback`, `Log4j2`), so your code doesn't depend on the log backend — in JS the choice (`pino`, `winston`) is made per project and frameworks like NestJS inject it. MDC is the direct ancestor of your explicit `requestId`: in Java the request context travels *in the thread*; in JS there's no thread (one stack for everything), so `requestId` is passed by hand as an argument — Node's `AsyncLocalStorage` pattern tries to reclaim that thread-like convenience for async contexts.

---

## 8. Catching unhandled errors at the process level

### The problem: the error nobody caught decides whether your process lives or dies

When an error isn't caught by any `try/catch`, it reaches the process level. In Node.js, this can terminate the process. Catching these errors at the process level is your last line of defense before the crash — and you have to decide coolly whether to keep going or die.

### Process events in Node.js

```javascript
// 1. Uncaught synchronous exception
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error)
  // ⚠️ In production, the right thing is to log and terminate the process.
  // Continuing after an uncaughtException is dangerous because the state
  // of the application may be inconsistent.
  // Use a process manager (PM2, systemd) to restart automatically.

  process.exit(1)  // Terminate with an error
})

// 2. Unhandled rejected promise (async)
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED PROMISE REJECTION:", reason)
  // In Node.js 15+, unhandledRejection terminates the process by default.
  // You can change this with --unhandled-rejections=warn (not recommended in production)
})

// 3. Operating system signals
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully...")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT (Ctrl+C) — shutting down...")
  server.close(() => process.exit(0))
})
```

### Pattern: graceful shutdown

```javascript
async function gracefulShutdown(server, signal) {
  console.log(`${signal} received. Starting graceful shutdown...`)

  // 1. Stop accepting new connections
  server.close()

  // 2. Wait for in-flight requests to finish (with a timeout)
  const timeout = setTimeout(() => {
    console.error("Timeout: forcing shutdown")
    process.exit(1)
  }, 10000)  // 10 seconds

  // 3. Close database connections
  await db.close()

  // 4. Close other resources (queues, caches, etc.)
  await queue.close()

  clearTimeout(timeout)
  console.log("Shutdown complete")
  process.exit(0)
}

process.on("SIGTERM", () => gracefulShutdown(server, "SIGTERM"))
process.on("SIGINT", () => gracefulShutdown(server, "SIGINT"))
```

### Why must `uncaughtException` terminate the process?

```javascript
// Example of the danger of continuing after an uncaughtException:
let cache = { users: new Map() }

// Suppose an error corrupts the cache
process.on("uncaughtException", (error) => {
  console.error("Error:", error)
  // If we DON'T terminate the process, the app keeps running
  // but cache.users might be in an inconsistent state
  // Subsequent operations will use corrupt data without knowing it
})

// Instead, log and exit:
process.on("uncaughtException", (error) => {
  console.error("Fatal error, terminating process:", error)
  process.exit(1)
  // The process manager (PM2, Docker, systemd) will restart the app
})
```

- Why does Node.js 15+ terminate the process on `unhandledRejection`? Because unhandled rejected promises are bugs. In earlier versions, the process kept running in a potentially inconsistent state.
- `SIGTERM` vs `SIGKILL`? `SIGTERM` allows graceful shutdown (close connections, save state). `SIGKILL` kills the process immediately with no chance to clean up. Docker sends `SIGTERM` and waits `--stop-timeout` (default 10s) before `SIGKILL`.
- Can you recover from an `uncaughtException`? Technically yes (with domains or zone.js), but it's dangerous. The recommended practice is to log, exit, and let the process manager restart.

### Connection with Python

Python catches unhandled errors at the exit door:

```python
import sys, signal, asyncio

def crash_hook(exc_type, exc, tb):
    print("UNCAUGHT EXCEPTION:", exc)

sys.excepthook = crash_hook          # ↔ process.on("uncaughtException")

def shutdown(*args):
    print("SIGTERM/SIGINT received — shutting down gracefully...")
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)  # ↔ process.on("SIGTERM")
signal.signal(signal.SIGINT, shutdown)   # ↔ process.on("SIGINT")
```

**Translate exactly**: `process.on("uncaughtException")` ↔ `sys.excepthook`; `process.on("SIGTERM"/"SIGINT")` ↔ `signal.signal(...)`; the graceful shutdown routine ↔ a signal handler that closes resources and exits. `Process` ↔ the Python runtime running your script.

**Change of scene**: in Node, an uncaught exception **kills the process by default**; in Python it also terminates (prints the traceback and the process exits with a nonzero code in most events). The big difference: JS's `unhandledRejection` has no Python analogue — a throwing `await` is a normal exception that goes through `try/except`; there's no "abandoned promise" state. And in Python, thanks to `asyncio`, gracefully shutting down an async server is usually the well-covered `await server.stop()` gesture, not a fragile hand-written handler.

### Connection with Java

The JVM also hands its "lines of defense" to the programmer:

```java
Thread.setDefaultUncaughtExceptionHandler((thread, e) -> {
    System.err.println("UNCAUGHT EXCEPTION in " + thread.getName());
    System.exit(1);
});

Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    System.out.println("Shutting down: closing resources...");
    // ↔ your graceful shutdown: server.close(), db.close(), etc.
}));
```

**Translate exactly**: `process.on("uncaughtException")` ↔ `Thread.setDefaultUncaughtExceptionHandler`; graceful shutdown on signals ↔ a **shutdown hook** (`addShutdownHook`). Your verbose `server.close()` and `db.close()` fit verbatim inside the hook's body.

**Change of scene**: in Java, an uncaught error in one thread does **not** kill the whole process by default — the thread dies and the others keep running (a subtle danger); in Node, the single-thread model means `uncaughtException` does bring the process down, which is more honest but more dramatic. JVM shutdown hooks run whenever the process shuts down *naturally*; in Node the `SIGTERM/SIGINT` handlers are entirely yours, and `SIGKILL` kills without warning in both worlds.

---

## 9. Error handling patterns in production

### The problem: each error type needs a different response

In production, error handling isn't just catching exceptions. It's a system of layers that decides what to do with each kind of error: log it, send it to the client, retry, open the circuit, or terminate the process.

### Pattern: Express error middleware

```javascript
// Error middleware — must have 4 parameters (err, req, res, next)
function errorHandler(err, req, res, next) {
  const logger = req.logger || console

  // Operational errors (expected): send to the client
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      field: err.field,
      code: err.code,
    })
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: err.message,
      code: err.code,
    })
  }

  if (err instanceof AuthError) {
    return res.status(401).json({
      error: err.message,
    })
  }

  // Non-operational errors (bugs): log and answer generically
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    cause: err.cause?.message,
    path: req.path,
    method: req.method,
  })

  // Never send the stack trace to the client in production
  res.status(500).json({
    error: "Internal server error",
    requestId: req.id,
  })
}

// Must be registered AFTER all the routes
app.use(errorHandler)
```

### Pattern: retry with exponential backoff

```javascript
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,        // 1 second initial
    maxDelay = 30000,         // 30 seconds maximum
    factor = 2,               // Exponential multiplier
    retryableErrors = ["NETWORK_ERROR", "TIMEOUT", "DATABASE_ERROR"],
  } = options

  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error

      // Is this error retryable?
      const isRetryable = retryableErrors.includes(error.code)
      if (!isRetryable) throw error

      // Is it the last attempt?
      if (attempt === maxAttempts) {
        throw new Error(`Operation failed after ${maxAttempts} attempts`, {
          cause: error,
        })
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay)
      const jitter = Math.random() * 500  // Avoids the thundering herd
      await new Promise(resolve => setTimeout(resolve, delay + jitter))

      console.log(`Retry ${attempt + 1}/${maxAttempts} in ${delay}ms`)
    }
  }

  throw lastError
}

// Usage:
const result = await withRetry(
  () => fetch("https://api.example.com/data"),
  { maxAttempts: 5, baseDelay: 500 }
)
```

### Pattern: circuit breaker

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5        // Failures before opening
    this.timeout = options.timeout || 60000  // Time before half-open
    this.state = "CLOSED"                     // CLOSED | OPEN | HALF_OPEN
    this.failures = 0
    this.lastOpenedAt = null
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastOpenedAt > this.timeout) {
        this.state = "HALF_OPEN"  // Allow a probe attempt
      } else {
        throw new Error("Circuit breaker open — operation rejected")
      }
    }

    try {
      const result = await fn()
      this.success()
      return result
    } catch (error) {
      this.failure()
      throw error
    }
  }

  success() {
    this.failures = 0
    this.state = "CLOSED"
  }

  failure() {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = "OPEN"
      this.lastOpenedAt = Date.now()
    }
  }
}

// Usage: protecting calls to an external service
const breaker = new CircuitBreaker({ threshold: 5, timeout: 30000 })

async function callApi() {
  return breaker.execute(() => fetch("https://api-external.com/data"))
}
```

- Why the jitter in exponential backoff? Without jitter, if several services fail at the same time, they all retry at the same time (thundering herd). Jitter spreads the retries out.
- When circuit breaker vs retry? Retry is for transient failures (network, timeout). Circuit breaker is for services that may be down for a while — it avoids spending resources on requests that are going to fail.
- Should the circuit breaker reset automatically? Yes, with the HALF_OPEN state: after the timeout, allow one probe request. If it succeeds, close the circuit. If it fails, open it again.

### Connection with Python

Python has the *tenacity* library, which declares retry and backoff in a decorator:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=30),
    retry_on_exception=lambda e: getattr(e, "retryable", False),
)
def fetch_data():
    return fetch("https://api.example.com/data")
```

**Translate exactly**: your `withRetry(fn, { maxAttempts: 3, baseDelay: 1000, maxDelay: 30000 })` ↔ `@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=30))`. The jitter in the strict equivalent is enabled with `wait_random_exponential`; for circuit breakers Python usually drops to resilience libraries (few standards) or your own class as in JS.

**Change of scene**: in Python, retry with backoff is a **declarative decision** from a de-facto-standard decorator; in JS the norm is writing it by hand (or pulling in `p-retry`/`bottleneck`). The logic is the same — that's why this chapter teaches it raw: if you implement it once, reading `tenacity` or `p-retry` is like reading your own code behind a declarative signature.

### Connection with Java

Java has these patterns **industrialized** in *Resilience4j*:

```java
Retry retryPolicy = Retry.ofDefaults("api");
CircuitBreaker cb = CircuitBreaker.ofDefaults("api-external");

// Compose: retry AROUND an open circuit breaker
Supplier<String> call = () -> callApi();
Supplier<String> guarded = CircuitBreaker.decorateSupplier(cb, call);
Supplier<String> retried = Retry.decorateSupplier(retryPolicy, guarded);
String result = retried.get();
```

**Translate exactly**: your `withRetry` ↔ `Retry.ofDefaults`, with backoff configured (`RetryConfig`) and `exponentialWait`; your `CircuitBreaker` ↔ `CircuitBreaker.ofDefaults`, with CLOSED/OPEN/HALF_OPEN states and `countFailure`/`waitDurationInOpenState`. The "wrap my own function" pattern (`breaker.execute(() => ...)`) ↔ the *decorators* `Retry.decorateSupplier`/`CircuitBreaker.decorateSupplier`.

**Change of scene**: Resilience4j ships with metrics, events, and *fallback* (`Recover`) built in — it's a first-class citizen in Gradle/Maven. In JS there's no standard equivalent: big apps assemble it by hand (like this chapter's examples) or with partial libraries. But the state math (threshold, timeout, HALF_OPEN) is identical: if you understood your 50-line `CircuitBreaker`, you understand all of Resilience4j.

---

## Practice and exercises

Try to solve each challenge mentally or in code **before** opening the collapsible solutions.

### 1. Review questions

<details>
<summary><b>1. What does `finally` guarantee? And what happens if there's a `return` inside `finally`?</b></summary>

**Explanation**: `finally` runs **always**, error or not, and that's where you release resources (close a connection, clean up timers). But if `finally` has a `return` (or `throw`), it **overrides** what `try` had prepared: the `try`'s `return 42` becomes `finally`'s `return 0`, and a `throw` from `try` gets swallowed without ever reaching a `catch`. So never put a `return` in `finally`.
</details>

<details>
<summary><b>2. What is the difference between `ReferenceError` and `TypeError`? Give one example of each.</b></summary>

**Explanation**: `ReferenceError` means the variable **doesn't exist** in scope (`console.log(x)` with `x` undeclared). `TypeError` means the variable exists but the operation is invalid for its type (`null.foo` — accessing a property of `null`/`undefined`; `obj()` — calling something that isn't a function). Quick diagnosis: if the error says "is not defined" it's `ReferenceError`; if it says "cannot read properties of null" or "is not a function", it's `TypeError`.
</details>

<details>
<summary><b>3. When you rethrow an error with a new message, what do you lose without `Error.cause`?</b></summary>

**Explanation**: You lose the **original error**: its `message` (was it a 404, a timeout, or a network error?) and its `stack` (where did it actually fail?). The new message tells you *what* failed (upper layer), but without `cause` you're left without the *real why* — and in production that's the difference between fixing the product's problem and fixing a symptom.
</details>

<details>
<summary><b>4. Why can `instanceof Error` return `false` for an error from a worker, and how does `Error.isError` fix it?</b></summary>

**Explanation**: Because each *realm* (worker, iframe, `vm` context) has its **own** `Error` constructor. The object comes from the worker's realm, so its prototype chain doesn't pass through `Error.prototype` *of your world*. `Error.isError` doesn't look at the prototype chain: it does an internal brand check (slot `[[ErrorData]]`) that the `Error` constructor leaves when creating the instance — which is why it answers `true` no matter where it came from (ES2026, Node 24+).
</details>

<details>
<summary><b>5. Why is the production recommendation to terminate the process on `uncaughtException` instead of continuing?</b></summary>

**Explanation**: Because an uncaught exception may have left state **inconsistent** (a half-built cache, a half-done transaction, corrupted structures). If you keep running, the next operations work on contaminated data without knowing it: slow, silent failures — the worst kind to diagnose. Logging, exiting with `process.exit(1)`, and letting the manager (PM2, Docker, systemd) restart is cheaper than running with broken state.
</details>

---

### 2. Explain it in your own words

> **Challenge**: Explain to a friend coming from Python how **JavaScript's error model** works, using the metaphor of a **team at work**: the error is a notice that leaves the task (the function), climbs the chain of command (the call stack), and each level decides "I'll handle this one" (`catch`) or "let it keep going" (`throw`). With nobody to catch it, the boss — the process — closes the company (`uncaughtException`). Then explain: what extra information does `Error.cause` carry, and what does `Error.isError` guarantee that `instanceof` can't?
> *Hint: if in doubt, re-read [Section 1](#1-trycatchfinally-and-throw--the-basic-model), [Section 3](#3-errorcause-and-error-chaining-es2022), and [Section 4](#4-erroriserror--reliable-cross-realm-checking-es2026).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): `divide` with validation and controlled rethrowing

**Goal**: Build a function with basic error handling that validates its inputs and decides whether it can handle the error or rethrow it.

**Statement**: Write a function `divide(a, b)` that:
1. Throws a `TypeError` if any argument isn't a number.
2. Throws a `RangeError` if `b === 0`.
3. Catches the error it threw itself, logs it, and **rethrows** it so the caller decides.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Guard the validations with `throw new TypeError(...)` before trying to divide.
2. Wrap the body in `try/catch`; in the `catch`, `console.error` and then `throw error`.
3. Outside the function, compare the outputs: `divide(10, 2)`, `divide(10, 0)`, and `divide("10", 2)`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function divide(a, b) {
  try {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new TypeError('Both arguments must be numbers');
    }

    if (b === 0) {
      throw new RangeError('Cannot divide by zero');
    }

    return a / b;
  } catch (error) {
    console.error(`Error in divide: ${error.message}`);
    throw error; // Rethrow so the caller handles the error
  }
}

// Usage
try {
  console.log(divide(10, 2));   // 5
  console.log(divide(10, 0));   // Error: Cannot divide by zero
  console.log(divide('10', 2)); // Error: Both arguments must be numbers
} catch (error) {
  console.log('Error caught externally:', error.message);
}
```

**Why does it work?** `throw` interrupts the block and jumps straight to the inner `catch`, which logs and rethrows with `throw error`. The inner `throw` can't swallow the error (it rethrows it with the same stack). The outer `catch` receives it intact: both final `console.log`s appear. The types are chosen deliberately: `TypeError` for "invalid argument", `RangeError` for "value out of range" — native types are the language the console speaks.
</details>

---

#### Exercise 2 (Intermediate): `ErrorAPI` error hierarchy with `Error.cause`

**Goal**: Build an API error hierarchy with HTTP codes, timestamp, and `Error.cause` support, and handle it by type in the caller.

**Requirements**:
1. `ErrorAPI` must have `code`, `message`, `timestamp`.
2. `ErrorAutenticacion` for 401 errors, `ErrorNoEncontrado` for 404, `ErrorRateLimit` for 429.
3. All of them must support `Error.cause` to preserve the original error.
4. The caller (`getUser`) translates the `HTTP N` of `fetch` into the matching error type.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Extend the native `Error` and pass `{ cause }` to `super()`.
2. Set `this.name = this.constructor.name` inside the base.
3. In the `fetch` flow, use `response.status` to choose which subclass to throw.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class ErrorAPI extends Error {
  constructor(message, code, cause = null) {
    super(message, { cause: cause });
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date().toISOString();

    // Keep the correct stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class ErrorAutenticacion extends ErrorAPI {
  constructor(message = 'Not authenticated', cause = null) {
    super(message, 401, cause);
  }
}

class ErrorNoEncontrado extends ErrorAPI {
  constructor(resource = 'Resource', cause = null) {
    super(`${resource} not found`, 404, cause);
  }
}

class ErrorRateLimit extends ErrorAPI {
  constructor(retryIn = 60, cause = null) {
    super(`Rate limit exceeded. Retry in ${retryIn} seconds`, 429, cause);
    this.retryIn = retryIn;
  }
}

// Usage
async function getUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);

    if (!response.ok) {
      const originalError = new Error(`HTTP ${response.status}`);

      switch (response.status) {
        case 401:
          throw new ErrorAutenticacion('Token expired', originalError);
        case 404:
          throw new ErrorNoEncontrado('User', originalError);
        case 429:
          throw new ErrorRateLimit(30, originalError);
        default:
          throw new ErrorAPI('Unknown error', response.status, originalError);
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ErrorAPI) {
      console.error('API error:', error.toJSON());
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

**Why does it work?** the base `ErrorAPI` centralizes `name`, `code`, and `timestamp`, and each subclass only supplies its `HTTP status` — the hierarchy is what lets the `catch` discriminate: `error instanceof ErrorAutenticacion` etc. `Error.captureStackTrace(this, this.constructor)` trims the stack so the `ErrorAPI` constructor doesn't show as an extra frame (the default `name` would be `Error`; setting it by hand makes the log readable). The final `throw error` rethrows so the upper-level system (middleware, see Section 9) decides the HTTP response.
</details>

---

#### Exercise 3 (Advanced): structured logger with a circuit breaker

**Goal**: Assemble Section 7's logging system *plus* Section 9's circuit breaker, with levels, `requestId`, and redaction of sensitive data (PII).

**Specs**:
1. Each log must include: timestamp, level, service, requestId, message, metadata.
2. The circuit breaker must have states: CLOSED, OPEN, HALF_OPEN.
3. Support for redacting sensitive data (PII): for example, social security numbers (SSN) in the `123-45-6789` format must come out masked.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Use a `Logger` with `debug/info/warn/error` methods and a redaction filter in the `message` path.
2. Implement the circuit breaker as a class with `state`, `failures`, and `lastOpenedAt` (you saw it in Section 9).
3. The breaker wraps the external call; the logger records entry and exit with the same `requestId`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
// Structured logger
class LoggerEstructurado {
  constructor(configuration) {
    this.service = configuration.service;
    this.minLevel = configuration.minLevel || 'info';
    this.destinations = configuration.destinations || [console];
    this.redacters = configuration.redacters || [];

    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  _redact(message) {
    let redacted = message;
    for (const redacter of this.redacters) {
      redacted = redacter(redacted);
    }
    return redacted;
  }

  _format(level, message, metadata = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: level,
      service: this.service,
      requestId: metadata.requestId || 'no-request',
      message: this._redact(message),
      ...metadata
    };
  }

  _write(log) {
    if (this.levels[log.level] < this.levels[this.minLevel]) {
      return;
    }

    const formatted = JSON.stringify(log);
    this.destinations.forEach(destination => {
      if (destination.write) {
        destination.write(formatted);
      } else if (destination.log) {
        destination.log(formatted);
      }
    });
  }

  debug(message, metadata) {
    this._write(this._format('debug', message, metadata));
  }

  info(message, metadata) {
    this._write(this._format('info', message, metadata));
  }

  warn(message, metadata) {
    this._write(this._format('warn', message, metadata));
  }

  error(message, metadata) {
    this._write(this._format('error', message, metadata));
  }
}

// Circuit Breaker
class CircuitBreaker {
  constructor(configuration) {
    this.threshold = configuration.threshold || 5;
    this.timeout = configuration.timeout || 30000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastOpenedAt = 0;
  }

  async execute(func) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastOpenedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN - service unavailable');
      }
    }

    try {
      const result = await func();
      this._success();
      return result;
    } catch (error) {
      this._failure();
      throw error;
    }
  }

  _success() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  _failure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.lastOpenedAt = Date.now();
    }
  }
}

// Usage
const logger = new LoggerEstructurado({
  service: 'my-api',
  minLevel: 'info',
  redacters: [
    (message) => message.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX') // Redact SSN
  ]
});

const breaker = new CircuitBreaker({ threshold: 3, timeout: 10000 });

async function externalCall() {
  return breaker.execute(async () => {
    logger.info('Starting external call', { requestId: '123' });
    // Simulate an API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return { data: 'result' };
  });
}
```

**Why does it work?** the `Logger` honors the minimum level (`debug` 0 < `info` 1, so it's discarded) and applies the redacters *before* serializing — the SSN never reaches the destination, neither the file nor the observability service. The `CircuitBreaker` accumulates failures up to the threshold, opens the circuit (all calls fail fast without touching the service), and after the timeout flips back to `HALF_OPEN` to test with a single request. Together they're a "mini-Remote" like the ones in Section 9: overload protection *and* traceability of the same `requestId` from the entry log to the exit log.
</details>

---

## Debugging in practice

### Which error you're seeing and how to attack it

- If you see `TypeError: Cannot read properties of null` → something returned null/undefined where you expected an object. Check the data's origin.
- If you see `RangeError: Maximum call stack size exceeded` → infinite recursion or recursion without a base case.
- If you see `ReferenceError: x is not defined` → the variable doesn't exist in scope. Check for a missing `import` or a typo.
- If an error propagates without context → use `Error.cause` to preserve the original error.
- If `instanceof Error` returns false for an error from a worker/iframe → use `Error.isError`.
- If the app crashes without explanation → check `uncaughtException` and `unhandledRejection` in the logs.
- If the app gets slowly slower → take heap snapshots and hunt memory leaks.
- If the logs aren't useful → migrate from `console.log` to structured logging with context.
- If an external service fails repeatedly → implement a circuit breaker.
- If requests fail sometimes and succeed other times → implement retry with exponential backoff.

---

### Scenario 1: The error that escapes the async `forEach`

**Situation**: You have an async function that handles errors, but some errors don't get caught. The outer `try/catch` "only catches some". In production you see `unhandledRejection` in the logs.

**Diagnosis**:
- **Likely cause**: `ids.forEach(async (id) => { ... })` fires async callbacks without waiting: for `forEach` you're not an `await` that can fail, you're a **fire-and-forget** that discards the promises. The error inside `process(id)` detonates as an unhandled rejected promise — the outer `try/catch` never sees it, because the stack where it runs has already returned.
- **After that**: with `for...of` + `await`, every error falls into the `try/catch` and is catchable; with `Promise.allSettled`, you get both the successful results and the rejected ones without any of them taking the flow down.
- **In Python**: the analogue is forgetting `await` or forgetting an `asyncio` task — the exception surfaces as "Task exception was never retrieved". `asyncio.gather(...)` is the counterpart to `Promise.all`.

```javascript
// ❌ Problem: forEach with async/await
const ids = [1, 2, 3];
try {
  ids.forEach(async (id) => {
    await process(id); // Errors here are not caught externally
  });
} catch (error) {
  console.log('Never runs'); // ❌
}

// ✅ Solution: for...of with try/catch
try {
  for (const id of ids) {
    await process(id); // Errors here ARE caught
  }
} catch (error) {
  console.log('Error caught:', error.message); // ✅
}

// ✅ Solution: Promise.all with individual handling
const results = await Promise.allSettled(
  ids.map(id => process(id))
);

results.forEach((result, index) => {
  if (result.status === 'rejected') {
    console.error(`Error in ID ${ids[index]}:`, result.reason);
  }
});
```

---

### Scenario 2: The logs that are useless in production

**Situation**: Your application has logs, but they're useless for debugging production problems. An error shows up thousands of times a day and you don't know *which request* it came from or *how long* anything took.

**Diagnosis**:
- **Likely cause**: plain logs like ``console.log(`User ${id} ...`)`` — with no level, no timestamp, no `requestId`. You can't filter "all the errors of user 42", and the logs of a single request are scattered around the file with no way to join them.
- **Solution**: structured JSON logging with `requestId`, `level`, `timestamp`, and `service` (Section 7). The `requestId` is generated per request and propagated through all levels — so the log system (Datadog, Loki) can *follow the whole trace*.
- **In Python**: the same with `logging` + JSON formatter or `structlog`; in Java with SLF4J + MDC (you carry `requestId` in the thread context).

```javascript
// ✅ Logging with requestId context for traceability
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.logger = new Logger('api');   // or req.logger = logger.child({ requestId })
  next();
});

// In a controller
async function getUser(req, res) {
  req.logger.info('Starting to fetch user', { requestId: req.requestId, userId: req.params.id });

  try {
    const user = await userService.get(req.params.id);
    req.logger.info('User fetched successfully', { requestId: req.requestId, userId: req.params.id });
    res.json(user);
  } catch (error) {
    req.logger.error('Error fetching user', {
      requestId: req.requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal error', requestId: req.requestId });
  }
}
```

---

## Comparison table across languages

### JavaScript vs. Python

| Feature | JavaScript | Python |
|---|---|---|
| **Basic syntax** | `try/catch/finally` | `try/except/finally` (+ `else` when no error) |
| **Rethrowing** | `throw error` | bare `raise` (keeps the current one) |
| **Native error types** | 7 classic + `AggregateError` | Rich hierarchy in `Exception` (`ValueError`, `KeyError`, `RecursionError`...) |
| **Original cause** | `{ cause }` (ES2022, explicit) | `raise ... from e` explicit and `__context__` implicit |
| **Cross-realm checking** | `Error.isError` (ES2026, needed due to realms) | `isinstance(e, Exception)`; realms don't exist |
| **Custom errors** | `class X extends Error` + `instanceof` | `class X(Exception)` + `except X:` |
| **Debugging** | `node --inspect` (GUI in Chrome DevTools) + sourcemaps | `pdb`/`breakpoint()` (text) |
| **Logging** | No standard: `console` + `pino`/`winston` | Standard `logging` + JSON formatters |
| **Unhandled at process level** | `uncaughtException`/`unhandledRejection` | `sys.excepthook`; no `unhandledRejection` equivalent |
| **Retry / circuit breaker** | By hand or `p-retry`/`bottleneck` | `tenacity` (declarative retry) |

### JavaScript vs. Java

| Feature | JavaScript | Java |
|---|---|---|
| **Basic syntax** | `try/catch/finally` | `try/catch/finally` + try-with-resources |
| **Mandatory exceptions** | None | *Checked*: declare `throws` or it doesn't compile |
| **Native error types** | 7 + `AggregateError` | Dozens; `NullPointerException`, `NumberFormatException`, `ArrayIndexOutOfBoundsException`... |
| **Original cause** | `{ cause }` (ES2022) | Cause constructor + `getCause()` (since JDK 1.4) |
| **Cross-realm checking** | `Error.isError` (ES2026) | `instanceof Throwable` (realms barely exist) |
| **Custom errors** | `class X extends Error` + `instanceof` | `class X extends Exception/RuntimeException` + `catch (X e)` |
| **Debugging** | `node --inspect` (GUI) + sourcemaps | JDWP + IDE (bytes with debug info) |
| **Logging** | `console` + `pino`/`winston`; `requestId` by hand | SLF4J + Logback; **MDC** for `requestId` |
| **Unhandled at process level** | `uncaughtException` brings the process down | Thread dies; `setDefaultUncaughtExceptionHandler` + shutdown hooks |
| **Retry / circuit breaker** | By hand or partial libraries | **Resilience4j** (`Retry`, `CircuitBreaker`, fallback, metrics) |

---

## Chapter summary

1. **The model is `try/catch/finally` with `throw`**: `finally` always runs (release resources), but a `return` there **swallows** errors and values.
2. **Native types are the language of diagnosis**: `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`... plus `AggregateError` (ES2021). `name`, `message`, and `stack` (the latter non-standard).
3. **`Error.cause` (ES2022) preserves the original error when rethrowing**: without it, each new layer erases the root cause.
4. **`Error.isError` (ES2026) is the reliable cross-realm check**: `instanceof` fails with workers/iframes; the internal brand doesn't (Node 24+, Chrome 134+).
5. **Custom hierarchies + `error.code` let you discriminate by type**: operational vs. bug, and a distinct response per `catch`.
6. **In production: structured JSON logging with `requestId`**, `node --inspect` for debugging, heap snapshots for leaks, and `uncaughtException`/`SIGTERM` as the last line (log, exit, let the manager restart).
7. **Resilience patterns**: retry with exponential backoff + jitter for transient failures; circuit breaker (CLOSED/OPEN/HALF_OPEN) for downed services; graceful shutdown at the end.

---

## Next Chapter

→ **[Chapter 7: Creational patterns (Factory, Singleton, Builder)](./cap-07)**: Now that you know how to handle failures in production, we move to the patterns that structure how you create objects and control their instances in modern JavaScript.