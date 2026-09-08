---
title: "Capítulo 8: Patrones comportamentales y eventos (Observer, Mediator, Strategy)"
---

# Capítulo 8: Patrones comportamentales y eventos (Observer, Mediator, Strategy)

## Introducción

En el capítulo 7 aprendiste a controlar cómo se crean los objetos. Ahora los objetos existen y tienen que comunicarse — y ese es el punto donde los sistemas se convierten en un nudo: cada componente conoce a cada componente, nadie se desuscribe, y para cambiar un algoritmo hay que tocar diez sitios.

Los **patrones comportamentales** atacan la comunicación y la delegación de responsabilidades:

- **Observer**: un cambio de estado avisa a todos los interesados, sin que ellos se conozcan entre sí.
- **Mediator**: la comunicación entre muchas piezas pasa por un punto central, en vez de unir a todos contra todos.
- **Strategy**: un comportamiento se convierte en un algoritmo intercambiable en tiempo de ejecución.

Son la base de los sistemas orientados a eventos (el DOM, Node.js, arquitecturas reactivas). Como siempre, verás el problema detrás de cada uno, su implementación en JavaScript moderno y la versión de Python y Java de la misma idea.

## 1. Observer

### El problema: tu componente se entera de los cambios a fuerza de preguntar

La forma ingenua de saber si algo cambió es preguntar tú mismo cada vez:

```javascript
setInterval(() => {
  if (servidor.estado !== ultimoEstado) {
    actualizarUI(servidor.estado)
    ultimoEstado = servidor.estado
  }
}, 1000)
```

Esto se llama **polling**: gastas tiempo de CPU cada segundo, la UI se actualiza tarde y, sobre todo, el componente que pregunta tiene que conocer los detalles internos de `servidor`. El **Observer** invierte el flujo: el que cambia *notifica*, y los interesados se suscriben para recibir el aviso. Nadie pregunta, nadie se conoce.

```javascript
class EventEmitter {
  constructor() {
    this.eventos = new Map()
  }

  on(evento, callback) {
    if (!this.eventos.has(evento)) {
      this.eventos.set(evento, [])
    }
    this.eventos.get(evento).push(callback)
    return this
  }

  emit(evento, ...args) {
    const callbacks = this.eventos.get(evento)
    if (callbacks) {
      callbacks.forEach(cb => cb(...args))
    }
    return this
  }

  off(evento, callback) {
    const callbacks = this.eventos.get(evento)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) callbacks.splice(index, 1)
    }
    return this
  }
}

const notificaciones = new EventEmitter()

const onMensaje = (texto) => console.log(`Nuevo mensaje: ${texto}`)
const onAlerta = (texto) => console.log(`Alerta: ${texto}`)

notificaciones.on("mensaje", onMensaje)
notificaciones.on("alerta", onAlerta)

notificaciones.emit("mensaje", "Hola David")
notificaciones.emit("alerta", "Servidor caído")
```

El sujeto (`EventEmitter`) solo conoce una lista de callbacks por evento: no sabe quiénes son los suscriptores, y ellos no saben del resto. Ese es el desacople que lo hace útil.

### Cuándo usarlo

- Cuando un cambio debe avisar a una lista (posiblemente variable) de interesados.
- Cuando el emisor y los receptores no deberían conocerse.
- Ejemplos reales: el módulo `events` de Node.js, `addEventListener` en el DOM, sistemas pub/sub.

### Conexión con Python

**Traduce exactamente**: Python no trae un `EventEmitter` en su librería estándar, pero el patrón se implementa igual, con un diccionario de listas:

```python
class EventEmitter:
    def __init__(self):
        self.eventos = {}

    def on(self, evento, callback):
        self.eventos.setdefault(evento, []).append(callback)
        return self

    def emit(self, evento, *args):
        for callback in self.eventos.get(evento, []):
            callback(*args)

    def off(self, evento, callback):
        if evento in self.eventos and callback in self.eventos[evento]:
            self.eventos[evento].remove(callback)
        return self
```

**Cambia de fondo**: aquí la diferencia es de ecosistema, no de patrón. En Node.js el `EventEmitter` ya está en la biblioteca estándar (`require("node:events")`); en Python lo escribes a mano o usas una librería (por ejemplo `pyee`, que es un port del de Node). El mecanismo del diccionario de callbacks es idéntico.

