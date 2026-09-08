---
title: "Capítulo 7: Patrones creacionales (Factory, Singleton, Builder)"
---

# Capítulo 7: Patrones creacionales (Factory, Singleton, Builder)

## Introducción

Hasta ahora aprendiste a organizar datos (capítulo 5) y a fallar con intención (capítulo 6). Pero hay algo que haces en cada ejemplo sin pensarlo dos veces: crear objetos. Y la forma más directa — `new` a mano en cada sitio, con cada configuración repetida — se vuelve un problema cuando el código crece: cambias el constructor y tienes que perseguir todas las llamadas, o dos instancias de lo mismo conviven sin que te des cuenta y el estado empieza a descuadrarse.

Los **patrones creacionales** atacan exactamente eso: desacoplan la creación del uso. No son magia, son respuestas a problemas concretos:

- **Factory**: decide qué objeto concreto se crea según un criterio.
- **Singleton**: garantiza que una cosa existe una y solo una vez.
- **Builder**: arma objetos complejos pieza por pieza, en vez de un constructor gigante.

En este capítulo verás el problema detrás de cada uno, su implementación en JavaScript moderno y la versión que Python y Java le dan a la misma idea — porque los tres lenguajes resuelven lo mismo con herramientas distintas.

## 1. Factory

### El problema: `new` repetido por todo el código

Cuando creas un objeto a mano, cada sitio repite el mismo cableado:

```javascript
const admin = {
  nombre,
  rol: "admin",
  permisos: ["leer", "escribir", "eliminar"],
  describir() { return `Admin ${this.nombre} con permisos completos` }
}
```

Duplicas esa lógica en cada módulo que necesita un admin, y el día que los permisos agreguen un campo nuevo tienes que cazarlo en todas las copias. El **Factory** centraliza esa decisión: una función (o clase) que recibe un criterio y devuelve la forma de objeto correcta.

```javascript
function crearUsuario(tipo, nombre) {
  switch (tipo) {
    case "admin":
      return {
        nombre,
        rol: "admin",
        permisos: ["leer", "escribir", "eliminar"],
        describir() {
          return `Admin ${this.nombre} con permisos completos`
        }
      }
    case "editor":
      return {
        nombre,
        rol: "editor",
        permisos: ["leer", "escribir"],
        describir() {
          return `Editor ${this.nombre} con permisos de lectura y escritura`
        }
      }
    default:
      return {
        nombre,
        rol: "user",
        permisos: ["leer"],
        describir() {
          return `Usuario ${this.nombre} con permisos de solo lectura`
        }
      }
  }
}

const admin = crearUsuario("admin", "David")
const editor = crearUsuario("editor", "Ana")
```

El llamador deja de saber qué forma concreta recibe — solo sabe que es un usuario que sabe `describirse`. Si la misma idea la llevas a clases, la factory te permite devolver **subtipos** reales según la condición, y la lógica de decisión vive en un solo lugar.

### Cuándo usarlo

- Cuando la lógica de creación puede variar según un criterio.
- Cuando quieres centralizar la creación para que una sola pieza decida.
- Cuando el llamador no debería acoplarse a la clase concreta.

### Conexión con Python

**Traduce exactamente**: Python tampoco da una herramienta especial para esto — el patrón es una función que decide qué instancia construir.

```python
def crear_usuario(tipo, nombre):
    if tipo == "admin":
        return Usuario(nombre, rol="admin", permisos=["leer", "escribir", "eliminar"])
    if tipo == "editor":
        return Usuario(nombre, rol="editor", permisos=["leer", "escribir"])
    return Usuario(nombre, rol="user", permisos=["leer"])
```

**Cambia de fondo**: Python suele ir un paso más lejos y ni siquiera usar una función: los *constructores con nombre* vía `@classmethod` (`Usuario.admin("David")`) ponen el criterio directamente en la clase y la creación queda autodocumentada. JavaScript no tiene `classmethod` — la función factory es el equivalente natural.

### Conexión con Java

**Traduce exactamente**: Java es el hogar del patrón (venía del libro *Design Patterns*); aquí el factory típico es un método `static`:

```java
public static Usuario crear(String tipo, String nombre) {
    return switch (tipo) {
        case "admin" -> new Usuario(nombre, "admin", List.of("leer", "escribir", "eliminar"));
        case "editor" -> new Usuario(nombre, "editor", List.of("leer", "escribir"));
        default -> new Usuario(nombre, "user", List.of("leer"));
    };
}
```

