---
title: "Capítulo 2: Objetos, prototipos y clases"
---

# Capítulo 2: Objetos, prototipos y clases

> A diferencia de los lenguajes basados en clases tradicionales, JavaScript no clona moldes rígidos: conecta objetos vivos mediante una cadena dinámica de prototipos.

## Introducción

En JavaScript, casi todo lo que tocas en ejecución es un objeto. Sin embargo, muchos desarrolladores que vienen de Java, C# o Python intentan forzar su modelo mental de "clases como planos estáticos" sobre un motor que funciona por **delegación prototipal dinámica**.

Comprender cómo funcionan los descriptores internos de propiedades, la cadena de prototipos, el operador `new`, las clases modernas con campos privados `#`, la metaprogramación con `Proxy` y `Reflect`, y los tipos primitivos únicos como `Symbol`, es el paso indispensable para diseñar arquitecturas extensibles sin caer en trampas de memoria o acoplamientos rígidos.

---

## 1. Objetos literales y descriptores de propiedad

### El problema: propiedades sin control de mutación o visibilidad

Un objeto literal estándar en JavaScript es completamente abierto por defecto: cualquiera puede sobrescribir sus propiedades, reasignar métodos con tipos inválidos, iterar sobre datos sensibles con `Object.keys()`, o incluso borrar propiedades críticas con `delete`.

```javascript
const cuenta = { titular: "David", saldo: 1000 }

// Cualquiera puede sabotear el objeto accidentalmente:
cuenta.saldo = "mil pesos" // Rompe cálculos numéricos
delete cuenta.titular       // Destruye datos esenciales
```

### La solución: Descriptores con `Object.defineProperty`

Cada propiedad de un objeto posee atributos internos (metadatos) llamados **descriptores** que definen su comportamiento exacto ante asignaciones, enumeraciones y reconfiguraciones.

```javascript
const obj = {}

// 1. Propiedad de datos con protección estricta
Object.defineProperty(obj, "id", {
  value: "USR-9942",
  writable: false,      // Solo lectura: no se puede reasignar
  enumerable: true,     // Aparece en bucles for...in y Object.keys()
  configurable: false   // No se puede eliminar con delete ni alterar su descriptor
})

// 2. Propiedad de acceso (Getters y Setters)
let _contador = 0

Object.defineProperty(obj, "contador", {
  get() {
    return _contador
  },
  set(nuevoValor) {
    if (typeof nuevoValor !== "number" || nuevoValor < 0) {
      throw new TypeError("El contador debe ser un número no negativo")
    }
    _contador = nuevoValor
  },
  enumerable: true,
  configurable: false
})

obj.contador = 5
console.log(obj.contador) // 5

// obj.contador = -1 // Error: TypeError: El contador debe ser un número no negativo
// obj.id = "NUEVO"  // Silencioso en modo no estricto, TypeError en 'use strict'
```

### Tabla de descriptores de propiedad

| Descriptor | Por defecto con `defineProperty` | Por defecto en objeto literal `{ prop: val }` | Propósito |
|---|---|---|---|
| `value` | `undefined` | El valor asignado | El dato almacenado en la propiedad. |
| `writable` | `false` | `true` | Si es `true`, el valor puede cambiarse con un operador de asignación (`=`). |
| `enumerable` | `false` | `true` | Si es `true`, la propiedad aparece en `for...in` y `Object.keys()`. |
| `configurable` | `false` | `true` | Si es `true`, el tipo de descriptor puede modificarse y la propiedad puede eliminarse con `delete`. |
| `get` | `undefined` | `undefined` | Función que se ejecuta al leer la propiedad. |
| `set` | `undefined` | `undefined` | Función que recibe el nuevo valor al escribir en la propiedad. |

> **Trampa común**: Cuando defines una propiedad con `Object.defineProperty()`, todos los booleanos omitidos toman el valor `false` por defecto. En cambio, cuando creas `{ a: 1 }`, `writable`, `enumerable` y `configurable` son todos `true`.

### Conexión con Python

```python
# Python - Propiedades con decoradores @property
class Cuenta:
    def __init__(self, titular, saldo_inicial):
        self._titular = titular
        self._saldo = saldo_inicial

    @property
    def saldo(self):
        return self._saldo

    @saldo.setter
    def saldo(self, valor):
        if valor < 0:
            raise ValueError("El saldo no puede ser negativo")
        self._saldo = valor

c = Cuenta("David", 1000)
c.saldo = 1200
```

