---
title: "Capítulo 3: Asincronía, promesas y Event Loop"
---

# Capítulo 3: Asincronía, promesas y Event Loop

> JavaScript ejecuta tu código en un único hilo principal, pero nunca se detiene a esperar: delega el trabajo pesado al entorno y orquesta las respuestas mediante un bucle de eventos implacable.

## Introducción

A diferencia de entornos multihilo tradicionales donde cada petición o tarea bloqueante puede pausar un hilo del sistema operativo, el motor de JavaScript (V8, SpiderMonkey, JavaScriptCore) procesa instrucciones sobre un único hilo de ejecución síncrono (*Single-Threaded*).

Para no congelar la interfaz de usuario ni detener el servidor ante operaciones lentas de entrada/salida (I/O), lectura de archivos, consultas a bases de datos o peticiones de red, JavaScript implementa un modelo de **concurrencia no bloqueante** impulsado por el **Event Loop**, la **cola de microtareas** y las **Promesas**.

Comprender este flujo interno al milímetro es la única garantía para evitar condiciones de carrera, bloqueos invisibles de la interfaz y fugas de memoria en aplicaciones de alto rendimiento.

---

## 1. El Event Loop: Call Stack, Macrotareas y Microtareas

### El problema: ¿por qué `setTimeout(fn, 0)` no se ejecuta de inmediato?

Un error conceptual recurrente al comenzar con JavaScript es asumir que un temporizador con retardo de `0` milisegundos se ejecuta inmediatamente después de la línea previa:

```javascript
console.log("1. Inicio síncrono")

setTimeout(() => {
  console.log("2. Temporizador con 0ms")
}, 0)

Promise.resolve().then(() => {
  console.log("3. Promesa resuelta")
})

console.log("4. Fin síncrono")
```

Si ejecutas este bloque, el orden real de impresión en la consola será:
`1. Inicio síncrono` → `4. Fin síncrono` → `3. Promesa resuelta` → `2. Temporizador con 0ms`.

### La explicación mecánica del bucle de eventos

Para coordinar la ejecución, el motor interactúa con varias estructuras de memoria:

1. **Call Stack (Pila de llamadas)**: Ejecuta funciones de forma síncrona una a una (LIFO: *Last In, First Out*). Hasta que la pila no queda completamente vacía, nada más puede ejecutarse.
2. **Web APIs / Node.js C++ Bindings**: Gestionan en hilos del sistema operativo las tareas de temporizadores (`setTimeout`), peticiones de red (`fetch`) o I/O de disco.
3. **Microtask Queue (Cola de microtareas)**: Cola de alta prioridad donde se encolan los callbacks de Promesas (`.then()`, `.catch()`, `.finally()`), `queueMicrotask()` y `process.nextTick()` en Node.js.
4. **Macrotask Queue / Task Queue (Cola de macrotareas)**: Cola donde se encolan los callbacks de temporizadores (`setTimeout`, `setInterval`), eventos del DOM (`click`, `scroll`) e I/O.

### Diagrama del flujo de decisión del Event Loop

```
┌───────────────────────────────────────────────┐
│                   CALL STACK                  │
│       (Ejecuta código síncrono actual)        │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
          ¿Está el Stack vacío? ──(NO)──► Continúa ejecutando
                    │ (SÍ)
                    ▼
     ┌───────────────────────────────┐
     │   VACIAR TODAS LAS            │ ◄─── Repite hasta que la cola
     │   MICROTASKS PENDIENTES       │      de microtareas esté en 0
     │   (Promesas, queueMicrotask)  │
     └──────────────┬────────────────┘
                    │
                    ▼
          ¿Hay renderizado pendiente? (En navegador: actualiza UI si toca)
                    │
                    ▼
     ┌───────────────────────────────┐
     │   EJECUTAR EXACTAMENTE 1      │
     │   MACROTASK                   │
     │   (setTimeout, I/O, eventos)  │
     └──────────────┬────────────────┘
                    │
                    └─────────────────────► Vuelve al inicio del bucle
```

> **Regla de oro**: El Event Loop **siempre vacía por completo la cola de microtareas** antes de tomar la siguiente macrotarea o actualizar la pantalla.

