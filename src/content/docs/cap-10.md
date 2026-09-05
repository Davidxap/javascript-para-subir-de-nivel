---
title: "Capítulo 10: Seguridad defensiva (Prototype Pollution, OWASP)"
---

# Capítulo 10: Seguridad defensiva (Prototype Pollution, OWASP)

> La seguridad defensiva en JavaScript aborda vulnerabilidades específicas del lenguaje y prácticas de saneamiento de entradas bajo estándares OWASP.

## Introducción

JavaScript tiene vulnerabilidades únicas debido a su naturaleza dinámica y su modelo de prototipos. Este capítulo cubre las amenazas más comunes y cómo protegerse de ellas siguiendo las mejores prácticas de OWASP.

**¿Por qué importa?** Porque la seguridad no es opcional. Un solo agujero puede comprometer toda tu aplicación. Entender las vulnerabilidades específicas de JavaScript te permite construir sistemas más robustos.

## 1. Prototype Pollution

### Idea clave

Prototype Pollution ocurre cuando un atacante puede modificar propiedades de `Object.prototype` (o `Array.prototype`) mediante asignaciones maliciosas, afectando a todos los objetos del sistema.

### Vector de ataque clásico

```javascript
// Código vulnerable: merge recursivo sin validación
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object") {
      merge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// Ataque
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
merge({}, payload)

// Ahora TODOS los objetos heredan isAdmin: true
const obj = {}
console.log(obj.isAdmin) // true — ¡vulnerabilidad!
```

### Mitigación

```javascript
// 1. Validar claves peligrosas
function esClaveSegura(clave) {
  return clave !== "__proto__" && clave !== "constructor" && clave !== "prototype"
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) continue
    if (source[key] !== null && typeof source[key] === "object") {
      mergeSeguro(target[key] ??= {}, source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// 2. Usar Object.create(null) para objetos sin prototipo
const mapa = Object.create(null)
mapa.__proto__ = "malicioso" // No afecta a Object.prototype
```

### Reglas OWASP aplicables

- **A03:2021 - Injection**: validar y saneear toda entrada del usuario.
- **A08:2021 - Software and Data Integrity Failures**: verificar la integridad de datos y configuraciones.

## 2. Saneamiento de entradas

### Idea clave

Nunca confíes en los datos del usuario. Todo input externo debe ser validado, saneado y tipado antes de usarse.

### Ejemplo con validación defensiva

```javascript
function validarEntrada(datos, esquema) {
  const errores = []
  const limpio = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push(`${campo} es obligatorio`)
      continue
    }

    if (valor === undefined) continue

    if (reglas.tipo && typeof valor !== reglas.tipo) {
      errores.push(`${campo} debe ser de tipo ${reglas.tipo}`)
      continue
    }

    if (reglas.max && valor.length > reglas.max) {
      errores.push(`${campo} excede el máximo de ${reglas.max} caracteres`)
      continue
    }

    // Saneamiento: eliminar caracteres peligrosos
    limpio[campo] = String(valor).replace(/[<>]/g, "").trim()
  }

  return { valido: errores.length === 0, errores, datos: limpio }
}

const esquema = {
  nombre: { requerido: true, tipo: "string", max: 100 },
  email: { requerido: true, tipo: "string", max: 200 }
}

const resultado = validarEntrada(
  { nombre: "David", email: "<script>alert(1)</script>" },
  esquema
)
// resultado.datos.email => "script>alert(1)/script>"
```

### Comparación con Python

```python
# Python - Validación con Pydantic (similar a Zod en JS)
from pydantic import BaseModel, validator, EmailStr

class DatosEntrada(BaseModel):
    nombre: str
    email: EmailStr
    
    @validator('nombre')
    def validar_nombre(cls, v):
        if len(v) > 100:
            raise ValueError('Nombre demasiado largo')
        # Sanitizar XSS
        return v.replace('<', '').replace('>', '').strip()
    
    @validator('email')
    def validar_email(cls, v):
        if len(v) > 200:
            raise ValueError('Email demasiado largo')
        return v

# Uso
try:
    datos = DatosEntrada(nombre="David", email="david@ejemplo.com")
    print(datos.dict())
except ValidationError as e:
    print(e.errors())
```

**Diferencias clave**:
- **JavaScript**: Validación manual o con librerías (zod, joi, validator)
- **Python**: Pydantic ofrece validación declarativa con tipos y decoradores
- **Ambos**: Nunca confiar en datos del usuario

### Prácticas OWASP adicionales

- Usar librerías de validación probadas (zod, joi, validator).
- Aplicar CSP (Content Security Policy) en el servidor.
- Escapar salida (output encoding) según el contexto (HTML, JS, URL).

