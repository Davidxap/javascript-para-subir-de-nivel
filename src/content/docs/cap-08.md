---
title: "Capítulo 8: Patrones comportamentales y eventos (Observer, Mediator, Strategy)"
---

# Capítulo 8: Patrones comportamentales y eventos (Observer, Mediator, Strategy)

> Los patrones comportamentales definen cómo los componentes se comunican y delegan responsabilidades.

## Introducción

Los patrones comportamentales son esenciales para sistemas desacoplados y escalables. Definen cómo los objetos se comunican, cómo se delegan responsabilidades y cómo se gestionan las dependencias entre componentes.

**¿Por qué importa?** Porque estos patrones permiten crear código mantenible, extensible y fácil de probar. Son la base de muchas arquitecturas modernas, incluyendo sistemas reactivos y orientados a eventos.

## 1. Observer

### Idea clave

El patrón Observer define una relación uno-a-muchos: cuando un objeto (sujeto) cambia de estado, todos sus observadores son notificados automáticamente.

### Ejemplo real

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

// Uso: sistema de notificaciones
const notificaciones = new EventEmitter()

const onMensaje = (texto) => console.log(`📧 Nuevo mensaje: ${texto}`)
const onAlerta = (texto) => console.log(`🚨 Alerta: ${texto}`)

notificaciones.on("mensaje", onMensaje)
notificaciones.on("alerta", onAlerta)

notificaciones.emit("mensaje", "Hola David")
notificaciones.emit("alerta", "Servidor caído")
```

### Comparación con Python

```python
# Python no tiene EventEmitter integrado, pero podemos crear uno
class EventEmitter:
    def __init__(self):
        self.eventos = {}
    
    def on(self, evento, callback):
        if evento not in self.eventos:
            self.eventos[evento] = []
        self.eventos[evento].append(callback)
        return self
    
    def emit(self, evento, *args):
        if evento in self.eventos:
            for callback in self.eventos[evento]:
                callback(*args)
        return self
    
    def off(self, evento, callback):
        if evento in self.eventos:
            if callback in self.eventos[evento]:
                self.eventos[evento].remove(callback)
        return self

# Uso
notificaciones = EventEmitter()

def on_mensaje(texto):
    print(f"📧 Nuevo mensaje: {texto}")

def on_alerta(texto):
    print(f"🚨 Alerta: {texto}")

notificaciones.on("mensaje", on_mensaje)
notificaciones.on("alerta", on_alerta)

notificaciones.emit("mensaje", "Hola David")
notificaciones.emit("alerta", "Servidor caído")
```

**Diferencia clave**: Python no tiene un sistema de eventos integrado como JavaScript. Sin embargo, podemos implementar el patrón Observer de forma similar.

### Aplicaciones reales

- `EventEmitter` en Node.js (módulo `events`).
- `addEventListener` en el DOM.
- Sistemas de pub/sub en arquitecturas de mensajería.

## 2. Mediator

### Idea clave

El patrón Mediator centraliza la comunicación entre componentes: en lugar de que los objetos se comuniquen directamente, lo hacen a través de un mediador.

### Ejemplo real

```javascript
// Mediator para un chat
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

// Uso
const chat = new ChatMediator()

const david = new Usuario("David")
const ana = new Usuario("Ana")

chat.registrar(david)
chat.registrar(ana)

david.enviar("Hola Ana, ¿cómo vas?", "Ana")
// Ana recibió de David: Hola Ana, ¿cómo vas?
```

### Comparación con Python

```python
# Python - Mediator Pattern
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

# Uso
chat = ChatMediator()

david = Usuario("David")
ana = Usuario("Ana")

chat.registrar(david)
chat.registrar(ana)