### Conexión con Python

```python
# Python - Bucle de eventos explícito con asyncio
import asyncio

async def tarea_micro():
    print("3. Tarea async (corutina)")

async def main():
    print("1. Inicio")
    # Encolamos la tarea en el loop de asyncio
    asyncio.create_task(tarea_micro())
    print("2. Fin síncrono")
    await asyncio.sleep(0) # Cede el control al event loop

asyncio.run(main())
```

**Traduce exactamente**: Las corutinas de `asyncio` se suspenden y reanudan en un bucle de eventos de forma equivalente a las microtareas de JavaScript.  
**Cambia de fondo**: En Python, el bucle de eventos es una librería de nivel de aplicación (`asyncio.run()`), mientras que en JavaScript el Event Loop está integrado permanentemente en el núcleo del motor a nivel de arquitectura del lenguaje.

### Conexión con Java

```java
// Java - Modelo de hilos del sistema operativo vs Concurrencia Single-Thread
import java.util.concurrent.*;

public class EventLoopJava {
    public static void main(String[] args) throws Exception {
        // Java tradicional asigna hilos reales del SO o Virtual Threads (Loom)
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        
        executor.submit(() -> {
            System.out.println("Ejecutando en hilo concurrente real: " + Thread.currentThread());
        });
        
        executor.shutdown();
    }
}
```

**Traduce exactamente**: Ambos resuelven el procesamiento concurrente de miles de tareas I/O sin bloquear el progreso global.  
**Cambia de fondo**: Java utiliza hilos reales administrados por el sistema operativo o *Virtual Threads* ligeros. En JavaScript, **jamás hay dos fragmentos de tu código ejecutándose en paralelo en el mismo contexto**: todo el paralelismo real ocurre en el runtime en C++ mientras el código JS se turna en el hilo principal.

---

## 2. De Callbacks a Promesas: Estados y Encadenamiento

### El problema: El infierno de callbacks y la pérdida de control (*Inversion of Control*)

Antes de ES6, la asincronía dependía exclusivamente de funciones callback anidadas. Esto no solo creaba el visualmente ilegible *Callback Hell* (la "pirámide de la perdición"), sino un problema más grave: **Inversión de Control**. Al pasar tu callback a una librería de terceros, no tenías garantías de si la función se ejecutaría 0 veces, 1 vez o 5 veces, ni de cómo se capturarían los errores internos.

```javascript
// ❌ Callback Hell: Acoplamiento frágil y manejo de errores repetitivo
obtenerUsuario(42, function(err, usuario) {
  if (err) return manejarError(err)
  obtenerPedidos(usuario.id, function(err, pedidos) {
    if (err) return manejarError(err)
    procesarPago(pedidos[0].total, function(err, factura) {
      if (err) return manejarError(err)
      console.log("Factura lista:", factura)
    })
  })
})
```

### La solución: El contrato inmutable de una `Promise`

Una **Promesa** es un objeto que representa el resultado eventual (o el fallo) de una operación asíncrona. Posee tres estados excluyentes e inmutables:

1. **`pending` (pendiente)**: Estado inicial, la operación no ha terminado.
2. **`fulfilled` (cumplida)**: La operación finalizó con éxito. Emite un valor inmutable.
3. **`rejected` (rechazada)**: La operación falló. Emite un motivo de rechazo (*reason* o `Error`).

> **Garantía arquitectónica**: Una vez que una promesa pasa a `fulfilled` o `rejected`, **su estado queda sellado para siempre**. Jamás puede cambiar de estado una segunda vez ni emitir múltiples valores.

```javascript
// Creación explícita de una promesa
function consultarServidor(url) {
  return new Promise((resolve, reject) => {
    // Simulamos petición asíncrona
    setTimeout(() => {
      if (!url) {
        reject(new Error("URL inválida"))
        return
      }
      resolve({ status: 200, data: "Respuesta exitosa" })
    }, 1000)
  })
}

// Encadenamiento declarativo y canal único de errores
consultarServidor("https://api.empresa.com/datos")
  .then(respuesta => {
    console.log("Paso 1:", respuesta.status)
    return respuesta.data.toUpperCase() // Transforma y pasa al siguiente .then
  })
  .then(mensajeTransformado => {
    console.log("Paso 2:", mensajeTransformado)
  })
  .catch(error => {
    // Captura cualquier error ocurrido en cualquiera de los .then previos
    console.error("Error capturado:", error.message)
  })
  .finally(() => {
    console.log("Limpieza completada (cierre de conexiones, ocultar spinners)")
  })
```

