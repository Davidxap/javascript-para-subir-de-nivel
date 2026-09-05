---
title: "Chapter 10: Defensive Security (Prototype Pollution, OWASP)"
---

# Chapter 10: Defensive Security (Prototype Pollution, OWASP)

> Defensive security in JavaScript addresses language-specific vulnerabilities and input sanitization practices under OWASP standards.

## Introduction

JavaScript has unique vulnerabilities due to its dynamic nature and its prototype model. This chapter covers the most common threats and how to protect against them following OWASP best practices.

**Why does it matter?** Because security is not optional. A single loophole can compromise your entire application. Understanding JavaScript-specific vulnerabilities allows you to build more robust systems.

## 1. Prototype Pollution

### Key Idea

Prototype Pollution occurs when an attacker can modify properties of `Object.prototype` (or `Array.prototype`) through malicious assignments, affecting all objects in the system.

### Classic Attack Vector

```javascript
// Vulnerable code: recursive merge without validation
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

// Attack
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
merge({}, payload)

// Now ALL objects inherit isAdmin: true
const obj = {}
console.log(obj.isAdmin) // true — vulnerability!
```

### Mitigation

```javascript
// 1. Validate dangerous keys
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

// 2. Use Object.create(null) for objects without prototype
const mapa = Object.create(null)
mapa.__proto__ = "malicioso" // Does not affect Object.prototype
```

### Applicable OWASP Rules

- **A03:2021 - Injection**: Validate and sanitize all user input.
- **A08:2021 - Software and Data Integrity Failures**: Verify the integrity of data and configurations.

## 2. Input Sanitization

### Key Idea

Never trust user data. All external input must be validated, sanitized, and typed before being used.

### Example with Defensive Validation

```javascript
function validarEntrada(datos, esquema) {
  const errores = []
  const limpio = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push(`${campo} is required`)
      continue
    }

    if (valor === undefined) continue

    if (reglas.tipo && typeof valor !== reglas.tipo) {
      errores.push(`${campo} must be of type ${reglas.tipo}`)
      continue
    }

    if (reglas.max && valor.length > reglas.max) {
      errores.push(`${campo} exceeds the maximum of ${reglas.max} characters`)
      continue
    }

    // Sanitization: remove dangerous characters
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

### Comparison with Python

```python
# Python - Validation with Pydantic (similar to Zod in JS)
from pydantic import BaseModel, validator, EmailStr

class DatosEntrada(BaseModel):
    nombre: str
    email: EmailStr
    
    @validator('nombre')
    def validar_nombre(cls, v):
        if len(v) > 100:
            raise ValueError('Name too long')
        # Sanitize XSS
        return v.replace('<', '').replace('>', '').strip()
    
    @validator('email')
    def validar_email(cls, v):
        if len(v) > 200:
            raise ValueError('Email too long')
        return v

# Usage
try:
    datos = DatosEntrada(nombre="David", email="david@ejemplo.com")
    print(datos.dict())
except ValidationError as e:
    print(e.errors())
```

**Key differences**:
- **JavaScript**: Manual validation or using libraries (zod, joi, validator)
- **Python**: Pydantic offers declarative validation with types and decorators
- **Both**: Never trust user data

### Additional OWASP Practices

- Use proven validation libraries (zod, joi, validator).
- Apply CSP (Content Security Policy) on the server.
- Escape output (output encoding) depending on the context (HTML, JS, URL).

## Common Mistakes

- Not validating keys in recursive merges (Prototype Pollution).
- Trusting client data without validation.
- Using `eval()` with user data.
- Not escaping output in HTML templates.

---

## Practical Exercises

### Basic Level

**Objective**: Detect and prevent Prototype Pollution

**Exercise**: Create a `mergeSeguro` function that:
1. Validates all keys before merging
2. Blocks `__proto__`, `constructor`, and `prototype`
3. Works with nested objects

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use a `for...in` loop to iterate over keys
2. Verify each key with a validation function
3. Use `Object.create(null)` for secure objects

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
function esClaveSegura(clave) {
  const clavesPeligrosas = ['__proto__', 'constructor', 'prototype'];
  return !clavesPeligrosas.includes(clave);
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) {
      console.warn(`Dangerous key detected: ${key}`);
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

// Test
const seguro = Object.create(null);
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
mergeSeguro(seguro, payload);
console.log({}.isAdmin); // undefined (secure)
```

</details>


### Intermediate Level

**Objective**: Implement complete input validation

