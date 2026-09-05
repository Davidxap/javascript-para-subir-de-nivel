---
title: "Chapter 11: Asynchronous Resource Management (using, Explicit Resource Management)"
---

# Chapter 11: Asynchronous Resource Management (using, Explicit Resource Management)

> The TC39 **Explicit Resource Management** proposal introduces the `using` keyword to guarantee resource cleanup when exiting the scope.

## Introduction

In classic JavaScript, resources (network connections, file handles, timers) must be closed manually using `try/finally`. Forgetting to close them causes resource leaks. `using` solves this problem elegantly and safely.

**Why does it matter?** Because resource leaks are a real problem in large applications. `using` eliminates the need to remember to close connections, files, and other resources.

## 1. The Problem: Resource Leaks

### Key Idea

In classic JavaScript, resources (network connections, file handles, timers) must be closed manually using `try/finally`. Forgetting to close them causes leaks.

### Problem Example

```javascript
// Without using: the developer must remember to close everything
async function leerArchivo(path) {
  const archivo = await abrirArchivo(path)
  try {
    return await archivo.leer()
  } finally {
    await archivo.cerrar() // If you forget this, there is a leak
  }
}
```

## 2. The Solution: `using` (Explicit Resource Management)

### Key Idea

`using` declares a resource that is automatically disposed of when exiting the block, similar to `using` in C# or `with` in Python.

### Requirement: The object must implement `Symbol.dispose` or `Symbol.asyncDispose`

### Real-World Example

```javascript
// Define a disposable resource
class ConexionBD {
  constructor(host) {
    this.host = host
    console.log(`Connecting to ${host}...`)
  }

  [Symbol.asyncDispose]() {
    console.log(`Closing connection to ${this.host}...`)
    return Promise.resolve()
  }

  async consultar(sql) {
    return `Result of: ${sql}`
  }
}

// Usage with using: automatic cleanup
async function obtenerDatos() {
  await using conn = new ConexionBD("localhost:5432")
  const resultado = await conn.consultar("SELECT * FROM usuarios")
  return resultado
  // When exiting the function, [Symbol.asyncDispose] is called automatically
}

// Synchronous usage with Symbol.dispose
class TempFile {
  constructor(nombre) {
    this.nombre = nombre
    console.log(`Creating temporary file: ${nombre}`)
  }

  [Symbol.dispose]() {
    console.log(`Deleting temporary file: ${this.nombre}`)
  }
}

function procesar() {
  using temp = new TempFile("cache.tmp")
  // ... processing ...
  // When exiting the block, it is automatically deleted
}
```

### Comparison with Python

```python
# Python - Context Manager (equivalent to using)
class ConexionBD:
    def __init__(self, host):
        self.host = host
        print(f"Connecting to {host}...")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Closing connection to {self.host}...")
        return False
    
    def consultar(self, sql):
        return f"Result of: {sql}"

# Usage with with (equivalent to using)
def obtener_datos():
    with ConexionBD("localhost:5432") as conn:
        resultado = conn.consultar("SELECT * FROM usuarios")
        return resultado
    # When exiting the with block, __exit__ is called automatically

# Asynchronous Context Manager
class ConexionBDAsync:
    async def __aenter__(self):
        await self.conectar()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

# Usage
async def obtener_datos_async():
    async with ConexionBDAsync() as conn:
        return await conn.consultar("SELECT * FROM usuarios")
```

**Key Differences**:
- **JavaScript**: `using` with `Symbol.dispose`/`Symbol.asyncDispose`
- **Python**: `with` with `__enter__`/`__exit__` (synchronous) or `__aenter__`/`__aexit__` (asynchronous)
- **Both**: Guarantee resource cleanup even if exceptions occur

### Advantages

- Guaranteed resource cleanup even if exceptions occur.
- Cleaner code without repetitive `try/finally`.
- The resource cannot be used after being disposed of.

### Proposal Status

- `using` and `Symbol.dispose`/`Symbol.asyncDispose` are part of TC39's **Explicit Resource Management** proposal (Stage 3/4 in ES2025-ES2026).
- Available in Node.js 20+ using the `--harmony-explicit-resource-management` flag.

## Common Errors

- Forgetting to implement `Symbol.dispose` or `Symbol.asyncDispose`.
- Using `using` without implicit try/finally (the resource is released upon leaving the scope).
- Reusing a resource after it has been disposed of.

---

## Practical Exercises

### Basic Level

**Goal**: Implement a resource with Symbol.dispose

**Exercise**: Create a `TempFile` class that:
1. Creates a temporary file when instantiated
2. Implements `Symbol.dispose` to delete it
3. Prints messages when creating and deleting

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use `Symbol.dispose` for cleanup
2. Store the file name in `this`
3. Print messages using `console.log`

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
class TempFile {
  constructor(nombre) {
    this.nombre = nombre;
    this.contenido = '';
    console.log(`Creating temporary file: ${nombre}`);
  }
  
