---
title: "Capítulo 9: Arquitecturas de estado (MVC y derivados en Node.js)"
---

# Capítulo 9: Arquitecturas de estado (MVC y derivados en Node.js)

## Introducción

En el capítulo 8 viste cómo los componentes se comunican con Observer, Mediator y Strategy. Pero hay una pregunta más grande cuando la aplicación crece: **¿dónde vive el estado?** ¿Quién guarda los datos, quién decide qué mostrar, y quién responde cuando el usuario pide algo? Si nadie responde esas preguntas, cada ruta acaba haciendo de todo — leer datos, validarlos, formatearlos y responder — y el proyecto se convierte en un monolito donde cambiar cualquier cosa rompe todo.

Las **arquitecturas de estado** responden eso repartiendo responsabilidades en capas:

- **MVC** separa los datos (modelo), la lógica de respuesta (controlador) y la presentación (vista).
- **La capa de servicio** evita que el controlador engorde con lógica de negocio.
- **MVVM** hace que el estado sea *observable*: las vistas se enteran solas de los cambios (retomando el Observer del capítulo 8).

Como siempre, verás el problema concreto detrás de cada idea y la versión que Python y Java le dan — porque en este tema los tres lenguajes maduraron dominios distintos: Node con Express, Python con Django/Flask y Java con Spring MVC.

## 1. Modelo-Vista-Controlador (MVC)

### El problema: una ruta que hace de todo

La forma más directa de programar una ruta junta en el mismo bloque la lectura de datos, su transformación y la respuesta:

```javascript
app.get("/usuarios", (req, res) => {
  const datos = JSON.parse(fs.readFileSync("usuarios.json", "utf8"))
  const usuarios = datos.map(u => ({ id: u.id, nombre: u.nombre }))
  res.json(usuarios)
})
```

Con dos rutas funciona. Con veinte, cada handler repite la lectura del archivo, la transformación y el manejo de errores — y el día que cambias el almacenamiento o añades una respuesta nueva, tocas todas. **MVC** responde con tres capas de una responsabilidad cada una:

- **Modelo**: los datos y sus reglas (dónde viven, cómo se buscan, qué se puede crear).
- **Vista**: cómo se presentan los datos (HTML, JSON).
- **Controlador**: recibe la petición, consulta al modelo y devuelve la vista.

El ejemplo clásico en Express:

```javascript
class UsuarioModel {
  constructor() {
    this.usuarios = [
      { id: 1, nombre: "David", email: "david@ejemplo.com" },
      { id: 2, nombre: "Ana", email: "ana@ejemplo.com" }
    ]
  }

  obtenerTodos() {
    return this.usuarios
  }

  obtenerPorId(id) {
    return this.usuarios.find(u => u.id === Number(id))
  }

  crear(datos) {
    const nuevo = { id: Date.now(), ...datos }
    this.usuarios.push(nuevo)
    return nuevo
  }
}

class UsuarioController {
  constructor(modelo) {
    this.modelo = modelo
  }

  index(req, res) {
    res.json(this.modelo.obtenerTodos())
  }

  show(req, res) {
    const usuario = this.modelo.obtenerPorId(req.params.id)
    if (!usuario) return res.status(404).json({ error: "No encontrado" })
    res.json(usuario)
  }

  create(req, res) {
    const nuevo = this.modelo.crear(req.body)
    res.status(201).json(nuevo)
  }
}

const express = require("express")
const app = express()
app.use(express.json())

const modelo = new UsuarioModel()
const controller = new UsuarioController(modelo)

app.get("/usuarios", (req, res) => controller.index(req, res))
app.get("/usuarios/:id", (req, res) => controller.show(req, res))
app.post("/usuarios", (req, res) => controller.create(req, res))

app.listen(3000)
```

El controlador no sabe cómo se guardan los datos; el modelo no sabe qué es una petición HTTP. Prueba el modelo aislado con `node` y verás que no depende de Express en absoluto — esa independencia es exactamente el punto.

### Conexión con Python

**Cambia de fondo**: Django también separa en capas, pero las llama distinto: es **MVT** (Model-View-Template). Su "vista" hace de controlador y las plantillas hacen de vista.

