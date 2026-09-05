---
title: "Chapter 2: Objects, Prototypes, and Classes"
---

# Chapter 2: Objects, Prototypes, and Classes

> Unlike traditional class-based languages, JavaScript doesn't clone rigid templates: it connects live objects through a dynamic prototype chain.

## Introduction

In JavaScript, almost everything you interact with at runtime is an object. However, many developers coming from Java, C#, or Python attempt to project their mental model of "classes as static blueprints" onto an engine powered by **dynamic prototype delegation**.

Understanding how internal property descriptors work, the prototype chain, the `new` operator, modern classes with private `#` fields, metaprogramming with `Proxy` and `Reflect`, and unique primitives like `Symbol` is the indispensable foundation for designing extensible architectures without memory leaks or rigid couplings.

---

## 1. Object Literals and Property Descriptors

### The Problem: Uncontrolled Mutation and Visibility

A standard object literal in JavaScript is completely open by default: anyone can overwrite properties, reassign methods with invalid types, iterate over sensitive keys using `Object.keys()`, or delete critical fields using `delete`.

```javascript
const account = { holder: "David", balance: 1000 }

// Anyone can accidentally corrupt the object:
account.balance = "one thousand" // Breaks mathematical calculations
delete account.holder            // Destroys vital data
```

### The Solution: Property Descriptors with `Object.defineProperty`

Every property in an object possesses internal metadata attributes called **descriptors** that control its behavior during assignments, enumerations, and reconfigurations.

```javascript
const obj = {}

// 1. Data property with strict protections
Object.defineProperty(obj, "id", {
  value: "USR-9942",
  writable: false,      // Read-only: cannot be reassigned
  enumerable: true,     // Appears in for...in loops and Object.keys()
  configurable: false   // Cannot be deleted or reconfigured
})

// 2. Accessor property (Getters and Setters)
let _counter = 0

Object.defineProperty(obj, "counter", {
  get() {
    return _counter
  },
  set(newValue) {
    if (typeof newValue !== "number" || newValue < 0) {
      throw new TypeError("Counter must be a non-negative number")
    }
    _counter = newValue
  },
  enumerable: true,
  configurable: false
})

obj.counter = 5
console.log(obj.counter) // 5

// obj.counter = -1 // Error: TypeError: Counter must be a non-negative number
// obj.id = "NEW"   // Silent failure in non-strict mode, TypeError in 'use strict'
```

### Property Descriptors Reference Table

| Descriptor | Default with `defineProperty` | Default in Object Literal `{ prop: val }` | Purpose |
|---|---|---|---|
| `value` | `undefined` | Assigned value | The actual data value stored in the property. |
| `writable` | `false` | `true` | If `true`, the value can be modified with an assignment operator (`=`). |
| `enumerable` | `false` | `true` | If `true`, the property appears in `for...in` and `Object.keys()`. |
| `configurable` | `false` | `true` | If `true`, the descriptor type can be modified and the property can be removed with `delete`. |
| `get` | `undefined` | `undefined` | A function called whenever the property is read. |
| `set` | `undefined` | `undefined` | A function called with the new value whenever the property is written to. |

> **Common Trap**: When you define a property using `Object.defineProperty()`, all omitted boolean flags default to `false`. In contrast, when you create `{ a: 1 }`, `writable`, `enumerable`, and `configurable` are all `true`.

### Python Connection

```python
# Python - Properties with @property decorators
class Account:
    def __init__(self, holder, initial_balance):
        self._holder = holder
        self._balance = initial_balance

    @property
    def balance(self):
        return self._balance

    @balance.setter
    def balance(self, value):
        if value < 0:
            raise ValueError("Balance cannot be negative")
        self._balance = value

acc = Account("David", 1000)
acc.balance = 1200
```

**Translates exactly**: JavaScript getters and setters serve the same role as `@property` and `@prop.setter` in Python to intercept reads and writes with custom validations.  
**Core difference**: In Python, private attributes are a naming convention (`_balance`) or name-mangling (`__balance`), whereas `Object.defineProperty` with `writable: false` locks the property at the C++ engine level.

### Java Connection

```java
// Java - Traditional encapsulation with accessors
public class Account {
    private final String id;
    private double balance;

    public Account(String id, double initialBalance) {
        this.id = id; // Immutable after construction
        this.balance = initialBalance;
    }

    public String getId() { return id; }
    public double getBalance() { return balance; }

    public void setBalance(double newBalance) {
        if (newBalance < 0) throw new IllegalArgumentException("Negative balance");
        this.balance = newBalance;
    }
}
```