  escribir(texto) {
    this.contenido = texto;
    console.log(`Writing to ${this.nombre}: ${texto}`);
  }
  
  leer() {
    console.log(`Reading from ${this.nombre}`);
    return this.contenido;
  }
  
  [Symbol.dispose]() {
    console.log(`Deleting temporary file: ${this.nombre}`);
    this.contenido = null;
  }
}

// Usage
function procesar() {
  using temp = new TempFile('cache.tmp');
  temp.escribir('important data');
  const datos = temp.leer();
  return datos;
  // Upon exit, [Symbol.dispose] is called automatically
}

procesar();
// Output:
// Creating temporary file: cache.tmp
// Writing to cache.tmp: important data
// Reading from cache.tmp
// Deleting temporary file: cache.tmp
```

</details>


### Intermediate Level

**Goal**: Implement an asynchronous resource with error handling

**Exercise**: Create a `ConexionBD` class that:
1. Implements `Symbol.asyncDispose` to close the connection
2. Handles errors during connection
3. Supports multiple queries

**Requirements**:
1. Simulates a connection with a delay
2. Implements automatic reconnection
3. Logs operations in a log

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use `async`/`await` with `Symbol.asyncDispose`
2. Implement a retry system
3. Maintain an operations history

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
class ConexionBD {
  constructor(host) {
    this.host = host;
    this.conectada = false;
    this.log = [];
    this.reintentos = 0;
    this.maxReintentos = 3;
  }
  
  async conectar() {
    this.registrar('Connecting...');
    await new Promise(resolve => setTimeout(resolve, 100));
    this.conectada = true;
    this.registrar('Connection established');
    return this;
  }
  
  async reconectar() {
    if (this.reintentos >= this.maxReintentos) {
      throw new Error('Maximum retries reached');
    }
    
    this.reintentos++;
    this.registrar(`Retry ${this.reintentos}/${this.maxReintentos}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    this.conectada = true;
    return this;
  }
  
  async consultar(sql) {
    if (!this.conectada) {
      await this.reconectar();
    }
    
    this.registrar(`Executing: ${sql}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (Math.random() < 0.1) {
      this.conectada = false;
      throw new Error('Connection lost');
    }
    
    const resultado = { rows: [], affectedRows: 0 };
    this.registrar(`Query successful`);
    return resultado;
  }
  
  async [Symbol.asyncDispose]() {
    this.registrar('Closing connection...');
    await new Promise(resolve => setTimeout(resolve, 50));
    this.conectada = false;
    this.registrar('Connection closed');
  }
  
  registrar(mensaje) {
    const entrada = {
      timestamp: new Date().toISOString(),
      host: this.host,
      mensaje
    };
    this.log.push(entrada);
    console.log(`[${this.host}] ${mensaje}`);
  }
  
  obtenerLog() {
    return [...this.log];
  }
}

// Usage
async function ejecutarConsultas() {
  await using conn = new ConexionBD('localhost:5432');
  await conn.conectar();
  
  try {
    await conn.consultar('SELECT * FROM usuarios');
    await conn.consultar('INSERT INTO logs ...');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  return conn.obtenerLog();
}

ejecutarConsultas();
```

</details>


### Advanced Level

**Goal**: Implement a connection pool with garbage collection

**Exercise**: Create a connection pool system that:
1. Manages multiple connections
2. Implements automatic garbage collection
3. Supports multiple clients
4. Handles timeouts for inactive connections

**Specifications**:
1. Pool with configurable size
2. Inactivity timeout (30 seconds)
3. Usage statistics
4. Automatic cleanup of old connections

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use `using` for each connection in the pool
2. Implement a timer for inactive connections
3. Use `WeakRef` to allow garbage collection

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
class PoolConexiones {
  constructor(config = {}) {
    this.tamanioMax = config.tamanioMax || 10;
    this.timeoutInactividad = config.timeoutInactividad || 30000;
    this.conexiones = new Map();
    this.estadisticas = {
      creadas: 0,
      reutilizadas: 0,
      cerradas: 0,
      errores: 0
    };
    
    // Clean up inactive connections every 10 seconds
    this.intervalLimpieza = setInterval(() => {
      this.limpiarInactivas();
    }, 10000);
  }
  
  async obtenerConexion(nombre) {
    // Find existing connection
    for (const [id, conexion] of this.conexiones) {
      if (conexion.nombre === nombre && conexion.activa) {
        conexion.ultimaActividad = Date.now();
        this.estadisticas.reutilizadas++;
        return new ReferenciaConexion(this, id, conexion);
      }
    }
    
    // Create new connection if space is available
    if (this.conexiones.size < this.tamanioMax) {
      const id = Symbol();
      const conexion = new ConexionBD(nombre);
      await conexion.conectar();
      
      this.conexiones.set(id, {
        ...conexion,
        id,
        nombre,
        activa: true,
        creacion: Date.now(),
        ultimaActividad: Date.now()
      });
      
      this.estadisticas.creadas++;
      return new ReferenciaConexion(this, id, this.conexiones.get(id));
    }
    
    throw new Error('Connection pool is full');
  }
  
  liberarConexion(id) {
    const conexion = this.conexiones.get(id);
    if (conexion) {
      conexion.activa = false;
      conexion.liberada = Date.now();
    }
  }
  
  limpiarInactivas() {
    const ahora = Date.now();
    
    for (const [id, conexion] of this.conexiones) {
      if (!conexion.activa && 
          ahora - conexion.liberada > this.timeoutInactividad) {
        conexion.cerrar();
        this.conexiones.delete(id);
        this.estadisticas.cerradas++;
      }
    }
  }
  
  obtenerEstadisticas() {
    return {
      ...this.estadisticas,
      activas: [...this.conexiones.values()].filter(c => c.activa).length,
      totales: this.conexiones.size
    };
  }
  
  cerrar() {
    clearInterval(this.intervalLimpieza);
    for (const [id, conexion] of this.conexiones) {
      conexion.cerrar();
    }
    this.conexiones.clear();
  }
}

class ReferenciaConexion {
  constructor(pool, id, conexion) {
    this.pool = pool;
    this.id = id;
    this.conexion = conexion;
    this.usada = false;
  }
  
  async consultar(sql) {
    if (this.usada) {
      throw new Error('Connection already used');
    }
    
    try {
      const resultado = await this.conexion.consultar(sql);
      this.usada = true;
      return resultado;
    } catch (error) {
      this.pool.estadisticas.errores++;
      throw error;
    }
  }
  
  [Symbol.asyncDispose]() {
    this.pool.liberarConexion(this.id);
    return Promise.resolve();
  }
}

// Usage
async function ejecutarEnPool() {
  const pool = new PoolConexiones({ tamanioMax: 5 });
  
  try {
    await using conn1 = await pool.obtenerConexion('db1');
    await using conn2 = await pool.obtenerConexion('db2');
    
    await conn1.consultar('SELECT * FROM usuarios');
    await conn2.consultar('SELECT * FROM productos');
    
    console.log(pool.obtenerEstadisticas());
  } finally {
    pool.cerrar();
  }
}

ejecutarEnPool();
```

</details>


---

## Critical Thinking

### Problem 1: Resource Management in Large Applications

**Scenario**: Your application has multiple resource types (DB, files, external APIs) and it is difficult to track which ones are open.

**Guiding questions**:
1. How do you centralize resource management in a large application?
2. What patterns help track resources?
3. How do you handle resource cleanup in case of errors?

**Analysis**:
- **Problem**: Multiple resources, multiple scopes, hard to track
- **Solution**: Connection pool, management middleware, `using` for local scope
- **Patterns**: Factory, Pool, Composite

### Problem 2: Cascading Asynchronous Cleanup

**Scenario**: Your resources have dependencies among each other and must be disposed of in reverse order.

**Guiding questions**:
1. How do you guarantee the cleanup order?
2. What happens if releasing a resource fails?
3. How do you handle partially released resources?

**Analysis**:
- **Problem**: Circular dependencies, partial cleanup
- **Solution**: Dependency graph, cleanup with timeout
- **Patterns**: Chain of Responsibility, Memento

---

## Connection to Python

### Context Managers in Python

```python
# Custom Context Manager
class ConexionBD:
    def __init__(self, host):
        self.host = host
        self.conectada = False
    
    def __enter__(self):
        print(f"Connecting to {self.host}...")
        self.conectada = True
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Closing connection to {self.host}...")
        self.conectada = False
        return False  # Do not suppress exceptions
    
    def consultar(self, sql):
        if not self.conectada:
            raise RuntimeError("No connection")
        return f"Result of: {sql}"

# Usage
with ConexionBD("localhost") as conn:
    resultado = conn.consultar("SELECT * FROM usuarios")
    print(resultado)
# When exiting the with block, __exit__ is executed

# Asynchronous Context Manager
class ConexionAsync:
    async def __aenter__(self):
        await self.conectar()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

# Usage
async def usar_conexion():
    async with ConexionAsync() as conn:
        return await conn.consultar("SELECT 1")
```

### JavaScript vs. Python Comparison

| Aspect | JavaScript | Python |
|--------|------------|--------|
| **Syntax** | `using recurso = ...` | `with recurso as r:` |
| **Interface** | `Symbol.dispose` | `__enter__`/`__exit__` |
| **Asynchronous** | `await using` | `async with` |
| **Scope** | Current block | `with` block |
| **GC** | Automatic | Automatic |

---

## Summary

1. **`using`** guarantees resource cleanup upon exiting the scope
2. **The object** must implement `Symbol.dispose` (synchronous) or `Symbol.asyncDispose` (asynchronous)
3. **Eliminates** the need for repetitive `try/finally` and prevents leaks
4. **Python** offers `with`/`async with` as an equivalent alternative
5. **Pool and Factory patterns** help manage multiple resources

---

## Next Chapter

→ **[Chapter 12: Modern APIs and TC39 proposals](./cap-12)**: What's coming in ES2025-ES2026.