```python
# models.py
class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    email = models.EmailField()

# views.py — la "vista" de Django actúa como controlador
from django.http import JsonResponse
from django.views import View

class UsuarioView(View):
    def get(self, request, id=None):
        if id:
            usuario = Usuario.objects.get(id=id)
            return JsonResponse({"nombre": usuario.nombre, "email": usuario.email})
        return JsonResponse(list(Usuario.objects.all().values()), safe=False)

    def post(self, request):
        datos = json.loads(request.body)
        usuario = Usuario.objects.create(**datos)
        return JsonResponse({"id": usuario.id, "nombre": usuario.nombre}, status=201)
```

**Traduce exactamente**: la división de responsabilidades es idéntica a Express; lo que cambia es el nombre. Django además trae el ORM de fábrica (`Usuario.objects`), mientras que en Express eliges tú cómo guardar los datos — el modelo del capítulo lo hace en memoria. Flask, por su lado, es un punto medio: rutas como Express pero con un ORM opcional (SQLAlchemy).

### Conexión con Java

**Traduce exactamente**: aquí el MVC web es el estándar de la industria. Spring MVC lo resuelve con anotaciones, no con clases a mano:

```java
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioModel modelo;

    public UsuarioController(UsuarioModel modelo) { // inyección por constructor
        this.modelo = modelo;
    }

    @GetMapping
    public List<Usuario> index() {
        return modelo.obtenerTodos();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> show(@PathVariable Long id) {
        return modelo.obtenerPorId(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
```

**Cambia de fondo**: el web MVC nació en Smalltalk-80 (Trygve Reenskaug, 1979) y Java lo popularizó: cuando dices "MVC", mucha gente piensa en Spring. La diferencia práctica es que Spring **te obliga** a la separación con anotaciones y su ciclo de vida (cada petición pasa por el framework), mientras que en Node/Express la separación la escribes tú a mano — por eso conviene entenderla bien: nadie la pondrá por ti.

### Ventajas

- Separación de responsabilidades: cada capa se prueba aislada.
- El modelo no sabe de HTTP: se reutiliza en CLI, tests y otros protocolos.
- Las vistas cambian sin tocar la lógica de datos.

### Derivados

- **MVP** (Model-View-Presenter): un presentador media entre el modelo y una vista pasiva.
- **MVVM** (Model-View-ViewModel): un ViewModel expone un estado observable a la vista (lo vemos en la sección 3; es la base de Vue, Angular y React con cierto parecido).

## 2. La capa de servicio (y el Repository)

### El problema: el controlador que hace de todo

Es tan fácil que el controlador acumule trabajo que termina haciendo validación, lógica de negocio y hasta envío de emails:

```javascript
class UsuarioController {
  crear(req, res) {
    if (!req.body.email) {
      return res.status(400).json({ error: "Email requerido" })
    }

    const existente = db.buscarPorEmail(req.body.email)
    if (existente) {
      return res.status(409).json({ error: "El email ya existe" })
    }

    const usuario = db.crear({
      ...req.body,
      password: bcrypt.hashSync(req.body.password, 10)
    })

    emailService.enviarBienvenida(usuario.email)
    res.status(201).json(usuario)
  }
}
```

El controlador ahora conoce la base de datos, el encriptado y el servicio de email: cada test necesitaría simularlos todos. La **capa de servicio** extrae esa lógica a su propio objeto, y el controlador queda como un traductor delgadísimo entre HTTP y servicios:

```javascript
class UsuarioService {
  constructor(repositorio, emailService) {
    this.repositorio = repositorio
    this.emailService = emailService
  }

  crear(datos) {
    this.validar(datos)
    const existente = this.repositorio.buscarPorEmail(datos.email)
    if (existente) throw new Error("El email ya existe")

    const usuario = this.repositorio.crear({
      ...datos,
      password: bcrypt.hashSync(datos.password, 10)
    })

    this.emailService.enviarBienvenida(usuario.email)
    return usuario
  }
}

class UsuarioController {
  constructor(servicio) {
    this.servicio = servicio
  }

  async crear(req, res, next) {
    try {
      const usuario = await this.servicio.crear(req.body)
      res.status(201).json(usuario)
    } catch (error) {
      next(error)
    }
  }
}
```

