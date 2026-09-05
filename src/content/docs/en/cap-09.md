---
title: "Chapter 9: State Architectures (MVC and Derivatives in Node.js)"
---

# Chapter 9: State Architectures (MVC and Derivatives in Node.js)

> State architectures organize responsibilities: data, logic, and presentation.

## Introduction

In the context of Node.js, MVC separates the model (data), the controller (route logic), and the view (JSON/HTML responses). These architectures are the foundation for building maintainable and scalable applications.

**Why does it matter?** Because a good architecture allows the code to grow without becoming unmanageable. Design patterns and SOLID principles are applied through these architectures.

## 1. Model-View-Controller (MVC)

### Key Idea

MVC separates an application into three layers with distinct responsibilities.

### Structure

- **Model**: represents the data and business rules.
- **View**: presents the data to the user (HTML, JSON, etc.).
- **Controller**: receives the request, coordinates the model, and returns the view.

### Real-World Example in Node.js (Express)

```javascript
// Model
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

// Controller
class UsuarioController {
  constructor(modelo) {
    this.modelo = modelo
  }

  index(req, res) {
    const usuarios = this.modelo.obtenerTodos()
    res.json(usuarios)
  }

  show(req, res) {
    const usuario = this.modelo.obtenerPorId(req.params.id)
    if (!usuario) return res.status(404).json({ error: "Not found" })
    res.json(usuario)
  }

  create(req, res) {
    const nuevo = this.modelo.crear(req.body)
    res.status(201).json(nuevo)
  }
}

// Routes (binding layer)
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

### Comparison with Python (Django)

```python
# Python (Django) - MVC equivalent to MVT (Model-View-Template)
from django.db import models
from django.http import JsonResponse
from django.views import View

# Model
class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    email = models.EmailField()
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'email': self.email
        }

# View (equivalent to the controller in MVC)
class UsuarioView(View):
    def get(self, request, id=None):
        if id:
            try:
                usuario = Usuario.objects.get(id=id)
                return JsonResponse(usuario.to_dict())
            except Usuario.DoesNotExist:
                return JsonResponse({'error': 'Not found'}, status=404)
        else:
            usuarios = list(Usuario.objects.all().values())
            return JsonResponse(usuarios, safe=False)
    
    def post(self, request):
        import json
        datos = json.loads(request.body)
        usuario = Usuario.objects.create(**datos)
        return JsonResponse(usuario.to_dict(), status=201)

# URLs (equivalent to routes)
from django.urls import path
urlpatterns = [
    path('usuarios/', UsuarioView.as_view()),
    path('usuarios/<int:id>/', UsuarioView.as_view()),
]
```

**Key differences**:
- **Python/Django**: Uses MVT (Model-View-Template), where the view acts as the controller.
- **JavaScript/Express**: Pure MVC with separate controllers.
- **Both**: Separate concerns for maintainable code.

### Advantages

- Separation of concerns.
- The model is testable in isolation.
- Views can be changed without touching the logic.

### Derivatives

- **MVP (Model-View-Presenter)**: the presenter mediates between the model and the view; the view is passive.
- **MVVM (Model-View-ViewModel)**: the ViewModel exposes observable data to the view (common in Vue).

## Common Errors

- Putting business logic in the controller (fat controllers).
- Accessing the view from the model (breaks separation).
- Mixing response formatting (HTML/JSON) inside the model.

---

## Practical Exercises

### Basic Level

**Objective**: Implement a basic CRUD with MVC

**Exercise**: Create a task application with:
1. `Tarea` model with fields `id`, `titulo`, `completada`
2. Controller with methods `index`, `show`, `create`, `update`, `delete`
3. Routes for each operation

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use Express for routes
2. The model must handle the data (can be in-memory)
3. The controller coordinates between the model and the response

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
// Model
class TareaModel {
  constructor() {
    this.tareas = [];
  }
  
  obtenerTodas() {
    return this.tareas;
  }
  
  obtenerPorId(id) {
    return this.tareas.find(t => t.id === Number(id));
  }
  
  crear(datos) {
    const nuevaTarea = {
      id: Date.now(),
      titulo: datos.titulo,
      completada: false,
      fechaCreacion: new Date()
    };
    this.tareas.push(nuevaTarea);
    return nuevaTarea;
  }
  
  actualizar(id, datos) {
    const tarea = this.obtenerPorId(id);
    if (tarea) {
      Object.assign(tarea, datos);
    }
    return tarea;
  }
  
  eliminar(id) {
    const indice = this.tareas.findIndex(t => t.id === Number(id));
    if (indice !== -1) {
      return this.tareas.splice(indice, 1)[0];
    }
    return null;
  }
}

// Controller
class TareaController {
  constructor(modelo) {
    this.modelo = modelo;
  }
  
  index(req, res) {
    res.json(this.modelo.obtenerTodas());
  }
  
  show(req, res) {
    const tarea = this.modelo.obtenerPorId(req.params.id);
    if (!tarea) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(tarea);
  }
  
  create(req, res) {
    const nuevaTarea = this.modelo.crear(req.body);
    res.status(201).json(nuevaTarea);
  }
  
  update(req, res) {
    const tarea = this.modelo.actualizar(req.params.id, req.body);
    if (!tarea) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(tarea);
  }
  
  delete(req, res) {
    const tarea = this.modelo.eliminar(req.params.id);
    if (!tarea) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ mensaje: 'Task deleted', tarea });
  }
}

// Routes
const express = require('express');
const router = express.Router();
const modelo = new TareaModel();
const controller = new TareaController(modelo);

router.get('/tareas', (req, res) => controller.index(req, res));
router.get('/tareas/:id', (req, res) => controller.show(req, res));
router.post('/tareas', (req, res) => controller.create(req, res));
router.put('/tareas/:id', (req, res) => controller.update(req, res));
router.delete('/tareas/:id', (req, res) => controller.delete(req, res));

module.exports = router;
```