**Cambia de fondo**: en Java el factory no es un lujo — `new` siempre devuelve la clase exacta que nombraste, así que "devolver un subtipo según condición" solo es posible con un factory. En JavaScript, con funciones y objetos literales, el patrón a veces se reduce a tres líneas; si ese es tu caso, tres líneas están bien.

- ¿Vale la pena un factory si creas el objeto en un solo lugar? No: el patrón paga cuando la creación se repite o el criterio cambia. Si no, es abstracción de sobra.
- ¿La factory tiene que devolver clases? No. Devuelve lo que el resto del código necesite — lo que importa es que el criterio quede en un solo lugar.

## 2. Singleton

### El problema: dos conexiones que deberían ser una

Si cada módulo abre su propia conexión a la base de datos, terminas con dos conexiones, dos estados, y nadie las sincroniza:

```javascript
const con1 = crearConexion()
const con2 = crearConexion()
con1 === con2 // false — dos conexiones, dos hilos de estado
```

El **Singleton** garantiza que una operación devuelva siempre la misma instancia: un punto de acceso único a algo que solo debe existir una vez (configuración, pool de conexiones, caché de una sola entrada).

### Implementación con closure

```javascript
const crearConexionBD = (function () {
  let instancia = null

  return function () {
    if (instancia) return instancia

    instancia = {
      host: "localhost",
      puerto: 5432,
      conectar() {
        console.log(`Conectado a ${this.host}:${this.puerto}`)
      }
    }

    return instancia
  }
})()

const con1 = crearConexionBD()
const con2 = crearConexionBD()

console.log(con1 === con2) // true
```

La variable `instancia` queda encerrada en el closure: fuera de esa IIFE nadie puede tocarla, y la única forma de obtener la conexión es pasar por la función.

### Implementación con clase

```javascript
class Configuracion {
  static instancia = null

  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = new Configuracion()
    }
    return Configuracion.instancia
  }

  constructor() {
    this.entorno = "produccion"
    this.apiURL = "https://api.ejemplo.com"
  }
}

const config1 = Configuracion.obtenerInstancia()
const config2 = Configuracion.obtenerInstancia()

console.log(config1 === config2) // true
```

### Cuándo tener cuidado

- Un Singleton es un estado global disfrazado: si los tests corren esta clase y dejan valores modificados, el siguiente test arranca contaminado.
- En un entorno con `worker_threads`, cada hilo carga su propio módulo: el Singleton vive por hilo y no se comparte.

### Conexión con Python

**Cambia de fondo**: Python no tiene constructores privados, así que el Singleton clásico con clase no es el idioma. Lo común es un objeto a nivel de módulo, que por definición existe una sola vez:

```python
# conexion.py
conexion = {"host": "localhost", "puerto": 5432}
```

**Traduce exactamente**: si de verdad quieres la versión con clase, existe el decorador `@singleton` (de `singledispatch` puedes armarte uno con un metaclass), pero en la práctica el módulo es la respuesta Pythonica: el "punto de acceso global" lo pone el `import`, sin código extra.

### Conexión con Java

**Traduce exactamente**: Java es el caso canónico — constructor privado + método `static` que devuelve siempre lo mismo:

```java
public class Config {
    private static Config instancia;
    private Config() {}

    public static Config obtener() {
        if (instancia == null) instancia = new Config();
        return instancia;
    }
}
```

**Cambia de fondo**: en Java el constructor privado sí impide `new` desde fuera — el patrón es una barrera real del lenguaje. En JavaScript no existe constructor privado por defecto (los campos `#privados` no bloquean `new`), así que el Singleton JS es más una **convención** que una garantía. Y *Effective Java* recomienda ni siquiera eso: usar un `enum` con un solo valor. Lo mismo que en Python: a menos que necesites la clase, un objeto único basta.

- ¿Cuál es el umbral para que un Singleton sea legítimo? La configuración global, un pool, una caché — cosas que *deben* ser una sola. Si es cualquier clase que "parece que va a ser una", probablemente estás creando un estado oculto.
- ¿Cómo escapas del problema de los tests? Inyecta la instancia en quien la usa y permite reemplazarla en los tests, en vez de hacer que todos importen el Singleton directamente.

## 3. Builder

### El problema: el constructor con diez parámetros

Cuando un objeto necesita muchas piezas, el constructor posicional se vuelve ilegible. ¿Qué significa esta llamada?