### Conexión con Java

**Traduce exactamente**: Java maneja el Observer con interfaces de escucha. La versión antigua (`java.util.Observable`/`Observer`) viene deprecada desde Java 9; el enfoque moderno son interfaces de listener y `PropertyChangeSupport`:

```java
class Usuario {
    private final PropertyChangeSupport cambios = new PropertyChangeSupport(this);

    public void onEstadoCambia(PropertyChangeListener listener) {
        cambios.addPropertyChangeListener(listener);
    }
}
```

**Cambia de fondo**: en Java la notificación va por interfaces — una clase debe `implements ActionListener` y los add/remove de listeners se gestionan a mano. En JavaScript un callback es una función de primera clase: te suscribes pasando la función directamente. El DOM hace lo mismo que tu `EventEmitter` con un `addEventListener` que además te permite cancelar con un `AbortController`.

## 2. Mediator

### El problema: los componentes se conocen todos entre sí

Imagina un chat con tres usuarios. La forma ingenua conecta a cada usuario con el resto: `ana.enviar(mensaje, david)`, `luis.enviar(mensaje, ana)`... con diez usuarios son noventa conexiones, y cada cambio (nuevo tipo de destinatario, moderación) toca a todos. El **Mediator** hace de centralita: los usuarios no se conocen, solo conocen al mediador, y es él quien decide quién recibe qué.

```javascript
class ChatMediator {
  constructor() {
    this.usuarios = new Map()
  }

  registrar(usuario) {
    this.usuarios.set(usuario.nombre, usuario)
    usuario.mediator = this
  }

  enviar(mensaje, de, para) {
    const destinatario = this.usuarios.get(para)
    if (destinatario) {
      destinatario.recibir(mensaje, de)
    }
  }
}

class Usuario {
  constructor(nombre) {
    this.nombre = nombre
    this.mediator = null
  }

  enviar(mensaje, para) {
    this.mediator.enviar(mensaje, this.nombre, para)
  }

  recibir(mensaje, de) {
    console.log(`${this.nombre} recibió de ${de}: ${mensaje}`)
  }
}

const chat = new ChatMediator()

const david = new Usuario("David")
const ana = new Usuario("Ana")

chat.registrar(david)
chat.registrar(ana)

david.enviar("Hola Ana, ¿cómo vas?", "Ana")
// Ana recibió de David: Hola Ana, ¿cómo vas?
```

### Cuándo usarlo

- Cuando muchos objetos interactúan y el acoplamiento directo se vuelve insostenible.
- Cuando quieres reutilizar componentes que no deberían conocer a sus colaboradores.
- La contrapartida: el mediador puede crecer demasiado (lo vemos en el escenario de depuración).

### Conexión con Python

**Traduce exactamente**: la implementación es idéntica, con diccionario y atributo de instancia:

```python
class ChatMediator:
    def __init__(self):
        self.usuarios = {}

    def registrar(self, usuario):
        self.usuarios[usuario.nombre] = usuario
        usuario.mediator = self

    def enviar(self, mensaje, de, para):
        destinatario = self.usuarios.get(para)
        if destinatario:
            destinatario.recibir(mensaje, de)

class Usuario:
    def __init__(self, nombre):
        self.nombre = nombre
        self.mediator = None

    def enviar(self, mensaje, para):
        self.mediator.enviar(mensaje, self.nombre, para)

    def recibir(self, mensaje, de):
        print(f"{self.nombre} recibió de {de}: {mensaje}")
```

**Cambia de fondo**: ninguno en la mecánica — en ambos lenguajes los usuarios desconocen a los demás y todo pasa por el mediador. La única diferencia práctica es que en Python el "mediador" del mundo real suele ser una cola o un bus de mensajes (ver la conexión con Java), mientras que en JavaScript lo encuentras implementado a mano en toda arquitectura de chat o tablero.

### Conexión con Java

**Traduce exactamente**: no hay un mediador en la librería estándar de Java, pero el esqueleto es el mismo con interfaces:

```java
interface Componente {
    void recibir(String mensaje, String de);
}

class MediadorChat {
    Map<String, Componente> usuarios = new HashMap<>();

    void registrar(String nombre, Componente c) {
        usuarios.put(nombre, c);
    }

    void enviar(String mensaje, String de, String para) {
        Componente destino = usuarios.get(para);
        if (destino != null) destino.recibir(mensaje, de);
    }
}
```