---

## 3. `async/await` y Control de Flujo Asíncrono

### El problema: la sintaxis de promesas encadenadas sigue siendo verbosa

Aunque las promesas solucionaron el *Callback Hell*, encadenar múltiples transformaciones con condicionales o bucles complejos (`if`, `try/catch`, `while`) seguía resultando poco natural frente a la lectura secuencial de código.

### La solución: Código asíncrono con sintaxis secuencial

La combinación `async/await` es azúcar sintáctico sobre Promesas y Generadores. La palabra clave `async` garantiza que una función **siempre retorne una Promesa**, mientras que `await` pausa la ejecución de la función actual de forma no bloqueante hasta que la promesa se resuelve o rechaza.

```javascript
async function procesarPedido(usuarioId) {
  try {
    const respUsuario = await fetch(`/api/usuarios/${usuarioId}`)
    if (!respUsuario.ok) throw new Error("Usuario no encontrado")
    const usuario = await respUsuario.json()

    const respPedidos = await fetch(`/api/pedidos?userId=${usuario.id}`)
    const pedidos = await respPedidos.json()

    return { usuario: usuario.nombre, totalPedidos: pedidos.length }
  } catch (error) {
    // Manejo unificado de errores con bloques try/catch estándar
    console.error(`[Error de Pedido]: ${error.message}`)
    throw error // Re-lanzar si el llamador necesita enterarse
  }
}
```

### La trampa clásica: Secuencialidad innecesaria vs. Paralelismo real

Uno de los errores de rendimiento más comunes en producción es colocar `await` consecutivos sobre operaciones que no dependen entre sí:

```javascript
// ❌ Anti-patrón: Ejecución en cascada lenta (Toma tiempo A + tiempo B)
async function obtenerDashboardLento() {
  const perfil = await fetch("/api/perfil").then(r => r.json())   // Demora 200ms
  const noticias = await fetch("/api/noticias").then(r => r.json()) // Demora 300ms
  return { perfil, noticias } // Tiempo total: ~500ms
}

// ✅ Patrón correcto: Ejecución concurrente en paralelo (Toma max(A, B))
async function obtenerDashboardOptimo() {
  // Disparamos ambas peticiones simultáneamente
  const promesaPerfil = fetch("/api/perfil").then(r => r.json())
  const promesaNoticias = fetch("/api/noticias").then(r => r.json())

  // Esperamos a que ambas finalicen
  const [perfil, noticias] = await Promise.all([promesaPerfil, promesaNoticias])
  return { perfil, noticias } // Tiempo total: ~300ms (¡40% más rápido!)
}
```

---

## 4. Combinadores de Promesas: Estrategias de Concurrencia

### El problema: ¿cómo coordinar múltiples promesas con diferentes tolerancias a fallos?

Cuando tu aplicación interactúa con microservicios, réplicas de bases de datos o múltiples proveedores externos, necesitas diferentes estrategias: unas veces requieres que **todas** respondan con éxito, otras veces te basta con la **primera que responda**, y otras necesitas saber el estado de todas sin importar si alguna falló.

### Matriz de combinadores nativos

| Método | Resuelve cuando... | Rechaza cuando... | Caso de uso ideal |
|---|---|---|---|
| **`Promise.all`** | **Todas** se cumplen con éxito. | **Al menos una** es rechazada (falla rápida: *fail-fast*). | Necesitas todos los datos obligatoriamente para continuar (ej: renderizar perfil completo). |
| **`Promise.allSettled`** | **Todas** terminan (ya sea con éxito o con error). | **Nunca** rechaza. Retorna array de objetos `{ status, value / reason }`. | Tareas independientes donde quieres procesar los éxitos y auditar los fallos (ej: envío de correos masivos). |
| **`Promise.race`** | **La primera** promesa termina (sea éxito o error). | La primera en terminar resulta rechazada. | Implementar **Timeouts** estrictos para abortar peticiones lentas. |
| **`Promise.any`** | **La primera** promesa que tenga **éxito**. | **Todas** son rechazadas (emite un `AggregateError`). | Consultar múltiples réplicas o servidores espejo y quedarte con la respuesta más rápida que no falle. |