```javascript
const objeto = new Configurable("leer", "escribir", true, 10, "asc", "usuarios")
```

No sabes qué es cada `true` o cada `"asc"` sin ir a leer la firma. El **Builder** reemplaza eso por pasos con nombre: cada pieza del objeto se configura con un método que dice qué hace, y al final una operación `construir()` arma el resultado.

```javascript
class ConsultaSQL {
  constructor() {
    this._select = "*"
    this._from = ""
    this._where = ""
    this._orderBy = ""
    this._limit = ""
  }

  select(campos) {
    this._select = campos
    return this
  }

  from(tabla) {
    this._from = tabla
    return this
  }

  where(condicion) {
    this._where = `WHERE ${condicion}`
    return this
  }

  orderBy(campo) {
    this._orderBy = `ORDER BY ${campo}`
    return this
  }

  limit(n) {
    this._limit = `LIMIT ${n}`
    return this
  }

  construir() {
    return `SELECT ${this._select} FROM ${this._from} ${this._where} ${this._orderBy} ${this._limit}`.replace(/\s+/g, " ").trim()
  }
}

const consulta = new ConsultaSQL()
  .select("nombre, email")
  .from("usuarios")
  .where("activo = true")
  .orderBy("nombre ASC")
  .limit(10)
  .construir()

// SELECT nombre, email FROM usuarios WHERE activo = true ORDER BY nombre ASC LIMIT 10
```

### Ventajas

- Cada paso es opcional y tiene nombre: se lee como una frase, no como un montón de argumentos.
- El mismo proceso de construcción puede producir configuraciones distintas según qué pasos encadenes.
- Si un paso falta, es fácil validarlo en `construir()` y fallar con un error claro (recuerda el capítulo 6).

### Conexión con Python

**Cambia de fondo**: en Python el Builder es raro — y por una buena razón. Los argumentos con palabra clave y valores por defecto ya resuelven el "constructor con diez parámetros":

```python
@dataclass
class Consulta:
    select: str = "*"
    from_: str = ""
    donde: str = ""
    orden: str = ""
    limite: int | None = None

consulta = Consulta(select="nombre, email", from_="usuarios", donde="activo = true")
```

**Traduce exactamente**: si el objeto no es un simple grupo de datos sino que su construcción tiene reglas (pasos obligatorios, órdenes válidos), el Builder sí tiene sentido en Python — simplemente no es el idioma por defecto.

### Conexión con Java

**Traduce exactamente**: en Java el Builder ni siquiera necesita inventarse — está en la librería estándar y probablemente ya lo usaste:

```java
String sql = new StringBuilder()
        .append("SELECT ")
        .append(nombre)
        .append(" FROM usuarios")
        .toString();
```

**Cambia de fondo**: en Java la construcción por pasos es tan habitual que frameworks como Lombok generan builders con una anotación, porque los constructores largos son el problema diario. En JavaScript el idioma natural para objetos de datos es el objeto literal y el spread — el Builder tiene sentido cuando la construcción tiene lógica, no para agrupar campos.

- ¿Builder o objeto literal + `Object.assign`? Si solo agrupas datos, un literal con spread es más JavaScript-idiomático. El builder gana cuando hay pasos obligatorios, validación o representaciones distintas desde la misma plantilla.
- ¿Por qué cada método devuelve `this`? Porque sin eso, el encadenamiento se rompe: `consultar.select(...).from(...)` devolvería `undefined` y el siguiente `.from` lanza un `TypeError`.

## Depuración en la práctica

### Cuándo cada patrón sale mal

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `TypeError: consulta.from is not a function` | Un método del Builder olvidó el `return this` y el encadenamiento se rompió | Devuelve `this` en cada paso |
| Configuración "diferente" en dos archivos | Cada archivo creó su propia instancia en vez de pasar por el Singleton | Centraliza el acceso en `obtenerInstancia()` |
| La factory no hace más que `new` | El patrón se añadió sin ningún criterio de decisión que justificarlo | Añade la decisión o elimina el patrón |

### Escenario 1: el Singleton que arruina los tests

```javascript
class Configuracion {
  static instancia = null
  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = new Configuracion()
    }
    return Configuracion.instancia
  }
  constructor() { this.modo = "produccion" }
}

// test 1
Configuracion.obtenerInstancia().modo = "test"
// test 2
console.log(Configuracion.obtenerInstancia().modo) // "test" — fuga
```

