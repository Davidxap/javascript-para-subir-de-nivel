---
title: "Capítulo 11: Gestión asíncrona de recursos (using, Explicit Resource Management)"
---

# Capítulo 11: Gestión asíncrona de recursos (using, Explicit Resource Management)

> La propuesta **Explicit Resource Management** de TC39 introduce la palabra clave `using` para garantizar la liberación de recursos al salir del scope.

## Introducción

En JavaScript clásico, los recursos (conexiones de red, file handles, timers) deben cerrarse manualmente con `try/finally`. Olvidar el cierre provoca fugas. `using` resuelve este problema de forma elegante y segura.

**¿Por qué importa?** Porque las fugas de recursos son un problema real en aplicaciones grandes. `using` elimina la necesidad de recordar cerrar conexiones, archivos y otros recursos.

## 1. El problema: fugas de recursos

### Idea clave

En JavaScript clásico, los recursos (conexiones de red, file handles, timers) deben cerrarse manualmente con `try/finally`. Olvidar el cierre provoca fugas.

### Ejemplo del problema

```javascript
// Sin using: el desarrollador debe recordar cerrar todo
async function leerArchivo(path) {
  const archivo = await abrirArchivo(path)
  try {
    return await archivo.leer()
  } finally {
    await archivo.cerrar() // Si olvidas esto, hay una fuga
  }
}
```

## 2. La solución: `using` (Explicit Resource Management)

### Idea clave

`using` declara un recurso que se libera automáticamente al salir del bloque, similar a `using` en C# o `with` en Python.

### Requisito: el objeto debe implementar `Symbol.dispose` o `Symbol.asyncDispose`

### Ejemplo real

```javascript
// Definir un recurso desechable
class ConexionBD {
  constructor(host) {
    this.host = host
    console.log(`Conectando a ${host}...`)
  }

  [Symbol.asyncDispose]() {
    console.log(`Cerrando conexión a ${this.host}...`)
    return Promise.resolve()
  }

  async consultar(sql) {
    return `Resultado de: ${sql}`
  }
}

// Uso con using: liberación automática
async function obtenerDatos() {
  await using conn = new ConexionBD("localhost:5432")
  const resultado = await conn.consultar("SELECT * FROM usuarios")
  return resultado
  // Al salir de la función, se llama a [Symbol.asyncDispose] automáticamente
}

// Uso síncrono con Symbol.dispose
class TempFile {
  constructor(nombre) {
    this.nombre = nombre
    console.log(`Creando archivo temporal: ${nombre}`)
  }

  [Symbol.dispose]() {
    console.log(`Eliminando archivo temporal: ${this.nombre}`)
  }
}

function procesar() {
  using temp = new TempFile("cache.tmp")
  // ... procesamiento ...
  // Al salir del bloque, se elimina automáticamente
}
```

### Comparación con Python

```python
# Python - Context Manager (equivalente a using)
class ConexionBD:
    def __init__(self, host):
        self.host = host
        print(f"Conectando a {host}...")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Cerrando conexión a {self.host}...")
        return False
    
    def consultar(self, sql):
        return f"Resultado de: {sql}"

# Uso con with (equivalente a using)
def obtener_datos():
    with ConexionBD("localhost:5432") as conn:
        resultado = conn.consultar("SELECT * FROM usuarios")
        return resultado
    # Al salir del bloque with, se llama a __exit__ automáticamente

# Context Manager asíncrono
class ConexionBDAsync:
    async def __aenter__(self):
        await self.conectar()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

# Uso
async def obtener_datos_async():
    async with ConexionBDAsync() as conn:
        return await conn.consultar("SELECT * FROM usuarios")
```

**Diferencias clave**:
- **JavaScript**: `using` con `Symbol.dispose`/`Symbol.asyncDispose`
- **Python**: `with` con `__enter__`/`__exit__` (síncrono) o `__aenter__`/`__aexit__` (asíncrono)
- **Ambos**: Garantizan liberación de recursos incluso si hay excepciones

### Ventajas

- Liberación garantizada incluso si hay excepciones.
- Código más limpio sin `try/finally` repetitivo.
- El recurso no puede usarse después de ser liberado.

### Estado de la propuesta