### Ejemplos prácticos de combinadores

```javascript
// 1. Promise.allSettled para procesamiento tolerante a fallos
const reportes = await Promise.allSettled([
  fetch("/api/ventas").then(r => r.json()),
  fetch("/api/servidor-caido").then(r => r.json()), // Fallará
  fetch("/api/inventario").then(r => r.json())
])

reportes.forEach((resultado, i) => {
  if (resultado.status === "fulfilled") {
    console.log(`Reporte ${i + 1} listo:`, resultado.value)
  } else {
    console.warn(`Reporte ${i + 1} falló debido a:`, resultado.reason.message)
  }
})

// 2. Promise.race para crear un Timeout defensivo
function conTimeout(promesaOriginal, tiempoMs) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operación cancelada: Timeout tras ${tiempoMs}ms`)), tiempoMs)
  })

  return Promise.race([promesaOriginal, timeout])
}
```

---

## 5. Cancelación moderna con `AbortController` y `AbortSignal`

### El problema: promesas huérfanas y fugas de recursos

Las Promesas estándar de JavaScript no tienen un método `.cancel()` nativo. Si un usuario cambia de pestaña o escribe en un buscador autocompletado mientras viaja una petición de red lenta, la respuesta llegará igualmente a la memoria y se procesará en vano.

### La solución: El estándar `AbortController`

`AbortController` permite emitir una señal de aborto (`signal`) que puede conectarse a `fetch`, eventos del DOM, flujos de Node.js o temporizadores propios.

```javascript
// Controlador para cancelar peticiones al escribir rápido
let controller = null

async function buscarEnServidor(termino) {
  // Si había una búsqueda anterior en vuelo, la cancelamos de inmediato
  if (controller) {
    controller.abort()
  }

  controller = new AbortController()
  const { signal } = controller

  try {
    const res = await fetch(`/api/buscar?q=${encodeURIComponent(termino)}`, { signal })
    const datos = await res.json()
    console.log("Resultados frescos:", datos)
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(`[Búsqueda cancelada] Petición descartada por nueva búsqueda: "${termino}"`)
    } else {
      console.error("Error real de red:", error)
    }
  }
}
```

### Conexión con Java

```java
// Java - Cancelación mediante Future y Threads
import java.util.concurrent.*;

public class CancelacionJava {
    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        
        Future<String> tarea = executor.submit(() -> {
            Thread.sleep(5000);
            return "Datos pesados";
        });