**Cambia de fondo**: en el mundo Java este patrón rara vez se escribe a mano — se resuelve con infraestructura: buses de eventos, colas y brokers de mensajes (JMS), donde el "mediador" es un servidor. El concepto es el mismo — un punto central que reenvía y las partes no se conocen — pero la escala es distinta. En JavaScript el patrón suele caber en media página, y ahí está su encanto.

## 3. Strategy

### El problema: un `if/else` por cada variante del algoritmo

A medida que crecen las reglas de validación, cada método se llena de ramas:

```javascript
function validar(tipo, valor) {
  if (tipo === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
  } else if (tipo === "telefono") {
    return /^\+?[\d\s-]{7,15}$/.test(valor)
  } else if (tipo === "obligatorio") {
    return valor !== null && valor !== undefined && valor !== ""
  }
}
```

Cada regla nueva añade otra rama al mismo método, y el día que quieras validar con una regla distinta en un formulario concreto, tienes que tocar la función compartida. El **Strategy** extrae cada algoritmo a su propia pieza y las agrupa en un mapa: cambiar de comportamiento ya no es editar ramas, es *elegir una estrategia*.

```javascript
const estrategias = {
  email: (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
  telefono: (valor) => /^\+?[\d\s-]{7,15}$/.test(valor),
  obligatorio: (valor) => valor !== null && valor !== undefined && valor !== "" && valor !== 0
}

class Validador {
  constructor(estrategia) {
    this.estrategias = estrategias
    this.setEstrategia(estrategia)
  }

  setEstrategia(nombre) {
    if (!estrategias[nombre]) {
      throw new RangeError(`Estrategia desconocida: '${nombre}'`)
    }
    this.estrategia = estrategias[nombre]
  }

  validar(valor) {
    return this.estrategia(valor)
  }
}

const validador = new Validador("email")

validador.validar("david@ejemplo.com") // true
validador.setEstrategia("telefono")
validador.validar("+57 300 123 4567") // true
validador.setEstrategia("obligatorio")
validador.validar("") // false
```

### Ventajas

- Cada algoritmo queda aislado y se puede probar por separado.
- Cambiar de estrategia no modifica el contexto que la usa (principio abierto/cerrado).
- El error de estrategia desconocida ahora es claro y temprano (capítulo 6).

### Conexión con Python

**Traduce exactamente**: los callables de Python son funciones de primera clase, así que el mapa de estrategias es igual de directo:

```python
import re

def validar_email(valor):
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', valor))

def validar_obligatorio(valor):
    return valor is not None and valor != ""

estrategias = {
    "email": validar_email,
    "obligatorio": validar_obligatorio,
}
```

**Cambia de fondo**: ninguno en la idea. La diferencia sutil es idiomática: en Python es más habitual que cada estrategia sea una función con nombre (o una clase con `__call__`) y en JavaScript que sean closures anónimas en un objeto literal — pero ambos guardan las estrategias como valores y las intercambian en tiempo de ejecución.

### Conexión con Java

**Traduce exactamente**: el ejemplo canónico de Strategy en Java está *en la librería estándar*: `Comparator<T>`. Ordenar con una estrategia concreta se hace pasándola como argumento:

```java
Collections.sort(usuarios, Comparator.comparing(Usuario::getNombre));
```

**Cambia de fondo**: en Java las estrategias se declaran como **interfaces** — cada algoritmo es una clase que implementa `compare` — y en JavaScript son funciones en un mapa. Ambos permiten cambiar el algoritmo sin tocar el código que lo usa; la ganancia de JavaScript es que no hace falta declarar un tipo ni una clase para cada estrategia: una función basta.

## Depuración en la práctica

### Cuándo cada patrón sale mal

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| La UI se actualiza tarde y con retraso | Se usa polling en vez de Observer | Notificar con un `EventEmitter`/`addEventListener` |
| `TypeError: validador.estrategia is not a function` | `setEstrategia` recibió un nombre que no está en el mapa | Validar el nombre y fallar con `RangeError` en el `set` |
| El mediador tiene veinte métodos y los tests explotan | Se volvió un "God Object" que conoce todos los detalles | Dividirlo en mediadores por dominio, o usar eventos |

