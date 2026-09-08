---
title: "Capítulo 10: Seguridad defensiva (Prototype Pollution, OWASP)"
---

# Capítulo 10: Seguridad defensiva (Prototype Pollution, OWASP)

## Introducción

En el capítulo 9 viste el modelo, el controlador y el servicio pasar datos del usuario entre capas. Ahora la pregunta que falta: **¿en qué punto te fías de esos datos?** La respuesta incómoda es que en ninguno — la frontera donde tu aplicación recibe input externo es la primera línea de un ataque, y la seguridad defensiva consiste en tratar todo lo exterior como sospechoso hasta que demuestre lo contrario.

JavaScript, por su naturaleza dinámica y su modelo de prototipos, tiene vulnerabilidades que en otros lenguajes no existen. Este capítulo cubre las dos más importantes:

1. **Prototype Pollution**: envenenar `Object.prototype` para colar propiedades en todos los objetos.
2. **Saneamiento y validación de entradas**: qué significa «no confiar», y cómo hacerlo de verdad bajo las reglas de **OWASP** (in particular A03:2021 *Injection* y A08:2021 *Software and Data Integrity Failures*).

Como siempre verás la versión de Python y de Java — y aquí hay una sorpresa honesta: este capítulo es de los pocos donde el equivalente de Java es *literalmente* «no existe», por razones de diseño que merece la pena entender.

## 1. Prototype Pollution

### El problema: una fusión de datos que envenena todos los objetos

Un merge recursivo (la utilidad favorita para combinar configuración) copia propiedades de `source` a `target`:

```javascript
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
```

El problema: no protege la clave especial `__proto__`. Si el `source` viene de un `JSON.parse`, la clave `__proto__` viaja como propiedad propia del objeto — y en la recursión, `target["__proto__"]` se lee como *el prototipo de target*, es decir `Object.prototype`. Mutarlo envenena la cadena de prototipos de **todos** los objetos del proceso:

```javascript
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
merge({}, payload)

const objetoNormal = {}
console.log(objetoNormal.isAdmin) // true — todo objeto hereda isAdmin habiendo nacido limpio
```

Eso es Prototype Pollution. Con un `merge` expuesto a una petición del usuario, un solo campo `{"__proto__": {...}}` convierte en privilegiado cualquier objeto que luego consulte permisos por herencia.

Matiz importante: escribir `{ __proto__: {...} }` como literal en tu código **no** crea una propiedad propia — el literal activa el setter del prototipo solo en ese objeto. La amenaza real es la que llega por `JSON.parse` (el atacante no escribe en tu código, te manda bytes): allí `__proto__` viaja como propiedad propia enumerable y sí alcanza la cadena de prototipos en el merge.

### Mitigación

Dos defensas, complementarias:

**1. Validar claves peligrosas en el merge.**

```javascript
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

const payload2 = JSON.parse('{"__proto__": {"isAdmin": true}}')
mergeSeguro({}, payload2)
const limpio = {}
console.log(limpio.isAdmin) // undefined — la clave se ignora
```

**2. Usar `Object.create(null)` para contenedores que no merecen heredar de nadie.**

```javascript
const mapa = Object.create(null)

mapa.__proto__ = "malicioso" // crea una propiedad propia llamada __proto__; nada que ver con el prototipo real
console.log(mapa.__proto__)  // "malicioso" (data property), no el prototipo
console.log({}.__proto__)    // Object.prototype sigue intacto
```

### Conexión con Python

**Cambia de fondo**: Python no expone un atajo equivalente. Su cadena de búsqueda no es un objeto mutable al que apunta `target["__proto__"]`; los atributos de instancia viven en `obj.__dict__` y la clase no se cambia asignando en él (inténtalo con `obj.__class__` y verás que el descriptor lo ignora). El riesgo análogo no viene del lenguaje, sino de la **deserialización insegura**:

```python
import pickle, yaml

pickle.load(file_con_datos)       # ejecuta objetos arbitrarios si el archivo es de un atacante
yaml.load(datos, Loader=yaml.FullLoader)  # vulnerabilidades clásicas de ejecución de código
```

**Traduce exactamente**: la lección es la misma con otro nombre — «no fusiones ni deserialices datos que no puedas verificar». En JavaScript el merges es la superficie de ataque; en Python lo son las cargas de `pickle`/YAML de origen desconocido.

### Conexión con Java

**Literalmente, no hay equivalente**: Java no tiene Prototype Pollution porque no tiene prototipos — la jerarquía de clases es fija y no se muta por asignación desde un objeto. Escribir el ataque es imposible por diseño:

```java
// En Java no existe "obj.__proto__ = {...}" ni "Object.prototype.x = 1"
// La clase de objeto no se modifica desde una instancia.
```

**Cambia de fondo**: eso no vuelve a Java inmune a la misma *familia* de ataques: su superficie análoga es la **deserialización insegura** (las cadenas de gadgets de `readObject` que hicieron famoso a Log4Shell) y el abuso por reflexión. La regla OWASP que te lo recuerda es la misma de antes: **A08:2021 — Software and Data Integrity Failures** (verifica la integridad de lo que recibes, datos y código). Donde JavaScript es vulnerable por mutación dinámica, Java lo es por confiar en binarios y dependencias.

### Reglas OWASP aplicables

- **A03:2021 — Injection**: valida y sanea toda entrada del usuario.
- **A08:2021 — Software and Data Integrity Failures**: verifica la integridad de datos, configuraciones y deserializaciones.

## 2. Saneamiento y validación de entradas

### El problema: confiar en el payload del usuario

Todo lo que llegue a tu API — query params, body, headers, cookies — es texto que eligió un desconocido. Si lo guardas tal cual, un comentario como `Hola <script>...` o un email con comillas puede convertirse en HTML inyectado (XSS) o en una rotura de tu propia validación. El principio de partida de OWASP: **nunca confíes; separa validación, saneamiento y escape de salida**.

**Validación** decide si el dato *puede* entrar (tipo, longitud, formato). **Saneamiento** lo limpia antes de guardar. **Escape de salida** lo neutraliza al renderizar (HTML, JS, URL). Lo tres no son lo mismo:

```javascript
function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
  return String(texto).replace(/[&<>"']/g, c => mapa[c])
}

function validarEntrada(datos, esquema) {
  const errores = []
  const limpio = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push(`${campo} es obligatorio`)
      continue
    }

    if (valor === undefined || valor === null) continue

    if (reglas.tipo && typeof valor !== reglas.tipo) {
      errores.push(`${campo} debe ser de tipo ${reglas.tipo}`)
      continue
    }

    if (reglas.max && String(valor).length > reglas.max) {
      errores.push(`${campo} excede el máximo de ${reglas.max} caracteres`)
      continue
    }

    limpio[campo] = typeof valor === "string" ? escaparHtml(valor).trim() : valor
  }

  return { valido: errores.length === 0, errores, datos: limpio }
}

const esquema = {
  nombre: { requerido: true, tipo: "string", max: 100 },
  email: { requerido: true, tipo: "string", max: 200 }
}

const resultado = validarEntrada(
  { nombre: "  David  ", email: "<script>alert(1)</script>" },
  esquema
)

// resultado.datos.email => "&lt;script&gt;alert(1)&lt;/script&gt;" — neutralizado
```

Fíjate en el orden del `escaparHtml`: se escapa `&` primero y luego `<`/`>`; si lo hicieras al revés, el `<` de `&lt;` se escaparía otra vez y quedaría `&amp;lt;`.

### Prácticas OWASP adicionales

- Usa librerías de validación probadas (Zod, Joi) — no reescribas regex de emails.
- Para consultas a bases de datos, **parametriza**, no sanee: preparar sentencias elimina la inyección SQL de raíz.
- Aplica CSP (Content Security Policy) en el servidor.
- Escapa la salida según el contexto (HTML, JS, URL) — el escape correcto para uno no sirve para otro.