Los parámetros de `UsuarioService` son las **dependencias**: en JavaScript las pasas por el constructor (`new UsuarioService(repositorio, emailService)`) — es la inyección de dependencias más simple que existe.

### Repository: despegar el modelo de la base de datos

Si el modelo hace `require("./database")` por dentro, cambiarlo por otra base es cirugía. El **Repository** es la capa que aísla el acceso a datos detrás de una interfaz estable:

```javascript
class UsuarioRepository {
  constructor(database) {
    this.database = database
  }

  buscarPorEmail(email) {
    return this.database.usuarios.buscar({ email })
  }

  crear(datos) {
    return this.database.usuarios.crear(datos)
  }
}
```

### Conexión con Python

**Traduce exactamente**: en Python la capa de servicio se implementa igual, con clases que reciben sus dependencias por el constructor. La diferencia es de costumbre: los frameworks como Django fomentan que la lógica viva en los managers del modelo o en la propia vista, así que crear un `UsuarioService` explícito es opcional — pero es la misma recomendación cuando el controlador engorda.

**Cambia de fondo**: en Python el Repository casi siempre está incluido en el framework: el ORM de Django (`objects`) o Flask-SQLAlchemy ya son el repositorio. Tú rara vez escribes interfaces de acceso; consultas al ORM directo. En JavaScript no hay ORM oficial: o usas uno de terceros (Prisma, Knex) o escribes el Repository a mano — por eso aquí el patrón se nota más.

### Conexión con Java

**Traduce exactamente**: en Java esto es el idioma natural del framework. Spring trae las capas como anotaciones (`@Service`, `@Repository`) y la inyección de dependencias de fábrica:

```java
@Service
public class UsuarioService {
    private final UsuarioRepository repositorio;

    public UsuarioService(UsuarioRepository repositorio) { // Spring lo inyecta solo
        this.repositorio = repositorio;
    }
}
```

**Cambia de fondo**: en Java el framework conecta las piezas solo (el contenedor de Spring inyecta el repository en el constructor, con `@Autowired` o la convención de un solo constructor). En JavaScript/Express esa conexión es manual — pasas las dependencias tú al construir cada objeto. Simple, directo y sin magia: ventaja para aprender, aunque el boilerplate se nota en aplicaciones grandes.

## 3. MVVM: el estado como algo observable

### El problema: dos vistas con el mismo estado, desincronizadas

Si la pantalla web y el panel del cliente muestran las mismas tareas y cada uno las refresca por su cuenta, terminan diciendo cosas distintas. Hace falta un lugar único donde el estado viva y que **avise cuando cambie** — el Observer del capítulo 8 aplicado al estado. Ese lugar es el **ViewModel**: el estado de presentación, observable y con un mecanismo para suscribirse a sus propiedades.

```javascript
class TareaViewModel {
  constructor() {
    this.suscriptores = new Map()
    this.estado = {
      tareas: [],
      filtro: "todas",
      estadisticas: { total: 0, completadas: 0, pendientes: 0 }
    }

    this.estadoProxy = new Proxy(this.estado, {
      set: (objeto, propiedad, valor) => {
        objeto[propiedad] = valor
        this.notificarCambio(propiedad, valor)
        return true
      }
    })
  }

  suscribir(propiedad, callback) {
    if (!this.suscriptores.has(propiedad)) {
      this.suscriptores.set(propiedad, [])
    }
    this.suscriptores.get(propiedad).push(callback)
    return () => {
      const callbacks = this.suscriptores.get(propiedad)
      const indice = callbacks.indexOf(callback)
      if (indice !== -1) callbacks.splice(indice, 1)
    }
  }

  notificarCambio(propiedad, valor) {
    this.suscriptores.get(propiedad)?.forEach(callback => callback(valor))
  }

  cargarTareas(tareas) {
    this.estadoProxy.tareas = tareas
    this.actualizarEstadisticas()
  }

  actualizarEstadisticas() {
    const tareas = this.estadoProxy.tareas
    this.estadoProxy.estadisticas = {
      total: tareas.length,
      completadas: tareas.filter(t => t.completada).length,
      pendientes: tareas.filter(t => !t.completada).length
    }
  }
}

const vm = new TareaViewModel()

const desuscribirLista = vm.suscribir("tareas", (tareas) => {
  console.log(`La vista web muestra ${tareas.length} tareas`)
})
const desuscribirStats = vm.suscribir("estadisticas", (estadisticas) => {
  console.log(`Panel: ${estadisticas.pendientes} pendientes / ${estadisticas.total} total`)
})

vm.cargarTareas([
  { titulo: "Comprar pan", completada: false },
  { titulo: "Pagar la luz", completada: true }
])
// La vista web muestra 2 tareas
// Panel: 1 pendientes / 2 total
```