### Escenario 1: un Observer que filtra memoria

```javascript
class SistemaNotificaciones {
  constructor() {
    this.suscriptores = new Map()
  }

  on(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, new Set())
    }
    this.suscriptores.get(evento).add(callback)
    return () => this.suscriptores.get(evento)?.delete(callback)
  }
}

const sistema = new SistemaNotificaciones()
const suscriptor = () => console.log("aviso")
sistema.on("mensaje", suscriptor)
```

¿Ves el problema? `sistema` guarda una referencia fuerte a `suscriptor` mientras viva. Si el componente que se suscribió se monta y desmonta (pantallas de una SPA, listeners del DOM), los callbacks que nadie desuscribe **acumulan referencias** y el garbage collector no puede liberar nada. La solución es doble:

1. Que `on` **devuelva la función de desuscripción** (como en el código) y que el que se suscribe la llame cuando deja de interesarle.
2. En el DOM, usar `AbortController`: `addEventListener(evento, fn, { signal })` y `controller.abort()` se lleva el listener junto con el contexto.

En caso de herencia entre clases, `WeakMap`/`WeakSet` como almacén de suscriptores también permite que el GC limpie cuando el *emisor* muere — pero no sustituye a desuscribirse: la referencia fuerte puede estar en la otra dirección.

### Escenario 2: el mediador que se volvió Dios

Un mediador empieza "solo ordenando la comunicación", y con el tiempo termina con reglas de negocio, validación y persistencia:

```javascript
class MediadorCreciente {
  enviar() { /* reenvía mensajes */ }
  moderar() { /* reglas de moderación */ }
  persistir() { /* guarda en BD */ }
  notificarAdmin() { /* avisos */ }
  // ...20 métodos más que conocen cada componente por su nombre
}
```

Las señales de que se escapó de madre: más de diez métodos, conoce detalles de implementación de sus colaboradores, y los tests requieren fabricarlo con la mitad de la app. El arreglo no es borrarlo — es **dividir el mediador por dominio** (un `ChatMediator`, un `ModeracionMediator`), o pasar la lógica pesada a eventos: que el mediador solo reenvíe y que cada suscriptor decida. Si el patrón centraliza demasiado, el problema no es el patrón, es el tamaño de lo que centraliza.

## Práctica y ejercicios

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Qué problema concreto resuelve el Observer y por qué evita el polling?</b></summary>

**Explicación**: el interesado deja de preguntar si algo cambió y pasa a ser notificado cuando cambia. El emisor avisa a su lista de callbacks y el suscriptor no conoce los detalles del emisor; nadie pierde CPU preguntando a intervalos.
</details>

<details>
<summary><b>2. ¿Por qué un Observer sin desuscripción filtra memoria?</b></summary>

**Explicación**: el emisor guarda una referencia fuerte a cada callback mientras viva. Si el objeto que se suscribió desaparece, la lista del emisor sigue agarrando a su función y el garbage collector no puede liberar nada. La desuscripción (devolver una función que borre el callback) corta esa referencia.
</details>

<details>
<summary><b>3. ¿Qué gana el chat con Mediator respecto a que cada usuario conozca a los demás?</b></summary>

**Explicación**: con N usuarios, el acoplamiento directo crea N×N conexiones; con el mediador, cada usuario solo conoce al mediador, y agregar un destinatario nuevo no toca a los existentes. La centralización pone la lógica de enrutado en un solo lugar.
</details>

<details>
<summary><b>4. ¿Cómo mejora el Strategy al clásico `if/else` de algoritmos?</b></summary>

**Explicación**: cada variante queda aislada en su propia función y se agrupa en un mapa; añadir una regla nueva es añadir una entrada, no anidar otra rama. Cambiar de comportamiento en tiempo de ejecución es elegir otra estrategia, sin tocar el contexto que la usa.
</details>

<details>
<summary><b>5. ¿Cuál es la versión del Observer en el estándar de Node.js y en el DOM?</b></summary>

**Explicación**: el módulo `events` (el `EventEmitter` oficial) en Node, y `addEventListener`/`removeEventListener` (más `AbortController`) en el DOM. Ambos son el mismo patrón: te suscribes con una función y te avisan cuando ocurre el evento.
</details>