**Translates exactly**: `writable: false` and `configurable: false` achieve the same guarantee as a `final` field in Java (non-reassignable).  
**Core difference**: In Java, getters and setters are explicit method invocations (`account.getBalance()`). In JavaScript, property descriptors allow property access syntax (`account.balance`) while transparently executing functions behind the scenes.

---

## 2. The Prototype Chain

### The Problem: Massive Method Duplication in Memory

If you instantiate 10,000 users by declaring methods directly inside each individual object, each instance allocates memory for its own separate copy of every function:

```javascript
function createUser(name) {
  return {
    name,
    greet() { return `Hello, I'm ${this.name}` } // 10,000 duplicate functions in heap
  }
}
```

### The Solution: Prototype Delegation

Instead of copying functions, JavaScript employs **delegation**. Every object contains an internal link to another object known as its **prototype** (`[[Prototype]]`). If a requested property or method is not found on the instance itself, the engine traverses up the prototype chain until it finds it or reaches `null`.

### Mental Diagram of the Prototype Chain

```
instance (u1)
  │  own properties: { name: "David" }
  └── [[Prototype]] ──► User.prototype
                          │  shared methods: { greet() }
                          └── [[Prototype]] ──► Object.prototype
                                                  │  base methods: { toString(), hasOwnProperty() }
                                                  └── [[Prototype]] ──► null (end of chain)
```

### `__proto__` vs. `prototype`

This distinction is one of the most common sources of confusion in JavaScript:

- `prototype`: A property that **only functions have** (except arrow functions). It is the blueprint object that will become the prototype for instances created via `new MyFunction()`.
- `[[Prototype]]` (accessed historically via `__proto__` or formally via `Object.getPrototypeOf(obj)`): The actual link that **every object holds** pointing to the parent object it inherits from.

```javascript
function User(name) {
  this.name = name
}

// Attach the method once to the shared prototype
User.prototype.greet = function() {
  return `Hello, I'm ${this.name}`
}

const david = new User("David")

console.log(david.greet()) // "Hello, I'm David"
console.log(Object.getPrototypeOf(david) === User.prototype) // true
console.log(david.hasOwnProperty("name"))  // true (own property)
console.log(david.hasOwnProperty("greet")) // false (inherited via prototype)
```

---

## 3. Constructor Functions and the `new` Operator

### The Problem: Forgetting `new` Pollutes the Global Scope

Calling a constructor function without `new` is a notorious pitfall: in non-strict mode, `this` binds to the global object (`window` or `global`), leaking variables into global state and returning `undefined`.

```javascript
function Car(brand) {
  this.brand = brand
}

const c1 = Car("Toyota") // Missing 'new'!
console.log(c1)          // undefined
// console.log(window.brand) // "Toyota" (Leaked into global scope!)
```

### The Solution: The 4-Step Cycle of `new`

When you execute `new Car("Toyota")`, the engine executes four distinct steps:

1. **Creates a brand new empty object** in the Heap memory (`{}`).
2. **Binds the prototype**: sets the `[[Prototype]]` of the new object to `Car.prototype`.
3. **Executes constructor**: runs `Car` with `this` bound to the newly created object, forwarding all passed arguments.
4. **Returns the instance**: unless the constructor explicitly returns a different object, it automatically returns `this`.

```javascript
function Car(brand, model) {
  // Defensive guard against missing 'new'
  if (!new.target) {
    return new Car(brand, model)
  }

  this.brand = brand
  this.model = model
}

Car.prototype.getInfo = function() {
  return `${this.brand} ${this.model}`
}

const car1 = new Car("Mazda", "3")
const car2 = Car("Honda", "Civic") // Safe thanks to new.target

console.log(car1.getInfo()) // "Mazda 3"
console.log(car2.getInfo()) // "Honda Civic"
```

---

## 4. Modern ES6+ Classes and `#` Private Fields

### The Problem: Prototype Syntax Was Verbose and Error-Prone

Prior to ES6, implementing inheritance required manually chaining prototypes with `Object.create()`, resetting `constructor` references, and making confusing calls to `ParentClass.call(this)`.

### The Solution: Declarative Class Syntax

ES6 classes provide a clean syntactic layer over prototype delegation, introducing keywords like `class`, `extends`, `super`, `static`, and true private fields using `#`.