Cada vez que asignas `estadoProxy.tareas` o `.estadisticas`, el `Proxy` intercepta el `set`, actualiza el objeto real y **notifica a todos los suscriptores**. Cambias una pantalla, se actualizan todas; importa el mecanismo de desuscripción del capítulo 8 para no acumular suscriptores.

### Conexión con Python

**Traduce exactamente**: Python logra el mismo observable con propiedades que notifican al asignarse:

```python
class TareaViewModel:
    def __init__(self):
        self._tareas = []
        self._suscriptores = {}

    @property
    def tareas(self):
        return self._tareas

    @tareas.setter
    def tareas(self, valor):
        self._tareas = valor
        self._notificar("tareas", valor)
```

**Cambia de fondo**: Python no tiene `Proxy` — los `@property` y `@property.setter` cubren el caso más común, y librerías como `streams` o frameworks traen lo parecido a un ViewModel reactivo (el propio Django Channels para estado en tiempo real). El mecanismo de suscriptores por diccionario es el que ya viste en el capítulo 8.

### Conexión con Java

**Traduce exactamente**: Java también tiene proxies dinámicos (`java.lang.reflect.Proxy`), aunque casi nunca los uses a mano: el ViewModel con observables está resuelto en el mundo Android con `ViewModel` + `LiveData`, y en el backend con Reactor / el patrón de estados observables del mismo estilo que tu `tareas`.

```java
class ControladorUI {
    private ObservableList<Tarea> tareas = FXCollections.observableArrayList();
}
```

**Cambia de fondo**: el ejemplo de arriba es el ViewModel de la UI de escritorio de Java (JavaFX: `ObservableList`) — objetos que avisan solos a quien los escucha. En JavaScript el `Proxy` te da esa capacidad en tres líneas y se usa en Vue y en React antes de transformar; en Java el mecanismo está repartido en `ObservableList`, `LiveData` y los flujos de Reactor. El concepto del capítulo 8 — suscribirse y ser notificado — está en los tres.

## Depuración en la práctica

### Cuándo la arquitectura sale mal

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| El controlador tiene 200 líneas y cada test necesita una base de datos | Fat controller: toda la lógica vive en el handler | Extraer a un servicio y pasar las dependencias por constructor |
| Cambiar de base de datos rompe todo el modelo | El modelo hace `require("./database")` por dentro | Aislar el acceso a datos en un Repository |
| La vista consulta el modelo directo | Se saltó el controlador/ViewModel | Pasar la consulta por la capa de enlace correspondiente |
| Dos pantallas muestran datos distintos del mismo estado | Cada una refresca por su cuenta | Estado observable único (ViewModel) con suscripción |

### Escenario 1: el controlador gordo

El ejemplo de fat controller de la sección 2 es un caso real: validación, duplicado, encriptado y email dentro de `crear`. ¿Qué pasa cuando el test quiere probar "el email no se envía dos veces"? Necesita una base de datos real, bcrypt y un servicio de email. Ese acoplamiento hace que cada test sea lento y frágil.

El arreglo visto arriba — `UsuarioService` que recibe `repositorio` y `emailService` por el constructor — deja el test trivial: le pasas un repositorio de mentira (un objeto con `buscarPorEmail` que devuelva `null`) y un email que acumule los envíos, sin tocar ninguna base de datos ni enviar nada real.

### Escenario 2: el modelo pegado a la base de datos