### Conexión con Python

**Traduce exactamente**: Python resuelve lo mismo con Pydantic, que hace validación y tipado en un solo modelo (el equivalente declarativo de un esquema):

```python
from pydantic import BaseModel, EmailStr, field_validator, ValidationError

class DatosEntrada(BaseModel):
    nombre: str
    email: EmailStr

    @field_validator("nombre")
    def limpiar_nombre(cls, v):
        if len(v) > 100:
            raise ValueError("El nombre no puede superar 100 caracteres")
        return v.replace("<", "&lt;").replace(">", "&gt;").strip()

try:
    datos = DatosEntrada(nombre="David", email="david@ejemplo.com")
    print(datos.model_dump())
except ValidationError as error:
    print(error.errors())
```

**Cambia de fondo**: Pydantic valida y tipa al instanciar (a `EmailStr` le llega solo el formato, no solo el tipo `str`), y los decoradores `@field_validator` centralizan el saneamiento. En JavaScript tienes Zod con la misma filosofía declarativa y sin diseño de clases: defines el esquema como un objeto y `safeParse` devuelve datos tipados o errores.

### Conexión con Java

**Traduce exactamente**: la validación declarativa de Java es Bean Validation (`jakarta.validation`), que se aplica a los DTO con anotaciones y se activa en Spring MVC con `@Valid`:

```java
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class DatosEntrada {
    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar 100 caracteres")
    private String nombre;

    @NotBlank
    @Email
    private String email;
}

// En el controlador:
public ResponseEntity<?> crear(@Valid @RequestBody DatosEntrada datos) { ... }
```

**Cambia de fondo**: en Java la validación está *en el contrato*: `@Valid` dispara todas las anotaciones antes de entrar al método y el framework devuelve los errores con código 400 automáticamente. En JavaScript esa validación la montas tú (Zod en la frontera, o el `validarEntrada` de arriba) porque no hay nada que la imponga en la firma. Y una capa que Java tiene de serie y JavaScript no: la parametrización de consultas y el policy de inyección de seguridad del web container — recuerda que en JS la disciplina es tuya.

## Depuración en la práctica

### Cuándo la seguridad falla

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `objetoNormal.isAdmin === true` tras un merge | Claves `__proto__`/`constructor` no filtradas | Validar claves y usar `Object.create(null)` |
| Un campo `email` llega con `&lt;` ya escapados y muertos dobles | Se saneó lo que ya venía saneado | Escapar solo en la frontera de salida y guardar el valor limpio original |
| El endpoint A valida y el endpoint B no | Validación repartida y olvidada | Middleware + esquemas compartidos |
| Una librería nueva trae una vulnerabilidad | Dependencia sin revisión | Mapeo de dependencias y reglas OWASP A08 |

### Escenario 1: la validación inconsistente

Tu API valida con un Zod schema en `/usuarios` pero no en `/comentarios`. El día que alguien publica `<script>` en un comentario y se ejecuta en el navegador de otro usuario, nadie sabe dónde empezó: la regla de seguridad "se aplica en algún sitio" no existe. La causa no es malicia, es **falta de estándar** — la validación nació en el endpoint que la necesitaba y nunca se generalizó.

El arreglo de fondo es centralizar: un middleware de Express que valide con esquemas compartidos antes de llegar al controlador (como harás en el ejercicio avanzado) garantiza que *todas* las rutas pasan por la misma puerta. Una regla que se aplica «solo algunas veces» es una regla que igual podrías no tener.

### Escenario 2: la fuga de abstracción en la validación

Dos librerías de validación conviven en la misma app porque cada equipo eligió la suya: errores en formatos distintos, reglas duplicadas y nadie sabe qué esquema manda si el mismo campo se valida en dos sitios con criterios opuestos. Encima reescribir a mano regex complejas (emails, URLs) para no añadir dependencias es donde nacen los falsos positivos y los agujeros.