        // Cancelamos la tarea si tarda demasiado (interrumpe el hilo)
        boolean cancelada = tarea.cancel(true);
        System.out.println("Tarea cancelada con éxito: " + cancelada);
        executor.shutdown();
    }
}
```

**Traduce exactamente**: Ambos mecanismos permiten revocar el interés en el resultado de una tarea asíncrona antes de que concluya.  
**Cambia de fondo**: En Java, `Future.cancel(true)` interrumpe físicamente el hilo de ejecución mediante señales a nivel de JVM (`Thread.interrupt()`). En JavaScript, `AbortController` no "mata" un hilo (porque solo hay uno), sino que notifica al runtime C++ para que cierre el socket de red y rechace la Promesa inmediatamente con un `AbortError`.

---

## Práctica y ejercicios de estudio activo

Aplica el método de las **5R**: intenta resolver mentalmente o en tu editor cada desafío **antes** de abrir las soluciones desplegables.

### 1. Preguntas de recuperación activa

<details>
<summary><b>1. ¿Por qué una microtarea recursiva infinita bloquea el navegador por completo, mientras que un <code>setTimeout</code> recursivo infinito permite que la página siga respondiendo?</b></summary>

**Explicación**: Porque la especificación del Event Loop exige **vaciar por completo la cola de microtareas antes de ceder el control**. Si una microtarea encola otra microtarea sin fin, el motor jamás termina de vaciar la cola y nunca llega al paso de renderizado ni a la cola de macrotareas. En cambio, `setTimeout` encola una **macrotarea**: el Event Loop ejecuta una sola macrotarea, cede el turno para actualizar la pantalla y procesar eventos de usuario, y solo entonces procesa la siguiente.
</details>

<details>
<summary><b>2. ¿Qué retorna exactamente una función declarada con <code>async</code> si en su interior ejecutas únicamente <code>return "Hola"</code>?</b></summary>

**Explicación**: Retorna siempre una **Promesa en estado cumplido** (`Promise<string>`) que envuelve al valor `"Hola"`. Cualquier valor retornado dentro de una función `async` es envuelto automáticamente en `Promise.resolve(valor)`. Si la función lanza un error (`throw new Error()`), retornará una Promesa en estado rechazado (`Promise.reject(error)`).
</details>

<details>
<summary><b>3. Si pasas 5 promesas a <code>Promise.all</code> y la tercera falla a los 10ms, mientras las otras 4 siguen procesándose en segundo plano durante 2 segundos, ¿cuándo se rechaza <code>Promise.all</code> y qué pasa con las otras 4 promesas?</b></summary>

**Explicación**: `Promise.all` se rechaza **inmediatamente a los 10ms** con el error de la tercera promesa (*fail-fast*). Sin embargo, las otras 4 promesas **no se cancelan automáticamente**: seguirán ejecutándose en segundo plano en el motor hasta terminar, pero sus resultados serán completamente ignorados por `Promise.all`. Para cancelarlas de verdad, se debe usar un `AbortController`.
</details>

---

### 2. Ejercicio de explicación (Técnica Feynman)

> **Reto**: Explica a un programador junior la diferencia entre el **Call Stack**, la **Cola de Microtareas** y la **Cola de Macrotareas** utilizando la analogía de la **sala de emergencias de un hospital** (donde hay pacientes de riesgo vital inmediato, consultas prioritarias y citas de rutina programadas).  
> *Si dudas sobre el orden en que se atienden las tareas, repasa la [Sección 1](#1-el-event-loop-call-stack-macrotareas-y-microtareas).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): Temporizador con Promesas y validación

**Objetivo**: Convertir el clásico `setTimeout` basado en callbacks en una función utilitaria `esperar(ms)` basada en Promesas limpias y seguras.

**Enunciado**:  
Crea una función `esperar(ms)` que:
1. Valide que `ms` sea un número no negativo; de lo contrario, rechace la promesa inmediatamente.
2. Retorne una promesa que resuelva con el string `"Completado tras X ms"` una vez transcurrido el tiempo.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function esperar(ms) {
  return new Promise((resolve, reject) => {
    if (typeof ms !== "number" || ms < 0) {
      reject(new TypeError("El parámetro 'ms' debe ser un número no negativo"))
      return
    }

    setTimeout(() => {
      resolve(`Completado tras ${ms} ms`)
    }, ms)
  })
}

// Uso con async/await
;(async () => {
  console.log("Iniciando pausa...")
  const resultado = await esperar(1500)
  console.log(resultado) // "Completado tras 1500 ms"
})()
```
</details>

---

#### Ejercicio 2 (Intermedio): Orquestador concurrente de Usuarios y Pedidos

**Objetivo**: Diseñar una función `obtenerDatosCompletos(ids)` que consulte información en paralelo para optimizar el tiempo de respuesta, pero procese operaciones dependientes de forma controlada.

**Requisitos**:
1. Recibir un arreglo de `ids` numéricos.
2. Consultar todos los usuarios **en paralelo** usando `Promise.all` simulado.
3. Para cada usuario obtenido con éxito, consultar su historial de pedidos.
4. Tolerar fallos individuales sin que una petición rota tire abajo todo el proceso.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
// Simulación de API con latencia
async function mockFetch(url) {
  await new Promise(r => setTimeout(r, 100))
  if (url.includes("/usuario/3")) throw new Error("Usuario 3 no disponible")
  if (url.includes("/pedidos/")) return [{ id: 101, total: 450 }]
  return { id: 1, nombre: "Usuario Simulado" }
}