**Traduce exactamente**: Los getters y setters de JavaScript cumplen el mismo rol que `@property` y `@prop.setter` en Python para interceptar lecturas y escrituras con validaciones.  
**Cambia de fondo**: En Python los atributos privados son una convención (`_saldo`) o name-mangling (`__saldo`), mientras que `Object.defineProperty` con `writable: false` congela la propiedad a nivel del motor en C++.

### Conexión con Java

```java
// Java - Encapsulamiento tradicional con métodos accesores
public class Cuenta {
    private final String id;
    private double saldo;

    public Cuenta(String id, double saldoInicial) {
        this.id = id; // Inmutable tras el constructor
        this.saldo = saldoInicial;
    }

    public String getId() { return id; }
    public double getSaldo() { return saldo; }

    public void setSaldo(double nuevoSaldo) {
        if (nuevoSaldo < 0) throw new IllegalArgumentException("Saldo negativo");
        this.saldo = nuevoSaldo;
    }
}
```

**Traduce exactamente**: `writable: false` y `configurable: false` logran un efecto equivalente a un campo `final` en Java (no reasignable).  
**Cambia de fondo**: En Java los getters/setters son métodos explícitos (`cuenta.getSaldo()`). En JavaScript, los descriptores permiten que la sintaxis de acceso sea idéntica a una propiedad normal (`cuenta.saldo`), ejecutando la función por debajo de forma transparente.

---

## 2. La cadena de prototipos (Prototype Chain)

### El problema: duplicación masiva de métodos en memoria

Si creas 10,000 instancias de usuarios asignando funciones directamente dentro de cada objeto, cada instancia reservará memoria para una copia idéntica de cada función:

```javascript
function crearUsuario(nombre) {
  return {
    nombre,
    saludar() { return `Hola, soy ${this.nombre}` } // 10,000 funciones idénticas en memoria
  }
}
```

### La solución: delegación mediante prototipos

En lugar de copiar métodos, JavaScript utiliza un mecanismo de **delegación**. Cada objeto tiene un enlace interno a otro objeto llamado su **prototipo** (`[[Prototype]]`). Si una propiedad o método no se encuentra en el objeto actual, el motor sube por la cadena hasta encontrarlo o llegar a `null`.

### Diagrama mental de la cadena

```
instancia (u1)
  │  propiedades propias: { nombre: "David" }
  └── [[Prototype]] ──► Usuario.prototype
                          │  métodos compartidos: { saludar() }
                          └── [[Prototype]] ──► Object.prototype
                                                  │  métodos base: { toString(), hasOwnProperty() }
                                                  └── [[Prototype]] ──► null (fin de la cadena)
```

### `__proto__` vs. `prototype`

Esta es una de las mayores fuentes de confusión en JavaScript:

- `prototype`: Es una propiedad que **solo tienen las funciones** (excepto arrow functions). Es el objeto que se usará como prototipo para todas las instancias creadas con `new MiFuncion()`.
- `[[Prototype]]` (accesible históricamente como `__proto__` o formalmente con `Object.getPrototypeOf(obj)`): Es la referencia real que **todo objeto tiene** hacia su prototipo del cual hereda.

```javascript
function Usuario(nombre) {
  this.nombre = nombre
}

// Agregamos el método al prototipo compartido (1 sola copia en memoria)
Usuario.prototype.saludar = function() {
  return `Hola, soy ${this.nombre}`
}

const david = new Usuario("David")

console.log(david.saludar()) // "Hola, soy David"
console.log(Object.getPrototypeOf(david) === Usuario.prototype) // true
console.log(david.hasOwnProperty("nombre"))  // true (propiedad propia)
console.log(david.hasOwnProperty("saludar")) // false (heredada del prototipo)
```

### Conexión con Python

```python
# Python - Clases reales y MRO (Method Resolution Order)
class Usuario:
    def __init__(self, nombre):
        self.nombre = nombre

    def saludar(self):
        return f"Hola, soy {self.nombre}"

u = Usuario("David")
# Python busca en la clase del objeto (u.__class__) y en su MRO
print(Usuario.__mro__) # (<class '__main__.Usuario'>, <class 'object'>)
```

**Traduce exactamente**: Ambos lenguajes buscan métodos en una jerarquía superior si la instancia no los contiene directamente.  
**Cambia de fondo**: En Python, las clases son tipos fijos y la resolución sigue un árbol precalculado (C3 Linearization). En JavaScript, los prototipos son **objetos planos mutables en tiempo de ejecución**: si alteras `Usuario.prototype` después de instanciar, todas las instancias vivas ven el cambio instantáneamente.

---

## 3. Funciones constructoras y el operador `new`

### El problema: ¿qué hace exactamente `new` bajo el capó?

