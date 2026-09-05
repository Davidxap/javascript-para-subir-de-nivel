---
title: "Chapter 8: Behavioral Patterns and Events (Observer, Mediator, Strategy)"
---

# Chapter 8: Behavioral Patterns and Events (Observer, Mediator, Strategy)

> Behavioral patterns define how components communicate and delegate responsibilities.

## Introduction

Behavioral patterns are essential for decoupled and scalable systems. They define how objects communicate, how responsibilities are delegated, and how dependencies between components are managed.

**Why does it matter?** Because these patterns allow you to create maintainable, extensible, and easy-to-test code. They are the foundation of many modern architectures, including reactive and event-driven systems.

## 1. Observer

### Key Idea

The Observer pattern defines a one-to-many relationship: when an object (subject) changes state, all its observers are notified automatically.

### Real-world example

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

### Comparison with Python

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

**Key difference**: Python does not have a built-in event system like JavaScript. However, we can implement the Observer pattern in a similar way.

### Real-world applications

- `EventEmitter` in Node.js (`events` module).
- `addEventListener` in the DOM.
- Pub/sub systems in messaging architectures.

## 2. Mediator

### Key Idea

The Mediator pattern centralizes communication between components: instead of objects communicating directly with each other, they do so through a mediator.

### Real-world example

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

### Comparison with Python

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
        self.mediator.enviar(self.nombre, para)
    
    def recibir(self, mensaje, de):
        print(f"{self.nombre} recibió de {de}: ${mensaje}")

# Uso
chat = ChatMediator()

david = Usuario("David")
ana = Usuario("Ana")

chat.registrar(david)
chat.registrar(ana)

david.enviar("Hola Ana, ¿cómo vas?", "Ana")
# Ana recibió de David: Hola Ana, ¿cómo vas?
```

**Key difference**: The implementation is very similar. Python does not have significant differences in this pattern.

### When to use it

- When many objects interact and direct coupling is unsustainable.
- When you want to reuse components without them knowing their collaborators.

## 3. Strategy

### Key Idea

The Strategy pattern defines a family of interchangeable algorithms. It allows changing an object's behavior at runtime without altering its structure.

### Real-world example

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

### Comparison with Python

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

**Key difference**: Python uses functions as strategies, while JavaScript uses anonymous functions. Both are equally effective.

### Advantages

- Algorithms are isolated and can be tested independently.
- Changing strategies does not modify the context that uses them.
- It facilitates the Open/Closed principle (open for extension, closed for modification).

---

## Practical Exercises

### Basic Level

**Objective**: Implement a basic notification system with Observer

**Exercise**: Create a notification system that allows:
1. Subscribing to events (on)
2. Unsubscribing (off)
3. Emitting events (emit)

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use a Map to store subscribers per event
2. Implement on, off, and emit methods
3. Ensure that callbacks are executed in order

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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


### Intermediate Level

**Objective**: Implement a chat with Mediator

**Exercise**: Create a chat system where:
1. Users register with the mediator
2. They can send private messages
3. The mediator manages the communication

**Requirements**:
1. Users do not directly know other users
2. The mediator centralizes all communication
3. Support for private messages and broadcasts

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use a Map to store registered users
2. Implement methods to send private and broadcast messages
3. Ensure that users only receive messages addressed to them

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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


### Advanced Level

**Objective**: Implement an interchangeable strategy system

**Exercise**: Create a compression system that supports different algorithms (gzip, brotli, deflate) and allows changing them at runtime.

**Specifications**:
1. Each strategy must implement the same interface
2. The system must be able to change strategies dynamically
3. Support for compression statistics

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Define a common interface for all strategies
2. Use the Strategy pattern to swap algorithms
3. Implement performance statistics

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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

## Critical Thinking

### Problem 1: Memory leaks in Observer

**Situation**: You have a notification system where components subscribe but never unsubscribe, causing memory leaks.

**Guiding questions**:
1. Why do memory leaks occur in the Observer pattern?
2. How do you implement automatic unsubscription?
3. What strategies does Python use for this?

**Analysis**:
- **Cause**: Objects maintain references to their subscribers, preventing the garbage collector from removing them
- **JS Solution**: Use WeakMap, implement automatic unsubscription, use AbortController to cancel subscriptions
- **Python**: Use weakref for weak references, context managers for cleanup

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

### Problem 2: Coupling in Mediator

**Situation**: Your mediator has become a "God Object" with too much logic, making it hard to test and maintain.

**Guiding questions**:
1. When does a mediator have too much responsibility?
2. How do you split a complex mediator?
3. What alternatives exist to the mediator?

**Analysis**:
- **Signs**: The mediator has more than 10 methods, knows too many implementation details
- **Solution**: Split into multiple specialized mediators, use events instead
- **Alternatives**: Event bus, pub/sub, event-driven architecture

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

## Connection with Python

### Behavioral Patterns in Python

**Observer in Python (using weakref)**:
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

**Strategy in Python (using callables)**:
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

### When to use each language

**JavaScript is better for**:
- Real-time event systems (DOM, Node.js)
- Reactive frontend
- Event-driven architectures

**Python is better for**:
- Message queue systems
- Data processing with flow patterns
- Machine learning with interchangeable pipelines

---

## Summary

1. **Observer** notifies multiple subscribers of state changes
2. **Mediator** centralizes communication between decoupled components
3. **Strategy** swaps algorithms at runtime without modifying the context
4. **Behavioral patterns** are essential for maintainable and extensible code
5. **Python implements these patterns similarly** but with different syntax
6. **Watch out for memory leaks** in Observer and excessive coupling in Mediator

---

## Next Chapter

→ **Cap-9-Arquitecturas-Estado**: In the next chapter, we will look at state architectures like MVC and their derivatives in Node.js.