### 2. Explicarlo con tus palabras

> **Reto**: explica a un amigo que viene de Python estos tres patrones con la metáfora de una **radio**: el **Observer** es la emisora que transmite y cualquier persona que sintoniza la recibe sin conocerse entre sí; el **Mediator** es la centralita de un edificio — para llamar a alguien, pasas por la central, no le gritas al vecino; el **Strategy** es cambiar el filtro de la antena: el receptor sigue siendo el mismo, solo cambias la pieza que procesa la señal. Después explica qué le pasa a cada metáfora si te olvidas de desuscribirte, si la centralita crece sin límite y si eliges un filtro que no existe.
> *Pista: si dudas, relee la [Sección 1](#1-observer), la [Sección 2](#2-mediator) y la [Sección 3](#3-strategy).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): sistema de notificaciones con desuscripción

**Objetivo**: implementar un Observer propio con `on`, `off` y `emit`, y probar que desuscribirse de verdad corta el aviso.

**Enunciado**: crea una clase `SistemaNotificaciones` donde:
1. `on(evento, callback)` registre el callback por evento y **devuelva una función** que lo desuscriba.
2. `off(evento, callback)` elimine solo ese callback.
3. `emit(evento, ...args)` ejecute los callbacks en orden.
4. Comprueba que después de desuscribirse, un nuevo `emit` ya no notifica.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa un `Map` de evento → array (o `Set`) de callbacks.
2. `on` debe devolver `return () => this.off(evento, callback)` para que el suscriptor pueda guardar la desuscripción.
3. `emit` recorre una copia del array y llama cada callback con los argumentos extra (`callback(...args)`).

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class SistemaNotificaciones {
  constructor() {
    this.suscriptores = new Map()
  }

  on(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, new Set())
    }
    this.suscriptores.get(evento).add(callback)
    return () => this.off(evento, callback)
  }

  off(evento, callback) {
    this.suscriptores.get(evento)?.delete(callback)
  }

  emit(evento, ...args) {
    this.suscriptores.get(evento)?.forEach(callback => callback(...args))
  }
}

const sistema = new SistemaNotificaciones()

const desuscribir = sistema.on("mensaje", (texto) => {
  console.log(`Mensaje recibido: ${texto}`)
})

sistema.emit("mensaje", "Hola mundo") // Mensaje recibido: Hola mundo

desuscribir()
sistema.emit("mensaje", "Este ya no se ve") // no pasa nada
```

**¿Por qué funciona?** `on` devuelve una función que captura el evento y el callback, y `off` los borra del `Set`. Al guardar ese `return`, quien se suscribió tiene la llave de la desuscripción sin necesitar acordarse del callback original: es el mismo mecanismo que luego verás en APIs reales como los *cleanup functions* de React. El `emit` con `forEach` garantiza el orden y, al recorrer una copia bajo el capó, los cambios de suscripción durante un `emit` no rompen la iteración.

</details>

#### Ejercicio 2 (Intermedio): chat con Mediator, mensajes privados y broadcast

**Objetivo**: ampliar el chat del capítulo para que el mediador soporte mensajes privados, difusión a todos e historial.

**Enunciado**: implementa un `ChatMediator` que:
1. Registre usuarios y avise a todos con "X se ha unido al chat".
2. `enviar(mensaje, de, para = null)` envíe privado si `para` tiene valor, o difunda a todos menos al emisor si es `null`.
3. Guarde cada mensaje (con `timestamp`) en un historial accesible con `obtenerHistorial()`.
4. Los usuarios deleguen su envío en el mediador, sin conocerse entre sí.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. El historial es un array de objetos `{ de, para, mensaje, timestamp }`.
2. El broadcast recorre `this.usuarios` y salta al emisor con `nombre !== de`.
3. `recibir` imprime con el formato `[nombre] De origen: mensaje`, y `registrar` debe asignar `usuario.mediator = this` antes de cualquier uso.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class ChatMediator {
  constructor() {
    this.usuarios = new Map()
    this.historial = []
  }

  registrar(usuario) {
    this.usuarios.set(usuario.nombre, usuario)
    usuario.mediator = this
    const aviso = `${usuario.nombre} se ha unido al chat`
    this.historial.push({ de: "Sistema", para: null, mensaje: aviso, timestamp: new Date() })
    this.difundir(aviso, "Sistema")
  }

  enviar(mensaje, de, para = null) {
    this.historial.push({ de, para, mensaje, timestamp: new Date() })

    if (para) {
      this.usuarios.get(para)?.recibir(mensaje, de)
    } else {
      this.difundir(mensaje, de)
    }
  }

  difundir(mensaje, de) {
    this.usuarios.forEach((usuario, nombre) => {
      if (nombre !== de) usuario.recibir(mensaje, de)
    })
  }

  obtenerHistorial() {
    return [...this.historial]
  }
}

class UsuarioChat {
  constructor(nombre) {
    this.nombre = nombre
    this.mediator = null
  }

  enviar(mensaje, para = null) {
    if (this.mediator) {
      this.mediator.enviar(mensaje, this.nombre, para)
    }
  }

  recibir(mensaje, de) {
    console.log(`[${this.nombre}] De ${de}: ${mensaje}`)
  }
}

const chat = new ChatMediator()
const david = new UsuarioChat("David")
const ana = new UsuarioChat("Ana")
const luis = new UsuarioChat("Luis")

chat.registrar(david) // [David] De Sistema: David se ha unido al chat
chat.registrar(ana)
chat.registrar(luis)

david.enviar("Hola a todos") // broadcast
ana.enviar("Hola David", "David") // privado
console.log(chat.obtenerHistorial().length) // 5
```