async function obtenerDatosCompletos(ids) {
  // 1. Consultamos todos los usuarios en paralelo de forma tolerante
  const promesasUsuarios = ids.map(id =>
    mockFetch(`/api/usuario/${id}`)
      .then(usuario => ({ id, usuario, error: null }))
      .catch(error => ({ id, usuario: null, error: error.message }))
  )

  const resultadosUsuarios = await Promise.all(promesasUsuarios)

  // 2. Para los usuarios válidos, obtenemos sus pedidos concurrentemente
  const reporteFinal = await Promise.all(
    resultadosUsuarios.map(async item => {
      if (item.error) {
        return { id: item.id, estado: "error", detalle: item.error, pedidos: [] }
      }

      try {
        const pedidos = await mockFetch(`/api/pedidos/${item.id}`)
        return { id: item.id, estado: "exito", usuario: item.usuario, pedidos }
      } catch (err) {
        return { id: item.id, estado: "parcial", usuario: item.usuario, pedidos: [], advertencia: err.message }
      }
    })
  )

  return reporteFinal
}

obtenerDatosCompletos([1, 2, 3]).then(console.log)
```
</details>

---

#### Ejercicio 3 (Avanzado): Reintentos con Backoff Exponencial y `AbortSignal`

**Objetivo**: Implementar un cliente de peticiones resiliente que reintente operaciones fallidas con tiempos de espera progresivamente mayores y soporte para cancelación externa.

**Requisitos**:
1. Función `ejecutarConReintentos(fnAsync, opciones)`.
2. Parámetros configurables: `maxIntentos` (def: 3), `tiempoBaseMs` (def: 500), `factor` (def: 2), `signal` (instancia de `AbortSignal`).
3. Si `signal.aborted` es verdadero, detener los reintentos inmediatamente con `AbortError`.
4. El tiempo entre intentos debe calcularse como `tiempoBaseMs * (factor ** intento)`.

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
async function ejecutarConReintentos(
  fnAsync,
  { maxIntentos = 3, tiempoBaseMs = 500, factor = 2, signal = null } = {}
) {
  let ultimoError = null

  for (let intento = 0; intento < maxIntentos; intento++) {
    // 1. Verificamos si la operación fue cancelada externamente
    if (signal?.aborted) {
      throw new DOMException("Operación abortada por el usuario", "AbortError")
    }

    try {
      return await fnAsync()
    } catch (error) {
      ultimoError = error

      // Si el error fue por cancelación explícita, no reintentamos
      if (error.name === "AbortError") throw error

      // Si ya agotamos los intentos, salimos del bucle
      if (intento === maxIntentos - 1) break

      // Calculamos backoff exponencial: 500ms, 1000ms, 2000ms...
      const delay = tiempoBaseMs * Math.pow(factor, intento)
      console.warn(`[Intento ${intento + 1} falló]: Reintentando en ${delay}ms...`)

      // Esperamos con soporte de cancelación durante la pausa
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay)
        signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(new DOMException("Operación abortada durante la espera", "AbortError"))
        }, { once: true })
      })
    }
  }

  throw new Error(`Operación fallida tras ${maxIntentos} intentos. Último error: ${ultimoError.message}`)
}

// Demostración
let contador = 0
const operacionInestable = async () => {
  if (++contador < 3) throw new Error("Fallo de red 503")
  return "¡Éxito en el tercer intento!"
}

ejecutarConReintentos(operacionInestable, { maxIntentos: 4, tiempoBaseMs: 300 })
  .then(console.log)
  .catch(console.error)
```
</details>

---

## Pensamiento crítico y depuración

### Escenario 1: Condiciones de carrera en peticiones autocompletadas (Search UI Race Condition)

**Situación**: Un usuario escribe `"react"` rápidamente en un buscador. Se disparan dos peticiones:
1. Petición A con `"rea"` (tarda 400ms por latencia de red).
2. Petición B con `"react"` (tarda 100ms porque estaba en caché).