```javascript
class UsuarioModel {
  constructor() {
    this.db = require("./database") // acoplamiento directo
  }

  crear(datos) {
    return this.db.query("INSERT INTO usuarios ...", datos)
  }
}
```

El modelo primero se prueba fácil, y entonces alguien añade `this.db` dentro del constructor "para probar". El día que la base cambie (PostgreSQL a Redis, o un servicio externo), hay que tocar el modelo. La solución es el `UsuarioRepository` de la sección 2 con inyección del `database` por constructor: el modelo deja de saber *cómo* se guarda y solo sabe *qué* necesita. En los tests, el repository se sustituye por un objeto que devuelve datos fijos — sin conexiones reales.

## Práctica y ejercicios

### 1. Preguntas de repaso

<details>
<summary><b>1. ¿Qué responsabilidad tiene cada capa de MVC y por qué no deben mezclarse?</b></summary>

**Explicación**: el modelo guarda datos y reglas, la vista presenta, el controlador coordina petición → modelo → respuesta. No se mezclan porque la independencia es lo que permite probar cada capa por separado y cambiar una sin romper las otras.
</details>

<details>
<summary><b>2. ¿Cuál es la diferencia de nombres entre Express y Django?</b></summary>

**Explicación**: Express es MVC clásico (controlador explícito); Django usa MVT, donde su "vista" hace de controlador y las plantillas hacen de vista. La separación de responsabilidades es la misma, solo cambia la etiqueta.
</details>

<details>
<summary><b>3. ¿Qué señales indican que un controlador se volvió gordo?</b></summary>

**Explicación**: valida, consulta la base, encripta, envía emails y formatea la respuesta en el mismo método; los tests precisan simular todas esas piezas. La solución es mover esa lógica a una capa de servicio.
</details>

<details>
<summary><b>4. ¿Qué hace el patrón Repository y cómo se conecta con la inyección de dependencias?</b></summary>

**Explicación**: aísla el acceso a datos detrás de una interfaz estable para que el modelo no dependa de una base concreta. Se conecta con la inyección porque pasa esa dependencia por el constructor: `new Service(repository)`, lo que permite sustituirla en tests.
</details>

<details>
<summary><b>5. En MVVM, ¿quién notifica a las vistas y con qué mecanismo del capítulo 8?</b></summary>

**Explicación**: el ViewModel guarda el estado observable (con `Proxy` en JavaScript) y notifica a los suscriptores cuando cambia — exactamente el patrón Observer: `suscribir` devuelve una función de desuscripción y cada vista recibe el nuevo valor al asignarse.
</details>

### 2. Explicarlo con tus palabras