**¿Por qué funciona?** Los usuarios jamás se guardan referencias entre sí: `enviar` solo conoce al mediador, y es el mapa del mediador quien decide el destino. La regla del broadcast (saltar al emisor) vive en un solo lugar, y el historial centraliza la auditoría sin que cada usuario tenga que conservar sus propios mensajes — justo la ventaja del patrón: el acoplamiento N×N se vuelve N hacia uno.

</details>

#### Ejercicio 3 (Avanzado): compresión con estrategias intercambiables y estadísticas reales

**Objetivo**: combinar Strategy con medición real: cambiar de algoritmo en caliente y comparar estadísticas verídicas de cada uno.

**Enunciado**: implementa un `SistemaCompresion` que:
1. Ofrezca tres estrategias (`gzip`, `brotli`, `deflate`), cada una con un método `comprimir(datos)` que devuelva `{ datos, ratio }`.
2. `setEstrategia(nombre)` cambie de algoritmo y lance `RangeError` si el nombre no existe.
3. `comprimir(datos)` mida el tiempo real (`Date.now()` antes/después) y acumule bytes de entrada y salida reales.
4. `obtenerEstadisticas()` devuelva `operaciones`, `bytesEntrada`, `bytesSalida`, `ratioPromedio` (bytes de salida entre bytes de entrada) y `tiempoPromedio`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Guarda las estrategias en un objeto literal `estrategias` y úsalo tanto para el constructor como para `setEstrategia`.
2. El ratio **se calcula**, no se inventa: `ratioPromedio = bytesSalida / bytesEntrada`.
3. Guarda `tiempoTotal` acumulado para poder promediar; abstrae la entrega de estadísticas en el objeto `estadisticas`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
const estrategias = {
  gzip: { comprimir: (datos) => ({ datos: `gzip:${datos}`, ratio: 0.3 }) },
  brotli: { comprimir: (datos) => ({ datos: `brotli:${datos}`, ratio: 0.25 }) },
  deflate: { comprimir: (datos) => ({ datos: `deflate:${datos}`, ratio: 0.35 }) },
}

class SistemaCompresion {
  constructor(estrategiaInicial = "gzip") {
    this.estrategia = estrategias[estrategiaInicial]
    this.estadisticas = { bytesEntrada: 0, bytesSalida: 0, tiempoTotal: 0, operaciones: 0 }
  }

  setEstrategia(nombre) {
    if (!estrategias[nombre]) {
      throw new RangeError(`Estrategia '${nombre}' no disponible`)
    }
    this.estrategia = estrategias[nombre]
  }

  comprimir(datos) {
    const inicio = Date.now()
    const resultado = this.estrategia.comprimir(datos)
    const tiempoReal = Date.now() - inicio

    this.estadisticas.bytesEntrada += datos.length
    this.estadisticas.bytesSalida += resultado.datos.length
    this.estadisticas.tiempoTotal += tiempoReal
    this.estadisticas.operaciones++

    return { ...resultado, tiempoReal }
  }