```javascript
class Animal {
  species = "unknown"

  constructor(name) {
    this.name = name
    this._energy = 100
  }

  get energy() {
    return this._energy
  }

  eat() {
    this._energy = Math.min(100, this._energy + 20)
    return `${this.name} ate. Energy: ${this._energy}`
  }

  static createRandom() {
    const names = ["Rex", "Luna", "Max"]
    return new Animal(names[Math.floor(Math.random() * names.length)])
  }
}

// Inheritance with extends and super
class Dog extends Animal {
  #breed // Strict engine-level private field

  constructor(name, breed) {
    super(name) // Must be called before accessing 'this'
    this.#breed = breed
  }

  eat() {
    super.eat()
    return `${this.name} (${this.#breed}) ate kibble.`
  }

  bark() {
    return `${this.name} says: Woof!`
  }
}

const myDog = new Dog("Buddy", "Labrador")
console.log(myDog.eat())  // "Buddy (Labrador) ate kibble."
console.log(myDog.bark()) // "Buddy says: Woof!"

// myDog.#breed // SyntaxError: Private field '#breed' must be declared in an enclosing class
```

### True Encapsulation with `#`

Unlike the `_field` convention (which remains completely public) or closures (which recreate functions in memory), `#` private fields cannot be accessed outside the class, not even via `Object.keys()` or reflection APIs:

```javascript
class Wallet {
  #balance = 0

  constructor(initialBalance) {
    this.#balance = initialBalance
  }

  deposit(amount) {
    if (amount <= 0) throw new Error("Invalid amount")
    this.#balance += amount
  }

  get balance() {
    return this.#balance
  }
}

const w = new Wallet(500)
w.deposit(200)
console.log(w.balance) // 700
```

---

## 5. Composition vs. Inheritance

### The Problem: The Fragile Base Class Trap

Deep inheritance hierarchies (`Animal` → `Mammal` → `Carnivore` → `Feline` → `Cat`) lead to tight coupling: modifying a method in a high-level base class can unpredictably break subclasses several layers down. Furthermore, single inheritance cannot cleanly express entities like a `Duck` that can both fly and swim.

### The Solution: Composition with Mixins

Instead of modeling what an object **is** (inheritance), model what an object **can do** (composition) by assembling modular units of behavior.

```javascript
// Modular, reusable behaviors
const Swimmer = {
  swim() {
    return `${this.name} is swimming in water.`
  }
}

const Flyer = {
  fly() {
    return `${this.name} is flying through the sky.`
  }
}

const Walker = {
  walk() {
    return `${this.name} is walking.`
  }
}

// Helper to attach behaviors to class prototypes
function applyMixins(TargetClass, ...mixins) {
  Object.assign(TargetClass.prototype, ...mixins)
}

class Duck {
  constructor(name) {
    this.name = name
  }
}

class Hound {
  constructor(name) {
    this.name = name
  }
}

// Compose capabilities on demand
applyMixins(Duck, Swimmer, Flyer, Walker)
applyMixins(Hound, Swimmer, Walker)

const donald = new Duck("Donald")
console.log(donald.swim()) // "Donald is swimming in water."
console.log(donald.fly())  // "Donald is flying through the sky."

const buster = new Hound("Buster")
console.log(buster.swim()) // "Buster is swimming in water."
// buster.fly() // TypeError: buster.fly is not a function
```

---

## 6. Metaprogramming with `Proxy` and `Reflect`

### The Problem: Intercepting Fundamental Object Operations

Standard getters and setters only work for predefined properties. They cannot intercept property deletions (`delete`), dynamic missing properties, function invocations, or `in` operator checks.

### The Solution: `Proxy` and the `Reflect` API

A `Proxy` wraps a target object and intercepts fundamental operations through **traps**. The `Reflect` API provides standardized methods to forward operations to the original target cleanly.