Invocar una función constructora sin `new` es un bug clásico: en modo no estricto, `this` apuntará al objeto global (`window` o `global`), contaminando el entorno y retornando `undefined`.

```javascript
function Auto(marca) {
  this.marca = marca
}

const a1 = Auto("Toyota") // ¡Sin new!
console.log(a1)           // undefined
// console.log(window.marca) // "Toyota" (¡Contaminó el scope global!)
```

### La solución: El ciclo de 4 pasos de `new`

Cuando ejecutas `new Auto("Toyota")`, el motor realiza 4 pasos fundamentales:

1. **Crea un nuevo objeto vacío** en memoria en el Heap (`{}`).
2. **Vincula el prototipo**: enlaza el `[[Prototype]]` del nuevo objeto a `Auto.prototype`.
3. **Ejecuta el constructor**: invoca `Auto` haciendo que `this` apunte al nuevo objeto recién creado y le pasa los argumentos.
4. **Retorna el objeto**: si la función no retorna explícitamente un objeto propio, retorna automáticamente el `this` recién creado.

```javascript
function Auto(marca, modelo) {
  // Protección moderna: si olvidan 'new', lo forzamos
  if (!new.target) {
    return new Auto(marca, modelo)
  }

  this.marca = marca
  this.modelo = modelo
}

Auto.prototype.obtenerInfo = function() {
  return `${this.marca} ${this.modelo}`
}

const auto1 = new Auto("Mazda", "3")
const auto2 = Auto("Honda", "Civic") // Seguro gracias a new.target

console.log(auto1.obtenerInfo()) // "Mazda 3"
console.log(auto2.obtenerInfo()) // "Honda Civic"
```

---

## 4. Clases en ES6+ y campos privados `#`

### El problema: la sintaxis de prototipos era propensa a errores

Antes de ES6, simular herencia implicaba manipular prototipos manualmente con `Object.create()`, reasignar `constructor` a mano y hacer llamadas confusas a `SuperClase.call(this)`.

### La solución: sintaxis de clases declarativa

Las clases de ES6 introdujeron una capa de azúcar sintáctico limpia y robusta sobre el mismo motor prototipal, añadiendo palabras clave como `class`, `extends`, `super`, `static` y campos privados reales con `#`.

```javascript
class Animal {
  especie = "desconocida"

  constructor(nombre) {
    this.nombre = nombre
    this._energia = 100
  }

  get energia() {
    return this._energia
  }

  comer() {
    this._energia = Math.min(100, this._energia + 20)
    return `${this.nombre} comió. Energía: ${this._energia}`
  }

  static crearAleatorio() {
    const nombres = ["Rex", "Luna", "Max"]
    return new Animal(nombres[Math.floor(Math.random() * nombres.length)])
  }
}

// Herencia con extends y super
class Perro extends Animal {
  #raza // Campo privado estricto a nivel de motor

  constructor(nombre, raza) {
    super(nombre) // Obligatorio antes de acceder a 'this'
    this.#raza = raza
  }

  comer() {
    super.comer()
    return `${this.nombre} (${this.#raza}) comió croquetas.`
  }

  ladrar() {
    return `${this.nombre} dice: ¡Guau!`
  }
}

const miPerro = new Perro("Firulais", "Labrador")
console.log(miPerro.comer())  // "Firulais (Labrador) comió croquetas."
console.log(miPerro.ladrar()) // "Firulais dice: ¡Guau!"

// miPerro.#raza // SyntaxError: Private field '#raza' must be declared in an enclosing class
```

### Encapsulamiento real con `#`

A diferencia de la convención `_variable` (que sigue siendo pública) o los closures (que recrean funciones en memoria), los campos privados con `#` son inaccesibles desde fuera de la clase, incluso mediante `Object.keys()` o `Reflect`:

```javascript
class Billetera {
  #saldo = 0

  constructor(saldoInicial) {
    this.#saldo = saldoInicial
  }

  depositar(monto) {
    if (monto <= 0) throw new Error("Monto inválido")
    this.#saldo += monto
  }

  get saldo() {
    return this.#saldo
  }
}

const b = new Billetera(500)
b.depositar(200)
console.log(b.saldo) // 700
```

### Conexión con Java

```java
// Java - Modificadores de acceso estrictos
public class Perro extends Animal {
    private String raza; // Privado en tiempo de compilación

    public Perro(String nombre, String raza) {
        super(nombre);
        this.raza = raza;
    }

    @Override
    public String comer() {
        super.comer();
        return this.getNombre() + " (" + this.raza + ") comió croquetas.";
    }
}
```