</details>


### Intermediate Level

**Objective**: Implement MVP with business validation

**Exercise**: Extend the previous example to include:
1. Business validation in the model (non-empty title, maximum 100 characters)
2. Presentation logic in a presentation layer
3. Structured error handling

**Requirements**:
1. The model must validate before creating/updating
2. The presentation layer formats the response
3. Errors must be consistent

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Use validation methods in the model
2. Create a `Presentador` class to format responses
3. Implement error-handling middleware

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
// Model with validation
class TareaModel {
  constructor() {
    this.tareas = [];
  }
  
  validarTitulo(titulo) {
    if (!titulo || typeof titulo !== 'string') {
      throw new Error('Title is required');
    }
    if (titulo.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }
    if (titulo.length > 100) {
      throw new Error('Title cannot exceed 100 characters');
    }
    return titulo.trim();
  }
  
  crear(datos) {
    const tituloValidado = this.validarTitulo(datos.titulo);
    const nuevaTarea = {
      id: Date.now(),
      titulo: tituloValidado,
      completada: false,
      fechaCreacion: new Date()
    };
    this.tareas.push(nuevaTarea);
    return nuevaTarea;
  }
  
  // ... other methods
}

// Presentation layer
class TareaPresentador {
  static formatearTarea(tarea) {
    return {
      id: tarea.id,
      titulo: tarea.titulo,
      completada: tarea.completada,
      fechaCreacion: tarea.fechaCreacion.toISOString(),
      resumen: `${tarea.titulo} - ${tarea.completada ? 'Completed' : 'Pending'}`
    };
  }
  
  static formatearLista(tareas) {
    return tareas.map(tarea => this.formatearTarea(tarea));
  }
}

// Improved controller
class TareaController {
  constructor(modelo) {
    this.modelo = modelo;
  }
  
  create(req, res, next) {
    try {
      const nuevaTarea = this.modelo.crear(req.body);
      const tareaFormateada = TareaPresentador.formatearTarea(nuevaTarea);
      res.status(201).json(tareaFormateada);
    } catch (error) {
      next(error);
    }
  }
  
  // ... other methods
}

// Error-handling middleware
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      mensaje: err.message || 'Internal server error',
      codigo: err.status || 500,
      timestamp: new Date().toISOString()
    }
  });
}
```

</details>


### Advanced Level

**Objective**: Implement MVVM with the Observer pattern for reactive updates

**Exercise**: Create a reactive task system where:
1. The ViewModel exposes observable data
2. Changes are automatically notified
3. Support for multiple views (web, CLI, API)

**Specifications**:
1. Use the Observer pattern to notify changes
2. The ViewModel manages state and presentation logic
3. Views subscribe to specific changes

<details class="spoiler spoiler-pistas">
<summary>Show hints</summary>

1. Implement an event system in the ViewModel
2. Use a Proxy to automatically detect changes
3. Separate presentation logic from business logic

</details>


<details class="spoiler spoiler-solucion">
<summary>Show solution</summary>

```javascript
// ViewModel with Observer
class TareaViewModel {
  constructor(modelo) {
    this.modelo = modelo;
    this.suscriptores = new Map();
    this.estado = {
      tareas: [],
      filtro: 'all',
      estadisticas: {
        total: 0,
        completadas: 0,
        pendientes: 0
      }
    };
    
    // Proxy to detect changes
    this.estadoProxy = new Proxy(this.estado, {
      set: (obj, prop, valor) => {
        obj[prop] = valor;
        this.notificarCambio(prop, valor);
        return true;
      }
    });
  }
  