```javascript
const originalUser = {
  name: "David",
  age: 25,
  apiKey: "secret_12345"
}

const secureUser = new Proxy(originalUser, {
  // Read trap
  get(target, prop, receiver) {
    if (prop === "apiKey") {
      return "••••••••" // Mask sensitive data
    }
    if (!(prop in target)) {
      console.warn(`Warning: property '${String(prop)}' does not exist.`)
      return undefined
    }
    return Reflect.get(target, prop, receiver)
  },

  // Write & validation trap
  set(target, prop, value, receiver) {
    if (prop === "age") {
      if (typeof value !== "number" || value < 0 || value > 120) {
        throw new TypeError("Age must be a valid number between 0 and 120")
      }
    }
    return Reflect.set(target, prop, value, receiver)
  },

  // Delete trap
  deleteProperty(target, prop) {
    if (prop === "apiKey") {
      throw new Error("Deleting the API key is forbidden")
    }
    return Reflect.deleteProperty(target, prop)
  }
})

console.log(secureUser.name)   // "David"
console.log(secureUser.apiKey) // "••••••••"
secureUser.age = 26            // Valid update
// secureUser.age = "twenty"   // Error: TypeError
// delete secureUser.apiKey    // Error: Deleting the API key is forbidden
```

### Real-World Example: Observable Reactive State (Vue.js Pattern)

```javascript
function createObservable(data, onChange) {
  return new Proxy(data, {
    set(target, prop, value, receiver) {
      const prevValue = target[prop]
      const success = Reflect.set(target, prop, value, receiver)

      if (success && prevValue !== value) {
        onChange(prop, prevValue, value)
      }
      return success
    }
  })
}

const state = createObservable({ theme: "light", volume: 80 }, (prop, oldVal, newVal) => {
  console.log(`[Reactivity] '${prop}' changed from '${oldVal}' to '${newVal}'`)
})

state.theme = "dark"  // Log: [Reactivity] 'theme' changed from 'light' to 'dark'
state.volume = 90     // Log: [Reactivity] 'volume' changed from '80' to '90'
```

---

## 7. `Symbol` and Non-Colliding Properties

### The Problem: Property Collisions and Secret Keys

When writing libraries or plugins that attach metadata to third-party objects, using common string keys (`_id`, `state`, `meta`) creates high risk of accidental property overwriting.

### The Solution: The `Symbol` Primitive

A `Symbol` is guaranteed to be **unique and immutable**. No two Symbols ever collide, even if created with the identical description.

```javascript
const id1 = Symbol("id")
const id2 = Symbol("id")

console.log(id1 === id2) // false (Each Symbol is unique)

const user = {
  name: "David",
  [id1]: "INTERNAL_SECRET_ID"
}

// Symbol keys are ignored by for...in loops and Object.keys()
console.log(Object.keys(user)) // ["name"]
console.log(JSON.stringify(user)) // '{"name":"David"}'

// Symbols must be retrieved via dedicated reflection APIs:
const symbols = Object.getOwnPropertySymbols(user)
console.log(user[symbols[0]]) // "INTERNAL_SECRET_ID"
```

### Well-Known Symbols: Customizing Language Primitives

JavaScript exposes system symbols like `Symbol.iterator`, `Symbol.toStringTag`, and `Symbol.toPrimitive` to let your custom objects plug directly into native language operators.

```javascript
class NumberRange {
  constructor(start, end) {
    this.start = start
    this.end = end
  }

  // Make custom instances iterable with for...of loops
  [Symbol.iterator]() {
    let current = this.start
    const limit = this.end

    return {
      next() {
        if (current <= limit) {
          return { value: current++, done: false }
        }
        return { value: undefined, done: true }
      }
    }
  }
}

for (const num of new NumberRange(1, 4)) {
  console.log(num) // 1, 2, 3, 4
}

// Works seamlessly with destructuring and spread:
console.log([...new NumberRange(10, 13)]) // [10, 11, 12, 13]
```

---

## Active Recall Practice & Exercises

Apply the **5R methodology**: test your understanding mentally and in code **before** expanding solutions.

### 1. Active Recall Questions

<details>
<summary><b>1. If two instances created via a constructor function access a prototype method, do they share the same function reference in memory?</b></summary>

**Explanation**: Yes. The function exists solely on `Constructor.prototype`. When you call `inst1.method()` and `inst2.method()`, both delegate lookup to that identical prototype object. Therefore, `inst1.method === inst2.method` evaluates strictly to `true`, drastically reducing memory overhead.
</details>

<details>
<summary><b>2. What is the practical difference between a `#field` private field and a property with `{ writable: false }`?</b></summary>

**Explanation**: `writable: false` creates a read-only property that remains entirely **public** (it is enumerated in `Object.keys()`, readable from anywhere, but cannot be reassigned). In contrast, `#field` is **engine-enforced private state**: attempting to read or write it outside the class body throws an immediate `SyntaxError`, and no reflection API can inspect it.
</details>