> **Reto**: explica a un amigo que viene de Python cómo funciona MVC usando la metáfora de una **oficina de atención al cliente**: el **controlador** es el recepcionista que recibe la solicitud y devuelve el resultado, pero no hace el trámite; el **modelo** es el archivo central con los datos y sus reglas; la **vista** es la vitrina donde se muestra el resultado. Si el trámite es complejo, el recepcionista lo pasa a un departamento (la **capa de servicio**). Después explica: ¿qué pasa si el recepcionista empieza a hacer los trámites él mismo (fat controller)? ¿Y si la vitrina consulta el archivo directo?
> *Pista: si dudas, relee la [Sección 1](#1-modelo-vista-controlador-mvc), la [Sección 2](#2-la-capa-de-servicio-y-el-repository) y la [Sección 3](#3-mvvm-el-estado-como-algo-observable).*

---

### 3. Ejercicios de código progresivos

#### Ejercicio 1 (Básico): CRUD de tareas con MVC

**Objetivo**: implementar las tres capas de MVC para un API de tareas en memoria y verificar el flujo modelo → controlador.

**Enunciado**: crea una `TareaModel` con `obtenerTodas`, `obtenerPorId`, `crear`, `actualizar` y `eliminar` sobre un array en memoria; y un `TareaController` con `index`, `show`, `create`, `update` y `delete` que respondan `200/201/404` con JSON. Las rutas Express las limitas a lo mínimo (`/tareas` y `/tareas/:id`).

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. El modelo es idéntico al de la sección 1, cambiando `usuarios` por `tareas` y con `id: Date.now()` al crear.
2. El controlador recibe el modelo por el constructor y usa `req.params.id` con `Number(id)` para buscar.
3. `actualizar` usa `Object.assign` sobre la tarea encontrada; `delete` que devuelva `null` si no existe.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class TareaModel {
  constructor() {
    this.tareas = []
  }

  obtenerTodas() {
    return this.tareas
  }

  obtenerPorId(id) {
    return this.tareas.find(t => t.id === Number(id))
  }

  crear(datos) {
    const nuevaTarea = {
      id: Date.now(),
      titulo: datos.titulo,
      completada: false,
      fechaCreacion: new Date()
    }
    this.tareas.push(nuevaTarea)
    return nuevaTarea
  }

  actualizar(id, datos) {
    const tarea = this.obtenerPorId(id)
    if (tarea) Object.assign(tarea, datos)
    return tarea
  }

  eliminar(id) {
    const indice = this.tareas.findIndex(t => t.id === Number(id))
    return indice !== -1 ? this.tareas.splice(indice, 1)[0] : null
  }
}

class TareaController {
  constructor(modelo) {
    this.modelo = modelo
  }

  index(req, res) {
    res.json(this.modelo.obtenerTodas())
  }

  show(req, res) {
    const tarea = this.modelo.obtenerPorId(req.params.id)
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" })
    res.json(tarea)
  }

  create(req, res) {
    res.status(201).json(this.modelo.crear(req.body))
  }

  update(req, res) {
    const tarea = this.modelo.actualizar(req.params.id, req.body)
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" })
    res.json(tarea)
  }

  delete(req, res) {
    const tarea = this.modelo.eliminar(req.params.id)
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" })
    res.json({ mensaje: "Tarea eliminada", tarea })
  }
}

// Prueba sin Express: simula req/res
const controller = new TareaController(new TareaModel())

controller.create({ body: { titulo: "Comprar pan" } }, {
  status: function (codigo) { this.statusCode = codigo; return this },
  json: function (cuerpo) { this.cuerpo = cuerpo }
})

controller.index({}, {
  json: function (cuerpo) { console.log(cuerpo.length) } // 1
})
```

**¿Por qué funciona?** El modelo gestiona datos sin saber nada de HTTP y el controlador traduce petición → modelo → respuesta sin saber nada de almacenamiento. Fíjate en el test: con un `req` y `res` de mentira (objetos con `body`/`status`/`json`) pruebas todo el CRUD sin levantar ningún servidor — esa es la ventaja práctica de la separación de capas.

</details>

#### Ejercicio 2 (Intermedio): validación en el modelo y presentación formateada

**Objetivo**: añadir reglas de negocio al modelo y separar el formato de la respuesta en un presentador.

**Enunciado**: extiende la `TareaModel` para que:
1. `validarTitulo(titulo)` lance `Error` con mensaje claro si no es un string, está vacío o supera 100 caracteres (recuerda el capítulo 6).
2. `crear` y `actualizar` validen antes de guardar, devolviendo el título recortado.
3. Un `TareaPresentador` con `formatearTarea` que añada un campo `resumen` (`"Titulo - Completada/Pendiente"`) y `formatearLista`.
4. El controlador use el presentador en `index` y `create`.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Valida antes de asignar: `throw new Error("El título es requerido")` para casos inválidos, y devuelve `titulo.trim()` al final.
2. El presentador puede ser una clase con métodos `static` que no guarde estado.
3. El `resumen` sale de `tarea.titulo` y `tarea.completada`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class TareaModel {
  constructor() {
    this.tareas = []
  }

  validarTitulo(titulo) {
    if (typeof titulo !== "string" || titulo.trim().length === 0) {
      throw new Error("El título es requerido")
    }
    if (titulo.length > 100) {
      throw new Error("El título no puede exceder 100 caracteres")
    }
    return titulo.trim()
  }

  crear(datos) {
    const tarea = {
      id: Date.now(),
      titulo: this.validarTitulo(datos.titulo),
      completada: false,
      fechaCreacion: new Date()
    }
    this.tareas.push(tarea)
    return tarea
  }

  actualizar(id, datos) {
    const tarea = this.obtenerPorId(id)
    if (tarea && datos.titulo !== undefined) {
      tarea.titulo = this.validarTitulo(datos.titulo)
    }
    return tarea
  }
}

class TareaPresentador {
  static formatearTarea(tarea) {
    return {
      ...tarea,
      resumen: `${tarea.titulo} - ${tarea.completada ? "Completada" : "Pendiente"}`
    }
  }

  static formatearLista(tareas) {
    return tareas.map(tarea => TareaPresentador.formatearTarea(tarea))
  }
}

class TareaController {
  constructor(modelo) {
    this.modelo = modelo
  }

  index(req, res) {
    res.json(TareaPresentador.formatearLista(this.modelo.obtenerTodas()))
  }

  create(req, res, next) {
    try {
      const tarea = this.modelo.crear(req.body)
      res.status(201).json(TareaPresentador.formatearTarea(tarea))
    } catch (error) {
      next(error)
    }
  }
}

try {
  new TareaModel().crear({ titulo: "   " }) // lanza "El título es requerido"
} catch (error) {
  console.log(error.message) // El título es requerido
}
```

**¿Por qué funciona?** Las reglas de negocio viven en el modelo (lo que las hace probables aisladas) y el formato vive en el presentador (que no guarda estado). El controlador queda con una sola responsabilidad: traducir. El `trim()` garantiza que "  Comprar pan  " se guarde como "Comprar pan", y el error con mensaje claro se propaga al middleware del capítulo 6 para responder con formato consistente.

</details>

#### Ejercicio 3 (Avanzado): ViewModel reactivo con Proxy y Observer

**Objetivo**: construir un estado observable estilo MVVM en el que asignar el estado notifica solo a los suscriptores interesados.

**Enunciado**: completa un `TareaViewModel` (como el de la sección 3) que:
1. Exponga `estadoProxy` con `tareas` y `filtro`.
2. `suscribir(propiedad, callback)` devuelva una función de desuscripción.
3. `crearTarea(datos)` añada al modelo y actualice `estadoProxy.tareas`.
4. `filtrarTareas()` devuelva según `filtro` (`todas`, `completadas`, `pendientes`).
5. Comprueba que al cambiar `filtro`, el suscriptor al `filtro` se avisa pero el de `tareas` no.

<details class="spoiler spoiler-pistas">
<summary>💡 Ver pistas</summary>

1. Coloca el `new Proxy` sobre un objeto de estado y usa el `set` del Proxy para llamar a `notificarCambio`.
2. Los suscriptores se guardan en un `Map` propiedad → array; la desuscripción borra el callback con `indexOf`/`splice`.
3. `filtrarTareas` usa `switch` sobre `this.estadoProxy.filtro`; para el `set` del Proxy no necesita escribir — leer siempre funciona.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 Ver solución explicada</summary>

```javascript
class TareaViewModel {
  constructor(modelo) {
    this.modelo = modelo
    this.suscriptores = new Map()
    this.estado = { tareas: [], filtro: "todas" }

    this.estadoProxy = new Proxy(this.estado, {
      set: (objeto, propiedad, valor) => {
        objeto[propiedad] = valor
        this.notificarCambio(propiedad, valor)
        return true
      }
    })
  }

  suscribir(propiedad, callback) {
    if (!this.suscriptores.has(propiedad)) {
      this.suscriptores.set(propiedad, [])
    }
    this.suscriptores.get(propiedad).push(callback)
    return () => {
      const callbacks = this.suscriptores.get(propiedad)
      const indice = callbacks.indexOf(callback)
      if (indice !== -1) callbacks.splice(indice, 1)
    }
  }

  notificarCambio(propiedad, valor) {
    this.suscriptores.get(propiedad)?.forEach(callback => callback(valor))
  }

  crearTarea(datos) {
    const tarea = this.modelo.crear(datos)
    this.estadoProxy.tareas = this.modelo.obtenerTodas()
    return tarea
  }

  filtrarTareas() {
    switch (this.estadoProxy.filtro) {
      case "completadas":
        return this.estado.tareas.filter(t => t.completada)
      case "pendientes":
        return this.estado.tareas.filter(t => !t.completada)
      default:
        return this.estado.tareas
    }
  }
}

const modelo = {
  _tareas: [],
  crear(datos) {
    const tarea = { id: Date.now(), titulo: datos.titulo, completada: false }
    this._tareas.push(tarea)
    return tarea
  },
  obtenerTodas() {
    return this._tareas
  }
}

const vm = new TareaViewModel(modelo)

const avisosFiltro = []
const desuscribirFiltro = vm.suscribir("filtro", filtro => avisosFiltro.push(filtro))

const avisosTareas = []
vm.suscribir("tareas", tareas => avisosTareas.push(tareas.length))

vm.crearTarea({ titulo: "Comprar pan" })
vm.estadoProxy.filtro = "pendientes"

console.log(avisosFiltro) // ["pendientes"] — solo el suscriptor de filtro
console.log(avisosTareas) // [1] — el de tareas avisó al crear

desuscribirFiltro()
vm.estadoProxy.filtro = "completadas"
console.log(avisosFiltro) // ["pendientes"] — la desuscripción funcionó
```

**¿Por qué funciona?** El `Proxy` intercepta **solo escrituras**: asignar `estadoProxy.filtro` dispara el `set`, que guarda el valor real y notifica únicamente al mapa de `filtro`. Suscribir por propiedad evita que cada cambio repinte todas las pantallas — retomando el Observer del capítulo 8 con desuscripción devuelta por `suscribir`. Reescribe `estadoProxy.tareas` tras crear para que el array nuevo se propague también.

</details>

## Tabla comparativa entre lenguajes

| Aspecto | JavaScript (Node/Express) | Python (Django/Flask) |
|---|---|---|
| Arquitectura | MVC clásico con controlador explícito | MVT (la "vista" de Django es el controlador) |
| Modelo | Clase propia o ORM de terceros (Prisma/Knex) | ORM incluido (Django `objects`, SQLAlchemy) |
| Rutas | `app.get("/ruta", handler)` | `urlpatterns` (Django) o `@app.route` (Flask) |
| Capa de servicio | Se escribe a mano (clase + constructor) | Opcional; suele vivir en la vista o en managers |
| ViewModel reactivo | `Proxy` + Observer (a mano) | `@property`/setters o librerías de streams |

| Aspecto | JavaScript (Node/Express) | Java (Spring MVC) |
|---|---|---|
| MVC | Lo escribes tú, capa por capa | El framework lo impone con anotaciones |
| Inyección de dependencias | Manual (por constructor) | Automática (contenedor de Spring) |
| Repository | Mano, con `database` inyectada | Spring Data JPA genera las interfaces por ti |
| Estado observable | `Proxy` en tres líneas | `ObservableList`, `LiveData`, Reactor |
| Boilerplate | Nulo — pero la disciplina es tuya | Alto — pero el esqueleto está garantizado |

## Resumen del capítulo

1. **MVC** reparte el estado en tres capas: modelo (datos y reglas), vista (presentación) y controlador (coordinación).
2. En **Express** esa separación la escribes tú; en **Django** llega con otro nombre (MVT) y en **Spring** la impone el framework.
3. El **fat controller** es la señal de que la lógica de negocio se fugó del modelo; la **capa de servicio** la vuelve a su sitio.
4. El **Repository** aísla el acceso a datos y, con la inyección por constructor, deja el modelo testeable sin base de datos real.
5. **MVVM** convierte el estado en algo observable: el ViewModel (`Proxy` + Observer) notifica solo a los suscriptores de la propiedad que cambió.
6. La desuscripción vuelve a ser clave: un estado observable sin unsubscribe acumula listeners (capítulo 8).
7. En los tres lenguajes el patrón de fondo es el mismo — estado, lógica y presentación no conviven en la misma función.

## Siguiente Capítulo

→ **[Capítulo 10: Seguridad defensiva](./cap-10)**: Ahora que sabes organizar el estado de la aplicación, pasamos a protegerlo: qué es la inyección, cómo sanitizar entradas, el prototype pollution y las reglas de OWASP — con sus versiones Python y Java a la vista.