## Errores Comunes

- No validar claves en merge recursivo (Prototype Pollution).
- Confiar en datos del cliente sin validar.
- Usar `eval()` con datos del usuario.
- No escapar salida en templates HTML.

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Detectar y prevenir Prototype Pollution

**Ejercicio**: Crea una función `mergeSeguro` que:
1. Valide todas las claves antes de fusionar
2. Bloquee `__proto__`, `constructor` y `prototype`
3. Funcione con objetos anidados

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un bucle `for...in` para iterar claves
2. Verifica cada clave con una función de validación
3. Usa `Object.create(null)` para objetos seguros

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
function esClaveSegura(clave) {
  const clavesPeligrosas = ['__proto__', 'constructor', 'prototype'];
  return !clavesPeligrosas.includes(clave);
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) {
      console.warn(`Clave peligrosa detectada: ${key}`);
      continue;
    }
    
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = Object.create(null);
      }
      mergeSeguro(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  
  return target;
}

// Prueba
const seguro = Object.create(null);
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
mergeSeguro(seguro, payload);
console.log({}.isAdmin); // undefined (seguro)
```

</details>


### Nivel Intermedio

**Objetivo**: Implementar validación de entrada completa

**Ejercicio**: Crea un sistema de validación que:
1. Valide tipos de datos
2. Aplique reglas de longitud
3. Sanee caracteres peligrosos
4. Genere mensajes de error descriptivos

**Requisitos**:
1. Soporte para tipos: string, number, boolean, email, url
2. Reglas: requerido, min, max, pattern
3. Saneamiento: XSS, SQL injection básico

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa un esquema de validación declarativo
2. Implementa validadores por tipo
3. Crea una función de saneamiento por tipo

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
const validadores = {
  string: (valor, reglas) => {
    if (typeof valor !== 'string') return 'Debe ser texto';
    if (reglas.min && valor.length < reglas.min) return `Mínimo ${reglas.min} caracteres`;
    if (reglas.max && valor.length > reglas.max) return `Máximo ${reglas.max} caracteres`;
    return null;
  },
  
  number: (valor, reglas) => {
    if (typeof valor !== 'number') return 'Debe ser número';
    if (reglas.min !== undefined && valor < reglas.min) return `Mínimo ${reglas.min}`;
    if (reglas.max !== undefined && valor > reglas.max) return `Máximo ${reglas.max}`;
    return null;
  },
  
  email: (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(valor)) return 'Email inválido';
    return null;
  }
};

function sanear(valor, tipo) {
  if (typeof valor !== 'string') return valor;
  
  // Sanear XSS
  let saneado = valor
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Sanear SQL injection básico
  if (tipo === 'string') {
    saneado = saneado.replace(/['";\\]/g, '');
  }
  
  return saneado;
}

function validar(datos, esquema) {
  const errores = [];
  const datosSanitizados = {};
  
  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo];
    
    if (reglas.requerido && (valor === undefined || valor === null || valor === '')) {
      errores.push({ campo, error: `${campo} es requerido` });
      continue;
    }
    
    if (valor !== undefined && valor !== null) {
      const validador = validadores[reglas.tipo];
      if (validador) {
        const error = validador(valor, reglas);
        if (error) {
          errores.push({ campo, error });
          continue;
        }
      }
      
      datosSanitizados[campo] = sanear(valor, reglas.tipo);
    }
  }
  
  return {
    valido: errores.length === 0,
    errores,
    datos: datosSanitizados
  };
}
```

</details>


### Nivel Avanzado

**Objetivo**: Implementar sistema de seguridad completo

**Ejercicio**: Crea un middleware de seguridad que:
1. Detecte y bloquee intentos de Prototype Pollution
2. Valide y sanee todas las entradas
3. Registre intentos sospechosos
4. Aplique rate limiting básico

**Especificaciones**:
1. Intercepte requests antes de llegar al controlador
2. Use un sistema de reglas configurable
3. Mantenga un log de eventos de seguridad

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa Express middleware
2. Implementa un patrón Chain of Responsibility
3. Almacena eventos en un array o archivo

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
class SecurityMiddleware {
  constructor() {
    this.eventos = [];
    this.rateLimits = new Map();
  }
  
  detectarPrototypePollution(body) {
    const clavesPeligrosas = ['__proto__', 'constructor', 'prototype'];
    const detectadas = [];
    
    function revisar(obj, path = '') {
      for (const key of Object.keys(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (clavesPeligrosas.includes(key)) {
          detectadas.push(fullPath);
        }
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          revisar(obj[key], fullPath);
        }
      }
    }
    
    revisar(body);
    return detectadas;
  }
  
