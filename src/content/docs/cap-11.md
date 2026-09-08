---
title: "Capítulo 11: Gestión asíncrona de recursos (using, Explicit Resource Management)"
---

# Capítulo 11: Gestión asíncrona de recursos (using, Explicit Resource Management)

## Introducción

El capítulo 10 te enseñó a cerrar la puerta de entrada: no confiar en nada que llegue de fuera. Este capítulo cierra la otra puerta — la de salida. Toda aplicación que abre algo — un archivo, una conexión a base de datos, un timer, un lector de streams — tiene que cerrarlo, y JavaScript clásico dejaba ese cierre a la buena memoria del programador con un `try/finally` a mano.

La propuesta **Explicit Resource Management** (estándar **ES2027**, ya disponible en los runtimes) introduce `using` y `await using`: declaras un recurso y el lenguaje lo libera solo al salir del bloque, pase lo que pase (termita normal, excepción, `return`, `break`). Es la respuesta de JavaScript a un mecanismo que Java lleva usando desde 2011 con `try-with-resources` — y que Python resume en una palabra: `with`. Es también la prueba de que ECMAScript sigue absorbiendo lo mejor de los demás: este capítulo y el último del libro van de eso, de APIs modernas que llegan al estándar.

Dos avisos de honestidad antes de empezar:

- En Node.js esto ya funciona de serie (probado en este libro con Node 24+); además, manejadores nativos como `fs/promises` y su `FileHandle` ya implementan el contrato. No es futurismo.
- JavaScript tiene *garbage collector* para la memoria, pero **nunca** ha tenido destructores para los recursos: `using` no es un destructor, es un *contrato de liberación* que tú implementas. Verás la diferencia y cómo cubrirla.

## 1. `using`: liberación garantizada de recursos

### El problema: un cierre que tienes que recordar

Cada recurso que abres es un favor que alguien debe devolver. Sin `using`, la garantía se construye a mano con `try/finally`:

```javascript
let conexionesAbiertas = 0

async function obtenerDatos(sql) {
  const conexion = await abrirConexion()
  conexionesAbiertas++
  try {
    return await conexion.consultar(sql)
  } finally {
    await conexion.cerrar()
    conexionesAbiertas--
  }
}
```

Funciona… si lo recuerdas. El `finally` existe justamente porque *te puedes olvidar*: una ruta que devuelve antes, una excepción temprana, y la conexión queda abierta sin que nadie la reclame. El `finally` también se repite en cada función — diez funciones de acceso a datos, diez `try/finally` clonados. Y si en el `finally` primero cierras y luego lanzas algo, pierdes el error original (lo viste con las cadenas del capítulo 6).

**`using` declara el recurso y el lenguaje se encarga**: al salir del bloque se llama a `[Symbol.dispose]` (síncrono) o `[Symbol.asyncDispose]` (asíncrono), tanto si el bloque termina bien como si lanza.

```javascript
class ConexionBD {
  constructor(host) {
    this.host = host
    this.conectada = false
  }

  async conectar() {
    await new Promise(resolve => setTimeout(resolve, 10))
    this.conectada = true
    console.log(`[${this.host}] conectada`)
  }

  consultar(sql) {
    return `Resultado de: ${sql}`
  }

  async [Symbol.asyncDispose]() {
    await new Promise(resolve => setTimeout(resolve, 10))
    this.conectada = false
    console.log(`[${this.host}] conexión cerrada`)
  }
}

async function obtenerDatos(sql) {
  await using conn = new ConexionBD("localhost:5432")
  await conn.conectar()
  return conn.consultar(sql)
} // <- aquí se ejecuta [Symbol.asyncDispose] automáticamente
```

Nada de `try/finally`: la limpieza es parte del *contrato* del recurso, no de la disciplina del que lo usa. Y no solo en funciones: `using` funciona en cualquier bloque, `if`, `for` y `try`.

### El contrato: `Symbol.dispose` y `Symbol.asyncDispose`

El objeto que pasas a `using` debe implementar el método con el símbolo correspondiente:

| Declaración | Método que llama al salir | Uso típico |
|---|---|---|
| `using recurso = ...` | `[Symbol.dispose]()` (síncrono) | cerrar archivos, timers, listeners |
| `await using recurso = ...` | `[Symbol.asyncDispose]()` (asíncrono) | cerrar conexiones, deshacer locks |

Si el valor no implementa el contrato, obtienes un `TypeError` claro:

```javascript
{ using x = {} } // TypeError: Symbol(Symbol.dispose) is not a function
```

Y fíjate en lo que **no** hace: `using` garantiza que se llame a tu método de liberación, pero **no impide** que el objeto se siga usando después. Si quieres que un recurso liberado rechace llamadas, la guarda la pones tú en tu clase (un flag que teclea `yaLiberado`), como harás en el ejercicio avanzado.

### Conexión con Java

**Traduce exactamente**: `using` es un puerto directo de Java 7 (2011): `try-with-resources` con `AutoCloseable`. Java lo popularizó tanto que TC39 se inspiró en él.

```java
public final class ConexionBD implements AutoCloseable {
    private final String host;

    public ConexionBD(String host) {
        this.host = host;
    }

    @Override
    public void close() {
        System.out.println("[" + host + "] conexión cerrada");
    }

    public String consultar(String sql) {
        return "Resultado de: " + sql;
    }
}

// Llamadas automáticas a close() al salir del bloque
try (ConexionBD conn = new ConexionBD("localhost:5432")) {
    System.out.println(conn.consultar("SELECT * FROM usuarios"));
}
```

**Cambia de fondo**: Java cierra automáticamente al final del `try`, JavaScript al salir del bloque `using` — el mismo contrato, distinta caja. Una diferencia que no tiene Java: JavaScript distingue la liberación **asíncrona** (`await using` + `[Symbol.asyncDispose]`), porque en Node cerrar una conexión real suele implicar I/O. El `close()` de Java es síncrono y punto — no hay `AutoCloseable` asíncrono en el estándar (llegan soluciones en frameworks como Spring).

### Conexión con Python

**Traduce exactamente**: Python lo resuelve con el `with` y los *context managers*: `__enter__`/`__exit__` (síncrono) y `__aenter__`/`__aexit__` (asíncrono).

```python
class ConexionBD:
    def __init__(self, host):
        self.host = host

    def __enter__(self):
        print(f"Conectando a {self.host}...")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Cerrando conexión a {self.host}...")
        return False  # No suprime excepciones; que propaguen

    def consultar(self, sql):
        return f"Resultado de: {sql}"

with ConexionBD("localhost") as conn:
    print(conn.consultar("SELECT * FROM usuarios"))
# Al salir del bloque se ejecuta __exit__ automáticamente


class ConexionAsync:
    async def __aenter__(self):
        await self.conectar()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

async def usar():
    async with ConexionAsync() as conn:
        return await conn.consultar("SELECT 1")
```

**Cambia de fondo**: en Python el nombre de la interfaz es `__enter__`/`__exit__` y hay que *saber* que existe; en JavaScript el `Symbol.dispose` es un símbolo — un identificador único garantizado, imposible de colisionar — y el contrato es igual de explícito con `[Symbol.dispose]()`. Ambos lenguajes liberan incluso si el bloque lanza: esa es la promesa que `try/finally` a mano no puede igualar.

## 2. El orden de la liberación y los errores en cascada

### El problema: dos recursos que dependen entre sí

Cuando un recurso depende de otro, el orden de cierre importa. Una transacción abre una conexión; no puedes *cerrar* la transacción después de que la conexión dejes de existir:

```javascript
async function conTransaccion() {
  let conexion
  let transaccion
  try {
    conexion = await abrirConexion()
    transaccion = await conexion.abrirTransaccion()
    await transaccion.commit()
  } finally {
    if (transaccion) await transaccion.cerrar()
    if (conexion) await conexion.cerrar()
  }
}
```

Fíjate en la fragilidad: cerramos en orden inverso (primero lo que se abrió después) a mano, con dos `if` que ponemos por si falló la apertura. Olvidar un `if` o el orden provoca fugas o cierres prematuros.

