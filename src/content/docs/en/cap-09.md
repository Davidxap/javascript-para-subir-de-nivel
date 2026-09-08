---
title: "Chapter 9: State Architectures (MVC and Derivatives in Node.js)"
---

# Chapter 9: State Architectures (MVC and Derivatives in Node.js)

## Introduction

In chapter 8 you saw how components communicate with Observer, Mediator and Strategy. But there is a bigger question as the application grows: **where does the state live?** Who holds the data, who decides what to show, and who responds when the user asks for something? If nobody answers those questions, every route ends up doing everything — reading data, validating it, formatting and responding — and the project turns into a monolith where changing anything breaks everything.

**State architectures** answer that by splitting responsibilities into layers:

- **MVC** separates the data (model), the response logic (controller) and the presentation (view).
- **The service layer** keeps the controller from bloating with business logic.
- **MVVM** makes the state *observable*: views find out on their own when it changes (building on the Observer from chapter 8).

As always, you'll see the concrete problem behind each idea and the version Python and Java give it — because here the three languages matured in different domains: Node with Express, Python with Django/Flask and Java with Spring MVC.

## 1. Model-View-Controller (MVC)

### The problem: a route that does everything

The most direct way to write a route puts data reading, transformation and the response in the same block:

```javascript
app.get("/usuarios", (req, res) => {
  const datos = JSON.parse(fs.readFileSync("usuarios.json", "utf8"))
  const usuarios = datos.map(u => ({ id: u.id, nombre: u.nombre }))
  res.json(usuarios)
})
```

With two routes it works. With twenty, each handler repeats the file read, the transformation and the error handling — and the day you change the storage or add a new response, you touch all of them. **MVC** answers with three layers of one responsibility each:

- **Model**: the data and its rules (where it lives, how it is looked up, what can be created).
- **View**: how the data is presented (HTML, JSON).
- **Controller**: receives the request, asks the model and returns the view.

The classic example in Express:

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

The controller has no idea how the data is stored; the model has no idea what an HTTP request is. Try the model on its own with `node` and you'll see it does not depend on Express at all — that independence is exactly the point.

### Connection with Python

**Change of scene**: Django also separates into layers, but calls them differently: it is **MVT** (Model-View-Template). Its "view" plays the role of a controller and the templates play the view.