El arreglo es un proveedor único: un adaptador que envuelva la librería elegida (el patrón Strategy del capítulo 8) y que todos los endpoints importen. Si mañana cambias la librería, cambia solo el adaptador. Y para lo crítico — emails, URLs, contraseñas — deja que la librería probada y mantenida haga el trabajo; tu regex casera no tiene su historial de bugs.

## Práctica y ejercicios

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Cómo consigue Prototype Pollution que todos los objetos hereden una propiedad?</b></summary>

**Explicación**: en un `merge` recursivo, la clave `__proto__` de un `JSON.parse` viaja como propiedad propia. Al fusionarla, `target["__proto__"]` se lee como el prototipo del objetivo (es decir `Object.prototype`) y la recursión muta ese prototipo compartido: `Object.prototype.isAdmin = true` queda para todo objeto del proceso.
</details>

<details>
<summary><b>2. ¿Qué dos mitigaciones hay contra Prototype Pollution y qué aporta cada una?</b></summary>

**Explicación**: validar las claves del merge (`__proto__`, `constructor`, `prototype`) para que se ignoren antes de tocar nada, y `Object.create(null)` para contenedores cuyo prototipo no quieras heredar — asignar `mapa.__proto__` ahí crea una propiedad propia inofensiva. La primera es la defensa activa; la segunda, la de diseño.
</details>

<details>
<summary><b>3. ¿En qué se distinguen validar, sanear y escapar?</b></summary>

**Explicación**: validar decide si el dato puede entrar (tipo, longitud, formato); sanear lo limpia antes de guardar (quitar lo malformado); escapar lo neutraliza al renderizar según el contexto (HTML, JS, URL). Saneada de más puedes romper datos legítimos; escapada de menos, dejas XSS abierto.
</details>

<details>
<summary><b>4. ¿Por qué la validación inconsistente es peor que no tener validación?</b></summary>

**Explicación**: una regla que se aplica en unos endpoints y no en otros da falsa sensación de seguridad: el atacante busca la ruta sin puerta. La solución es centralizar en un middleware con esquemas compartidos para que todas las entradas pasen por la misma frontera.
</details>

<details>
<summary><b>5. ¿Puede Java sufrir Prototype Pollution? ¿Y cuál es el equivalente para Python?</b></summary>

**Explicación**: Java no puede — su jerarquía de clases es fija y no se muta desde una instancia; su familia análoga es la deserialización insegura (gadgets de `readObject`) y la integridad de dependencias (A08). Python tampoco tiene el atajo de `__proto__`; su superficie equivalente es la deserialización insegura (`pickle`, `yaml.load`) de datos que no puedes verificar.
</details>

### 2. Explicarlo con tus palabras

