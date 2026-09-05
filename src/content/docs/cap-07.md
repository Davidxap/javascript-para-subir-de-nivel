---
title: "Capítulo 7: Patrones creacionales (Factory, Singleton, Builder)"
---

# Capítulo 7: Patrones creacionales (Factory, Singleton, Builder)

> Los patrones creacionales abordan la creación de objetos de forma controlada, segura y reutilizable.

## Introducción

Los patrones creacionales son la base para construir sistemas que no dependan de instanciación directa y frágil. Encapsulan la lógica de creación de objetos, permitiendo devolver subtipos según condiciones y facilitando el mantenimiento.

**¿Por qué importa?** Porque los patrones creacionales permiten crear código flexible, mantenible y reutilizable. Son esenciales para arquitecturas de software escalables y para implementar otros patrones de diseño.

**¿Por qué importa?** Porque los patrones creacionales permiten crear código flexible, mantenible y reutilizable. Son esenciales para arquitecturas de software escalables y para implementar otros patrones de diseño.

## 1. Factory

### Idea clave

El patrón Factory delega la creación de objetos a una función o clase que decide qué instancia concreta devolver.

### Para qué sirve

- Encapsular la lógica de creación.
- Devolver distintos subtipos según condiciones.
- Evitar el acoplamiento directo a `new`.

### Ejemplo real

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

### Cuándo usarlo

- Cuando la lógica de creación puede variar.
- Cuando necesitas devolver diferentes subtipos.
- Cuando quieres centralizar la creación para facilitar mantenimiento.

## 2. Singleton

### Idea clave

El patrón Singleton garantiza que una clase tenga una única instancia y proporciona un punto de acceso global a ella.

### Implementación con closure

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

### Implementación con clase

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

### Cuándo tener cuidado

- Un Singleton puede convertirse en un estado global difícil de testear.
- En entornos con múltiples hilos (worker_threads), un Singleton por hilo no es compartido.

## 3. Builder

### Idea clave

El patrón Builder separa la construcción de un objeto complejo de su representación, permitiendo construir paso a paso.

### Ejemplo real

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

### Ventajas

- Cada paso es opcional y ordenable.
- El mismo proceso de construcción puede crear representaciones distintas.
- Mejora la legibilidad frente a un constructor con muchos parámetros.

## Errores Comunes

- Usar Singleton para todo: convierte el código en un laberinto de dependencias ocultas.
- Olvidar retornar `this` en los métodos del Builder (rompe el encadenamiento).
- Crear Factories que solo envuelven `new` sin añadir lógica de decisión.

## Resumen

- **Factory** encapsula la creación y permite devolver subtipos.
- **Singleton** garantiza una única instancia con un punto de acceso global.
- **Builder** construye objetos complejos paso a paso con encadenamiento fluido.

## Siguiente Capítulo

En el próximo capítulo veremos patrones comportamentales como Observer, Mediator y Strategy, que definen cómo los componentes se comunican y delegan responsabilidades.