```python
# models.py
class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    email = models.EmailField()

# views.py — Django's "view" acts as a controller
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

**Literal translation**: the split of responsibilities is identical to Express; what changes is the name. Django also ships the ORM out of the box (`Usuario.objects`), while in Express you choose how to store data yourself — this chapter's model keeps it in memory. Flask, for its part, is a middle ground: routes like Express but with an optional ORM (SQLAlchemy).

### Connection with Java

**Literal translation**: here the web MVC is the industry standard. Spring MVC handles it with annotations, not with hand-written classes:

```java
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioModel modelo;

    public UsuarioController(UsuarioModel modelo) { // constructor injection
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

**Change of scene**: the web MVC was born in Smalltalk-80 (Trygve Reenskaug, 1979) and Java popularized it: when you say "MVC", a lot of people think of Spring. The practical difference is that Spring **forces** the separation on you with annotations and its own lifecycle (every request goes through the framework), while in Node/Express you write the separation by hand — which is exactly why it's worth understanding well: nobody will add it for you.

### Advantages

- Separation of responsibilities: each layer is tested in isolation.
- The model knows nothing about HTTP: it is reused in CLIs, tests and other protocols.
- Views change without touching the data logic.

### Derivatives

- **MVP** (Model-View-Presenter): a presenter mediates between the model and a passive view.
- **MVVM** (Model-View-ViewModel): a ViewModel exposes an observable state to the view (we look at it in section 3; it is the base of Vue, Angular and, partly, React).

## 2. The service layer (and the Repository)

### The problem: the controller that does everything

It is so easy for the controller to pile up work that it ends up doing validation, business logic and even sending emails:

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

The controller now knows the database, the encryption and the email service: every test would need to mock all of them. The **service layer** extracts that logic into its own object, and the controller stays as a paper-thin translator between HTTP and services:

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

The parameters of `UsuarioService` are the **dependencies**: in JavaScript you pass them through the constructor (`new UsuarioService(repositorio, emailService)`) — that's the simplest dependency injection there is.

### Repository: ungluing the model from the database

If the model calls `require("./database")` internally, switching to another database is surgery. The **Repository** is the layer that isolates data access behind a stable interface:

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

### Connection with Python

**Literal translation**: in Python the service layer is implemented the same way, with classes that receive their dependencies through the constructor. The difference is one of habit: frameworks like Django encourage logic to live in the model's managers or in the view itself, so writing an explicit `UsuarioService` is optional — but it's the same recommendation when the controller bloats.

**Change of scene**: in Python the Repository is almost always included in the framework: Django's ORM (`objects`) or Flask-SQLAlchemy *are* the repository. You rarely write access interfaces; you just query the ORM. In JavaScript there is no official ORM: either you use a third-party one (Prisma, Knex) or you write the Repository by hand — which is why the pattern stands out more here.

### Connection with Java

**Literal translation**: in Java this is the framework's native language. Spring brings the layers as annotations (`@Service`, `@Repository`) and dependency injection out of the box:

```java
@Service
public class UsuarioService {
    private final UsuarioRepository repositorio;

    public UsuarioService(UsuarioRepository repositorio) { // Spring injects it for you
        this.repositorio = repositorio;
    }
}
```

**Change of scene**: in Java the framework wires the pieces together on its own (Spring's container injects the repository into the constructor, via `@Autowired` or the single-constructor convention). In JavaScript/Express that wiring is manual — you pass the dependencies yourself when building each object. Simple, direct and magic-free: an advantage for learning, although the boilerplate shows up in large applications.

## 3. MVVM: the state as something observable

### The problem: two views with the same state, out of sync

If the web screen and the customer panel show the same tasks and each one refreshes on its own, they end up saying different things. We need a single place where the state lives and that **announces when it changes** — the Observer from chapter 8 applied to state. That place is the **ViewModel**: the presentation state, observable, with a mechanism to subscribe to its properties.

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

Every time you assign `estadoProxy.tareas` or `.estadisticas`, the `Proxy` intercepts the `set`, updates the real object and **notifies every subscriber**. Change one screen and they all update; the unsubscribe mechanism from chapter 8 matters so you don't accumulate subscribers.

### Connection with Python

**Literal translation**: Python reaches the same observable with properties that notify on assignment:

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

**Change of scene**: Python has no `Proxy` — `@property` and `@property.setter` cover the most common case, and libraries or frameworks bring something close to a reactive ViewModel (Django Channels handles real-time state). The per-dictionary subscriber mechanism is the one you already saw in chapter 8.

### Connection with Java

**Literal translation**: Java also has dynamic proxies (`java.lang.reflect.Proxy`), although you will rarely use them by hand: the ViewModel with observables is already solved in the Android world with `ViewModel` + `LiveData`, and in the backend with Reactor / observable state patterns in the same style as your `tareas`.

```java
class ControladorUI {
    private ObservableList<Tarea> tareas = FXCollections.observableArrayList();
}
```

**Change of scene**: the example above is the ViewModel of Java's desktop UI (JavaFX: `ObservableList`) — objects that notify their listeners on their own. In JavaScript the `Proxy` gives you that capability in three lines and it is used by Vue and, before transforming, by React; in Java the mechanism is spread across `ObservableList`, `LiveData` and Reactor streams. The concept from chapter 8 — subscribing and being notified — exists in all three.

## Debugging in practice

### When the architecture goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| The controller has 200 lines and every test needs a database | Fat controller: all the logic lives in the handler | Extract to a service and pass dependencies through the constructor |
| Changing databases breaks the whole model | The model calls `require("./database")` internally | Isolate data access in a Repository |
| The view queries the model directly | It skipped the controller/ViewModel | Route the query through the corresponding layer |
| Two screens show different data for the same state | Each one refreshes on its own | Single observable state (ViewModel) with subscription |

### Scenario 1: the fat controller

The fat controller example from section 2 is a real case: validation, duplicate check, encryption and email inside `crear`. What happens when the test wants to prove "the email is not sent twice"? It needs a real database, bcrypt and an email service. That coupling makes every test slow and brittle.

The fix seen above — `UsuarioService` receiving `repositorio` and `emailService` through the constructor — makes the test trivial: you pass it a fake repository (an object whose `buscarPorEmail` returns `null`) and an email sender that accumulates the sends, without touching any database or sending anything real.

### Scenario 2: the model glued to the database

```javascript
class UsuarioModel {
  constructor() {
    this.db = require("./database") // direct coupling
  }

  crear(datos) {
    return this.db.query("INSERT INTO usuarios ...", datos)
  }
}
```

The model was testable at first, and then someone added `this.db` inside the constructor "to try it". The day the database changes (PostgreSQL to Redis, or an external service), the model has to be touched. The fix is the `UsuarioRepository` from section 2 with the `database` injected through the constructor: the model stops knowing *how* things are stored and only knows *what* it needs. In tests, the repository is replaced by an object that returns fixed data — no real connections.

## Practice and exercises

### 1. Review questions

<details>
<summary><b>1. What responsibility does each MVC layer have, and why should they not be mixed?</b></summary>

**Explanation**: the model holds data and rules, the view presents, the controller coordinates request → model → response. They are not mixed because independence is what allows testing each layer separately and changing one without breaking the others.
</details>

<details>
<summary><b>2. What is the naming difference between Express and Django?</b></summary>

**Explanation**: Express is classic MVC (explicit controller); Django uses MVT, where its "view" plays the controller and the templates play the view. The separation of responsibilities is the same, only the label changes.
</details>

<details>
<summary><b>3. What signs show that a controller has become fat?</b></summary>

**Explanation**: it validates, queries the database, encrypts, sends emails and formats the response in the same method; tests need to mock all of those pieces. The fix is moving that logic to a service layer.
</details>

<details>
<summary><b>4. What does the Repository pattern do, and how does it connect to dependency injection?</b></summary>

**Explanation**: it isolates data access behind a stable interface so the model does not depend on a specific database. It connects to injection because it passes that dependency through the constructor: `new Service(repository)`, letting you replace it in tests.
</details>

<details>
<summary><b>5. In MVVM, who notifies the views and with which mechanism from chapter 8?</b></summary>

**Explanation**: the ViewModel holds the observable state (with `Proxy` in JavaScript) and notifies subscribers when it changes — exactly the Observer pattern: `suscribir` returns an unsubscribe function and each view receives the new value on assignment.
</details>

### 2. Explain it in your own words

> **Challenge**: explain to a friend coming from Python how MVC works using the metaphor of a **service desk**: the **controller** is the receptionist who takes the request and returns the result, but does not do the task; the **model** is the central file room with the data and its rules; the **view** is the display case where the result is shown. If the task is complex, the receptionist passes it to a department (the **service layer**). Then explain: what happens if the receptionist starts doing the tasks himself (fat controller)? And if the display case queries the file directly?
> *Hint: if you hesitate, re-read [Section 1](#1-model-view-controller-mvc), [Section 2](#2-the-service-layer-and-the-repository) and [Section 3](#3-mvvm-the-state-as-something-observable).*

---

### 3. Progressive coding exercises

#### Exercise 1 (Basic): task CRUD with MVC

**Objective**: implement the three MVC layers for an in-memory tasks API and verify the model → controller flow.

**Statement**: create a `TareaModel` with `obtenerTodas`, `obtenerPorId`, `crear`, `actualizar` and `eliminar` over an in-memory array; and a `TareaController` with `index`, `show`, `create`, `update` and `delete` responding `200/201/404` with JSON. Keep the Express routes to a minimum (`/tareas` and `/tareas/:id`).

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. The model is identical to section 1, swapping `usuarios` for `tareas` and using `id: Date.now()` when creating.
2. The controller receives the model through the constructor and uses `req.params.id` with `Number(id)` to look up.
3. `actualizar` uses `Object.assign` on the found task; `delete` returns `null` if it does not exist.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

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

// Test without Express: mock req/res
const controller = new TareaController(new TareaModel())

controller.create({ body: { titulo: "Comprar pan" } }, {
  status: function (codigo) { this.statusCode = codigo; return this },
  json: function (cuerpo) { this.cuerpo = cuerpo }
})

controller.index({}, {
  json: function (cuerpo) { console.log(cuerpo.length) } // 1
})
```

**Why does it work?** The model manages data without knowing anything about HTTP, and the controller translates request → model → response without knowing anything about storage. Notice the test: with a fake `req` and `res` (objects with `body`/`status`/`json`) you test the whole CRUD without starting a server — that is the practical advantage of the layer separation.

</details>

#### Exercise 2 (Intermediate): validation in the model and formatted presentation

**Objective**: add business rules to the model and separate the response format into a presenter.

**Statement**: extend `TareaModel` so that:
1. `validarTitulo(titulo)` throws `Error` with a clear message if it is not a string, is empty or exceeds 100 characters (remember chapter 6).
2. `crear` and `actualizar` validate before saving, returning the trimmed title.
3. A `TareaPresentador` with `formatearTarea` adds a `resumen` field (`"Titulo - Completada/Pendiente"`) and `formatearLista`.
4. The controller uses the presenter in `index` and `create`.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Validate before assigning: `throw new Error("El título es requerido")` for invalid cases, and return `titulo.trim()` at the end.
2. The presenter can be a class with `static` methods that keeps no state.
3. The `resumen` comes from `tarea.titulo` and `tarea.completada`.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

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
  new TareaModel().crear({ titulo: "   " }) // throws "El título es requerido"
} catch (error) {
  console.log(error.message) // El título es requerido
}
```

**Why does it work?** The business rules live in the model (making them testable in isolation) and the format lives in the presenter (which keeps no state). The controller is left with a single responsibility: translating. The `trim()` guarantees that "  Comprar pan  " is stored as "Comprar pan", and the error with a clear message propagates to the chapter 6 middleware for a consistent response format.

</details>

#### Exercise 3 (Advanced): reactive ViewModel with Proxy and Observer

**Objective**: build an MVVM-style observable state where assigning state notifies only the interested subscribers.

**Statement**: complete a `TareaViewModel` (like the one in section 3) so that:
1. It exposes `estadoProxy` with `tareas` and `filtro`.
2. `suscribir(propiedad, callback)` returns an unsubscribe function.
3. `crearTarea(datos)` adds to the model and updates `estadoProxy.tareas`.
4. `filtrarTareas()` returns according to `filtro` (`todas`, `completadas`, `pendientes`).
5. Check that when `filtro` changes, the `filtro` subscriber is notified but the `tareas` one is not.

<details class="spoiler spoiler-pistas">
<summary>💡 View hints</summary>

1. Place the `new Proxy` over a state object and use the `set` trap to call `notificarCambio`.
2. Subscribers go in a `Map` property → array; the unsubscribe removes the callback with `indexOf`/`splice`.
3. `filtrarTareas` uses a `switch` over `this.estadoProxy.filtro`; for the `set` trap it does not need to write — reading always works.

</details>

<details class="spoiler spoiler-solucion">
<summary>💡 View explained solution</summary>

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

console.log(avisosFiltro) // ["pendientes"] — only the filtro subscriber
console.log(avisosTareas) // [1] — the tareas one was notified on create

desuscribirFiltro()
vm.estadoProxy.filtro = "completadas"
console.log(avisosFiltro) // ["pendientes"] — the unsubscribe worked
```

**Why does it work?** The `Proxy` intercepts **only writes**: assigning `estadoProxy.filtro` fires the `set` trap, which stores the real value and notifies only the `filtro` map. Subscribing per property keeps every change from redrawing all the screens — building on the Observer from chapter 8 with the unsubscribe returned by `suscribir`. Reassign `estadoProxy.tareas` after creating so the fresh array propagates too.

</details>

## Comparison table across languages

| Aspect | JavaScript (Node/Express) | Python (Django/Flask) |
|---|---|---|
| Architecture | Classic MVC with an explicit controller | MVT (Django's "view" is the controller) |
| Model | Own class or third-party ORM (Prisma/Knex) | Built-in ORM (Django `objects`, SQLAlchemy) |
| Routes | `app.get("/ruta", handler)` | `urlpatterns` (Django) or `@app.route` (Flask) |
| Service layer | Written by hand (class + constructor) | Optional; usually lives in the view or managers |
| Reactive ViewModel | `Proxy` + Observer (by hand) | `@property`/setters or stream libraries |

| Aspect | JavaScript (Node/Express) | Java (Spring MVC) |
|---|---|---|
| MVC | You write it yourself, layer by layer | The framework imposes it with annotations |
| Dependency injection | Manual (via constructor) | Automatic (Spring container) |
| Repository | By hand, with the `database` injected | Spring Data JPA generates the interfaces for you |
| Observable state | `Proxy` in three lines | `ObservableList`, `LiveData`, Reactor |
| Boilerplate | None — but the discipline is yours | High — but the skeleton is guaranteed |

## Chapter summary

1. **MVC** splits the state into three layers: model (data and rules), view (presentation) and controller (coordination).
2. In **Express** you write that separation yourself; in **Django** it arrives under another name (MVT) and in **Spring** the framework enforces it.
3. The **fat controller** is the sign that business logic leaked out of the model; the **service layer** puts it back in place.
4. The **Repository** isolates data access and, with constructor injection, leaves the model testable with no real database.
5. **MVVM** turns state into something observable: the ViewModel (`Proxy` + Observer) notifies only the subscribers of the property that changed.
6. Unsubscribing matters again: an observable state without unsubscribe accumulates listeners (chapter 8).
7. In all three languages the pattern underneath is the same — state, logic and presentation do not live in the same function.

## Next Chapter

→ **[Chapter 10: Defensive Security](./cap-10)**: now that you know how to organize the application state, let's protect it: what injection is, how to sanitize input, prototype pollution and the OWASP rules — with their Python and Java counterparts in view.