- `using` y `Symbol.dispose`/`Symbol.asyncDispose` son parte de la propuesta **Explicit Resource Management** de TC39 (stage 3/4 en ES2025-ES2026).
- Disponible en Node.js 20+ con flag `--harmony-explicit-resource-management`.

## Errores Comunes

- Olvidar implementar `Symbol.dispose` o `Symbol.asyncDispose`.
- Usar `using` sin try/finally implícito (el recurso se libera al salir del scope).
- Reutilizar un recurso después de ser liberado.

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Implementar un recurso con Symbol.dispose

**Ejercicio**: Crea una clase `TempFile` que:
1. Cree un archivo temporal al instanciarse
2. Implemente `Symbol.dispose` para eliminarlo
3. Imprima mensajes al crear y eliminar

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa `Symbol.dispose` para la limpieza
2. Guarda el nombre del archivo en `this`
3. Imprime mensajes con `console.log`

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class TempFile {
  constructor(nombre) {
    this.nombre = nombre;
    this.contenido = '';
    console.log(`Creando archivo temporal: ${nombre}`);
  }
  
  escribir(texto) {
    this.contenido = texto;
    console.log(`Escribiendo en ${this.nombre}: ${texto}`);
  }
  
  leer() {
    console.log(`Leyendo de ${this.nombre}`);
    return this.contenido;
  }
  
  [Symbol.dispose]() {
    console.log(`Eliminando archivo temporal: ${this.nombre}`);
    this.contenido = null;
  }
}

// Uso
function procesar() {
  using temp = new TempFile('cache.tmp');
  temp.escribir('datos importantes');
  const datos = temp.leer();
  return datos;
  // Al salir, se llama a [Symbol.dispose] automáticamente
}

