---
title: "Capítulo 1: Funciones modernas, destructuring y entorno léxico"
---

# Capítulo 1: Funciones modernas, destructuring y entorno léxico

> Antes de abordar patrones de arquitectura o asincronía avanzada, necesitas dominar los cimientos: cómo viajan los datos, cómo se recuerdan las variables y cómo el motor de JavaScript procesa cada instrucción.

## Introducción

Las funciones en JavaScript no son simples bloques de código: son **ciudadanos de primera clase** (*first-class citizens*). Esto significa que puedes tratarlas como cualquier otro valor: asignarlas a variables, guardarlas en arreglos, pasarlas como argumentos a otras funciones o retornarlas como resultado.

Este comportamiento habilita patrones muy expresivos (como *closures*, funciones de orden superior y composición), pero también introduce trampas si no entiendes cómo gestiona el motor el alcance (*scope*), el contexto (`this`) y la memoria.

En este capítulo recorrerás desde la sintaxis moderna de manipulación de datos (*destructuring*, *rest/spread*) hasta las entrañas del motor (*Execution Context*, *Call Stack*, *Heap*, *Garbage Collection* y el *Event Loop*). Al final, encontrarás una guía de estudio activo y comparativas directas con Python y Java para conectar estos conceptos con lo que ya conoces.

---

## 1. Fundamentos: declaraciones, expresiones y alcance

### El problema: ¿cómo organizamos y reutilizamos lógica?

Imagina que calculas el impuesto de compras en cinco lugares distintos de tu aplicación. Si la tasa impositiva cambia, tendrías que modificar cinco archivos. Encapsular la operación en una función resuelve la duplicación, pero la forma en que defines esa función cambia drásticamente su comportamiento en tiempo de ejecución.

### Declaración vs. Expresión de función

```javascript
// 1. Declaración de función (Function Declaration)
// El motor la registra completa antes de ejecutar la primera línea de código (Hoisting)
console.log(sumar(5, 3)) // 8 (funciona aunque esté antes de su definición)

function sumar(a, b) {
  return a + b
}

// 2. Expresión de función (Function Expression)
// La variable 'restar' se declara, pero la función se asigna cuando la ejecución llega a esta línea
// console.log(restar(5, 3)) // ❌ ReferenceError (con let/const) o TypeError (con var)

const restar = function (a, b) {
  return a - b
}
console.log(restar(5, 3)) // 2
```