**Traduce exactamente**: `extends`, `super()` y el comportamiento de sobrescritura de métodos funcionan bajo la misma lógica mental.  
**Cambia de fondo**: En Java, la privacidad de `private` se puede romper mediante reflexión en tiempo de ejecución (`field.setAccessible(true)`). En JavaScript, los campos con `#` están protegidos mediante una tabla débil interna (*Private Brand Check*) a nivel del motor V8: no existe ninguna API para leer `#campo` desde afuera.

---

## 5. Composición vs. Herencia

### El problema: la trampa de la herencia profunda (Fragile Base Class)

Una jerarquía de herencia profunda (`Animal` → `Mamifero` → `Carnivoro` → `Felino` → `Gato`) crea un acoplamiento frágil: cambiar un método en la clase base puede romper inesperadamente subclases a cuatro niveles de distancia. Además, ¿qué pasa si necesitas un `Pato` que debe nadar y volar, pero la herencia simple solo permite heredar de una sola clase base?

### La solución: Composición con Mixins

En lugar de modelar lo que un objeto **es** (herencia), modelamos lo que un objeto **puede hacer** (composición) combinando piezas de comportamiento reutilizables.

```javascript
// Comportamientos aislados y reutilizables
const Nadador = {
  nadar() {
    return `${this.nombre} está nadando en el agua.`
  }
}

const Volador = {
  volar() {
    return `${this.nombre} está volando por el cielo.`
  }
}

const Caminador = {
  caminar() {
    return `${this.nombre} está caminando.`
  }
}

// Función para componer comportamientos en el prototipo de una clase
function aplicarMixins(ClaseDestino, ...mixins) {
  Object.assign(ClaseDestino.prototype, ...mixins)
}

class Pato {
  constructor(nombre) {
    this.nombre = nombre
  }
}

class PerroComun {
  constructor(nombre) {
    this.nombre = nombre
  }
}

// Componemos capacidades según la necesidad
aplicarMixins(Pato, Nadador, Volador, Caminador)
aplicarMixins(PerroComun, Nadador, Caminador)

const donald = new Pato("Donald")
console.log(donald.nadar()) // "Donald está nadando en el agua."
console.log(donald.volar()) // "Donald está volando por el cielo."

const bobby = new PerroComun("Bobby")
console.log(bobby.nadar())   // "Bobby está nadando en el agua."
// bobby.volar() // TypeError: bobby.volar is not a function
```

### ¿Cuándo usar cada enfoque?

- **Usa Herencia (`extends`)**: Solo cuando exista una relación estricta y permanente de tipo "es un" (*Is-A*), con una jerarquía de no más de 1 o 2 niveles (por ejemplo, `HttpError extends Error`).
- **Usa Composición (Mixins / Funciones)**: Cuando modeles capacidades transversales o relaciones del tipo "tiene un" o "puede hacer" (*Can-Do*).

---

## 6. Metaprogramación con `Proxy` y `Reflect`

### El problema: interceptar operaciones fundamentales sobre objetos

Los getters y setters tradicionales solo funcionan sobre propiedades conocidas de antemano. No permiten interceptar el borrado de propiedades (`delete`), la lectura de propiedades inexistentes dinámicas, la llamada a funciones, o la verificación con el operador `in`.

### La solución: `Proxy` y la API `Reflect`

Un `Proxy` envuelve a un objeto destino (*target*) e intercepta sus operaciones fundamentales mediante funciones trampa (*traps*). La API `Reflect` proporciona los métodos por defecto para ejecutar la operación original limpiamente.

```javascript
const usuarioOriginal = {
  nombre: "David",
  edad: 25,
  apiKey: "secret_12345"
}

const usuarioSeguro = new Proxy(usuarioOriginal, {
  // Trampa para lectura de propiedades
  get(target, prop, receiver) {
    if (prop === "apiKey") {
      return "••••••••" // Ocultamos datos confidenciales
    }
    if (!(prop in target)) {
      console.warn(`Advertencia: la propiedad '${String(prop)}' no existe.`)
      return undefined
    }
    return Reflect.get(target, prop, receiver)
  },

  // Trampa para escritura y validación
  set(target, prop, valor, receiver) {
    if (prop === "edad") {
      if (typeof valor !== "number" || valor < 0 || valor > 120) {
        throw new TypeError("La edad debe ser un número válido entre 0 y 120")
      }
    }
    return Reflect.set(target, prop, valor, receiver)
  },

  // Trampa para borrado
  deleteProperty(target, prop) {
    if (prop === "apiKey") {
      throw new Error("No está permitido eliminar la clave de API")
    }
    return Reflect.deleteProperty(target, prop)
  }
})

console.log(usuarioSeguro.nombre) // "David"
console.log(usuarioSeguro.apiKey) // "••••••••"
usuarioSeguro.edad = 26          // Modificación exitosa
// usuarioSeguro.edad = "veinte" // Error: TypeError
// delete usuarioSeguro.apiKey   // Error: No está permitido eliminar la clave
```