La Petición B responde primero y pinta los resultados de `"react"`. 300ms más tarde, la Petición A finaliza y sobrescribe la pantalla con los resultados obsoletos de `"rea"`, dejando la interfaz en un estado inconsistente.

**Diagnóstico y solución**:
- **Causa**: Las promesas son asíncronas e independientes; el orden de llegada no coincide necesariamente con el orden de emisión.
- **Solución arquitectónica**: Utilizar un `AbortController` para cancelar la señal de la petición en vuelo anterior cada vez que el usuario ingresa un nuevo carácter.

---

### Escenario 2: Fuga de memoria por Promesas colgadas (*Unresolved Promise Memory Leaks*)

**Situación**: En un servidor Node.js de alta concurrencia, una función crea promesas que escuchan un evento de socket que rara vez ocurre, olvidando configurar un tiempo límite de rechazo (*timeout*).

```javascript
function esperarEventoDeSocket(socket) {
  return new Promise((resolve) => {
    // Si el socket se desconecta sin emitir 'datos_listos', esta promesa queda 'pending' para siempre
    socket.on("datos_listos", resolve)
  })
}
```

**Diagnóstico y solución**:
- **Causa**: Una promesa en estado `pending` mantiene vivas en el Heap todas las referencias de su closure y listeners asociados, impidiendo que el Garbage Collector libere los buffers de memoria del socket.
- **Solución arquitectónica**: Todo listener asíncrono debe limpiar sus eventos en caso de desconexión o implementar un `Promise.race` con un temporizador que fuerce el rechazo tras un tiempo límite razonable.

---

## Tabla comparativa entre lenguajes

### JavaScript vs. Python

| Característica | JavaScript | Python (`asyncio`) |
|---|---|---|
| **Modelo de Ejecución** | Event Loop nativo e inseparable en el runtime. | Event Loop opcional mediante módulo `asyncio`. |
| **Pausar ejecución** | `await promesa` | `await corutina()` |
| **Cancelación** | `AbortController` / `AbortSignal` cooperativo. | `task.cancel()` sobre objetos `asyncio.Task`. |
| **Paralelismo I/O** | `Promise.all([p1, p2])` | `asyncio.gather(c1, c2)` |

### JavaScript vs. Java

| Característica | JavaScript | Java (`CompletableFuture` / Loom) |
|---|---|---|
| **Concurrencia base** | Hilo único con I/O no bloqueante. | Hilos del sistema operativo o Virtual Threads concurrentes. |
| **Abstracción de Promesa** | `Promise<T>` nativa. | `CompletableFuture<T>` en biblioteca estándar. |
| **Encadenamiento** | `.then(fn).catch(fn)` | `.thenApply(fn).exceptionally(fn)` |
| **Bloqueo explícito** | Imposible por diseño (no existe `promise.get()`). | Soportado mediante `future.get()` bloqueante. |

---

## Resumen del capítulo

1. **El Event Loop orquesta el hilo único**: vacía todas las microtareas antes de procesar la siguiente macrotarea o actualizar el renderizado.
2. **Las Microtareas tienen prioridad absoluta**: callbacks de Promesas y `queueMicrotask` se ejecutan antes que `setTimeout`.
3. **Las Promesas son inmutables**: una vez resueltas o rechazadas, su estado no puede ser alterado.
4. **Evita el `await` secuencial innecesario**: utiliza `Promise.all()` para disparar peticiones independientes en paralelo.
5. **Elige el combinador adecuado**: `Promise.all` para todo o nada, `Promise.allSettled` para tolerancia a fallos, `Promise.race` para timeouts y `Promise.any` para réplicas.
6. **Usa `AbortController` para cancelar**: evita condiciones de carrera y fugas de recursos abortando operaciones obsoletas.

---

## Siguiente Capítulo

→ **[Capítulo 4: Módulos, Empaquetadores y Arquitectura de Código](./cap-04)**: Ahora que dominas el flujo de ejecución y la asincronía, exploraremos cómo organizar aplicaciones a gran escala con ES Modules, CommonJS, árboles de dependencias y optimizaciones de empaquetado.