<details>
<summary><b>3. Why does `Object.assign()` fail to copy getters and setters as accessor functions when cloning?</b></summary>

**Explanation**: Because `Object.assign()` uses simple `[[Get]]` and `[[Set]]` operations. When reading from the source object, it evaluates the getter function and copies only the **resulting computed value** as a plain data property on the target object. To clone exact descriptor definitions, use `Object.defineProperties(target, Object.getOwnPropertyDescriptors(source))`.
</details>

---

### 2. Feynman Explanation Challenge

> **Challenge**: Explain the difference between `__proto__` and `prototype` to a Java developer using the analogy of a **factory recipe book** versus the **owner's manual inside a purchased product's box**.  
> *If you hesitate on which object owns which property, revisit [Section 2](#2-the-prototype-chain).*

---

### 3. Progressive Coding Exercises

#### Exercise 1 (Basic): Immutable Configuration with Descriptors

**Objective**: Create a secure object where critical keys cannot be overwritten or deleted, alongside a balance property guarded by accessor methods.

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function createBankAccount(holder, initialBalance) {
  let _balance = initialBalance

  const account = {
    deposit(amount) {
      if (typeof amount !== "number" || amount <= 0) {
        throw new Error("Deposit amount must be positive")
      }
      _balance += amount
      return _balance
    },
    withdraw(amount) {
      if (typeof amount !== "number" || amount <= 0) {
        throw new Error("Withdrawal amount must be positive")
      }
      if (amount > _balance) {
        throw new Error("Insufficient funds")
      }
      _balance -= amount
      return _balance
    }
  }

  Object.defineProperty(account, "holder", {
    value: holder,
    writable: false,
    enumerable: true,
    configurable: false
  })

  Object.defineProperty(account, "balance", {
    get() {
      return _balance
    },
    enumerable: true,
    configurable: false
  })

  return account
}

const myAccount = createBankAccount("David", 1000)
console.log(myAccount.holder)  // "David"
console.log(myAccount.balance) // 1000

myAccount.deposit(500)
console.log(myAccount.balance) // 1500

myAccount.balance = 99999      // Ignored: cannot overwrite accessor
console.log(myAccount.balance) // 1500
```
</details>

---

#### Exercise 2 (Intermediate): Role System and Composition with Mixins

**Objective**: Build a decoupled user hierarchy where serialization capabilities are added cleanly via prototype mixins.

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
class User {
  constructor(name, email) {
    this.name = name
    this.email = email
  }

  getProfile() {
    return `${this.name} <${this.email}>`
  }
}

class Admin extends User {
  constructor(name, email, permissions = ["read", "write", "delete"]) {
    super(name, email)
    this.permissions = permissions
  }
}

class Editor extends User {
  constructor(name, email) {
    super(name, email)
    this.articles = []
  }

  publish(article) {
    this.articles.push(article)
  }
}

// Modular Mixin
const JSONExportable = {
  toJSON() {
    return JSON.stringify(
      {
        type: this.constructor.name,
        ...this
      },
      null,
      2
    )
  }
}

// Prototype composition
Object.assign(Admin.prototype, JSONExportable)
Object.assign(Editor.prototype, JSONExportable)

const admin = new Admin("Ana", "ana@admin.com")
console.log(admin.toJSON())
/*
{
  "type": "Admin",
  "name": "Ana",
  "email": "ana@admin.com",
  "permissions": ["read", "write", "delete"]
}
*/
```
</details>

---

#### Exercise 3 (Advanced): Caching Proxy with TTL and Stats

**Objective**: Create a `Proxy` wrapper that memorizes asynchronous function calls with a time-to-live expiration and real-time cache statistics.

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

```javascript
function createCacheProxy(asyncFn, ttlMs = 5000) {
  const cache = new Map()
  const stats = { hits: 0, misses: 0 }

  return new Proxy(asyncFn, {
    async apply(target, thisArg, argsList) {
      const key = JSON.stringify(argsList)
      const now = Date.now()

      if (cache.has(key)) {
        const { value, expires } = cache.get(key)
        if (now < expires) {
          stats.hits++
          return value
        }
        cache.delete(key) // Expired entry
      }

      stats.misses++
      const result = await Reflect.apply(target, thisArg, argsList)

      cache.set(key, {
        value: result,
        expires: now + ttlMs
      })

      return result
    },

    get(target, prop, receiver) {
      if (prop === "stats") {
        return { ...stats }
      }
      if (prop === "clearCache") {
        return () => cache.clear()
      }
      return Reflect.get(target, prop, receiver)
    }
  })
}

// Demo with simulated DB fetch
async function fetchUser(id) {
  await new Promise(r => setTimeout(r, 100))
  return { id, name: `User ${id}` }
}

const cachedFetch = createCacheProxy(fetchUser, 3000)

;(async () => {
  console.log(await cachedFetch(1)) // Miss (~100ms)
  console.log(await cachedFetch(1)) // Hit (instant)
  console.log(cachedFetch.stats)    // { hits: 1, misses: 1 }
})()
```
</details>

---

## Critical Thinking and Debugging

### Scenario 1: The Fragile Base Class in Production

**Situation**: A UI team built a deep hierarchy: `BaseElement` → `VisualComponent` → `Container` → `Panel` → `Dashboard`. A developer added an internal event teardown inside `VisualComponent.prototype.render()`. Subclasses like `Dashboard` stopped responding to events because their own `render()` override did not call `super.render()`.

**Architectural Diagnosis**:
- **Root Cause**: Deep inheritance ties subclasses to the implicit private contracts of ancestor classes (*Fragile Base Class Problem*).
- **Solution**: Break monolithic hierarchies into small, composable capabilities (*LifecycleManager*, *Renderer*, *EventHandler*) composed via mixins or dependency injection.

---

### Scenario 2: Reactivity Leaks in Nested Proxies

**Situation**: When mutating deeply nested properties (`state.user.address.city = "Bogota"`), a top-level `Proxy` set trap fails to fire.

```javascript
const state = new Proxy({ user: { address: { city: "Medellin" } } }, {
  set(target, prop, val) {
    console.log(`Updated: ${prop}`)
    return Reflect.set(target, prop, val)
  }
})

state.user.address.city = "Bogota" // Silent! The proxy set trap never executes.
```

**Diagnosis & Fix**:
- **Cause**: A `Proxy` wraps only the outermost object. Accessing `state.user` returns the raw internal nested object.
- **Fix**: Build a recursive proxy (*Deep Proxy*) where the `get` trap wraps any returned child object dynamically before yielding it.

---

## Comparative Language Matrix

### JavaScript vs. Python

| Feature | JavaScript | Python |
|---|---|---|
| **Object Model** | Dynamic prototype delegation (`[[Prototype]]`). | Class-based with linear MRO (C3 Linearization). |
| **Private Fields** | Native `#field` (hard engine privacy). | Convention `_field` or name-mangled `__field`. |
| **Getters / Setters** | `get prop()` / `set prop()` or `defineProperty`. | Decorators `@property` and `@prop.setter`. |
| **Metaprogramming** | `Proxy` & `Reflect` over any object/function. | Dunder methods (`__getattr__`, `__setattr__`). |

### JavaScript vs. Java

| Feature | JavaScript | Java |
|---|---|---|
| **Paradigm** | Multi-paradigm prototype delegation. | Strict class-based OOP. |
| **Private Scope** | `#field` strictly enforced at runtime. | `private` keyword (can be broken via Reflection). |
| **Calling without `new`** | Traps context unless guarded with `new.target`. | Compile error: impossible by design. |
| **Dynamic Proxies** | Universal `Proxy` object for any object/function. | `java.lang.reflect.Proxy` (restricted to Interfaces). |

---

## Chapter Summary

1. **Descriptors define property anatomy**: `writable`, `enumerable`, and `configurable` enable immutable keys and safe accessors.
2. **Inheritance is prototype delegation**: objects resolve properties by walking up their `[[Prototype]]` chain to `null`.
3. **`new` executes 4 steps**: allocates memory, links the prototype, binds `this`, and returns the instance.
4. **ES6 classes wrap prototypes**, but `#field` syntax delivers genuine runtime encapsulation.
5. **Favor composition over inheritance**: assemble capabilities with mixins (*Can-Do*) instead of rigid class trees (*Is-A*).
6. **`Proxy` and `Reflect` provide full metaprogramming**: intercept operations for reactivity, logging, and validation.
7. **`Symbol` creates non-colliding keys**: ideal for internal library metadata and protocol hooks like `Symbol.iterator`.

---

## Next Chapter

→ **[Chapter 3: Deep Asynchrony, Promises, and the Event Loop](./cap-03)**: Now that you understand object memory structures, we will dive into non-blocking concurrency, microtask queues, and Promises in JavaScript's single-threaded runtime.