### Ejemplo real: Sistema reactivo observable (como en Vue.js)

```javascript
function crearObservable(datos, alCambiar) {
  return new Proxy(datos, {
    set(target, prop, valor, receiver) {
      const valorAnterior = target[prop]
      const exito = Reflect.set(target, prop, valor, receiver)

      if (exito && valorAnterior !== valor) {
        alCambiar(prop, valorAnterior, valor)
      }
      return exito
    }
  })
}

const estado = crearObservable({ tema: "claro", volumen: 80 }, (prop, viejo, nuevo) => {
  console.log(`[Reactividad] '${prop}' cambió de '${viejo}' a '${nuevo}'`)
})

estado.tema = "oscuro"   // Log: [Reactividad] 'tema' cambió de 'claro' a 'oscuro'
estado.volumen = 90      // Log: [Reactividad] 'volumen' cambió de '80' a '90'
```

### Conexión con Java

```java
// Java - Dynamic Proxy con Reflection
import java.lang.reflect.*;

interface Servicio {
    void ejecutar();
}

public class ProxyDemo {
    public static void main(String[] args) {
        Servicio original = () -> System.out.println("Ejecutando servicio real");

        Servicio proxy = (Servicio) Proxy.newProxyInstance(
            Servicio.class.getClassLoader(),
            new Class<?>[]{Servicio.class},
            (p, method, args1) -> {
                System.out.println("Antes de ejecutar: " + method.getName());
                Object res = method.invoke(original, args1);
                System.out.println("Después de ejecutar");
                return res;
            }
        );

        proxy.ejecutar();
    }
}
```

**Traduce exactamente**: Ambos permiten interceptar llamadas a métodos en tiempo de ejecución para añadir logging, validaciones o reactividad.  
**Cambia de fondo**: En Java, `java.lang.reflect.Proxy` **solo puede interceptar métodos de interfaces**, no campos directos ni objetos planos. En JavaScript, `Proxy` intercepta cualquier operación sobre cualquier objeto o función directamente a nivel de motor.

---

## 7. `Symbol` y propiedades no colisionables

### El problema: colisión de nombres y propiedades ocultas

Cuando escribes una librería o plugin que necesita almacenar metadatos en objetos ajenos, corres el riesgo de sobrescribir accidentalmente una propiedad existente del usuario si usas strings comunes como claves (`_id`, `state`, `meta`).

### La solución: Tipos primitivos `Symbol`

Un `Symbol` es un tipo de dato primitivo garantizado como **único e inmutable**. Jamás colisiona con otro Symbol, ni siquiera si comparten la misma descripción.

```javascript
const id1 = Symbol("id")
const id2 = Symbol("id")

console.log(id1 === id2) // false (Cada Symbol es único)

const usuario = {
  nombre: "David",
  [id1]: "ID_INTERNO_SECRETO"
}

// Las claves Symbol no aparecen en bucles for...in ni en Object.keys()
console.log(Object.keys(usuario)) // ["nombre"]
console.log(JSON.stringify(usuario)) // '{"nombre":"David"}'

// Para leer los símbolos de un objeto se requiere una API específica:
const simbolos = Object.getOwnPropertySymbols(usuario)
console.log(usuario[simbolos[0]]) // "ID_INTERNO_SECRETO"
```

### Well-Known Symbols: personalizando el comportamiento del lenguaje

JavaScript expone símbolos del sistema (*Well-Known Symbols*) como `Symbol.iterator`, `Symbol.toStringTag` o `Symbol.toPrimitive` para permitirte modificar cómo responde tu objeto a operadores nativos.

```javascript
class Rango {
  constructor(inicio, fin) {
    this.inicio = inicio
    this.fin = fin
  }

  // Hacemos que cualquier instancia de Rango sea iterable con for...of
  [Symbol.iterator]() {
    let actual = this.inicio
    const limite = this.fin

    return {
      next() {
        if (actual <= limite) {
          return { value: actual++, done: false }
        }
        return { value: undefined, done: true }
      }
    }
  }
}

const conteo = new Rango(1, 4)
for (const numero of conteo) {
  console.log(numero) // 1, 2, 3, 4
}

// También funciona con destructuring y spread:
console.log([...new Rango(10, 13)]) // [10, 11, 12, 13]
```