  suscribir(propiedad, callback) {
    if (!this.suscriptores.has(propiedad)) {
      this.suscriptores.set(propiedad, []);
    }
    this.suscriptores.get(propiedad).push(callback);
    
    // Return function to unsubscribe
    return () => {
      const callbacks = this.suscriptores.get(propiedad);
      const indice = callbacks.indexOf(callback);
      if (indice !== -1) {
        callbacks.splice(indice, 1);
      }
    };
  }
  
  notificarCambio(propiedad, valor) {
    if (this.suscriptores.has(propiedad)) {
      this.suscriptores.get(propiedad).forEach(callback => {
        callback(valor);
      });
    }
  }
  
  cargarTareas() {
    this.estadoProxy.tareas = this.modelo.obtenerTodas();
    this.actualizarEstadisticas();
  }
  
  actualizarEstadisticas() {
    const tareas = this.estadoProxy.tareas;
    this.estadoProxy.estadisticas = {
      total: tareas.length,
      completadas: tareas.filter(t => t.completada).length,
      pendientes: tareas.filter(t => !t.completada).length
    };
  }
  
  crearTarea(datos) {
    const nuevaTarea = this.modelo.crear(datos);
    this.cargarTareas(); // Updates the state
    return nuevaTarea;
  }
  
  filtrarTareas(filtro) {
    this.estadoProxy.filtro = filtro;
    let tareasFiltradas;
    
    switch (filtro) {
      case 'completed':
        tareasFiltradas = this.estado.tareas.filter(t => t.completada);
        break;
      case 'pending':
        tareasFiltradas = this.estado.tareas.filter(t => !t.completada);
        break;
      default:
        tareasFiltradas = this.estado.tareas;
    }
    
    return tareasFiltradas;
  }
}

// Web View (example)
class TareaVistaWeb {
  constructor(viewModel) {
    this.viewModel = viewModel;
    this.suscriciones = [];
    
    // Subscribe to changes
    this.suscriciones.push(
      viewModel.suscribir('tareas', this.renderizarTareas.bind(this)),
      viewModel.suscribir('estadisticas', this.renderizarEstadisticas.bind(this))
    );
  }
  
  renderizarTareas(tareas) {
    console.log('Rendering tasks on web:', tareas.length);
    // Code to update the DOM would go here
  }
  
  renderizarEstadisticas(estadisticas) {
    console.log('Updating statistics:', estadisticas);
    // Code to update stats in the UI would go here
  }
  
  destruir() {
    // Clean up subscriptions
    this.suscriciones.forEach(suscripcion => suscripcion());
  }
}

// Usage
const modelo = new TareaModel();
const viewModel = new TareaViewModel(modelo);
const vistaWeb = new TareaVistaWeb(viewModel);

// Load initial data
viewModel.cargarTareas();

// Create task (automatically notifies views)
viewModel.crearTarea({ titulo: 'New task' });
```

</details>


---

## Critical Thinking

### Problem 1: Fat controllers

**Situation**: Your controllers have too much business logic, making them hard to test and maintain.

**Guiding Questions**:
1. Why do controllers tend to get fat?
2. How do you extract business logic from the controller?
3. What patterns help keep controllers thin?

**Analysis**:
- **Cause**: Controllers accumulate validation, transformation, and business logic.
- **Solution**: Extract logic to services, use the Command pattern, apply Single Responsibility.
- **Patterns**: Service Layer, Command Pattern, Repository Pattern.

```javascript
// ❌ Fat controller
class UsuarioController {
  crear(req, res) {
    // Validation
    if (!req.body.email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    // Business logic
    const usuarioExistente = db.buscarPorEmail(req.body.email);
    if (usuarioExistente) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    // Password hashing
    const hash = bcrypt.hashSync(req.body.password, 10);
    
    // Create user
    const usuario = db.crear({
      ...req.body,
      password: hash,
      fechaCreacion: new Date()
    });
    
    // Send welcome email
    emailService.enviarBienvenida(usuario.email);
    
    // Respond
    res.status(201).json(usuario);
  }
}

// ✅ Thin controller with services
class UsuarioController {
  constructor(usuarioService) {
    this.usuarioService = usuarioService;
  }
  