**`using` te da el orden inverso por diseño.** Los recursos declarados en el mismo bloque se liberan en el **orden contrario a su declaración** (LIFO): el que abrió el último es el que cierra el primero — exactamente lo que necesita la cascada de arriba, sin los `if` ni el orden casero.

```javascript
let orden = []

class Transaccion {
  constructor(conexion) { this.conexion = conexion }

  async commit() { orden.push("commit") }

  async [Symbol.asyncDispose]() {
    orden.push("cerrar transacción")
  }
}

class Conexion {
  abrirTransaccion() { return new Transaccion(this) }

  async [Symbol.asyncDispose]() {
    orden.push("cerrar conexión")
  }
}

async function ejemplo() {
  await using conexion = new Conexion()
  await using transaccion = conexion.abrirTransaccion()
  await transaccion.commit()
} // el scope se vacía: primero transacción, luego conexión

await ejemplo()
console.log(orden) // ["commit", "cerrar transacción", "cerrar conexión"]
```

### El caso incómodo: el cuerpo y la limpieza fallan a la vez

¿Y si tu código lanza **y** la limpieza también? El estándar agrupa ambas en un **`SuppressedError`** (verificado así en Node 24+):

```javascript
class Roto {
  [Symbol.dispose]() {
    throw new Error("la limpieza también falló")
  }
}

try {
  using r = new Roto()
  throw new Error("el cuerpo lanzó")
} catch (error) {
  console.log(error.constructor.name) // SuppressedError
  console.log(error.error.message) // la limpieza también falló
  console.log(error.suppressed.message) // el cuerpo lanzó
}
```

Punto delicado que debes conocer: el **error que gana** es el de la disposición (`error.error`) y el del cuerpo queda *suprimido* en `error.suppressed`. Tu excepción original no se pierde — pero tienes que saber buscarla en `.suppressed` cuando veas un `SuppressedError` en el log.

Y un error en la liberación **sí** se propaga: si todo el bloque terminó bien pero el `dispose` lanza, la excepción que ves es la del `dispose`.

### Conexión con Java

**Traduce exactamente**: `try-with-resources` también libera en orden inverso a la declaración:

```java
try (Conexion conexion = abrir();
     Transaccion transaccion = conexion.abrirTransaccion()) {
    transaccion.commit();
} // cierra transacción y después conexión
```

**Cambia de fondo**: aquí se nota un **detalle distinto**. En Java, si el cuerpo lanza y `close()` también, el error del **cuerpo** gana y el del cierre se adjunta con `addSuppressed()`; en JavaScript gana el error de la **disposición** y el del cuerpo queda en `.suppressed`. Mismo principio (nada de excepciones perdidas) con prioridades opuestas — mézclalo mentalmente entre los dos lenguajes una sola vez y lo recordarás para siempre.

### Conexión con Python

**Traduce exactamente**: Python anida scopes y la misma regla LIFO se aplica con `with` anidados — se sale de los bloques en orden inverso a su apertura. Para dependencias dinámicas (no sabes cuántos recursos abrirás hasta ejecutar), Python tiene `contextlib.ExitStack`, que apila y libera en orden inverso igual que un `using` tras otro:

```python
from contextlib import ExitStack

with ExitStack() as stack:
    conexion = stack.enter_context(ConexionBD("localhost"))
    stack.callback(lambda: print("limpieza extra"))
# se cierran las entradas en orden inverso: callback, y luego conexion
```

**Cambia de fondo**: `ExitStack` cubre el caso de *cantidad desconocida* de recursos, que en JavaScript se resuelve de dos formas: varios `using` a la vez (si los conoces) o `DisposableStack`/`AsyncDisposableStack` (si los vas sumando en un bucle — el mecanismo equivalente a `ExitStack`, con `use()` y liberación en LIFO). El orden LIFO es la misma regla en los tres lenguajes: raro que algo sea idéntico entre Java, Python y JavaScript pero en la limpieza lo es.

## Depuración en la práctica