> **Reto**: imagina que tu aplicación es un edificio de oficinas con plantas restringidas (los modelos y las bases de datos). Explica a un amigo que viene de Java cómo funciona la seguridad defensiva de JavaScript usando el **control de acceso de recepción**: el **visitante** llega con sus datos (el payload del usuario) y nadie entra a las plantas solo por decirlo — la **recepcionista valida** su documento (tipo, longitud, formato), lo **sanea** si hace falta y **escapa** lo que pueda ejecutarse cuando vuelva a salir pantalla. Después aclara el caso raro: alguien que intenta cambiar él mismo el letrero de "todas las puertas" (Prototype Pollution) — y cómo el merge no debe permitirlo.
> *Pista: si dudas, relee la [Sección 1](#1-prototype-pollution) y la [Sección 2](#2-saneamiento-y-validación-de-entradas).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): un merge a prueba de envenenamientos

**Objetivo**: detectar y prevenir Prototype Pollution en un merge recursivo.

**Enunciado**: crea una función `mergeSeguro` que:
1. Valide todas las claves antes de fusionar.
2. Bloquee `__proto__`, `constructor` y `prototype`.
3. Funcione con objetos anidados y no contamine `Object.prototype` (verifícalo con `{}.isAdmin`).

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa `for...in` para iterar las claves propias y heredadas del objeto fuente.
2. Comprueba cada clave con un `include` sobre la lista de claves peligrosas antes de usarla.
3. Para la prueba: `mergeSeguro({}, JSON.parse('{"__proto__": {"isAdmin": true}}'))` y comprueba que `{}.isAdmin` siga siendo `undefined`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function esClaveSegura(clave) {
  const clavesPeligrosas = ["__proto__", "constructor", "prototype"]
  return !clavesPeligrosas.includes(clave)
}

function mergeSeguro(target, source) {
  for (const key in source) {
    if (!esClaveSegura(key)) {
      console.warn(`Clave peligrosa ignorada: ${key}`)
      continue
    }

    if (typeof source[key] === "object" && source[key] !== null) {
      if (typeof target[key] !== "object" || target[key] === null) {
        target[key] = Object.create(null)
      }
      mergeSeguro(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// Prueba
const seguro = Object.create(null)
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}')
mergeSeguro(seguro, payload)
console.log({}.isAdmin) // undefined — el prototipo global sigue limpio
```

**¿Por qué funciona?** El `esClaveSegura` filtra antes de que `target[key]` pueda intercambiarse por el prototipo en la recursión. Las subclaves anidadas — no `__proto__` — se fusionan igual, y `Object.create(null)` en los subobjetos evita que un objeto fusionado herede propiedades de `Object.prototype`. El `console.warn` deja rastro de los intentos sin romper el merge.
</details>

#### Ejercicio 2 (Intermedio): validación y saneamiento completos

**Objetivo**: montar un sistema de validación por tipos con saneamiento y mensajes de error descriptivos.

**Enunciado**: crea un validador con:
1. Soporte para tipos `string`, `number` y `email` (con reglas `requerido`, `min`, `max`).
2. Saneamiento que escape los caracteres HTML antes de guardar.
3. Rechazo con errores por campo, sin lanzar excepciones (devuelve `{ valido, errores, datos }`).
4. Como extensión (opcional), nota por qué para SQL la solución de verdad es parametrizar, no sanear.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Un objeto `validadores` con una función por tipo recibe `(valor, reglas)` y devuelve `null` o un mensaje.
2. Para emails usa una regex simple `^[^\s@]+@[^\s@]+\.[^\s@]+$` — y reserva las robustas a librerías probadas.
3. El saneamiento con mapa de caracteres evita el bug de escapar dos veces (`&amp;lt;`): escapa `&` primero.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
const validadores = {
  string: (valor, reglas) => {
    if (typeof valor !== "string") return "Debe ser texto"
    if (reglas.min && valor.length < reglas.min) return `Mínimo ${reglas.min} caracteres`
    if (reglas.max && valor.length > reglas.max) return `Máximo ${reglas.max} caracteres`
    return null
  },

  number: (valor, reglas) => {
    if (typeof valor !== "number") return "Debe ser número"
    if (reglas.min !== undefined && valor < reglas.min) return `Mínimo ${reglas.min}`
    if (reglas.max !== undefined && valor > reglas.max) return `Máximo ${reglas.max}`
    return null
  },

  email: (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(valor)) return "Email inválido"
    return null
  }
}

function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }
  return String(texto).replace(/[&<>"']/g, c => mapa[c])
}

function validar(datos, esquema) {
  const errores = []
  const datosSanitizados = {}

  for (const [campo, reglas] of Object.entries(esquema)) {
    const valor = datos[campo]

    if (reglas.requerido && (valor === undefined || valor === null || valor === "")) {
      errores.push({ campo, error: `${campo} es requerido` })
      continue
    }

    if (valor === undefined || valor === null) continue

    const validador = validadores[reglas.tipo]
    if (validador) {
      const error = validador(valor, reglas)
      if (error) {
        errores.push({ campo, error })
        continue
      }
    }

    datosSanitizados[campo] = typeof valor === "string" ? escaparHtml(valor).trim() : valor
  }

  return { valido: errores.length === 0, errores, datos: datosSanitizados }
}

const esquema = {
  nombre: { requerido: true, tipo: "string", min: 2, max: 100 },
  email: { requerido: true, tipo: "email" },
  edad: { tipo: "number", min: 0, max: 150 }
}

const resultado = validar(
  { nombre: "David", email: "david@ejemplo.com", edad: 25 },
  esquema
)
console.log(resultado.valido) // true

const resultado2 = validar({ nombre: "x", email: "mal", edad: 200 }, esquema)
console.log(resultado2.errores)
// [{ campo: "nombre", error: "Mínimo 2 caracteres" },
//  { campo: "email", error: "Email inválido" },
//  { campo: "edad", error: "Máximo 150" }]
```

**¿Por qué funciona?** Los validadores devuelven `null` (ok) o el mensaje (fallo), y el bucle acumula todos los errores sin cortar en el primero: el usuario ve la lista completa de una vez. El saneamiento escapa `&` antes que `<`/`>` para no duplicar escapes, y la salida es un `{ valido, errores, datos }` estable que cualquier capa del capítulo 9 puede consumir. Sobre SQL: sanear comillas no detiene la inyección de forma fiable — **parametriza** (prepared statements) y no tendrás que sanear nada.
</details>

#### Ejercicio 3 (Avanzado): middleware de seguridad Express

**Objetivo**: centralizar la seguridad en la frontera con detección de Prototype Pollution, registro de eventos sospechosos y rate limiting básico.

**Enunciado**: construye un middleware `SecurityMiddleware` que:
1. Detecte y bloquee `__proto__`, `constructor` y `prototype` en cualquier profundidad del `req.body`.
2. Registre los intentos detectados (y los rechazos por rate limit) en un log consultable.
3. Aplique un rate limit por IP (máx. 100 peticiones / 60 s) respondiendo `429` al sobrepasar.
4. Deje pasar el resto con `next()`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. La detección recursiva recorre `Object.keys` guardando la ruta (`usuario.perfil.__proto__`).
2. Recuerda el patrón del capítulo 6: `try`/`catch` no es necesario aquí — el middleware responde y corta, o llama a `next()`.
3. El rate limit: un `Map` ip → `{ count, inicio }`; si la ventana expira, reinicia `count` en 1.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class SecurityMiddleware {
  constructor() {
    this.eventos = []
    this.rateLimits = new Map()
  }

  detectarPrototypePollution(objeto) {
    const clavesPeligrosas = ["__proto__", "constructor", "prototype"]
    const detectadas = []

    function revisar(nodo, ruta = "") {
      for (const clave of Object.keys(nodo)) {
        const rutaCompleta = ruta ? `${ruta}.${clave}` : clave

        if (clavesPeligrosas.includes(clave)) {
          detectadas.push(rutaCompleta)
        }
        if (typeof nodo[clave] === "object" && nodo[clave] !== null) {
          revisar(nodo[clave], rutaCompleta)
        }
      }
    }

    revisar(objeto)
    return detectadas
  }

  registrarEvento(tipo, detalles) {
    this.eventos.push({ timestamp: new Date().toISOString(), tipo, detalles })
  }

  rateLimit(ip, maxRequests = 100, windowMs = 60000) {
    const ahora = Date.now()
    const ventana = this.rateLimits.get(ip) || { count: 0, inicio: ahora }

    if (ahora - ventana.inicio > windowMs) {
      ventana.count = 1
      ventana.inicio = ahora
    } else {
      ventana.count++
    }

    this.rateLimits.set(ip, ventana)
    return ventana.count <= maxRequests
  }

  middleware() {
    return (req, res, next) => {
      if (!this.rateLimit(req.ip)) {
        this.registrarEvento("RATE_LIMIT", { ip: req.ip, path: req.path })
        return res.status(429).json({ error: "Demasiadas peticiones" })
      }

      if (req.body && typeof req.body === "object") {
        const clavesDetectadas = this.detectarPrototypePollution(req.body)

        if (clavesDetectadas.length > 0) {
          this.registrarEvento("POLLUTION_ATTEMPT", {
            ip: req.ip,
            path: req.path,
            claves: clavesDetectadas
          })

          return res.status(400).json({ error: "Petición rechazada por razones de seguridad" })
        }
      }

      next()
    }
  }

  obtenerEventos() {
    return [...this.eventos]
  }
}

// Uso en Express
const seguridad = new SecurityMiddleware()
app.use(seguridad.middleware())
```

**¿Por qué funciona?** El middleware actúa en la frontera: todo `req.body` pasa por `detectarPrototypePollution` (recorrido recursivo con `Object.keys`, que funciona con claves propias aunque el body llegue con `__proto__`), y si aparece una clave peligrosa se registra y se responde `400` sin llegar jamás al controlador del capítulo 9. El rate limit por `Map` detecta ráfagas por IP con ventana deslizante de 60 s. En producción, el `Map` de IPs debería podarse (o usar un store con TTL) para no crecer sin límite;
</details>

## Tabla comparativa entre lenguajes

| Aspecto | JavaScript (Express) | Python (Django/Pydantic) |
|---|---|---|
| Prototype Pollution | Posible por `__proto__` en merges | Inexistente por `__dict__`/clases fijas |
| Riesgo análogo | Merge/deserialización de body | Deserialización insegura (`pickle`, `yaml.load`) |
| Validación | Manual con esquemas (Zod) o propios | Pydantic declarativa con tipos y validadores |
| Saneamiento | A mano; escapar según contexto | Decoradores `@field_validator` |
| Consultas | Parámetros manuales (tu disciplina) | ORM con querysets preparados |

| Aspecto | JavaScript (Express) | Java (Spring/Bean Validation) |
|---|---|---|
| Prototype Pollution | Posible y frecuente en utils de merge | Imposible por diseño (clases fijas) |
| Riesgo análogo | — (mismo que la columna derecha del análisis) | Deserialización insegura (gadgets `readObject`) |
| Validación | En la frontera, escrita por ti | Anotaciones `@Valid` + Bean Validation en cada DTO |
| La puerta de entrada | Middleware manual | El framework lo fuerza en la firma |
| Escape de salida | Manual (templates, `res.json`) | Templates con escaping por defecto (Thymeleaf) |

## Resumen del capítulo

1. **Prototype Pollution**: una clave `__proto__` en un merge recursivo muta `Object.prototype` y cola propiedades en todos los objetos del proceso.
2. Las **dos defensas** son filtrar claves peligrosas y usar `Object.create(null)` para contenedores que no deben heredar.
3. **Java es inmune por diseño** (no hay prototipos mutables); su familia análoga es la deserialización insegura. Python tampoco tiene `__proto__`; su riesgo equivalente es `pickle`/`yaml.load` de fuentes no confiables.
4. **Validar, sanear y escapar son tres operaciones distintas**; mezclarlas causa datos rotos o XSS abierto.
5. La validación debe estar **centralizada en la frontera** (middleware, esquemas compartidos) — una regla que se aplica a veces es una regla que no existe.
6. Para SQL la respuesta no es sanear sino **parametrizar**; para HTML es **escapar en la salida** según contexto.
7. OWASP resume el criterio: **validar toda entrada (A03)** e **integrity de datos y dependencias (A08)**.

## Siguiente Capítulo

→ **[Capítulo 11: Gestión asíncrona de recursos](./cap-11)**: la seguridad te enseña a cerrar la puerta de entrada; el siguiente capítulo enseña a cerrar la puerta de salida — cómo liberar recursos (archivos, conexiones) con `using` y el Explicit Resource Management.