david.enviar("Hola Ana, ¿cómo vas?", "Ana")
# Ana recibió de David: Hola Ana, ¿cómo vas?
```

**Diferencia clave**: La implementación es muy similar. Python no tiene diferencias significativas en este patrón.

### Cuándo usarlo

- Cuando muchos objetos interactúan y el acoplamiento directo es insostenible.
- Cuando quieres reutilizar componentes sin que conozcan a sus colaboradores.

## 3. Strategy

### Idea clave

El patrón Strategy define una familia de algoritmos intercambiables. Permite cambiar el comportamiento de un objeto en tiempo de ejecución sin alterar su estructura.

### Ejemplo real

```javascript
// Estrategias de validación
const estrategias = {
  email: (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
  telefono: (valor) => /^\+?[\d\s-]{7,15}$/.test(valor),
  obligatorio: (valor) => valor !== null && valor !== undefined && valor !== ""
}

class Validador {
  constructor(estrategia) {
    this.estrategia = estrategias[estrategia]
  }

  setEstrategia(estrategia) {
    this.estrategia = estrategias[estrategia]
  }

  validar(valor) {
    return this.estrategia(valor)
  }
}

const validador = new Validador("email")

validador.validar("david@ejemplo.com")  // true
validador.setEstrategia("telefono")
validador.validar("+57 300 123 4567")   // true
validador.setEstrategia("obligatorio")
validador.validar("")                    // false
```

### Comparación con Python

```python
# Python - Strategy Pattern
import re

# Estrategias de validación
def validar_email(valor):
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', valor))

def validar_telefono(valor):
    return bool(re.match(r'^\+?[\d\s-]{7,15}$', valor))

def validar_obligatorio(valor):
    return valor is not None and valor != ""

estrategias = {
    'email': validar_email,
    'telefono': validar_telefono,
    'obligatorio': validar_obligatorio
}

class Validador:
    def __init__(self, estrategia):
        self.estrategia = estrategias[estrategia]
    
    def set_estrategia(self, estrategia):
        self.estrategia = estrategias[estrategia]
    
    def validar(self, valor):
        return self.estrategia(valor)

# Uso
validador = Validador('email')
print(validador.validar('david@ejemplo.com'))  # True
validador.set_estrategia('telefono')
print(validador.validar('+57 300 123 4567'))   # True
validador.set_estrategia('obligatorio')
print(validador.validar(''))                    # False
```

**Diferencia clave**: Python usa funciones como estrategias, mientras que JavaScript usa funciones anónimas. Ambos son igual de efectivos.

### Ventajas

- Los algoritmos se aíslan y se pueden testear independientemente.
- Cambiar de estrategia no modifica el contexto que la usa.
- Facilita el principio Open/Closed (abierto a extensión, cerrado a modificación).

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Implementar un sistema de notificaciones básico con Observer

**Ejercicio**: Crea un sistema de notificaciones que permita:
1. Suscribirse a eventos (on)
2. Desuscribirse (off)
3. Emitir eventos (emit)

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un Map para almacenar suscriptores por evento
2. Implementa métodos on, off y emit
3. Asegúrate de que los callbacks se ejecuten en orden

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class SistemaNotificaciones {
  constructor() {
    this.suscriptores = new Map();
  }
  
  on(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, []);
    }
    this.suscriptores.get(evento).push(callback);
    return () => this.off(evento, callback); // Función para desuscribirse
  }
  
  off(evento, callback) {
    if (this.suscriptores.has(evento)) {
      const callbacks = this.suscriptores.get(evento);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(evento, ...args) {
    if (this.suscriptores.has(evento)) {
      const callbacks = this.suscriptores.get(evento);
      callbacks.forEach(callback => callback(...args));
    }
  }
}

// Uso
const sistema = new SistemaNotificaciones();

const desuscribir = sistema.on('mensaje', (texto) => {
  console.log(`Mensaje recibido: ${texto}`);
});

sistema.emit('mensaje', 'Hola mundo'); // "Mensaje recibido: Hola mundo"
esuscribir(); // Desuscribirse
sistema.emit('mensaje', 'Esta no se ve'); // No se ejecuta
```

</details>


### Nivel Intermedio

**Objetivo**: Implementar un chat con Mediator

**Ejercicio**: Crea un sistema de chat donde:
1. Los usuarios se registren en el mediador
2. Puedan enviar mensajes privados
3. El mediador gestione la comunicación

**Requisitos**:
1. Los usuarios no conocen directamente a otros usuarios
2. El mediador centraliza toda la comunicación
3. Soporte para mensajes privados y broadcasts

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un Map para almacenar usuarios registrados
2. Implementa métodos para enviar mensajes privados y a todos
3. Asegúrate de que los usuarios solo reciban mensajes dirigidos a ellos

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class ChatMediator {
  constructor() {
    this.usuarios = new Map();
    this.historial = [];
  }
  
  registrar(usuario) {
    this.usuarios.set(usuario.nombre, usuario);
    usuario.mediator = this;
    this.notificarTodos(`${usuario.nombre} se ha unido al chat`);
  }
  
  enviar(mensaje, de, para = null) {
    const mensajeCompleto = {
      de,
      para,
      mensaje,
      timestamp: new Date()
    };
    
    this.historial.push(mensajeCompleto);
    
    if (para) {
      // Mensaje privado
      const destinatario = this.usuarios.get(para);
      if (destinatario) {
        destinatario.recibir(mensaje, de);
      }
    } else {
      // Broadcast
      this.usuarios.forEach((usuario, nombre) => {
        if (nombre !== de) {
          usuario.recibir(mensaje, de);
        }
      });
    }
  }
  
  notificarTodos(mensaje) {
    this.usuarios.forEach(usuario => {
      usuario.recibir(mensaje, 'Sistema');
    });
  }
  
  obtenerHistorial() {
    return [...this.historial];
  }
}

class UsuarioChat {
  constructor(nombre) {
    this.nombre = nombre;
    this.mediator = null;
  }
  
  enviar(mensaje, para = null) {
    if (this.mediator) {
      this.mediator.enviar(mensaje, this.nombre, para);
    }
  }
  
  recibir(mensaje, de) {
    console.log(`[${this.nombre}] De ${de}: ${mensaje}`);
  }
}

// Uso
const chat = new ChatMediator();
const david = new UsuarioChat('David');
const ana = new UsuarioChat('Ana');
const luis = new UsuarioChat('Luis');

chat.registrar(david);
chat.registrar(ana);
chat.registrar(luis);

david.enviar('Hola a todos'); // Broadcast
ana.enviar('Hola David', 'David'); // Privado
```

</details>


### Nivel Avanzado

**Objetivo**: Implementar un sistema de estrategias intercambiables

**Ejercicio**: Crea un sistema de compresión que soporte diferentes algoritmos (gzip, brotli, deflate) y permita cambiarlos en tiempo de ejecución.

**Especificaciones**:
1. Cada estrategia debe implementar la misma interfaz
2. El sistema debe poder cambiar de estrategia dinámicamente
3. Soporte para estadísticas de compresión

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Define una interfaz común para todas las estrategias
2. Usa el patrón Strategy para intercambiar algoritmos
3. Implementa estadísticas de rendimiento

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
// Estrategias de compresión
class CompresionGzip {
  comprimir(datos) {
    // Simular compresión gzip
    return {
      datos: `gzip:${datos}`,
      algoritmo: 'gzip',
      ratio: 0.3,
      tiempo: 15
    };
  }
}

class CompresionBrotli {
  comprimir(datos) {
    // Simular compresión brotli
    return {
      datos: `brotli:${datos}`,
      algoritmo: 'brotli',
      ratio: 0.25,
      tiempo: 25
    };
  }
}

class CompresionDeflate {
  comprimir(datos) {
    // Simular compresión deflate
    return {
      datos: `deflate:${datos}`,
      algoritmo: 'deflate',
      ratio: 0.35,
      tiempo: 10
    };
  }
}

// Sistema de compresión
class SistemaCompresion {
  constructor(estrategiaInicial = 'gzip') {
    this.estrategias = {
      gzip: new CompresionGzip(),
      brotli: new CompresionBrotli(),
      deflate: new CompresionDeflate()
    };
    
    this.estrategiaActual = this.estrategias[estrategiaInicial];
    this.estadisticas = {
      totalComprimido: 0,
      tiempoTotal: 0,
      operaciones: 0
    };
  }
  
  setEstrategia(nombre) {
    if (this.estrategias[nombre]) {
      this.estrategiaActual = this.estrategias[nombre];
    } else {
      throw new Error(`Estrategia '${nombre}' no disponible`);
    }
  }
  
  comprimir(datos) {
    const inicio = Date.now();
    const resultado = this.estrategiaActual.comprimir(datos);
    const tiempo = Date.now() - inicio;
    
    // Actualizar estadísticas
    this.estadisticas.totalComprimido += datos.length;
    this.estadisticas.tiempoTotal += tiempo;
    this.estadisticas.operaciones++;
    
    return {
      ...resultado,
      tiempoReal: tiempo
    };
  }
  
  obtenerEstadisticas() {
    const { totalComprimido, tiempoTotal, operaciones } = this.estadisticas;
    return {
      totalComprimido,
      tiempoPromedio: operaciones > 0 ? tiempoTotal / operaciones : 0,
      operaciones,
      ratioPromedio: totalComprimido > 0 ? 
        this.estadisticas.totalComprimido / totalComprimido : 0
    };
  }
}

// Uso
const sistema = new SistemaCompresion('gzip');
const datos = 'Datos de prueba para compresión'.repeat(100);

console.log(sistema.comprimir(datos));
console.log(sistema.obtenerEstadisticas());

sistema.setEstrategia('brotli');
console.log(sistema.comprimir(datos));
console.log(sistema.obtenerEstadisticas());
```

</details>


---

## Pensamiento Crítico

### Problema 1: Memory leaks en Observer

**Situación**: Tienes un sistema de notificaciones donde los componentes se suscriben pero nunca se desuscriben, causando memory leaks.

**Preguntas guía**:
1. ¿Por qué ocurren los memory leaks en el patrón Observer?
2. ¿Cómo implementas la desuscripción automática?
3. ¿Qué estrategias usa Python para esto?

**Análisis**:
- **Causa**: Los objetos mantienen referencias a sus suscriptores, impidiendo que el garbage collector los elimine
- **Solución JS**: Usar WeakMap, implementar desuscripción automática, usar AbortController para cancelar suscripciones
- **Python**: Usa weakref para referencias débiles, context managers para limpieza

```javascript
// ❌ Problemático: memory leak
class MalObserver {
  constructor() {
    this.suscriptores = [];
  }
  
  suscribir(callback) {
    this.suscriptores.push(callback);
    // Nunca se desuscribe
  }
}

// ✅ Solución: desuscripción automática
class BuenObserver {
  constructor() {
    this.suscriptores = new Map();
  }
  
  suscribir(evento, callback) {
    if (!this.suscriptores.has(evento)) {
      this.suscriptores.set(evento, new Set());
    }
    this.suscriptores.get(evento).add(callback);
    
    // Devolver función de desuscripción
    return () => {
      this.suscriptores.get(evento)?.delete(callback);
    };
  }
  
  emitir(evento, ...args) {
    this.suscriptores.get(evento)?.forEach(callback => {
      callback(...args);
    });
  }
}
```

### Problema 2: Acoplamiento en Mediator

**Situación**: Tu mediador se ha convertido en un "God Object" con demasiada lógica, making it hard to test and maintain.

**Preguntas guía**:
1. ¿Cuándo un mediador tiene demasiada responsabilidad?
2. ¿Cómo divides un mediador complejo?
3. ¿Qué alternativas existen al mediador?

**Análisis**:
- **Señales**: El mediador tiene más de 10 métodos, conoce demasiados detalles de implementación
- **Solución**: Dividir en múltiples mediadores especializados, usar eventos en su lugar
- **Alternativas**: Event bus, pub/sub, arquitectura basada en eventos

```javascript
// ❌ Mediador demasiado grande
class GodMediator {
  // 20+ métodos que conocen demasiados detalles
}

// ✅ Mediadores especializados
class ChatMediator {
  // Solo maneja mensajería
}

class UsuarioMediator {
  // Solo maneja gestión de usuarios
}

class NotificacionMediator {
  // Solo maneja notificaciones
}
```

---

## Conexión con Python

### Patrones comportamentales en Python

**Observer en Python (usando weakref)**:
```python
import weakref

class EventManager:
    def __init__(self):
        self._listeners = {}
    
    def on(self, event, callback):
        if event not in self._listeners:
            self._listeners[event] = []
        # Usar weakref para evitar memory leaks
        ref = weakref.WeakMethod(callback, self._remove_listener)
        self._listeners[event].append(ref)
    
    def _remove_listener(self, ref):
        # Limpiar referencias muertas
        for event in list(self._listeners.keys()):
            self._listeners[event] = [
                r for r in self._listeners[event] if r is not ref
            ]
    
    def emit(self, event, *args, **kwargs):
        for ref in self._listeners.get(event, []):
            callback = ref()
            if callback:
                callback(*args, **kwargs)
```

**Strategy en Python (usando callables)**:
```python
# Python usa callables (funciones, clases con __call__)
class CompressionStrategy:
    def compress(self, data):
        raise NotImplementedError

class GzipCompression(CompressionStrategy):
    def compress(self, data):
        return f"gzip:{data}"

class BrotliCompression(CompressionStrategy):
    def compress(self, data):
        return f"brotli:{data}"

# O simplemente usar funciones
def gzip_compress(data):
    return f"gzip:{data}"

def brotli_compress(data):
    return f"brotli:{data}"

# El patrón Strategy en Python es más flexible
# porque los callables son de primera clase
```

### Cuándo usar cada lenguaje

**JavaScript es mejor para**:
- Sistemas de eventos en tiempo real (DOM, Node.js)
- Frontend reactivo
- Arquitecturas basadas en eventos

**Python es mejor para**:
- Sistemas de colas de mensajes
- Procesamiento de datos con patrones de flujo
- Machine learning con pipelines intercambiables

---

## Resumen

1. **Observer** notifica a múltiples suscriptores ante cambios de estado
2. **Mediator** centraliza la comunicación entre componentes desacoplados
3. **Strategy** intercambia algoritmos en tiempo de ejecución sin modificar el contexto
4. **Los patrones comportamentales** son esenciales para código mantenible y extensible
5. **Python implementa estos patrones de forma similar** pero con sintaxis diferente
6. **Cuidado con los memory leaks** en Observer y el acoplamiento excesivo en Mediator

---

## Siguiente Capítulo

→ **[Capítulo 9: Arquitecturas de estado](./cap-09)**: MVC y sus derivados en Node.js.