**Exercise**: Create a validation system that:
1. Validates data types
2. Applies length rules
3. Sanitizes dangerous characters
4. Generates descriptive error messages

**Requirements**:
1. Support for types: string, number, boolean, email, url
2. Rules: requerido, min, max, pattern
3. Sanitization: XSS, basic SQL injection

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use a declarative validation schema
2. Implement validators by type
3. Create a sanitization function by type

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
const validadores = {
  string: (valor, reglas) => {
    if (typeof valor !== 'string') return 'Must be text';
    if (reglas.min && valor.length < reglas.min) return `Minimum ${reglas.min} characters`;
    if (reglas.max && valor.length > reglas.max) return `Maximum ${reglas.max} characters`;
    return null;
  },
  
  number: (valor, reglas) => {
    if (typeof valor !== 'number') return 'Must be a number';
    if (reglas.min !== undefined && valor < reglas.min) return `Minimum ${reglas.min}`;
    if (reglas.max !== undefined && valor > reglas.max) return `Maximum ${reglas.max}`;
    return null;
  },
  
  email: (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(valor)) return 'Invalid email';
    return null;
  }
};

function sanear(valor, tipo) {
  if (typeof valor !== 'string') return valor;
  
  // Sanitize XSS
  let saneado = valor
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Sanitize basic SQL injection
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
      errores.push({ campo, error: `${campo} is required` });
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


### Advanced Level

**Objective**: Implement a complete security system

**Exercise**: Create a security middleware that:
1. Detects and blocks Prototype Pollution attempts
2. Validates and sanitizes all inputs
3. Logs suspicious attempts
4. Applies basic rate limiting

**Specifications**:
1. Intercepts requests before reaching the controller
2. Uses a configurable rules system
3. Maintains a security event log

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use Express middleware
2. Implement a Chain of Responsibility pattern
3. Store events in an array or file

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

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
        return res.status(429).json({ error: 'Too many requests' });
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
            error: 'Request rejected for security reasons'
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

## Critical Thinking

### Problem 1: Inconsistent Validation

**Situation**: Your API has validation on some endpoints but not on others, making it hard to maintain security.

**Guiding Questions**:
1. Why is inconsistent validation a security issue?
2. How do you centralize validation in an application?
3. What patterns help maintain consistent validation?

**Analysis**:
- **Cause**: Lack of standards, development rush, legacy code
- **Solution**: Centralized middleware, shared validation schemas
- **Patterns**: Schema Validation, Middleware Chain

### Problem 2: Dependency on Third-Party Libraries

**Situation**: Your application uses multiple validation libraries, each with its own API.

**Guiding Questions**:
1. What problems does using multiple validation libraries create?
2. How do you unify validation in a large application?
3. When is it worth creating custom validation vs using a library?

**Analysis**:
- **Problem**: Inconsistency, duplicate maintenance, dependencies
- **Solution**: Abstraction layer, Strategy Pattern
- **Tools**: Zod (JS), Pydantic (Python), JOI

---

## Connection with Python

### Validation in Python vs JavaScript

**JavaScript (Zod)**:
```javascript
import { z } from 'zod';

const UsuarioSchema = z.object({
  nombre: z.string().min(2).max(100),
  email: z.string().email(),
  edad: z.number().min(0).max(150)
});

// Validate
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
            raise ValueError('Name must be between 2 and 100 characters')
        return v
    
    @validator('edad')
    def validar_edad(cls, v):
        if v < 0 or v > 150:
            raise ValueError('Invalid age')
        return v

# Validate
usuario = Usuario(nombre="David", email="david@ejemplo.com", edad=25)
```

### Key Differences

| Aspect | JavaScript | Python |
|---------|------------|--------|
| **Libraries** | Zod, JOI, Yup | Pydantic, Marshmallow |
| **Approach** | Declarative (Zod) | Decorators + types |
| **TypeScript** | Integrated with types | Type hints |
| **Runtime** | Runtime validation | Runtime validation |

---

## Summary

1. **Prototype Pollution** exploits the prototype chain to inject global properties.
2. **Mitigation** requires validating dangerous keys and using `Object.create(null)`.
3. **Input sanitization** follows OWASP principles: validate, sanitize, and escape.
4. **Validation** must be consistent and centralized throughout the application.
5. **Validation libraries** (Zod, Pydantic) offer proven and maintained tools.

---

## Next Chapter

→ **Cap-11-Gestion-Asincrona-Recursos**: In the next chapter, we will look at asynchronous resource management, including `using` and Explicit Resource Management.