### Cuando la limpieza falla

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `conexionesAbiertas` nunca vuelve a 0 | `try/finally` olvidado en alguna ruta | Declarar con `using`/`await using` |
| `TypeError: Symbol(Symbol.dispose) is not a function` | El valor no implementa el contrato | Añadir `[Symbol.dispose]` o `[Symbol.asyncDispose]` |
| Ves `SuppressedError` en el log | El cuerpo y la disposición fallaron a la vez | Leer `.error` y `.suppressed` para no perder tu excepción |
| El recurso se usa después de liberado y rompe | `using` no inmoviliza el objeto | Guardar en la clase con un flag `yaLiberado` |
| El pool de conexiones crece sin límite | Las inactivas nunca se cierran | `limpiarInactivas()` con timeout (ver ejercicio avanzado) |

### Escenario 1: muchos recursos, muchos scopes

En una aplicación grande no hay un `finally` que encuentres — hay cincuenta, cada uno en su función, algunos olvidados. Rastrear "cuántas conexiones están abiertas en este momento" es imposible porque el estado está repartido. El arreglo combina dos cosas: **centralizar** los recursos longevos (un pool de conexiones como el del ejercicio avanzado, con estadísticas) y **acotar la vida** de los temporales con `using` en el scope donde se usan. El pool responde "¿cuántas hay abiertas?"; `using` responde "ninguna se quedará abierta solo porque me olvidé".

### Escenario 2: la limpieza en cascada y la liberación parcial

Los recursos con dependencias (config → archivo → conexión, o transacción → conexión) imponen dos reglas: **orden inverso** de liberación y **tolerancia** a fallar a mitad de la cascada. Si cierras la conexión antes que la transacción, los datos en vuelo se pierden; si el primer `close` lanza, los demás deben seguir cerrándose aunque sea parcialmente. `using` te da el orden inverso gratis; para la tolerancia a fallos, recuerda que cada `[Symbol.dispose]` corre en bloque aparte — una excepción en un dispose no impide que se llame al siguiente. Diseña cada `dispose` como si fuera la única cosa que funciona del sistema.

## Práctica y ejercicios

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Qué contrato debe cumplir un objeto para usarlo con `using`? ¿Y con `await using`?</b></summary>

**Explicación**: para `using` debe implementar `[Symbol.dispose]()` (síncrono); para `await using`, `[Symbol.asyncDispose]()` (asíncrono). Sin el método, el runtime lanza `TypeError: Symbol(Symbol.dispose) is not a function`.
</details>

<details>
<summary><b>2. ¿En qué orden se liberan varios `using` del mismo bloque y por qué importa?</b></summary>

**Explicación**: en orden inverso a la declaración (LIFO): el último abierto cierra primero. Importa para recursos con dependencias — una transacción debe cerrarse antes que la conexión — y es justo lo que un `try/finally` casero se ve obligado a repetir en cada función.
</details>

<details>
<summary><b>3. Si el cuerpo y la disposición lanzan a la vez, ¿qué obtienes y dónde está cada error?</b></summary>

**Explicación**: un `SuppressedError`. Allí `.error` es la excepción de la disposición (la que gana) y `.suppressed` la del cuerpo; tu error original no se pierde, está en `.suppressed`. Si el bloque termina bien pero el `dispose` lanza, se propaga el del `dispose`.
</details>

<details>
<summary><b>4. ¿`using` impide que uses un recurso después de liberarlo?</b></summary>

**Explicación**: no. `using` solo garantiza que se llame a `Symbol.dispose`/`Symbol.asyncDispose` al salir del bloque; el objeto sigue llamable. Si quieres rechazar usos tras la liberación, la guarda (un flag) la implementa tu clase — como `ReferenciaConexion` en el ejercicio avanzado.
</details>

<details>
<summary><b>5. ¿Cuál es el ancestro de `using` en Java y el equivalente de Python?</b></summary>

**Explicación**: el ancestro es `try-with-resources` de Java 7 (2011) con `AutoCloseable` y `close()`, que también cierra en orden inverso. En Python el equivalente es el `with` y los context managers `__enter__`/`__exit__` (o `__aenter__`/`__aexit__`), con `contextlib.ExitStack` para recursos dinámicos.
</details>

### 2. Explicarlo con tus palabras