  async crear(req, res, next) {
    try {
      const usuario = await this.usuarioService.crear(req.body);
      res.status(201).json(usuario);
    } catch (error) {
      next(error);
    }
  }
}

// Service with business logic
class UsuarioService {
  async crear(datos) {
    // Validation
    this.validarDatos(datos);
    
    // Check for duplicate
    const existente = await this.usuarioRepository.buscarPorEmail(datos.email);
    if (existente) {
      throw new ConflictError('Email already exists');
    }
    
    // Password hashing
    const hash = await bcrypt.hash(datos.password, 10);
    
    // Create user
    const usuario = await this.usuarioRepository.crear({
      ...datos,
      password: hash
    });
    
    // Send email (asynchronous, non-blocking)
    this.emailService.enviarBienvenida(usuario.email).catch(console.error);
    
    return usuario;
  }
}
```

### Problem 2: Coupling between layers

**Situation**: Your model directly depends on the database, making it hard to test and switch databases.

**Guiding Questions**:
1. Why is direct coupling to the DB problematic?
2. How do you implement the Repository pattern?
3. What are the benefits of dependency injection?

**Analysis**:
- **Problem**: The model knows the implementation details of the DB.
- **Solution**: Repository Pattern, Dependency Injection, Interfaces.
- **Benefits**: Testability, flexibility, maintainability.

```javascript
// ❌ Model coupled to the DB
class UsuarioModel {
  constructor() {
    this.db = require('./database');
  }
  
  async crear(datos) {
    return await this.db.query('INSERT INTO usuarios ...', datos);
  }
}

// ✅ Repository Pattern
class UsuarioRepository {
  constructor(database) {
    this.database = database;
  }
  
  async crear(datos) {
    return await this.database.usuarios.crear(datos);
  }
  
  async buscarPorId(id) {
    return await this.database.usuarios.buscarPorId(id);
  }
}

// Dependency injection
const database = new Database();
const usuarioRepository = new UsuarioRepository(database);
const usuarioService = new UsuarioService(usuarioRepository);
const usuarioController = new UsuarioController(usuarioService);
```

---

## Connection with Python

### MVC in Python (Django vs Flask)

**Django (MVT - Model-View-Template)**:
```python
# models.py
class Tarea(models.Model):
    titulo = models.CharField(max_length=100)
    completada = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.titulo

# views.py (equivalent to the controller)
from django.views import View
from django.http import JsonResponse

class TareaView(View):
    def get(self, request, id=None):
        if id:
            tarea = Tarea.objects.get(id=id)
            return JsonResponse({
                'id': tarea.id,
                'titulo': tarea.titulo,
                'completada': tarea.completada
            })
        else:
            tareas = list(Tarea.objects.all().values())
            return JsonResponse(tareas, safe=False)
    
    def post(self, request):
        import json
        datos = json.loads(request.body)
        tarea = Tarea.objects.create(**datos)
        return JsonResponse({
            'id': tarea.id,
            'titulo': tarea.titulo
        }, status=201)

# urls.py
from django.urls import path
urlpatterns = [
    path('tareas/', TareaView.as_view()),
    path('tareas/<int:id>/', TareaView.as_view()),
]
```

**Flask (MVC more traditional)**:
```python
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
db = SQLAlchemy(app)

# Model
class Tarea(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(100), nullable=False)
    completada = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'titulo': self.titulo,
            'completada': self.completada
        }

# Controller (routes)
@app.route('/tareas', methods=['GET'])
def obtener_tareas():
    tareas = Tarea.query.all()
    return jsonify([t.to_dict() for t in tareas])

@app.route('/tareas', methods=['POST'])
def crear_tarea():
    datos = request.get_json()
    nueva_tarea = Tarea(titulo=datos['titulo'])
    db.session.add(nueva_tarea)
    db.session.commit()
    return jsonify(nueva_tarea.to_dict()), 201

# View (templates)
@app.route('/')
def index():
    return render_template('tareas.html')
```

### Key Differences

| Aspect | JavaScript (Node.js) | Python (Django/Flask) |
|---------|----------------------|------------------------|
| **Architecture** | Pure MVC | MVT (Django) or MVC (Flask) |
| **View** | JSON/HTML in controller | Separate templates |
| **Model** | JavaScript classes | ORM (Django/SQLAlchemy) |
| **Routes** | Express router | Django URLs/Flask routes |
| **Validation** | Manual or libraries | Django Forms/WTForms |

### When to Use Each

**JavaScript (Node.js/Express) is best for**:
- High-performance REST/GraphQL APIs
- Real-time applications (WebSockets)
- Lightweight microservices

**Python (Django/Flask) is best for**:
- Web applications with a powerful ORM
- Automatic admin panels
- Integrated data science

---

## Summary

1. **MVC** separates data, logic, and presentation into three layers.
2. **In Node.js**, the controller coordinates the model and returns the response.
3. **Derivatives** (MVP, MVVM) adjust the view-logic relationship based on the environment.
4. **Thin controllers** are essential for maintainable code.
5. **The Repository pattern** decouples the model from the database.
6. **Dependency injection** facilitates testing and flexibility.
7. **Python implements MVC similarly** but with different tools.

---

## Next Chapter

→ **Cap-10-Seguridad-Defensiva**: In the next chapter, we will look at defensive security, including Prototype Pollution and OWASP.