El Singleton es un módulo con estado, y el estado sobrevive entre tests. La solución no es "borrar el Singleton" sino controlar su ciclo de vida: un método `Configuracion.reiniciar()` para los tests, o — mejor — recibir la instancia por parámetro (inyección de dependencias) y reservar el Singleton para quien carga el programa.

### Escenario 2: la factory que no decide nada

```javascript
function crearRepositorio(tipo) {
  return new Repositorio(tipo) // solo envuelve `new` — sin decisión
}
```

Si la factory no recibe un criterio que cambie el resultado, está añadiendo una capa sin motivo: los llamadores ganan una función que no les ahorra nada y esconde la clase real. Antes de crear una factory, pregúntate qué *decisiones* encapsula. Si la respuesta es "ninguna", el `new` directo es más honesto.

## Práctica y ejercicios

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Qué problema concreto resuelve el Factory y cuál es la señal de que lo estás usando sin necesidad?</b></summary>

**Explicación**: resuelve la duplicación de lógica de creación y el acoplamiento del llamador a la clase concreta, centralizando la decisión de "qué instancia devolver". Si solo lo creas en un lugar o no hay criterio que varíe, la señal es clara: no lo necesitas.
</details>

<details>
<summary><b>2. ¿Por qué `con1 === con2` en el Singleton con closure?</b></summary>

**Explicación**: la variable `instancia` vive dentro del closure de la IIFE; la primera llamada la crea y las siguientes la devuelven sin recrear. Como el objeto se crea una sola vez y se guarda ahí, toda llamada posterior devuelve la misma referencia.
</details>

<details>
<summary><b>3. ¿Qué rol juega `return this` en el Builder y qué error produce olvidarlo?</b></summary>

**Explicación**: `return this` devuelve el mismo builder para que la siguiente llamada del encadenamiento funcione. Sin él, el método devuelve `undefined`, el siguiente `.from(...)` se llama sobre `undefined` y salta un `TypeError: Cannot read properties of undefined`.
</details>

<details>
<summary><b>4. ¿Por qué no se puede compartir un Singleton entre `worker_threads`?</b></summary>

**Explicación**: cada worker carga su propio registro de módulos, así que el módulo que contiene la instancia se evalúa de nuevo en cada hilo. El Singleton vive por hilo, no por proceso — no es una vía mágica de comunicación entre hilos.
</details>

<details>
<summary><b>5. ¿Cuál es el equivalente Pythonico del Singleton y por qué no suele necesitar una clase?</b></summary>

**Explicación**: un objeto a nivel de módulo. Python no tiene constructores privados y un `import` ya garantiza una única copia por proceso; la clase Singleton clásica es innecesaria para el caso típico, igual que en JavaScript un `const` a nivel de módulo suele bastar antes de escribir una clase.
</details>

### 2. Explicarlo con tus palabras