  obtenerEstadisticas() {
    const { bytesEntrada, bytesSalida, tiempoTotal, operaciones } = this.estadisticas
    return {
      operaciones,
      bytesEntrada,
      bytesSalida,
      ratioPromedio: bytesEntrada > 0 ? +(bytesSalida / bytesEntrada).toFixed(4) : 0,
      tiempoPromedio: operaciones > 0 ? +(tiempoTotal / operaciones).toFixed(1) + "ms" : "0ms",
    }
  }
}

const sistema = new SistemaCompresion("gzip")
const datos = "Datos de prueba para compresión".repeat(100)

console.log(sistema.comprimir(datos).datos.slice(0, 5)) // gzip:
console.log(sistema.comprimir(datos).datos.slice(0, 7)) // brotli:

sistema.setEstrategia("brotli")
console.log(sistema.obtenerEstadisticas())
// { operaciones: 2, bytesEntrada: ..., bytesSalida: ..., ratioPromedio: ~0.34, tiempoPromedio: "0.0ms" }

try {
  sistema.setEstrategia("lz4")
} catch (error) {
  console.log(error instanceof RangeError) // true
}
```

**¿Por qué funciona?** Las estrategias son valores del mapa, así que `this.estrategia` siempre es un objeto con `comprimir` — cambiar de algoritmo es reasignar esa referencia. Las estadísticas miden lo que de verdad pasó (`datos.length` de entrada contra `resultado.datos.length` de salida), no un número decorativo, así que la comparación entre `gzip`, `brotli` y `deflate` es honesta. Y el `RangeError` reutiliza la lección del capítulo 6: un nombre mal escrito falla temprano y con un mensaje que dice exactamente qué pasó.

</details>

## Tabla comparativa entre lenguajes

| Aspecto | JavaScript | Python |
|---|---|---|
| Observer estándar | `EventEmitter` en `node:events`, `addEventListener` en el DOM | No hay en la stdlib; se implementa con diccionarios (o `pyee`) |
| Mediator | Clase a mano en media página | Clase a mano, idéntica; o colas/buses externos |
| Strategy | Funciones en un objeto literal | Funciones/callables en un diccionario |
| Desuscripción | Función que devuelve `on`, o `AbortController` | `remove` sobre la lista, o context managers |
| Lógica de eventos en la vida real | Primera clase (Node, DOM, reactivas) | Librerías y frameworks externos |

| Aspecto | JavaScript | Java |
|---|---|---|
| Observer | Callbacks de primera clase | Interfaces de listener + `PropertyChangeSupport` |
| Mediator | Manual, mínimo | Buses de eventos, colas, brokers JMS |
| Strategy | Funciones en un mapa | `Comparator<T>` en la stdlib, interfaces |
| Plantilla de la notificación | Notificación directa a funciones | Añadir/quitar listeners de un objeto a mano |
| Boilerplate | Nulo — una función basta | Alto — delegados e interfaces |

## Resumen del capítulo

1. **Observer** invierte el flujo: el que cambia notifica y los interesados se suscriben — el emisor y los receptores no se conocen.
2. La desuscripción es obligatoria: si `on` no devuelve cómo cancelar, acumulas referencias y filtras memoria.
3. **Mediator** reduce el acoplamiento N×N a N hacia un punto central que decide quién recibe qué.
4. La contrapartida del mediador es que crece sin límite; divídelo por dominio o muévelo a eventos antes de que sea un God Object.
5. **Strategy** convierte cada variante del algoritmo en una pieza del mapa e intercambiarla en caliente no toca al contexto.
6. En los tres, el patrón está en la vida real: `EventEmitter` y `addEventListener`, `Comparator` en Java, callables en Python.
7. La señal de exceso de ingeniería sigue siendo la misma: un patrón sin un problema concreto que resolver.

## Siguiente Capítulo

→ **[Capítulo 9: Arquitecturas de estado (MVC y derivados en Node.js)](./cap-09)**: Ahora que sabes cómo comunican los patrones comportamentales, pasamos a organizar el estado de la aplicación: quién guarda los datos, quién cambia la vista y quién entera a los demás — con la arquitectura MVC y sus variantes en Node.