> **Reto**: explica a un amigo que viene de Java cómo funciona `await using` con la metáfora del **check-out de un hotel con conserje automático**: al registrarte (abrir el recurso) el conserje anota la habitación; al hacer checkout, el conserje cierra **en orden inverso** lo que abriste (si diste dos vueltas de llave, desbloquea primero la segunda) y lo hace *incluso si sales corriendo por un incendio* (excepción). Después céntrate en el caso raro: si al cerrar la puerta escuchas que también se rompe la cerradura del pasillo, el conserje te entrega un formulario doble: la avería de la puerta (`.error`) y el motivo por el que saliste corriendo (`.suppressed`).
> *Pista: si dudas, relee la [Sección 1](#1-using-liberación-garantizada-de-recursos) y la [Sección 2](#2-el-orden-de-la-liberación-y-los-errores-en-cascada).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): un archivo temporal autocerrado

**Objetivo**: implementar `Symbol.dispose` y comprobar que `using` llama a la limpieza al salir del bloque.

**Enunciado**: crea una clase `TempFile` que:
1. Al instanciarse cree un archivo temporal (simulado: guarda un nombre y contenido en memoria).
2. Implemente `Symbol.dispose` para marcarlo como eliminado e imprimirlo.
3. Imprima un mensaje al crear y otro al eliminar.
4. Tras la liberación, `leer()` rechace con un `Error` claro (la guarda contra uso posterior).

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Guarda `this.nombre` y `this.contenido`; un flag `this.eliminado` empieza en `false`.
2. En `leer()`, si `this.eliminado === true`, lanza `new Error("El archivo ya fue liberado")`.
3. Escribe el orden de los mensajes con `console.log` y compáralo con lo que ves al ejecutar.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class TempFile {
  constructor(nombre) {
    this.nombre = nombre
    this.contenido = ""
    this.eliminado = false
    console.log(`Creando archivo temporal: ${nombre}`)
  }

  escribir(texto) {
    if (this.eliminado) throw new Error("El archivo ya fue liberado")
    this.contenido = texto
    console.log(`Escribiendo en ${this.nombre}: ${texto}`)
  }

  leer() {
    if (this.eliminado) throw new Error("El archivo ya fue liberado")
    console.log(`Leyendo de ${this.nombre}`)
    return this.contenido
  }

  [Symbol.dispose]() {
    this.eliminado = true
    this.contenido = ""
    console.log(`Eliminando archivo temporal: ${this.nombre}`)
  }
}

function procesar() {
  using temp = new TempFile("cache.tmp")
  temp.escribir("datos importantes")
  return temp.leer()
}

console.log(procesar())
// Creando archivo temporal: cache.tmp
// Escribiendo en cache.tmp: datos importantes
// Leyendo de cache.tmp
// Eliminando archivo temporal: cache.tmp
// datos importantes

let temp
{
  using manejador = new TempFile("otro.tmp")
  temp = manejador
  console.log(temp.leer()) // "" — dentro del scope, todavía no está liberado
}
// aquí el scope terminó: [Symbol.dispose] ha corrido
try {
  temp.leer()
} catch (error) {
  console.log(error.message) // El archivo ya fue liberado
}
```

**¿Por qué funciona?** `using` llama a `[Symbol.dispose]` en cuanto el scope termina, tanto si el cuerpo lanza como si no — no hace falta `try/finally`. Y como `using` no inmoviliza el objeto por sí solo, aquí la clase guarda con el flag `eliminado` que nadie use el archivo después de liberarlo. Fíjate en el matiz de *cuándo* se libera: no en la declaración, sino al **salir del bloque** — por eso `temp.leer()` dentro del `{}` funciona y el mismo `leer()` después lanza. Ese matiz exacto es la fuente de los bugs al migrar el `finally` antiguo a `using`.
</details>

#### Ejercicio 2 (Intermedio): conexión asíncrona con reintento determinista

**Objetivo**: implementar `Symbol.asyncDispose`, una reconexión controlada (sin aleatoriedad) y un log de operaciones verificable.

**Enunciado**: crea una clase `ConexionBD` que:
1. `conectar()` ponga `conectada = true` con un pequeño delay simulado.
2. `consultar(sql)` falle la primera vez *si se configura* con `modoFallar: 1` (determinista, para poder comprobarlo), y al fallar marque `conectada = false`.
3. `reconectar()` lo intente hasta `maxReintentos` y lance `Error` si se agota.
4. Implemente `Symbol.asyncDispose` que cierre la conexión y lo registre.
5. Mantenga un log (`registrar`) con todas las operaciones, recuperable con `obtenerLog()`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. El fallo programado: un contador `fallosRestantes` que se decrementa en cada `consultar` si es > 0.
2. `reconectar` incrementa `reintentos` y lanza `"Máximo de reintentos alcanzado"` al llegar a `maxReintentos`.
3. El `[Symbol.asyncDispose]` es un método `async` que registra y marca `conectada = false`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class ConexionBD {
  constructor(host, { modoFallar = 0 } = {}) {
    this.host = host
    this.conectada = false
    this.fallosRestantes = modoFallar
    this.reintentos = 0
    this.maxReintentos = 3
    this.log = []
  }

  async conectar() {
    this.registrar("conectar")
    await esperar(20)
    this.conectada = true
    return this
  }

  async consultar(sql) {
    if (!this.conectada) await this.reconectar()
    this.registrar(`consultar: ${sql}`)

    if (this.fallosRestantes > 0) {
      this.fallosRestantes--
      this.conectada = false
      throw new Error("Conexión perdida")
    }

    return `Resultado de: ${sql}`
  }

  async reconectar() {
    this.reintentos++
    this.registrar(`reintento ${this.reintentos}/${this.maxReintentos}`)
    if (this.reintentos > this.maxReintentos) {
      throw new Error("Máximo de reintentos alcanzado")
    }
    await esperar(20)
    this.conectada = true
    return this
  }

  async [Symbol.asyncDispose]() {
    this.registrar("cerrar conexión")
    await esperar(10)
    this.conectada = false
  }

  registrar(mensaje) {
    this.log.push(mensaje)
    console.log(`[${this.host}] ${mensaje}`)
  }

  obtenerLog() {
    return [...this.log]
  }
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const conn = new ConexionBD("localhost:5432", { modoFallar: 1 })

async function ejecutarConsultas() {
  await using c = conn
  await c.conectar()

  const fallos = []
  try {
    await c.consultar("SELECT * FROM usuarios") // falla por diseño (modoFallar)
  } catch (error) {
    fallos.push(error.message) // "Conexión perdida"
  }

  const logs = await c.consultar("SELECT * FROM logs") // reconecta y sí puede
  return { fallos, logs }
}

// envuelve el await de primer nivel para que el script corra también en CommonJS
async function principal() {
  const resultado = await ejecutarConsultas()
  console.log(resultado.fallos) // ["Conexión perdida"]
  console.log(resultado.logs)   // Resultado de: SELECT * FROM logs

  // aquí `ejecutarConsultas` ya terminó: el asyncDispose corrió solo
  console.log(conn.conectada)  // false — la conexión está cerrada
  console.log(conn.obtenerLog())
  // ["conectar", "consultar: SELECT * FROM usuarios", "reintento 1/3",
  //  "consultar: SELECT * FROM logs", "cerrar conexión"]
}

principal()
```

**¿Por qué funciona?** El primer `consultar` falla a propósito (`modoFallar: 1`), el `catch` registra el fallo en lugar de relanzarlo, y el segundo `consultar` entra por el `if (!this.conectada)` para reconectar antes de ejecutar — el reintento es explícito y verificable, sin `Math.random()`. Al terminar `ejecutarConsultas`, el scope de `await using` se cierra y el `[Symbol.asyncDispose]` corre solo: por eso, en `principal`, después de la llamada, `conn.conectada` ya es `false` y el log final contiene `"cerrar conexión"`. Por qué el reintento funciona: la reconexión detecta el flag antes de lanzar la consulta, no después — por eso `fallos` solo tiene un mensaje.
</details>

#### Ejercicio 3 (Avanzado): pool de conexiones con `await using`

**Objetivo**: gestionar varias conexiones con un pool, `ReferenciaConexion` de un solo uso y estadísticas verificables.

**Enunciado**: crea un `PoolConexiones` que:
1. Tenga `tamanioMax` configurable y prepaga conexiones por nombre, reutilizando las libres (`reutilizadas` + `creadas` en estadísticas).
2. Devuelva `ReferenciaConexion`, cuyo `consultar` solo funcione **una vez** (guarda `usada`) y cuyo `[Symbol.asyncDispose]` devuelva la conexión al pool.
3. Lance `Error` si el pool está lleno (sin conexión libre y `size >= tamanioMax`).
4. Tenga `limpiarInactivas()` por timeout (sin timers sueltos: dale a `cerrar()` para limpiar todo) y `obtenerEstadisticas()`.
5. Prueba con `await using` doble que al final `activas === 0` y que una `ReferenciaConexion` de un solo uso explote si la consultas dos veces.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. El `ReferenciaConexion` guarda una referencia al pool y un `id`; su `[Symbol.asyncDispose]` llama a `pool.liberar(id)`.
2. El pool guarda las conexiones en un `Map` id → conexión con un flag `estaLibre`.
3. Para la estadística `activas`, cuenta las conexiones con `estaLibre === false`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class ConexionSimulada {
  constructor(nombre) {
    this.nombre = nombre
  }

  async consultar(sql) {
    return `[${this.nombre}] ${sql}`
  }

  async cerrar() {
    // liberación de la conexión real
  }
}

class ReferenciaConexion {
  constructor(pool, id) {
    this.pool = pool
    this.id = id
    this.usada = false
  }

  consultar(sql) {
    if (this.usada) {
      throw new Error("Esta conexión ya fue utilizada")
    }
    const conexion = this.pool.conexiones.get(this.id)
    this.usada = true
    return conexion.consultar(sql)
  }

  [Symbol.asyncDispose]() {
    this.pool.liberar(this.id)
    return Promise.resolve()
  }
}

class PoolConexiones {
  constructor({ tamanioMax = 5 } = {}) {
    this.tamanioMax = tamanioMax
    this.conexiones = new Map()
    this.ultimoId = 0
    this.estadisticas = { creadas: 0, reutilizadas: 0, cerradas: 0 }
  }

  async obtenerConexion(nombre) {
    for (const [id, conexion] of this.conexiones) {
      if (conexion.nombre === nombre && conexion.estaLibre) {
        conexion.estaLibre = false
        this.estadisticas.reutilizadas++
        return new ReferenciaConexion(this, id)
      }
    }

    if (this.conexiones.size >= this.tamanioMax) {
      throw new Error(`Pool de conexiones lleno (máximo ${this.tamanioMax})`)
    }

    const id = ++this.ultimoId
    const conexion = new ConexionSimulada(nombre)
    conexion.estaLibre = false
    conexion.creadaEn = Date.now()
    this.conexiones.set(id, conexion)
    this.estadisticas.creadas++
    return new ReferenciaConexion(this, id)
  }

  liberar(id) {
    const conexion = this.conexiones.get(id)
    if (conexion) {
      conexion.estaLibre = true
      conexion.liberadaEn = Date.now()
    }
  }

  limpiarInactivas(timeoutMs = 30000) {
    const ahora = Date.now()
    for (const [id, conexion] of this.conexiones) {
      if (conexion.estaLibre && ahora - conexion.liberadaEn > timeoutMs) {
        conexion.cerrar()
        this.conexiones.delete(id)
        this.estadisticas.cerradas++
      }
    }
  }

  cerrar() {
    for (const conexion of this.conexiones.values()) {
      conexion.cerrar()
    }
    this.conexiones.clear()
  }

  obtenerEstadisticas() {
    const activas = [...this.conexiones.values()].filter(c => !c.estaLibre).length
    return { ...this.estadisticas, activas, totales: this.conexiones.size }
  }
}

const pool = new PoolConexiones({ tamanioMax: 2 })

async function conDosConexiones() {
  await using conn1 = await pool.obtenerConexion("db1")
  await using conn2 = await pool.obtenerConexion("db2")
  console.log(await conn1.consultar("SELECT * FROM usuarios"))
  console.log(await conn2.consultar("SELECT * FROM productos"))
  console.log(pool.obtenerEstadisticas()) // creadas: 2, activas: 2
}

await conDosConexiones()
console.log(pool.obtenerEstadisticas()) // activas: 0 — el await using liberal

const ref = await pool.obtenerConexion("db1")
console.log(await ref.consultar("SELECT 1"))
try {
  await ref.consultar("SELECT 2")
} catch (error) {
  console.log(error.message) // Esta conexión ya fue utilizada
}
await ref[Symbol.asyncDispose]()
```

**¿Por qué funciona?** `await using conn1`/`conn2` liberan al pool automáticamente al salir del bloque, en orden inverso, y le devuelven la conexión con `estaLibre = true` (vuelve a `reutilizarse` en la siguiente petición del mismo `db1`). El `ReferenciaConexion` es un *permiso de un solo uso*: su `consultar` comprueba `usada` y el flag explota si alguien intenta consultar dos veces — la guarda manual que `using` no pone por ti. El límite también se respeta: con `tamanioMax: 2`, una tercera petición sin liberar lanzaría `"Pool de conexiones lleno"`. Nota: `limpiarInactivas` solo es segura si la conexión está **libre** — nunca cierres nada que un `ReferenciaConexion` pueda estar usando.
</details>

## Tabla comparativa entre lenguajes

| Aspecto | JavaScript | Python | Java |
|---|---|---|---|
| Sintaxis | `using` / `await using` | `with` / `async with` | `try (…)` |
| Interfaz | `[Symbol.dispose]` / `[Symbol.asyncDispose]` | `__enter__`/`__exit__` (o `__aenter__`/`__aexit__`) | `AutoCloseable.close()` |
| Orden de liberación | LIFO (inverso a la declaración) | LIFO (anidamiento) + `ExitStack` | LIFO (inverso a la declaración) |
| Asincronía | `Symbol.asyncDispose` estándar | `__aexit__` async | No hay en el estándar |
| Varios recursos | `using` y DisposableStack | anidados o `ExitStack` | varios en el mismo `try` |
| Si el cuerpo falla y la limpieza también | `SuppressedError` (gana el de limpieza) | Propaga el nuevo; el original en `__context__` | Gana el del cuerpo; el otro con `addSuppressed` |

En este capítulo los tres lenguajes convergen en el **mismo contrato** con nombres distintos — y la comparativa de errores es de las asimétricas que conviene subrayar: cada lenguaje decide quién gana cuando el cuerpo y la limpieza fallan a la vez.

## Resumen del capítulo

1. **`using`/`await using`** (ES2027) garantizan la liberación de recursos al salir del bloque: normal, excepción, `return` o `break`.
2. El objeto debe implementar **`[Symbol.dispose]`** (síncrono) o **`[Symbol.asyncDispose]`** (asíncrono); sin contrato, `TypeError`.
3. **Se libera en orden inverso** a la declaración (LIFO), exactamente lo que exigen los recursos con dependencias.
4. `using` **no inmoviliza el objeto** tras liberarlo — la guarda posterior (`usada`, `eliminado`) la pones tú en tu clase.
5. Cuerpo y limpieza que fallan a la vez → **`SuppressedError`**: `.error` es de la disposición, `.suppressed` el tuyo.
6. **Java** (`try-with-resources`, 2011) es el ancestro del diseño; **Python** (`with`, context managers) y JavaScript comparten LIFO; solo JS tiene el cierre asíncrono en el estándar.
7. **Node.js ya lo trae**: manejadores reales (`fs/promises`, `FileHandle`) implementan el contrato — ya puedes liberar recursos de verdad sin polyfill.

## Siguiente Capítulo

→ **[Capítulo 12: APIs modernas y propuestas TC39](./cap-12)**: `using` es solo la muestra de cómo ECMAScript se mueve deprisa. El capítulo final hace barrido de las APIs modernas (iterator helpers, `Promise.withResolvers`, `Error.isError`, import attributes) y de cómo leer las propuestas que aún están en camino.