> **Reto**: explica a un amigo que viene de Python estos tres patrones con la metáfora de un **restaurante**: el **Factory** es el chef que recibe tu pedido ("algo con pollo") y decide qué plato concreto te trae; el **Singleton** es la única llave del almacén — una sola copia para todo el local; el **Builder** es montar la hamburguesa paso a paso en vez de pedirla en una sola línea gigante. Después explica cuándo cada uno deja de ser útil y se vuelve exceso de ingeniería.
> *Pista: si dudas, relee la [Sección 1](#1-factory), la [Sección 2](#2-singleton) y la [Sección 3](#3-builder).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): `crearNotificacion` con distintos canales

**Objetivo**: implementar tu primer Factory sin clases, con objetos que comparten la misma interfaz.

**Enunciado**: escribe una función `crearNotificacion(tipo, mensaje)` que devuelva:
1. Para `"email"`: un objeto con `canal: "email"` y un método `enviar()` que haga `console.log("Enviando email: " + mensaje)`.
2. Para `"sms"`: lo mismo con `canal: "sms"` y mensaje de SMS.
3. Para cualquier otro tipo: `canal: "push"` por defecto.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa `switch (tipo)` o `if/else` y devuelve un objeto en cada rama.
2. Los tres objetos deben tener la misma forma (`canal` + `enviar`), aunque el mensaje interno cambie.
3. Prueba las tres salidas: `crearNotificacion("email", "Hola")`, `crearNotificacion("sms", "Código 1234")` y `crearNotificacion("weird", "Hola")` — la última debe caer en `push`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
function crearNotificacion(tipo, mensaje) {
  switch (tipo) {
    case "email":
      return {
        canal: "email",
        mensaje,
        enviar() { console.log(`Enviando email: ${this.mensaje}`) }
      }
    case "sms":
      return {
        canal: "sms",
        mensaje,
        enviar() { console.log(`Enviando SMS: ${this.mensaje}`) }
      }
    default:
      return {
        canal: "push",
        mensaje,
        enviar() { console.log(`Enviando push: ${this.mensaje}`) }
      }
  }
}
```

**¿Por qué funciona?** El llamador pide "una notificación" y recibe un objeto con la interface `{ canal, mensaje, enviar }` sin saber cuál es. El criterio ("qué canal") vive en un solo lugar: en vez de repetir la creación en cada parte de la app, un `crearNotificacion` centraliza la decisión y el día que haya un canal nuevo se toca un solo sitio.

</details>

#### Ejercicio 2 (Intermedio): Singleton con configuración congelada

**Objetivo**: convertir una clase en Singleton y proteger su estado con `Object.freeze`.

**Enunciado**: implementa una clase `Configuracion` que:
1. Tenga un método estático `obtenerInstancia()` que devuelva siempre la misma instancia (campo estático `instancia`).
2. El constructor inicialice `puerto = 8080` y `debug = false`.
3. Congele la instancia **antes** de devolverla con `Object.freeze`, para que nadie pueda reasignar sus propiedades.
4. Comprueba que `Configuracion.obtenerInstancia() === Configuracion.obtenerInstancia()` es `true`, y que intentar hacer `config.puerto = 9090` no cambia nada.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Usa el patrón del capítulo: `static instancia = null` + condición en `obtenerInstancia()`.
2. Aplica `Object.freeze(new Configuracion())` y guarda *eso* como la instancia, no el objeto suelto.
3. La congelación es superficial: solo bloquea asignar propiedades existentes; no hace inmutable un `this.debug = ...` si `debug` fuera un objeto anidado.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class Configuracion {
  static instancia = null

  static obtenerInstancia() {
    if (!Configuracion.instancia) {
      Configuracion.instancia = Object.freeze(new Configuracion())
    }
    return Configuracion.instancia
  }

  constructor() {
    this.puerto = 8080
    this.debug = false
  }
}

const a = Configuracion.obtenerInstancia()
const b = Configuracion.obtenerInstancia()
console.log(a === b) // true

try {
  a.puerto = 9090
} catch (error) {
  console.log(error instanceof TypeError) // true — tu código es un módulo (modo estricto)
}
console.log(a.puerto) // 8080
```

**¿Por qué funciona?** `obtenerInstancia()` garantiza la unicidad (se devuelve siempre la misma referencia) y `Object.freeze` la convierte de "única" a "de solo lectura": nadie puede pisar `puerto` o `debug` por accidente. Ojo con un detalle de modo: en un módulo (modo estricto) el intento de escritura sobre un objeto congelado lanza `TypeError`; en código no estricto se ignora en silencio. En ambos casos el valor queda en `8080` — lo que cambia es el aviso. *`Object.freeze` además es superficial: un objeto anidado seguiría siendo mutable.*

</details>

#### Ejercicio 3 (Avanzado): Builder `Consulta` con validación y varios `WHERE`

**Objetivo**: construir un Builder que no solo encadena pasos sino que **valida** en `construir()` y combina varias condiciones.

**Enunciado**: implementa una clase `Consulta` que:
1. Tenga métodos `select(campos)`, `from(tabla)`, `where(condicion)` (acumulando varias), `orderBy(campo)`, `limit(n)` — todos devolviendo `this`.
2. En `construir()` lance un `RangeError` con mensaje claro si no se llamó a `from()` (recuerda el capítulo 6).
3. Combine varias condiciones con ` AND `: `where("activo = true").where("edad > 18")` debe producir `WHERE activo = true AND edad > 18`.
4. Genere exactamente: `SELECT nombre FROM usuarios WHERE activo = true AND edad > 18 ORDER BY nombre ASC LIMIT 10`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Guarda las condiciones en un array (`this._where = []`) y únelas con `.join(" AND ")` al construir.
2. El `RangeError` solo se lanza en `construir()`, no antes: el builder se arma por partes y solo al final sabes si le falta algo.
3. Empieza por un builder de una sola condición (clase del capítulo) y agrégalo a varias condiciones: primero `select + from + where`, luego el resto.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class Consulta {
  constructor() {
    this._select = "*"
    this._from = ""
    this._where = []
    this._orderBy = ""
    this._limit = ""
  }

  select(campos) {
    this._select = campos
    return this
  }

  from(tabla) {
    this._from = tabla
    return this
  }

  where(condicion) {
    this._where.push(condicion)
    return this
  }

  orderBy(campo) {
    this._orderBy = `ORDER BY ${campo}`
    return this
  }

  limit(n) {
    this._limit = `LIMIT ${n}`
    return this
  }

  construir() {
    if (!this._from) {
      throw new RangeError("Consulta sin tabla: llama a .from() antes de construir")
    }

    const where = this._where.length > 0
      ? `WHERE ${this._where.join(" AND ")}`
      : ""

    const sql = `SELECT ${this._select} FROM ${this._from} ${where} ${this._orderBy} ${this._limit}`
    return sql.replace(/\s+/g, " ").trim()
  }
}

const sql = new Consulta()
  .select("nombre")
  .from("usuarios")
  .where("activo = true")
  .where("edad > 18")
  .orderBy("nombre ASC")
  .limit(10)
  .construir()

console.log(sql)
// SELECT nombre FROM usuarios WHERE activo = true AND edad > 18 ORDER BY nombre ASC LIMIT 10

try {
  new Consulta().select("nombre").construir()
} catch (error) {
  console.log(error instanceof RangeError) // true
  console.log(error.message) // Consulta sin tabla: llama a .from() antes de construir
}
```

**¿Por qué funciona?** El array `_where` acumula condiciones y `.join(" AND ")` las combina en el momento exacto en que se construye el SQL; como los pasos son con nombre y `construir()` valida, un SQL incompleto falla **con un error claro y temprano** en vez de producir un `SELECT * FROM  ` que la base rechaza con un error confuso. Nota cómo el `RangeError` reutiliza la lección del capítulo 6: fallar con el tipo correcto y un mensaje accionable.

</details>

## Tabla comparativa entre lenguajes

| Aspecto | JavaScript | Python |
|---|---|---|
| Factory idiomático | Función que devuelve según criterio | `@classmethod` con nombre (`Usuario.admin(...)`) |
| Singleton idiomático | `const` a nivel de módulo o clase con `obtenerInstancia()` | Objeto a nivel de módulo |
| Constructor largo | Objeto literal, spread, o Builder | Argumentos por palabra clave + `@dataclass` |
| ¿Patrón en la stdlib? | No | No (pero `functools` y `dataclasses` cubren el 90 %) |
| Validación de construcción | En `construir()` | En `__post_init__` de dataclasses |

| Aspecto | JavaScript | Java |
|---|---|---|
| Factory | Función simple, sin boilerplate | Método `static` en el que `new` no basta |
| Builder | Se implementa a mano con `return this` | `StringBuilder`, `StringBuffer` y frameworks (Lombok) |
| Singleton garantizado por el lenguaje | No (es convención) | Sí, con constructor privado (o `enum`) |
| Boilerplate | Mínimo — los objetos literales son baratos | Alto — el patrón es casi obligatorio para subtipos |

## Resumen del capítulo

1. **Factory** centraliza la decisión de qué objeto crear: los llamadores dejan de acoplarse a una clase concreta.
2. **Singleton** garantiza una única instancia con un punto de acceso global — pero es estado global, y como tal contamina los tests si no controlas su ciclo de vida.
3. **Builder** reemplaza el constructor con diez parámetros por pasos con nombre que devuelven `this`.
4. En JavaScript los objetos literales y el spread ya resuelven la mitad de lo que en Java pide un Builder; úsalo cuando haya lógica o validación real en la construcción.
5. **Python** resuelve lo mismo con módulos, `@classmethod` y `@dataclass`; **Java** necesita los patrones con más frecuencia porque `new` es rígido.
6. La señal de exceso de ingeniería — en los tres — es el patrón sin decisión que justifique.

## Siguiente Capítulo

→ **[Capítulo 8: Patrones comportamentales y eventos (Observer, Mediator, Strategy)](./cap-08)**: Ahora que sabes controlar cómo se crean los objetos, pasamos a cómo se comunican entre sí: quién escucha eventos, quién reparte tareas y quién decide qué estrategia usar — con sus versiones Python y Java a la vista.