procesar();
// Salida:
// Creando archivo temporal: cache.tmp
// Escribiendo en cache.tmp: datos importantes
// Leyendo de cache.tmp
// Eliminando archivo temporal: cache.tmp
```

</details>


### Nivel Intermedio

**Objetivo**: Implementar recurso asíncrono con manejo de errores

**Ejercicio**: Crea una clase ` ConexionBD` que:
1. Implemente `Symbol.asyncDispose` para cerrar la conexión
2. Maneje errores durante la conexión
3. Soporte múltiples consultas

**Requisitos**:
1. Simule una conexión con delay
2. Implemente reconexión automática
3. Registre operaciones en un log

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa `async`/`await` con `Symbol.asyncDispose`
2. Implementa un sistema de reintentos
3. Mantén un historial de operaciones

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

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
    this.registrar('Conectando...');
    await new Promise(resolve => setTimeout(resolve, 100));
    this.conectada = true;
    this.registrar('Conexión establecida');
    return this;
  }
  
  async reconectar() {
    if (this.reintentos >= this.maxReintentos) {
      throw new Error('Máximo de reintentos alcanzado');
    }
    
    this.reintentos++;
    this.registrar(`Reintento ${this.reintentos}/${this.maxReintentos}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    this.conectada = true;
    return this;
  }
  
  async consultar(sql) {
    if (!this.conectada) {
      await this.reconectar();
    }
    
    this.registrar(`Ejecutando: ${sql}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (Math.random() < 0.1) {
      this.conectada = false;
      throw new Error('Conexión perdida');
    }
    
    const resultado = { rows: [], affectedRows: 0 };
    this.registrar(`Consulta exitosa`);
    return resultado;
  }
  
  async [Symbol.asyncDispose]() {
    this.registrar('Cerrando conexión...');
    await new Promise(resolve => setTimeout(resolve, 50));
    this.conectada = false;
    this.registrar('Conexión cerrada');
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

// Uso
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


### Nivel Avanzado

**Objetivo**: Implementar pool de conexiones con garbage collection

**Ejercicio**: Crea un sistema de pool de conexiones que:
1. Administre múltiples conexiones
2. Implemente garbage collection automático
3. Soporte múltiples clientes
4. Maneje timeout de conexiones inactivas

**Especificaciones**:
1. Pool con tamaño configurable
2. Timeout de inactividad (30 segundos)
3. Estadísticas de uso
4. Limpieza automática de conexiones viejas

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa `using` para cada conexión del pool
2. Implementa un temporizador para conexiones inactivas
3. Usa WeakRef para permitir garbage collection

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

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
    
    // Limpiar conexiones inactivas cada 10 segundos
    this.intervalLimpieza = setInterval(() => {
      this.limpiarInactivas();
    }, 10000);
  }
  
  async obtenerConexion(nombre) {
    // Buscar conexión existente
    for (const [id, conexion] of this.conexiones) {
      if (conexion.nombre === nombre && conexion.activa) {
        conexion.ultimaActividad = Date.now();
        this.estadisticas.reutilizadas++;
        return new ReferenciaConexion(this, id, conexion);
      }
    }
    
    // Crear nueva conexión si hay espacio
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
    
    throw new Error('Pool de conexiones lleno');
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
      throw new Error('Conexión ya utilizada');
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

// Uso
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

## Pensamiento Crítico

### Problema 1: Gestión de recursos en aplicaciones grandes

**Situación**: Tu aplicación tiene múltiples tipos de recursos (DB, archivos, APIs externas) y es difícil rastrear cuáles están abiertos.

**Preguntas guía**:
1. ¿Cómo centralizas la gestión de recursos en una aplicación grande?
2. ¿Qué patrones ayudan a rastrear recursos?
3. ¿Cómo manejas la liberación en caso de errores?

**Análisis**:
- **Problema**: Múltiples recursos, múltiples scopes, difícil de rastrear
- **Solución**: Pool de conexiones, middleware de gestión, `using` para scope local
- **Patrones**: Factory, Pool, Composite

### Problema 2: Limpieza asíncrona en cascada

**Situación**: Tus recursos tienen dependencias entre sí y la liberación debe ser en orden inverso.

**Preguntas guía**:
1. ¿Cómo garantizas el orden de liberación?
2. ¿Qué pasa si la liberación de un recurso falla?
3. ¿Cómo manejas recursos parcialmente liberados?

**Análisis**:
- **Problema**: Dependencias circulares, liberación parcial
- **Solución**: Grafo de dependencias, liberación con timeout
- **Patrones**: Chain of Responsibility, Memento

---

## Conexión con Python

### Context Managers en Python

```python
# Context Manager personalizado
class ConexionBD:
    def __init__(self, host):
        self.host = host
        self.conectada = False
    
    def __enter__(self):
        print(f"Conectando a {self.host}...")
        self.conectada = True
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Cerrando conexión a {self.host}...")
        self.conectada = False
        return False  # No suprimir excepciones
    
    def consultar(self, sql):
        if not self.conectada:
            raise RuntimeError("No hay conexión")
        return f"Resultado de: {sql}"

# Uso
with ConexionBD("localhost") as conn:
    resultado = conn.consultar("SELECT * FROM usuarios")
    print(resultado)
# Al salir del bloque with, se ejecuta __exit__

# Context Manager asíncrono
class ConexionAsync:
    async def __aenter__(self):
        await self.conectar()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cerrar()
        return False

# Uso
async def usar_conexion():
    async with ConexionAsync() as conn:
        return await conn.consultar("SELECT 1")
```

### Comparación JavaScript vs Python

| Aspecto | JavaScript | Python |
|---------|------------|--------|
| **Sintaxis** | `using recurso = ...` | `with recurso as r:` |
| **Interfaz** | `Symbol.dispose` | `__enter__`/`__exit__` |
| **Asíncrono** | `await using` | `async with` |
| **Scope** | Bloque actual | Bloque `with` |
| **GC** | Automático | Automático |

---

## Resumen

1. **`using`** garantiza la liberación de recursos al salir del scope
2. **El objeto** debe implementar `Symbol.dispose` (síncrono) o `Symbol.asyncDispose` (asíncrono)
3. **Elimina** la necesidad de `try/finally` repetitivo y previene fugas
4. **Python** ofrece `with`/`async with` como alternativa equivalente
5. **Los patrones** Pool y Factory ayudan a gestionar múltiples recursos

---

## Siguiente Capítulo

→ **[Capítulo 12: APIs modernas y propuestas TC39](./cap-12)**: Lo que viene en ES2025-ES2026.