---

## Práctica y ejercicios de estudio activo

Aplica el método de las **5R**: intenta resolver mentalmente o en código cada desafío **antes** de abrir las soluciones desplegables.

### 1. Preguntas de recuperación activa

<details>
<summary><b>1. Si dos objetos creados con una función constructora tienen un método definido en el prototipo, ¿comparten la misma referencia de función en memoria?</b></summary>

**Explicación**: Sí. El método vive exclusivamente en `Constructor.prototype`. Cuando llamas a `instancia1.metodo()` e `instancia2.metodo()`, ambas delegan la búsqueda al mismo objeto prototipo, por lo que `instancia1.metodo === instancia2.metodo` es estrictamente `true`. Esto ahorra memoria drásticamente.
</details>

<details>
<summary><b>2. ¿Qué diferencia práctica existe entre un campo privado `#saldo` y una propiedad con descriptor `{ writable: false }`?</b></summary>

**Explicación**: `writable: false` crea una propiedad de solo lectura que sigue siendo completamente **pública** (es visible en `Object.keys`, se puede leer desde fuera, pero no reasignar). En cambio, `#saldo` es un campo **privado a nivel de motor**: intentar leerlo o escribirlo fuera del cuerpo de la clase genera un `SyntaxError` inmediato y no existe ninguna API de reflexión para inspeccionarlo.
</details>

<details>
<summary><b>3. ¿Por qué `Object.assign()` no copia getters y setters como funciones accesoras al clonar un objeto?</b></summary>

**Explicación**: Porque `Object.assign()` utiliza la operación de lectura simple `[[Get]]` en el objeto fuente y de escritura `[[Set]]` en el destino. Al leer el getter del objeto original, evalúa la función y copia únicamente el **valor resultante** resultante como una propiedad de datos normal, perdiendo el getter/setter en el objeto destino. Para clonar descriptores exactos se debe usar `Object.defineProperties(destino, Object.getOwnPropertyDescriptors(origen))`.
</details>

---

### 2. Ejercicio de explicación (Técnica Feynman)