  registrarEvento(tipo, detalles) {
    this.eventos.push({
      timestamp: new Date().toISOString(),
      tipo,
      detalles
    });
  }
  
  rateLimit(ip, maxRequests = 100, windowMs = 60000) {
    const ahora = Date.now();
    const ventana = this.rateLimits.get(ip) || { count: 0, inicio: ahora };
    
    if (ahora - ventana.inicio > windowMs) {
      ventana.count = 1;
      ventana.inicio = ahora;
    } else {
      ventana.count++;
    }
    
    this.rateLimits.set(ip, ventana);
    return ventana.count <= maxRequests;
  }
  
  middleware() {
    return (req, res, next) => {
      if (!this.rateLimit(req.ip)) {
        this.registrarEvento('RATE_LIMIT', { ip: req.ip, path: req.path });
        return res.status(429).json({ error: 'Demasiadas peticiones' });
      }
      
      if (req.body && typeof req.body === 'object') {
        const clavesDetectadas = this.detectarPrototypePollution(req.body);
        
        if (clavesDetectadas.length > 0) {
          this.registrarEvento('POLLUTION_ATTEMPT', {
            ip: req.ip,
            path: req.path,
            claves: clavesDetectadas
          });
          
          return res.status(400).json({
            error: 'Petición rechazada por razones de seguridad'
          });
        }
      }
      
      next();
    };
  }
  
  obtenerEventos() {
    return [...this.eventos];
  }
}
```

</details>


---

## Pensamiento Crítico

### Problema 1: Validación inconsistente

**Situación**: Tu API tiene validación en algunos endpoints pero no en otros, making it hard to maintain security.

**Preguntas guía**:
1. ¿Por qué la validación inconsistente es un problema de seguridad?
2. ¿Cómo centralizas la validación en una aplicación?
3. ¿Qué patrones ayudan a mantener validación consistente?

**Análisis**:
- **Causa**: Falta de estándares, prisa en el desarrollo, código heredado
- **Solución**: Middleware centralizado, esquemas de validación compartidos
- **Patrones**: Schema Validation, Middleware Chain

### Problema 2: Dependencia de librerías de terceros

**Situación**: Tu aplicación usa múltiples librerías de validación, cada una con su propio API.

**Preguntas guía**:
1. ¿Qué problemas crea usar múltiples librerías de validación?
2. ¿Cómo unificas la validación en una aplicación grande?
3. ¿Cuándo vale la pena crear una validación personalizada vs usar una librería?

**Análisis**:
- **Problema**: Inconsistencia, mantenimiento duplicado, dependencias
- **Solución**: Abstraction layer, Strategy Pattern
- **Herramientas**: Zod (JS), Pydantic (Python), JOI

---

## Conexión con Python

### Validación en Python vs JavaScript

**JavaScript (Zod)**:
```javascript
import { z } from 'zod';

const UsuarioSchema = z.object({
  nombre: z.string().min(2).max(100),
  email: z.string().email(),
  edad: z.number().min(0).max(150)
});

// Validar
const resultado = UsuarioSchema.safeParse({
  nombre: "David",
  email: "david@ejemplo.com",
  edad: 25
});
```

**Python (Pydantic)**:
```python
from pydantic import BaseModel, validator

class Usuario(BaseModel):
    nombre: str
    email: str
    edad: int
    
    @validator('nombre')
    def validar_nombre(cls, v):
        if len(v) < 2 or len(v) > 100:
            raise ValueError('Nombre debe tener 2-100 caracteres')
        return v
    
    @validator('edad')
    def validar_edad(cls, v):
        if v < 0 or v > 150:
            raise ValueError('Edad inválida')
        return v

# Validar
usuario = Usuario(nombre="David", email="david@ejemplo.com", edad=25)
```

### Diferencias clave

| Aspecto | JavaScript | Python |
|---------|------------|--------|
| **Librerías** | Zod, JOI, Yup | Pydantic, Marshmallow |
| **Enfoque** | Declarativo (Zod) | Decoradores + tipos |
| **TypeScript** | Integrado con tipos | Type hints |
| **Runtime** | Validación en runtime | Validación en runtime |

---

## Resumen

1. **Prototype Pollution** explota la cadena de prototipos para inyectar propiedades globales
2. **La mitigación** requiere validar claves peligrosas y usar `Object.create(null)`
3. **El saneamiento de entradas** sigue los principios OWASP: validar, saneear y escapar
4. **La validación** debe ser consistente y centralizada en toda la aplicación
5. **Las librerías de validación** (Zod, Pydantic) ofrecen herramientas probadas y mantenidas

---

## Siguiente Capítulo

→ **[Capítulo 11: Gestión asíncrona de recursos](./cap-11)**: `using` y Explicit Resource Management.