> **Nota sobre el motor**: Esta diferencia ocurre por el proceso de **Hoisting**, que analizaremos a fondo en la [Sección 7](#7-contextos-de-ejecución-y-hoisting).

### Alcance (Scope): dónde viven y mueren las variables

El alcance determina la visibilidad y vida útil de una variable:

1. **Global Scope**: variables declaradas fuera de cualquier función o bloque. Accesibles desde cualquier parte del programa.
2. **Function Scope**: variables declaradas con `var` dentro de una función. Solo existen dentro de esa función, ignorando los bloques `{}` como `if` o `for`.
3. **Block Scope**: variables declaradas con `let` o `const` dentro de llaves `{}`. Mueren en cuanto el hilo de ejecución sale del bloque.

```javascript
function demoScope() {
  if (true) {
    var enFuncion = "Vivo en toda la función"
    let enBloque = "Solo vivo dentro del if"
    const tambienEnBloque = "Yo también muero al cerrar el bloque"
  }

  console.log(enFuncion) // "Vivo en toda la función"
  // console.log(enBloque) // ❌ ReferenceError: enBloque is not defined
}
```

---

## 2. Destructuring y operadores Rest/Spread

### El problema: extraer y transformar datos de forma repetitiva

Antes de ES6, extraer múltiples propiedades de un objeto requería código repetitivo y propenso a errores:

```javascript
// ❌ Enfoque antiguo: verboso y manual
function procesarEnvioAntiguo(usuario) {
  var nombre = usuario.nombre
  var email = usuario.email
  var ciudad = usuario.direccion ? usuario.direccion.ciudad : "Bogotá"
  return "Enviar a " + nombre + " (" + email + ") en " + ciudad
}
```

### La solución declarativa: Destructuring

El *destructuring* permite extraer valores de objetos o arreglos mapeando directamente su estructura visual:

```javascript
const usuario = {
  id: 101,
  nombre: "David",
  edad: 30,
  correo: "david@example.com",
  ubicacion: {
    ciudad: "Manizales",
    pais: "Colombia"
  }
}

// 1. Extracción básica con alias y valores por defecto
const {
  nombre: aliasNombre,      // Renombra la variable local a 'aliasNombre'
  edad,
  rol = "estudiante",       // Si 'rol' no existe o es undefined, usa "estudiante"
  ubicacion: { ciudad }     // Destructuring anidado
} = usuario

console.log(aliasNombre) // "David"
console.log(rol)         // "estudiante"
console.log(ciudad)      // "Manizales"

// 2. Destructuring directo en parámetros de funciones
const generarTarjeta = ({ nombre, edad, rol = "invitado" }) =>
  `${nombre} (${edad} años) - Rol: ${rol}`

console.log(generarTarjeta(usuario)) // "David (30 años) - Rol: estudiante"
```

### Operadores Rest (`...`) y Spread (`...`)

Aunque comparten la misma sintaxis de tres puntos (`...`), su propósito depende del contexto:

- **Rest (agrupar)**: recolecta múltiples elementos restantes dentro de una sola estructura.
- **Spread (expandir)**: desempaca los elementos de un iterable dentro de una nueva estructura.

```javascript
// 1. Rest en objetos: separa campos específicos del resto
const { id, correo, ...perfilPublico } = usuario
console.log(perfilPublico) 
// { nombre: "David", edad: 30, ubicacion: { ciudad: "Manizales", pais: "Colombia" } }

// 2. Rest en parámetros de funciones: acepta un número indefinido de argumentos
function sumarTodos(...numeros) {
  return numeros.reduce((acumulado, actual) => acumulado + actual, 0)
}
console.log(sumarTodos(10, 20, 30, 40)) // 100

// 3. Spread para clonar y extender objetos (inmutabilidad)
const usuarioActualizado = {
  ...usuario,
  edad: 31,                       // Sobrescribe 'edad'
  activo: true                    // Añade nueva propiedad
}

// ⚠️ Advertencia crítica: Spread hace copias superficiales (Shallow Copy)
usuarioActualizado.ubicacion.ciudad = "Medellín"
console.log(usuario.ubicacion.ciudad) // "Medellín" (¡El objeto anidado se mutó en ambos!)
```

> **Conexión mental**: Piensa en `Spread` como abrir una caja y vaciar su contenido sobre una mesa nueva; si dentro de la caja había otra caja cerrada con llave (un objeto anidado), ambas mesas compartirán la misma caja cerrada. Para copias profundas, usa `structuredClone(usuario)`.

---

## 3. Arrow Functions y enlace léxico de `this`

### El problema: el valor cambiante e impredecible de `this`

En funciones tradicionales, el valor de `this` no depende de dónde se escribe la función, sino de **cómo se invoca**. Al pasar un método como callback (por ejemplo, a `setTimeout` o un manejador de eventos), el contexto original suele perderse:

```javascript
const cuenta = {
  titular: "Ana",
  saldo: 500,
  mostrarSaldo() {
    console.log(`Titular: ${this.titular}, Saldo: ${this.saldo}`)
  }
}

cuenta.mostrarSaldo() // "Titular: Ana, Saldo: 500" (this es 'cuenta')

// ❌ Al pasarlo como callback, 'this' cambia al contexto global o undefined
setTimeout(cuenta.mostrarSaldo, 100) 
// Salida: "Titular: undefined, Saldo: undefined"
```

### La solución: Arrow Functions (`=>`)

Las *arrow functions* se introdujeron en ES6 para resolver este problema mediante el **enlace léxico** (*lexical this*): no definen su propio `this`, sino que heredan exactamente el `this` del ámbito en el que fueron creadas.

```javascript
// Retorno implícito para expresiones simples
const duplicar = n => n * 2

// Retorno implícito de objetos literales (requiere paréntesis para no confundir con bloque)
const crearItem = (id, nombre) => ({ id, nombre, creado: Date.now() })

// Solución al problema de callbacks:
const cuentaConTemporizador = {
  titular: "Ana",
  saldo: 500,
  consultarDespues() {
    // La arrow function captura el 'this' léxico del método 'consultarDespues' (la cuenta)
    setTimeout(() => {
      console.log(`Saldo de ${this.titular}: $${this.saldo}`)
    }, 100)
  }
}

cuentaConTemporizador.consultarDespues() // "Saldo de Ana: $500"
```

### Cuándo NO usar Arrow Functions

Las arrow functions tienen restricciones fundamentales que debes respetar:

| Caso de uso | ¿Usar Arrow Function? | ¿Por qué? |
| :--- | :--- | :--- |
| **Callbacks** (`map`, `filter`, `setTimeout`) | ✅ Sí | Mantiene el contexto exterior de forma limpia. |
| **Métodos de objetos literales** | ❌ No | El `this` léxico apuntará al ámbito exterior (módulo o `window`), no al objeto. |
| **Funciones constructoras** (`new`) | ❌ No | No tienen propiedad `.prototype` ni constructor interno `[[Construct]]`. Lanza `TypeError`. |
| **Uso del objeto `arguments`** | ❌ No | No tienen `arguments` propio; debes usar parámetros Rest (`...args`). |

```javascript
// ❌ Error clásico en métodos de objetos:
const usuarioFlecha = {
  nombre: "David",
  // En un módulo ES, el 'this' exterior es undefined
  saludar: () => {
    // ⚠️ Si accedes a this.nombre en modo estricto, lanzará TypeError porque this es undefined
    console.log(this) // undefined (o Window en scripts tradicionales)
  }
}
```

### Conexión con Python

```python
# Python - Lambdas y métodos
class Cuenta:
    def __init__(self, titular, saldo):
        self.titular = titular
        self.saldo = saldo

    def mostrar(self):
        print(f"Titular: {self.titular}, Saldo: {self.saldo}")

# En Python, el contexto no se pierde tan fácilmente porque 'self' se pasa explícitamente
cuenta = Cuenta("Ana", 500)
# lambda para funciones anónimas simples (solo expresiones de una línea)
duplicar = lambda x: x * 2
```

**Traduce exactamente**: Las lambdas de Python y las arrow functions de JS son funciones anónimas concisas para callbacks.  
**Cambia de fondo**: En Python, el paso de `self` es explícito y el enlace de métodos nunca muta inesperadamente según quién ejecute la llamada.

### Conexión con Java

```java
// Java 8+ - Expresiones Lambda
import java.util.function.Function;

public class Main {
    public static void main(String[] args) {
        // Lambda que implementa una Functional Interface (SAM: Single Abstract Method)
        Function<Integer, Integer> duplicar = n -> n * 2;
        System.out.println(duplicar.apply(5)); // 10
    }
}
```

**Traduce exactamente**: La sintaxis `n -> n * 2` de Java cumple el mismo rol que `n => n * 2` en JavaScript para operaciones funcionales (`map`, `filter`).  
**Cambia de fondo**: En Java, las lambdas no son objetos de función libres; son implementaciones de interfaces funcionales estrictamente tipadas. Además, dentro de una lambda en Java, `this` siempre se refiere a la clase que la envuelve.

---

## 4. Funciones de orden superior (Higher-Order Functions)

### El problema: duplicación de estructuras de control y algoritmos

Considera transformar una lista de precios aplicando un impuesto y filtrando los no válidos:

```javascript
// ❌ Enfoque imperativo tradicional: mezclamos iteración con lógica de negocio
const precios = [100, 250, null, 400, undefined, 80]
const procesados = []

for (let i = 0; i < precios.length; i++) {
  if (typeof precios[i] === "number") {
    const conIva = precios[i] * 1.19
    if (conIva > 150) {
      procesados.push(conIva)
    }
  }
}
```

### La solución: funciones que reciben o retornan funciones

Una **Higher-Order Function (HOF)** es una función que cumple al menos una de estas dos condiciones:
1. Recibe una o más funciones como argumentos.
2. Retorna una nueva función como resultado.

#### Nivel 1: Recibir funciones como argumentos

```javascript
const preciosValidos = precios
  .filter(p => typeof p === "number")
  .map(p => +(p * 1.19).toFixed(2))
  .filter(p => p > 150)

console.log(preciosValidos) // [ 297.5, 476 ]
```

#### Nivel 2: Funciones que retornan funciones (Generadores de lógica)

```javascript
// Generador de validadores
const crearFiltroRango = (min, max) => valor => valor >= min && valor <= max

const esPrecioMedio = crearFiltroRango(100, 300)
console.log(esPrecioMedio(150)) // true
console.log(esPrecioMedio(50))  // false
```

#### Nivel 3: Composición de funciones (Pipeline)

La composición permite encadenar funciones pequeñas y puras para construir flujos de datos complejos:

```javascript
// Función genérica de composición (de derecha a izquierda)
const componer = (...funciones) => valorInicial =>
  funciones.reduceRight((acumulado, fn) => fn(acumulado), valorInicial)

// Bloques individuales pequeños y testeables
const limpiarTexto = str => str.trim()
const aMayusculas = str => str.toUpperCase()
const agregarPrefijo = str => `[LOG]: ${str}`

// Creamos un pipeline reutilizable
const formatearMensaje = componer(agregarPrefijo, aMayusculas, limpiarTexto)

console.log(formatearMensaje("   error en base de datos   "))
// Salida: "[LOG]: ERROR EN BASE DE DATOS"
```

---

## 5. Closures (Clausuras léxicas)

### ¿Qué es un Closure?

Un **Closure** ocurre cuando una función interna conserva acceso a las variables de su entorno léxico exterior (*lexical environment*), **incluso después de que la función externa haya terminado de ejecutarse y haya salido de la pila de llamadas**.

> **Conexión mental**: Imagina que una función nace en una casa (su entorno léxico). Cuando sale al mundo exterior, empaca una **mochila** con referencias a todas las variables que existían en su casa en ese momento. Aunque la casa sea demolida (la función externa termine), la función lleva su mochila a donde sea que viaje.  
> ⚠️ **Dónde se rompe la analogía**: La mochila no guarda una *fotocopia* de las variables, sino un *hilo conductor* (referencia directa). Si la variable cambia de valor afuera, el closure verá el nuevo valor.

### Ejemplo 1: Encapsulamiento y estado privado

JavaScript no tenía variables privadas nativas en objetos hasta hace poco. Los closures han sido históricamente el mecanismo estándar para proteger estado:

```javascript
function crearBilletera(saldoInicial = 0) {
  // Variable privada: no es accesible directamente desde fuera
  let saldo = saldoInicial
  const historial = []

  return {
    depositar(cantidad) {
      if (cantidad <= 0) throw new Error("Cantidad no válida")
      saldo += cantidad
      historial.push({ tipo: "DEPOSITO", cantidad, fecha: new Date() })
      return saldo
    },
    retirar(cantidad) {
      if (cantidad > saldo) throw new Error("Fondos insuficientes")
      saldo -= cantidad
      historial.push({ tipo: "RETIRO", cantidad, fecha: new Date() })
      return saldo
    },
    verSaldo() {
      return saldo
    }
  }
}

const miBilletera = crearBilletera(100)
miBilletera.depositar(50)
console.log(miBilletera.verSaldo()) // 150
console.log(miBilletera.saldo)     // undefined (¡Estado protegido!)
```

### Ejemplo 2: La trampa clásica de closures en bucles

Uno de los errores más comunes en entrevistas y código de producción involucra closures dentro de bucles:

```javascript
// ❌ Problema con 'var' (Function Scope)
// Solo existe UNA variable 'i' compartida en memoria para todo el bucle
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log("Con var:", i)
  }, 50)
}
// Salida: Con var: 3, Con var: 3, Con var: 3

// ✅ Solución con 'let' (Block Scope)
// Cada iteración crea un NUEVO entorno léxico con su propia variable 'j' independiente
for (let j = 0; j < 3; j++) {
  setTimeout(() => {
    console.log("Con let:", j)
  }, 50)
}
// Salida: Con let: 0, Con let: 1, Con let: 2
```

### Conexión con Python

```python
# Python - Closures con 'nonlocal'
def crear_contador():
    total = 0
    def incrementar():
        nonlocal total  # Obligatorio para reasignar la variable del scope exterior
        total += 1
        return total
    return incrementar

contador = crear_contador()
print(contador())  # 1
print(contador())  # 2
```

**Traduce exactamente**: Ambos lenguajes permiten que funciones anidadas recuerden el estado exterior.  
**Cambia de fondo**: En Python, si intentas reasignar una variable del ámbito exterior sin declarar `nonlocal`, Python creará silenciosamente una nueva variable local, rompiendo el closure. En JS, la reasignación funciona directamente.

### Conexión con Java

```java
// Java - Captura en Lambdas / Clases Anónimas
public class EjemploJava {
    public static Runnable crearTarea() {
        int contador = 10; // Debe ser 'effectively final'
        return () -> {
            System.out.println("Valor: " + contador);
            // contador++; // ❌ Error de compilación: Local variable must be final or effectively final
        };
    }
}
```

**Traduce exactamente**: Ambos capturan variables del entorno circundante.  
**Cambia de fondo**: En Java, las variables capturadas por una lambda **deben ser inmutables o efectivamente finales** (*effectively final*). En JavaScript, los closures pueden mutar libremente las variables capturadas.

---

## 6. Currying y aplicación parcial

### El problema: funciones con múltiples argumentos que se repiten

Imagina que registras eventos en un sistema donde el módulo y el nivel de severidad se repiten constantemente:

```javascript
// ❌ Forma tradicional: repetimos los mismos primeros argumentos una y otra vez
logger("AUTH_SERVICE", "INFO", "Usuario autenticado con éxito")
logger("AUTH_SERVICE", "INFO", "Token renovado")
logger("AUTH_SERVICE", "ERROR", "Contraseña incorrecta")
```

### La solución: Currying

El **Currying** es una técnica matemática que transforma una función que recibe múltiples argumentos `f(a, b, c)` en una secuencia de funciones anidadas que reciben un solo argumento cada una: `f(a)(b)(c)`.

```javascript
// Función uncurried tradicional
const logBase = (modulo, nivel, mensaje) =>
  `[${modulo}] [${nivel}]: ${mensaje}`

// Versión curried
const logCurried = modulo => nivel => mensaje =>
  `[${modulo}] [${nivel}]: ${mensaje}`

// Creamos funciones especializadas por aplicación parcial
const logAuth = logCurried("AUTH_SERVICE")
const logAuthInfo = logAuth("INFO")
const logAuthError = logAuth("ERROR")

console.log(logAuthInfo("Usuario autenticado con éxito"))
// "[AUTH_SERVICE] [INFO]: Usuario autenticado con éxito"

console.log(logAuthError("Fallo de conexión a base de datos"))
// "[AUTH_SERVICE] [ERROR]: Fallo de conexión a base de datos"
```

---

## 7. Contextos de ejecución y Hoisting

### ¿Cómo lee JavaScript tu código?

JavaScript no interpreta tu archivo de arriba a abajo de una sola pasada. La ejecución ocurre siempre dentro de un **Contexto de Ejecución** (*Execution Context*) y se divide en dos fases bien diferenciadas:

1. **Global Execution Context (GEC)**: se crea al arrancar el script. Solo hay uno.
2. **Function Execution Context (FEC)**: se crea cada vez que se invoca una función.

```
┌───────────────────────────────────────────────────────────┐
│              FASE 1: CREACIÓN (Creation Phase)             │
│  - Reserva memoria para variables y funciones             │
│  - var se inicializa con undefined                        │
│  - Declaraciones de función se almacenan completas        │
│  - let y const se registran pero NO se inicializan (TDZ)  │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│             FASE 2: EJECUCIÓN (Execution Phase)           │
│  - Ejecuta el código línea por línea                      │
│  - Asigna valores reales a las variables                  │
│  - Invoca funciones creando nuevos FECs                   │
└───────────────────────────────────────────────────────────┘
```

### Hoisting y la Zona Muerta Temporal (TDZ)

El **Hoisting** es la consecuencia directa de la fase de creación: las declaraciones se procesan antes de ejecutar cualquier sentencia.

```javascript
console.log(declarada()) // "Hola desde declaración" (Se elevó completa)
// console.log(expresion()) // ❌ TypeError: expresion is not a function

console.log(miVar) // undefined (var se eleva e inicializa con undefined)
// console.log(miLet) // ❌ ReferenceError: Cannot access 'miLet' before initialization (TDZ)

function declarada() {
  return "Hola desde declaración"
}

var miVar = "Texto en var"
var expresion = function () { return "Hola" }
let miLet = "Texto en let"
```

> **Temporal Dead Zone (TDZ)**: es el período entre el inicio del bloque y la línea donde `let` o `const` es inicializada. Intentar leer la variable en ese intervalo provocará un `ReferenceError` inmediato.

---

## 8. Gestión de memoria: Stack, Heap y Garbage Collection

### ¿Dónde viven las variables que recuerda un closure?

Para entender por qué las variables de un closure no desaparecen, debemos mirar cómo organiza el motor la memoria:

```
      CALL STACK (Pila)                    MEMORY HEAP (Montículo)
 ┌───────────────────────────┐         ┌─────────────────────────────┐
 │ fnExterna() [Contexto]    │ ──────► │ { nombre: "David", edad: 30}│
 ├───────────────────────────┤         │ (Objetos, Arreglos,         │
 │ GEC (Global Context)      │         │  Funciones y Closures)      │
 └───────────────────────────┘         └─────────────────────────────┘
  Valores primitivos rápidos,           Estructuras dinámicas y datos
  punteros y control de flujo           que deben sobrevivir al Stack
```

1. **Call Stack (Pila de llamadas)**:
   - Estructura LIFO (*Last In, First Out*).
   - Almacena primitivos pequeños y los marcos de ejecución (*stack frames*) activos.
   - Cuando una función termina, su marco se descarta de la pila.

2. **Memory Heap (Montículo de memoria)**:
   - Espacio de memoria desestructurado para objetos, arreglos y entornos léxicos de closures.

### El recolector de basura: Mark-and-Sweep

¿Cómo sabe el motor cuándo liberar memoria para evitar fugas (*memory leaks*)? El algoritmo principal es **Mark-and-Sweep** (Marcar y Barrer):

1. **Raíces (*Roots*)**: el recolector parte de un conjunto de objetos raíz (objeto global `window`/`globalThis`, variables locales activas en la pila).
2. **Marcar (*Mark*)**: navega por todas las referencias directas e indirectas alcanzables desde las raíces y las marca como "vivas".
3. **Barrer (*Sweep*)**: cualquier bloque en el Heap que no haya sido marcado se considera inalcanzable y su memoria se libera.

```javascript
function crearFuga() {
  const elementoPesado = new Array(1_000_000).fill("datos")
  
  // Si retornamos una función que usa 'elementoPesado',
  // el Garbage Collector NO puede liberarlo porque sigue siendo alcanzable desde fuera
  return () => console.log("Longitud:", elementoPesado.length)
}

const mantenerVivo = crearFuga() // El arreglo de 1 millón de elementos sigue en el Heap
```

### Conexión con Java

**Traduce exactamente**: Tanto la JVM de Java como el motor V8 de JavaScript usan recolectores de basura automáticos con algoritmos de trazabilidad basados en raíces de alcance (*GC Roots*).  
**Cambia de fondo**: En Java puedes ajustar el comportamiento del recolector (G1, ZGC) y monitorizar la memoria con herramientas nativas de JVM. En JavaScript, el GC corre de forma completamente opaca en segundo plano sin control directo por parte del desarrollador.

---

## 9. El Event Loop y concurrencia no bloqueante

### El problema: JavaScript es de un solo hilo (Single-Threaded)

JavaScript tiene un único *Call Stack*. Si ejecutas una operación pesada (como procesar una imagen o hacer una consulta sincrónica de red), la interfaz se congela. Para resolver esto sin usar múltiples hilos complejos, el navegador y Node.js implementan el **Event Loop**.

```
    CALL STACK                WEB APIs / NODE C++ APIS
 ┌───────────────┐           ┌────────────────────────┐
 │ fetch(...)    │ ────────► │ Temporizadores, Red,   │
 │ console.log() │           │ Sistema de archivos    │
 └───────┬───────┘           └───────────┬────────────┘
         │                               │
         │         EVENT LOOP            │ (Al completar)
         │     ┌──────────────────┐      │
         └─────┤ ¿Stack vacío?    │◄─────┘
               │ Si sí: mover task│
               └─────────▲────────┘
                         │
     MICROTASK QUEUE     │      MACROTASK (TASK) QUEUE
  ┌──────────────────────┴──┐  ┌───────────────────────┐
  │ Promises (.then/catch)  │  │ setTimeout, setInterval│
  │ queueMicrotask          │  │ setImmediate (Node)   │
  └─────────────────────────┘  └───────────────────────┘
  (Prioridad absoluta: se      (Se ejecuta 1 por cada
   vacía completa siempre)      ciclo del Event Loop)
```

### Microtasks vs. Macrotasks: la regla de prioridad

El orden de ejecución sigue una regla estricta:
1. Ejecutar todo el código síncrono actual en el Call Stack.
2. Al quedar vacío el Call Stack, procesar **TODAS las Microtasks** pendientes hasta vaciar la cola.
3. Tomar **UNA sola Macrotask** de la cola de tareas y ejecutarla.
4. Renderizar UI (en navegadores) si corresponde.
5. Repetir el ciclo.

```javascript
console.log("1. Síncrono inicio")

setTimeout(() => {
  console.log("4. Macrotask (setTimeout)")
}, 0)

Promise.resolve().then(() => {
  console.log("3. Microtask (Promise 1)")
}).then(() => {
  console.log("3b. Microtask (Promise 2 encadenada)")
})

console.log("2. Síncrono fin")

// Salida exacta:
// 1. Síncrono inicio
// 2. Síncrono fin
// 3. Microtask (Promise 1)
// 3b. Microtask (Promise 2 encadenada)
// 4. Macrotask (setTimeout)
```

### Conexión con Python

```python
import asyncio

async def tarea():
    print("1. Inicio")
    # asyncio simula la cola de eventos cooperativa
    await asyncio.sleep(0) 
    print("2. Reanudado tras ciclo de evento")

# asyncio.run(tarea())
```

**Traduce exactamente**: Ambos usan un ciclo de eventos (*event loop*) para coordinar tareas asincrónicas sin bloquear el hilo principal.  
**Cambia de fondo**: En JavaScript el Event Loop es el corazón del runtime y siempre está activo. En Python, el event loop es una biblioteca (`asyncio`) que debes instanciar y ejecutar explícitamente.

### Conexión con Java

```java
// Java tradicional: modelo multi-hilo bloqueante
public class ServidorHilos {
    public static void main(String[] args) {
        // Cada petición suele correr en su propio hilo del sistema operativo (o Virtual Thread en Java 21+)
        Thread hilo = new Thread(() -> {
            System.out.println("Procesando en hilo: " + Thread.currentThread().getName());
        });
        hilo.start();
    }
}
```

**Traduce exactamente**: Ambos permiten procesar múltiples operaciones concurrentes de entrada y salida (I/O).  
**Cambia de fondo**: Java utiliza tradicionalmente hilos del sistema operativo que pueden bloquearse de forma segura sin detener a otros hilos. JavaScript nunca bloquea su único hilo principal; delega el I/O al sistema operativo mediante callbacks en el Event Loop.

---

## Práctica y ejercicios de estudio activo

Aplica el método de las **5R**: intenta responder las preguntas y resolver los problemas **sin mirar la solución primero**. El esfuerzo cognitivo de intentar recordar es lo que consolida el aprendizaje.

### 1. Preguntas de recuperación activa

Responde mentalmente o por escrito antes de expandir la respuesta:

<details>
<summary><b>1. ¿Por qué <code>const</code> no evita que modifiquemos las propiedades de un objeto?</b></summary>

**Explicación**: `const` protege la **asignación de la variable**, no el contenido del valor al que apunta. La variable almacena un puntero a una dirección en el Heap. Modificar una propiedad altera el contenido en el Heap, pero el puntero de la variable permanece intacto.  
*Trampa común*: Creer que `const` equivale a inmutabilidad profunda. Para congelar propiedades usa `Object.freeze()`.
</details>

<details>
<summary><b>2. Si una función externa termina, ¿por qué sus variables no son eliminadas por el Garbage Collector si hay un closure activo?</b></summary>

**Explicación**: Porque el algoritmo Mark-and-Sweep rastrea referencias desde las raíces activas. Si la función interna retornada sigue siendo accesible en el programa, mantiene un enlace directo a su entorno léxico en el Heap, haciéndolo inalcanzable para el recolector de basura.
</details>

<details>
<summary><b>3. En el Event Loop, ¿qué ocurre si una Microtask genera recursivamente otra Microtask?</b></summary>

**Explicación**: Se produce un bloqueo del Event Loop (*Microtask Starvation*). Dado que el motor vacía la cola de Microtasks por completo antes de ejecutar la siguiente Macrotask o pintar la pantalla, las tareas de temporizadores, eventos de usuario y renderizado jamás llegarán a ejecutarse.
</details>

---

### 2. Ejercicio de explicación (Técnica Feynman)

> **Reto**: Explica qué es un *closure* a un colega que solo programa en Java o Python básico, sin usar las palabras "entorno léxico" ni "scope chain". Usa una analogía cotidiana.  
> *Si dudas o te saltas pasos sobre cómo viaja el valor en memoria, regresa a la [Sección 5](#5-closures-clausuras-léxicas).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): Transformación y Destructuring limpio

**Objetivo**: Convertir una función de configuración verbosa a un patrón declarativo y seguro con valores por defecto.

**Enunciado**:  
Crea una función `configurarServidor` que reciba un objeto con opciones (`puerto`, `host`, `seguridad`). Debe:
1. Usar destructuring en los parámetros.
2. Asignar por defecto: `puerto: 8080`, `host: "localhost"`.
3. Extraer de `seguridad` la propiedad `ssl` (por defecto `false`).
4. Retornar un string: `"Servidor en http[s]://host:puerto (SSL: activo/inactivo)"`.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
const configurarServidor = ({
  puerto = 8080,
  host = "localhost",
  seguridad: { ssl = false } = {} // Maneja el caso si seguridad no se envía
} = {}) => {
  const protocolo = ssl ? "https" : "http"
  const estadoSSL = ssl ? "activo" : "inactivo"
  return `Servidor en ${protocolo}://${host}:${puerto} (SSL: ${estadoSSL})`
}

console.log(configurarServidor()) 
// "Servidor en http://localhost:8080 (SSL: inactivo)"

console.log(configurarServidor({ puerto: 3000, seguridad: { ssl: true } }))
// "Servidor en https://localhost:3000 (SSL: activo)"
```
**Por qué funciona**: `= {}` al final del destructuring anidado previene un `TypeError` si el usuario no envía el objeto `seguridad` o invoca la función sin argumentos.
</details>

---

#### Ejercicio 2 (Intermedio): Carrito con estado encapsulado (Closure)

**Objetivo**: Implementar un módulo de carrito de compras que mantenga sus datos completamente privados sin usar clases ni `this`.

**Requisitos**:
1. Función `crearCarrito()` que retorne métodos: `agregar(nombre, precio, cantidad = 1)`, `obtenerTotal()` y `listar()`.
2. El arreglo de productos debe ser inaccesible desde el exterior.
3. `listar()` debe devolver una copia superficial de los productos para evitar que muten el arreglo interno desde afuera.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearCarrito() {
  const productos = [] // Estado privado protegido por closure

  return {
    agregar(nombre, precio, cantidad = 1) {
      if (!nombre || precio <= 0) throw new Error("Datos de producto inválidos")
      productos.push({ nombre, precio, cantidad })
    },
    obtenerTotal() {
      return productos.reduce(
        (total, p) => total + p.precio * p.cantidad,
        0
      )
    },
    listar() {
      // Retornamos un nuevo arreglo con copias de los objetos para evitar mutación externa
      return productos.map(p => ({ ...p }))
    }
  }
}

const carrito = crearCarrito()
carrito.agregar("Laptop", 1200)
carrito.agregar("Mouse", 25, 2)

console.log("Total:", carrito.obtenerTotal()) // 1250
const items = carrito.listar()
items[0].precio = 0 // Intentamos sabotear el precio
console.log("Total real:", carrito.obtenerTotal()) // 1250 (¡El carrito sigue intacto!)
```
</details>

---

#### Ejercicio 3 (Avanzado): Pipeline de middleware con Currying y Composición

**Objetivo**: Diseñar un sistema de procesamiento de peticiones HTTP inspirado en frameworks modernos (Express/Koa) usando composición funcional.

**Requisitos**:
1. Cada middleware es una función `contexto => nuevoContexto`.
2. Implementar `crearPipeline(...middlewares)` que ejecute los middlewares en orden (de izquierda a derecha).
3. Cada middleware debe ser inmutable: retorna un nuevo objeto contexto con sus modificaciones sin mutar el original.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
// Función 'pipe' (composición de izquierda a derecha)
const crearPipeline = (...middlewares) => contextoInicial =>
  middlewares.reduce((ctx, fn) => fn(ctx), contextoInicial)

// Middlewares individuales puros
const conTimestamp = ctx => ({
  ...ctx,
  timestamp: Date.now()
})

const conAutenticacion = tokenValido => ctx => ({
  ...ctx,
  usuario: ctx.headers?.authorization === tokenValido ? { id: 1, rol: "admin" } : null
})

const conRutaNormalizada = ctx => ({
  ...ctx,
  path: ctx.path.toLowerCase().trim()
})

// Ensamblaje del pipeline
const pipeline = crearPipeline(
  conTimestamp,
  conRutaNormalizada,
  conAutenticacion("secret_token_123")
)

const peticionEntrante = {
  path: "  /API/V1/USUARIOS  ",
  headers: { authorization: "secret_token_123" }
}

const peticionProcesada = pipeline(peticionEntrante)
console.log(peticionProcesada)
/*
{
  path: '/api/v1/usuarios',
  headers: { authorization: 'secret_token_123' },
  timestamp: 1784800000000,
  usuario: { id: 1, rol: 'admin' }
}
*/
```
</details>

---

## Pensamiento crítico y depuración

### Escenario 1: Pérdida de contexto en callbacks asíncronos

**Situación**: Tienes una clase o servicio de notificaciones. Al registrar el callback en un temporizador o gestor de eventos, `this.canal` es `undefined`:

```javascript
class Notificador {
  constructor(canal) {
    this.canal = canal
  }

  enviar(mensaje) {
    console.log(`[${this.canal}] Enviando: ${mensaje}`)
  }

  programarEnvio(mensaje) {
    // ❌ Error: setTimeout invoca la función sin contexto
    setTimeout(this.enviar, 100)
  }
}
```

**Diagnóstico y soluciones**:
1. **Solución con Arrow Function (Recomendada)**:  
   `setTimeout(() => this.enviar(mensaje), 100)`  
   *Por qué*: La arrow function captura el `this` de la instancia léxicamente en `programarEnvio`.
2. **Solución con `.bind()`**:  
   `setTimeout(this.enviar.bind(this, mensaje), 100)`  
   *Por qué*: `.bind()` crea una nueva función con el `this` fijado permanentemente a la instancia.

---

### Escenario 2: Retención involuntaria de memoria por closures

**Situación**: Un observador de eventos retiene referencias a un elemento grande del DOM o un búfer de datos aunque ya no se utilice la pantalla correspondiente:

```javascript
function inicializarModulo() {
  const datosPesados = new Array(5_000_000).fill("💾")
  
  const boton = document.getElementById("guardar-btn")
  boton.addEventListener("click", () => {
    // Solo necesitamos el tamaño, pero el closure mantiene vivo TODO el arreglo
    console.log("Registros listos:", datosPesados.length)
  })
}
```

**Solución**: Extraer solo el dato primitivo estrictamente necesario antes de crear el closure:
```javascript
function inicializarModuloOptimizado() {
  const datosPesados = new Array(5_000_000).fill("💾")
  const totalRegistros = datosPesados.length // Guardamos solo el número (primitivo)

  const boton = document.getElementById("guardar-btn")
  boton.addEventListener("click", () => {
    console.log("Registros listos:", totalRegistros)
  })
  // 'datosPesados' podrá ser liberado por el Garbage Collector cuando termine la función
}
```

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Concepto | JavaScript (ES2026) | Python 3 | Nota técnica |
| :--- | :--- | :--- | :--- |
| **Función anónima** | `(x) => x * 2` | `lambda x: x * 2` | En Python las lambdas solo admiten una única expresión. |
| **Estado en closures** | Directo (por referencia léxica) | Requiere `nonlocal` para reasignar | En Python omitir `nonlocal` crea una variable local oculta. |
| **Paso de parámetros Rest** | `function f(...args) {}` | `def f(*args, **kwargs):` | Python separa argumentos posicionales de nombrados. |
| **Destructuring** | `const { a, b } = obj` | `a, b = tupla` / `dict.get()` | JS soporta destructuring anidado y en objetos nativamente. |
| **Decoradores** | Propuesta TC39 (Stage 3) / TS | `@decorador` nativo | En Python los decoradores son parte central del lenguaje desde 2.4. |

### JavaScript vs. Java

| Concepto | JavaScript (ES2026) | Java 21+ | Nota técnica |
| :--- | :--- | :--- | :--- |
| **Tipado de funciones** | Funciones como objetos libres | *Functional Interfaces* (SAM) | En Java cada lambda debe coincidir con una interfaz (`Function`, `Consumer`). |
| **Captura en lambdas** | Mutable (por referencia) | Solo variables `effectively final` | En Java no puedes reasignar variables externas capturadas. |
| **Modelo de ejecución** | Single-thread + Event Loop | Multi-thread (OS Threads / Virtual Threads) | JS usa concurrencia no bloqueante; Java usa paralelismo de hilos. |
| **Recolector de basura** | V8 Mark-and-Sweep automático | G1 / ZGC configurable | En Java la gestión de memoria se puede afinar exhaustivamente. |

---

## Resumen del capítulo

1. **Las funciones son valores**: trátalas como datos para componer lógica reutilizable y limpia.
2. **Destructuring y Rest/Spread**: reducen la fricción al transformar datos, pero ten presente que Spread solo realiza copias superficiales (*shallow copies*).
3. **Arrow Functions**: solucionan la pérdida de `this` mediante captura léxica, pero no deben usarse como métodos de objetos literales ni constructores.
4. **Closures**: permiten que una función recuerde su entorno léxico de nacimiento; son la base del encapsulamiento y las factorías de funciones.
5. **Fases del motor**: la fase de creación explica el Hoisting y la Zona Muerta Temporal (TDZ) de `let` y `const`.
6. **El Event Loop prioriza Microtasks**: las promesas resueltas se procesan inmediatamente al vaciarse el Call Stack, antes que cualquier `setTimeout`.

---

## Siguiente Capítulo

→ **[Capítulo 2: Objetos, prototipos y clases](./cap-02.md)**  
*Ahora que dominas las funciones y el entorno léxico, descubriremos cómo JavaScript implementa la orientación a objetos mediante la cadena de prototipos y cómo las clases modernas encapsulan este modelo.*