> **Reto**: Explica la diferencia entre `__proto__` y `prototype` a un desarrollador que solo conoce clases en Java o C#, utilizando la analogía de una **receta de cocina de fábrica** versus el **manual que viene en la caja de un producto comprado**.  
> *Si dudas sobre qué objeto posee cada propiedad, regresa a la [Sección 2](#2-la-cadena-de-prototipos-prototype-chain).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): Objeto inmutable de configuración con Descriptores

**Objetivo**: Crear un objeto seguro donde ciertas propiedades críticas no puedan ser sobreescritas ni eliminadas, y un saldo protegido por métodos accesores.

**Enunciado**:  
Crea una función `crearCuentaBancaria(titular, saldoInicial)` que retorne un objeto con:
1. `titular`: solo lectura (`writable: false`, `enumerable: true`, `configurable: false`).
2. `saldo`: propiedad con getter que retorna el saldo numérico actual, sin setter directo (para evitar asignaciones arbitrarias).
3. Métodos `depositar(monto)` y `retirar(monto)` que validen montos positivos y fondos suficientes.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearCuentaBancaria(titular, saldoInicial) {
  let _saldo = saldoInicial

  const cuenta = {
    depositar(monto) {
      if (typeof monto !== "number" || monto <= 0) {
        throw new Error("El monto a depositar debe ser un número positivo")
      }
      _saldo += monto
      return _saldo
    },
    retirar(monto) {
      if (typeof monto !== "number" || monto <= 0) {
        throw new Error("El monto a retirar debe ser un número positivo")
      }
      if (monto > _saldo) {
        throw new Error("Fondos insuficientes")
      }
      _saldo -= monto
      return _saldo
    }
  }

  Object.defineProperty(cuenta, "titular", {
    value: titular,
    writable: false,
    enumerable: true,
    configurable: false
  })

  Object.defineProperty(cuenta, "saldo", {
    get() {
      return _saldo
    },
    enumerable: true,
    configurable: false
  })

  return cuenta
}

const miCuenta = crearCuentaBancaria("David", 1000)
console.log(miCuenta.titular) // "David"
console.log(miCuenta.saldo)   // 1000

miCuenta.depositar(500)
console.log(miCuenta.saldo)   // 1500

miCuenta.saldo = 99999        // Silencioso o error: no altera _saldo
console.log(miCuenta.saldo)   // 1500
```
</details>

---

#### Ejercicio 2 (Intermedio): Sistema de Roles y Composición con Mixins

**Objetivo**: Diseñar una jerarquía desacoplada de usuarios donde las capacidades de administración y exportación se agreguen mediante mixins sobre prototipos.

**Requisitos**:
1. Clase base `Usuario(nombre, email)`.
2. Clases `Admin` y `Editor` que extiendan de `Usuario`.
3. Mixin `ExportableJSON` con método `exportarJSON()` que serialice las propiedades del objeto con formato indentado.
4. Aplicar el mixin a las clases deseadas sin duplicar código en constructores.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class Usuario {
  constructor(nombre, email) {
    this.nombre = nombre
    this.email = email
  }

  obtenerPerfil() {
    return `${this.nombre} <${this.email}>`
  }
}

class Admin extends Usuario {
  constructor(nombre, email, permisos = ["leer", "escribir", "borrar"]) {
    super(nombre, email)
    this.permisos = permisos
  }
}

class Editor extends Usuario {
  constructor(nombre, email) {
    super(nombre, email)
    this.articulos = []
  }

  publicar(articulo) {
    this.articulos.push(articulo)
  }
}

// Mixin desacoplado
const ExportableJSON = {
  exportarJSON() {
    return JSON.stringify(
      {
        tipo: this.constructor.name,
        ...this
      },
      null,
      2
    )
  }
}

// Composición en el prototipo
Object.assign(Admin.prototype, ExportableJSON)
Object.assign(Editor.prototype, ExportableJSON)

const admin = new Admin("Ana", "ana@admin.com")
console.log(admin.exportarJSON())
/*
{
  "tipo": "Admin",
  "nombre": "Ana",
  "email": "ana@admin.com",
  "permisos": ["leer", "escribir", "borrar"]
}
*/
```
</details>

---

#### Ejercicio 3 (Avanzado): Proxy de Caché con TTL e Intercepción de Métodos

**Objetivo**: Construir un wrapper con `Proxy` que memorice los resultados de llamadas a funciones asíncronas costosas con tiempo de expiración (TTL) y métricas de rendimiento.

**Requisitos**:
1. Función `crearCacheProxy(fnAsync, ttlMs)` que retorne un Proxy sobre la función.
2. Interceptar la ejecución con la trampa `apply`.
3. Mantener estadísticas (`hits`, `misses`) accesibles mediante la propiedad `.stats` en el Proxy.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearCacheProxy(fnAsync, ttlMs = 5000) {
  const cache = new Map()
  const stats = { hits: 0, misses: 0 }

  return new Proxy(fnAsync, {
    async apply(target, thisArg, argsList) {
      const clave = JSON.stringify(argsList)
      const ahora = Date.now()

      if (cache.has(clave)) {
        const { valor, expira } = cache.get(clave)
        if (ahora < expira) {
          stats.hits++
          return valor
        }
        cache.delete(clave) // Expiró
      }

      stats.misses++
      const resultado = await Reflect.apply(target, thisArg, argsList)

      cache.set(clave, {
        valor: resultado,
        expira: ahora + ttlMs
      })

      return resultado
    },

    get(target, prop, receiver) {
      if (prop === "stats") {
        return { ...stats }
      }
      if (prop === "limpiarCache") {
        return () => cache.clear()
      }
      return Reflect.get(target, prop, receiver)
    }
  })
}

// Prueba con función simulada
async function consultarBaseDatos(id) {
  await new Promise(r => setTimeout(r, 100)) // Simula latencia
  return { id, datos: `Info de usuario ${id}` }
}

const consultarConCache = crearCacheProxy(consultarBaseDatos, 2000)

;(async () => {
  console.log(await consultarConCache(10)) // Miss (demora 100ms)
  console.log(await consultarConCache(10)) // Hit (instantáneo)
  console.log(consultarConCache.stats)    // { hits: 1, misses: 1 }
})()
```
</details>

---

## Pensamiento crítico y depuración

### Escenario 1: El problema de la clase base frágil en producción

**Situación**: Un equipo diseñó una jerarquía profunda para componentes de interfaz: `ElementoBase` → `ComponenteVisual` → `Contenedor` → `Panel` → `Dashboard`. Un desarrollador modificó `ComponenteVisual` agregando un método `render()` con lógica de limpieza de eventos. Inesperadamente, los gráficos dentro del `Dashboard` dejaron de responder porque su propio método `render()` sobrescribía el nuevo comportamiento sin invocar `super.render()`.

**Preguntas de análisis**:
1. ¿Por qué la herencia jerárquica profunda crea acoplamiento temporal y fragilidad?
2. ¿Cómo se refactoriza este diseño usando el principio de "Composición sobre Herencia"?

**Diagnóstico arquitectónico**:
- **Causa**: En herencias profundas, las clases derivadas asumen implícitamente el estado y contrato interno de todas sus clases antecesoras. Cualquier cambio en un nivel intermedio altera las asunciones de los niveles inferiores (*Fragile Base Class Problem*).
- **Solución moderna**: Separar responsabilidades en pequeños objetos o funciones (*LifecycleManager*, *EventCleaner*, *Renderer*) y componerlos en el componente mediante inyección o mixins, en lugar de heredar un árbol rígido.

---

### Escenario 2: Fugas de reactividad en Proxies con objetos anidados

**Situación**: Implementas un `Proxy` para detectar cambios de estado en tu aplicación, pero descubres que cuando modificas una propiedad anidada (`estado.usuario.direccion.ciudad = "Bogotá"`), la trampa `set` del Proxy principal **no se dispara**.

```javascript
const estado = new Proxy({ usuario: { nombre: "David", direccion: { ciudad: "Medellín" } } }, {
  set(target, prop, val) {
    console.log(`Modificado: ${prop}`)
    return Reflect.set(target, prop, val)
  }
})

estado.usuario.direccion.ciudad = "Bogotá" // ¡Silencio total! No se ejecuta el log.
```

**Diagnóstico**:
- **Causa**: Un `Proxy` solo envuelve al objeto de primer nivel. Cuando accedes a `estado.usuario`, la trampa `get` devuelve el objeto plano interno original, el cual no está envuelto por ningún Proxy.
- **Solución**: Implementar un Proxy recursivo (*Deep Proxy*) donde la trampa `get`, al detectar que el valor retornado es un objeto, lo envuelva dinámicamente en otro Proxy antes de entregarlo.

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Característica | JavaScript | Python |
|---|---|---|
| **Modelo de objetos** | Prototipal dinámico (`[[Prototype]]`). | Basado en clases reales con MRO lineal. |
| **Campos privados** | Sintaxis nativa `#campo` (estricto a nivel de motor). | Convención `_campo` o name-mangling `__campo`. |
| **Getters / Setters** | `get prop()` / `set prop()` o `Object.defineProperty`. | Decoradores `@property` y `@prop.setter`. |
| **Metaprogramación** | `Proxy` y `Reflect` sobre cualquier objeto. | Métodos mágicos (`__getattr__`, `__setattr__`). |

### JavaScript vs. Java

| Característica | JavaScript | Java |
|---|---|---|
| **Paradigma** | Multi-paradigma con herencia prototipal. | Orientado a objetos estricto basado en clases. |
| **Privacidad** | `#campo` inviolable en tiempo de ejecución. | Modificador `private` (vulnerable a Reflection). |
| **Constructores sin `new`** | Genera errores de contexto a menos que uses `new.target`. | Imposible: el compilador rechaza la sintaxis. |
| **Proxies dinámicos** | `new Proxy(target, handler)` para cualquier objeto/función. | `java.lang.reflect.Proxy` (restringido solo a interfaces). |

---

## Resumen del capítulo

1. **Los descriptores controlan la anatomía de cada propiedad**: `writable`, `enumerable` y `configurable` permiten crear propiedades inmutables y getters/setters seguros.
2. **La herencia en JavaScript es por delegación prototipal**: los objetos buscan métodos hacia arriba en su cadena `[[Prototype]]` hasta llegar a `null`.
3. **`new` automatiza cuatro pasos**: reserva memoria, enlaza el prototipo, ejecuta el constructor vinculando `this` y retorna el objeto resultante.
4. **Las clases ES6 son azúcar sobre prototipos**, pero los campos privados `#` introducen encapsulamiento real y seguro a nivel de motor.
5. **Prefiere composición sobre herencia**: combina mixins y funciones para otorgar capacidades (*Can-Do*) en lugar de crear árboles rígidos de herencia (*Is-A*).
6. **`Proxy` y `Reflect` permiten metaprogramación completa**: interceptan accesos, asignaciones, borrados y ejecuciones para reactividad y validación.
7. **`Symbol` garantiza identificadores únicos**: ideal para metadatos que no deben colisionar ni exponerse en iteraciones comunes.

---

## Siguiente Capítulo

→ **[Capítulo 3: Asincronía profunda, Promesas y Event Loop](./cap-03)**: Ahora que dominas la estructura de los objetos en memoria, exploraremos cómo JavaScript gestiona la concurrencia no bloqueante, la cola de microtareas y la resolución de Promesas en un entorno mono-hilo.
