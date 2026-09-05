---
title: "Chapter 7: Creational Patterns (Factory, Singleton, Builder)"
---

# Chapter 7: Creational Patterns (Factory, Singleton, Builder)

> Creational patterns address object creation in a controlled, safe, and reusable manner.

## Introduction

Creational patterns are the foundation for building systems that do not rely on direct and fragile instantiation. They encapsulate object creation logic, allowing the return of subtypes based on conditions and facilitating maintenance.

**Why does it matter?** Because creational patterns allow you to write flexible, maintainable, and reusable code. They are essential for scalable software architectures and for implementing other design patterns.

**Why does it matter?** Because creational patterns allow you to write flexible, maintainable, and reusable code. They are essential for scalable software architectures and for implementing other design patterns.

## 1. Factory

### Key Idea

The Factory pattern delegates object creation to a function or class that decides which concrete instance to return.

### What it is used for

- Encapsulating creation logic.
- Returning different subtypes based on conditions.
- Avoiding direct coupling to `new`.

### Real-world example

```javascript
function crearUsuario(tipo, nombre) {
  switch (tipo) {
    case "admin":
      return {
        nombre,
        rol: "admin",
        permisos: ["leer", "escribir", "eliminar"],
        describir() {
          return `Admin ${this.nombre} con permisos completos`
        }
      }
    case "editor":
      return {
        nombre,
        rol: "editor",
        permisos: ["leer", "escribir"],
        describir() {
          return `Editor ${this.nombre} con permisos de lectura y escritura`
        }
      }
    default:
      return {
        nombre,
        rol: "user",
        permisos: ["leer"],
        describir() {
          return `Usuario ${this.nombre} con permisos de solo lectura`
        }
      }
  }
}

const admin = crearUsuario("admin", "David")
const editor = crearUsuario("editor", "Ana")
```

### When to use it

- When the creation logic can vary.
- When you need to return different subtypes.
- When you want to centralize creation to facilitate maintenance.

## 2. Singleton

### Key Idea

The Singleton pattern guarantees that a class has a single instance and provides a global point of access to it.

### Implementation with closure

```javascript
const crearConexionBD = (function () {
  let instancia = null

  return function () {
    if (instancia) return instancia

    instancia = {
      host: "localhost",
      puerto: 5432,
      conectar() {
        console.log(`Conectado a ${this.host}:${this.puerto}`)
      }
    }

    return instancia
  }
})()

const con1 = crearConexionBD()
const con2 = crearConexionBD()

console.log(con1 === con2) // true
```

### Implementation with class

```javascript
class Configuracion {
  static instancia = null

  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = new Configuracion()
    }
    return Configuracion.instancia
  }

  constructor() {
    this.entorno = "produccion"
    this.apiURL = "https://api.ejemplo.com"
  }
}

const config1 = Configuracion.obtenerInstancia()
const config2 = Configuracion.obtenerInstancia()

console.log(config1 === config2) // true
```

### When to be careful

- A Singleton can become a global state that is difficult to test.
- In multi-threaded environments (worker_threads), a Singleton per thread is not shared.

## 3. Builder

### Key Idea

The Builder pattern separates the construction of a complex object from its representation, allowing it to be built step by step.

### Real-world example

```javascript
class ConsultaSQL {
  constructor() {
    this._select = "*"
    this._from = ""
    this._where = ""
    this._orderBy = ""
    this._limit = ""
  }

  select(campos) {
    this._select = campos
    return this
  }

  from(tabla) {
    this._from = tabla
    return this
  }

  where(condicion) {
    this._where = `WHERE ${condicion}`
    return this
  }

  orderBy(campo) {
    this._orderBy = `ORDER BY ${campo}`
    return this
  }

  limit(n) {
    this._limit = `LIMIT ${n}`
    return this
  }

  construir() {
    return `SELECT ${this._select} FROM ${this._from} ${this._where} ${this._orderBy} ${this._limit}`.replace(/\s+/g, " ").trim()
  }
}

const consulta = new ConsultaSQL()
  .select("nombre, email")
  .from("usuarios")
  .where("activo = true")
  .orderBy("nombre ASC")
  .limit(10)
  .construir()

// SELECT nombre, email FROM usuarios WHERE activo = true ORDER BY nombre ASC LIMIT 10
```

### Advantages

- Each step is optional and orderable.
- The same construction process can create different representations.
- It improves readability compared to a constructor with many parameters.

## Common Mistakes

- Using Singleton for everything: it turns the code into a maze of hidden dependencies.
- Forgetting to return `this` in Builder methods (breaks chaining).
- Creating Factories that only wrap `new` without adding decision logic.

## Summary

- **Factory** encapsulates creation and allows returning subtypes.
- **Singleton** guarantees a single instance with a global point of access.
- **Builder** builds complex objects step by step with fluent chaining.

## Next Chapter

In the next chapter, we will look at behavioral patterns such as Observer, Mediator, and Strategy, which define how components communicate and delegate responsibilities.