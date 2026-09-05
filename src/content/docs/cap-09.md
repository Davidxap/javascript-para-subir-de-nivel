---
title: "Capítulo 9: Arquitecturas de estado (MVC y derivados en Node.js)"
---

# Capítulo 9: Arquitecturas de estado (MVC y derivados en Node.js)

> Las arquitecturas de estado organizan responsabilidades: datos, lógica y presentación.

## Introducción

En el contexto de Node.js, MVC separa el modelo (datos), el controlador (lógica de rutas) y la vista (respuestas JSON/HTML). Estas arquitecturas son la base para construir aplicaciones mantenibles y escalables.

**¿Por qué importa?** Porque una buena arquitectura permite que el código crezca sin volverse inmanejable. Los patrones de diseño y los principios SOLID se aplican a través de estas arquitecturas.

## 1. Modelo-Vista-Controlador (MVC)

### Idea clave

MVC separa una aplicación en tres capas con responsabilidades distintas.

### Estructura

- **Modelo**: representa los datos y las reglas de negocio.
- **Vista**: presenta los datos al usuario (HTML, JSON, etc.).
- **Controlador**: recibe la petición, coordina el modelo y devuelve la vista.

### Ejemplo real en Node.js (Express)

```javascript
// Modelo
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

// Controlador
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
    if (!usuario) return res.status(404).json({ error: "No encontrado" })
    res.json(usuario)
  }

  create(req, res) {
    const nuevo = this.modelo.crear(req.body)
    res.status(201).json(nuevo)
  }
}

// Rutas (capa de enlace)
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

### Comparación con Python (Django)

```python
# Python (Django) - MVC equivalente a MVT (Model-View-Template)
from django.db import models
from django.http import JsonResponse
from django.views import View

# Modelo
class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    email = models.EmailField()
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'email': self.email
        }

# Vista (equivalente al controlador en MVC)
class UsuarioView(View):
    def get(self, request, id=None):
        if id:
            try:
                usuario = Usuario.objects.get(id=id)
                return JsonResponse(usuario.to_dict())
            except Usuario.DoesNotExist:
                return JsonResponse({'error': 'No encontrado'}, status=404)
        else:
            usuarios = list(Usuario.objects.all().values())
            return JsonResponse(usuarios, safe=False)
    
    def post(self, request):
        import json
        datos = json.loads(request.body)
        usuario = Usuario.objects.create(**datos)
        return JsonResponse(usuario.to_dict(), status=201)

# URLs (equivalente a rutas)
from django.urls import path
urlpatterns = [
    path('usuarios/', UsuarioView.as_view()),
    path('usuarios/<int:id>/', UsuarioView.as_view()),
]
```

**Diferencias clave**:
- **Python/Django**: Usa MVT (Model-View-Template), donde la vista actúa como controlador
- **JavaScript/Express**: MVC puro con controladores separados
- **Ambos**: Separan responsabilidades para código mantenible

### Ventajas

- Separación de responsabilidades.
- El modelo es testeable de forma aislada.
- Las vistas se pueden cambiar sin tocar la lógica.

### Derivados

- **MVP (Model-View-Presenter)**: el presentador media entre modelo y vista; la vista es pasiva.
- **MVVM (Model-View-ViewModel)**: el ViewModel expone datos observables para la vista (común en Vue).

## Errores Comunes

- Poner lógica de negocio en el controlador (fat controllers).
- Acceder a la vista desde el modelo (rompe la separación).
- Mezclar formato de respuesta (HTML/JSON) dentro del modelo.

---

## Ejercicios Prácticos

### Nivel Básico

**Objetivo**: Implementar un CRUD básico con MVC

**Ejercicio**: Crea una aplicación de tareas con:
1. Modelo `Tarea` con campos `id`, `titulo`, `completada`
2. Controlador con métodos `index`, `show`, `create`, `update`, `delete`
3. Rutas para cada operación

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa Express para las rutas
2. El modelo debe manejar los datos (puede ser en memoria)
3. El controlador coordina entre modelo y respuesta

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
// Modelo
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

// Controlador
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
      return res.status(404).json({ error: 'Tarea no encontrada' });
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
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json(tarea);
  }
  
  delete(req, res) {
    const tarea = this.modelo.eliminar(req.params.id);
    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json({ mensaje: 'Tarea eliminada', tarea });
  }
}

// Rutas
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


### Nivel Intermedio

**Objetivo**: Implementar MVP con validación de negocio

**Ejercicio**: Extiende el ejemplo anterior para incluir:
1. Validación de negocio en el modelo (título no vacío, máximo 100 caracteres)
2. Lógica de presentación en una capa de presentación
3. Manejo de errores estructurado

**Requisitos**:
1. El modelo debe validar antes de crear/actualizar
2. La capa de presentación formatea la respuesta
3. Los errores deben ser consistentes

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Usa métodos de validación en el modelo
2. Crea una clase `Presentador` para formatear respuestas
3. Implementa middleware de manejo de errores

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
// Modelo con validación
class TareaModel {
  constructor() {
    this.tareas = [];
  }
  
  validarTitulo(titulo) {
    if (!titulo || typeof titulo !== 'string') {
      throw new Error('El título es requerido');
    }
    if (titulo.trim().length === 0) {
      throw new Error('El título no puede estar vacío');
    }
    if (titulo.length > 100) {
      throw new Error('El título no puede exceder 100 caracteres');
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
  
  // ... otros métodos
}

// Capa de presentación
class TareaPresentador {
  static formatearTarea(tarea) {
    return {
      id: tarea.id,
      titulo: tarea.titulo,
      completada: tarea.completada,
      fechaCreacion: tarea.fechaCreacion.toISOString(),
      resumen: `${tarea.titulo} - ${tarea.completada ? 'Completada' : 'Pendiente'}`
    };
  }
  
  static formatearLista(tareas) {
    return tareas.map(tarea => this.formatearTarea(tarea));
  }
}

// Controlador mejorado
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
  
  // ... otros métodos
}

// Middleware de manejo de errores
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      mensaje: err.message || 'Error interno del servidor',
      codigo: err.status || 500,
      timestamp: new Date().toISOString()
    }
  });
}
```

</details>


### Nivel Avanzado

**Objetivo**: Implementar MVVM con patrón Observer para actualizaciones reactivas

**Ejercicio**: Crea un sistema de tareas reactivo donde:
1. El ViewModel exponga datos observables
2. Los cambios se notifiquen automáticamente
3. Soporte para múltiples vistas (web, CLI, API)

**Especificaciones**:
1. Usa el patrón Observer para notificar cambios
2. El ViewModel gestiona el estado y la lógica de presentación
3. Las vistas se suscriben a cambios específicos

<details class="spoiler spoiler-pistas">
<summary>Ver pistas</summary>

1. Implementa un sistema de eventos en el ViewModel
2. Usa Proxy para detectar cambios automáticamente
3. Separa la lógica de presentación de la lógica de negocio

</details>


<details class="spoiler spoiler-solucion">
<summary>Ver solución</summary>

```javascript
// ViewModel con Observer
class TareaViewModel {
  constructor(modelo) {
    this.modelo = modelo;
    this.suscriptores = new Map();
    this.estado = {
      tareas: [],
      filtro: 'todas',
      estadisticas: {
        total: 0,
        completadas: 0,
        pendientes: 0
      }
    };
    
    // Proxy para detectar cambios
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
    
    // Devolver función para desuscribirse
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
    this.cargarTareas(); // Actualiza el estado
    return nuevaTarea;
  }
  
  filtrarTareas(filtro) {
    this.estadoProxy.filtro = filtro;
    let tareasFiltradas;
    
    switch (filtro) {
      case 'completadas':
        tareasFiltradas = this.estado.tareas.filter(t => t.completada);
        break;
      case 'pendientes':
        tareasFiltradas = this.estado.tareas.filter(t => !t.completada);
        break;
      default:
        tareasFiltradas = this.estado.tareas;
    }
    
    return tareasFiltradas;
  }
}

// Vista Web (ejemplo)
class TareaVistaWeb {
  constructor(viewModel) {
    this.viewModel = viewModel;
    this.suscriciones = [];
    
    // Suscribirse a cambios
    this.suscriciones.push(
      viewModel.suscribir('tareas', this.renderizarTareas.bind(this)),
      viewModel.suscribir('estadisticas', this.renderizarEstadisticas.bind(this))
    );
  }
  
  renderizarTareas(tareas) {
    console.log('Renderizando tareas en web:', tareas.length);
    // Aquí iría el código para actualizar el DOM
  }
  
  renderizarEstadisticas(estadisticas) {
    console.log('Actualizando estadísticas:', estadisticas);
    // Aquí iría el código para actualizar estadísticas en la UI
  }
  
  destruir() {
    // Limpiar suscripciones
    this.suscriciones.forEach(suscripcion => suscripcion());
  }
}

// Uso
const modelo = new TareaModel();
const viewModel = new TareaViewModel(modelo);
const vistaWeb = new TareaVistaWeb(viewModel);

// Cargar datos iniciales
viewModel.cargarTareas();

// Crear tarea (notifica automáticamente a las vistas)
viewModel.crearTarea({ titulo: 'Nueva tarea' });
```

</details>


---

## Pensamiento Crítico

### Problema 1: Fat controllers

**Situación**: Tus controladores tienen demasiada lógica de negocio, making them hard to test and maintain.

**Preguntas guía**:
1. ¿Por qué los controladores tienden a engordar?
2. ¿Cómo extraes lógica de negocio del controlador?
3. ¿Qué patrones ayudan a mantener controladores delgados?

**Análisis**:
- **Causa**: Los controladores acumulan validación, transformación, y lógica de negocio
- **Solución**: Extraer lógica a servicios, usar el patrón Command, aplicar Single Responsibility
- **Patrones**: Service Layer, Command Pattern, Repository Pattern

```javascript
// ❌ Fat controller
class UsuarioController {
  crear(req, res) {
    // Validación
    if (!req.body.email) {
      return res.status(400).json({ error: 'Email requerido' });
    }
    
    // Lógica de negocio
    const usuarioExistente = db.buscarPorEmail(req.body.email);
    if (usuarioExistente) {
      return res.status(409).json({ error: 'Email ya existe' });
    }
    
    // Hash de contraseña
    const hash = bcrypt.hashSync(req.body.password, 10);
    
    // Crear usuario
    const usuario = db.crear({
      ...req.body,
      password: hash,
      fechaCreacion: new Date()
    });
    
    // Enviar email de bienvenida
    emailService.enviarBienvenida(usuario.email);
    
    // Responder
    res.status(201).json(usuario);
  }
}

// ✅ Controlador delgado con servicios
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

// Servicio con lógica de negocio
class UsuarioService {
  async crear(datos) {
    // Validación
    this.validarDatos(datos);
    
    // Verificar duplicado
    const existente = await this.usuarioRepository.buscarPorEmail(datos.email);
    if (existente) {
      throw new ConflictError('Email ya existe');
    }
    
    // Hash de contraseña
    const hash = await bcrypt.hash(datos.password, 10);
    
    // Crear usuario
    const usuario = await this.usuarioRepository.crear({
      ...datos,
      password: hash
    });
    
    // Enviar email (asíncrono, no bloquea)
    this.emailService.enviarBienvenida(usuario.email).catch(console.error);
    
    return usuario;
  }
}
```

### Problema 2: Acoplamiento entre capas

**Situación**: Tu modelo depende directamente de la base de datos, making it hard to test and switch databases.

**Preguntas guía**:
1. ¿Por qué el acoplamiento directo a la DB es problemático?
2. ¿Cómo implementas el patrón Repository?
3. ¿Qué beneficios tiene la inyección de dependencias?

**Análisis**:
- **Problema**: El modelo conoce detalles de implementación de la DB
- **Solución**: Repository Pattern, Dependency Injection, Interfaces
- **Beneficios**: Testeabilidad, flexibilidad, mantenibilidad

```javascript
// ❌ Modelo acoplado a la DB
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

// Inyección de dependencias
const database = new Database();
const usuarioRepository = new UsuarioRepository(database);
const usuarioService = new UsuarioService(usuarioRepository);
const usuarioController = new UsuarioController(usuarioService);
```

---

## Conexión con Python

### MVC en Python (Django vs Flask)

**Django (MVT - Model-View-Template)**:
```python
# models.py
class Tarea(models.Model):
    titulo = models.CharField(max_length=100)
    completada = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.titulo

# views.py (equivalente al controlador)
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

**Flask (MVC más tradicional)**:
```python
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
db = SQLAlchemy(app)

# Modelo
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

# Controlador (rutas)
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

# Vista (templates)
@app.route('/')
def index():
    return render_template('tareas.html')
```

### Diferencias clave

| Aspecto | JavaScript (Node.js) | Python (Django/Flask) |
|---------|----------------------|------------------------|
| **Arquitectura** | MVC puro | MVT (Django) o MVC (Flask) |
| **Vista** | JSON/HTML en controlador | Templates separados |
| **Modelo** | Clases JavaScript | ORM (Django/SQLAlchemy) |
| **Rutas** | Express router | Django URLs/Flask routes |
| **Validación** | Manual o librerías | Formularios Django/WTForms |

### Cuándo usar cada uno

**JavaScript (Node.js/Express) es mejor para**:
- APIs REST/GraphQL de alto rendimiento
- Aplicaciones en tiempo real (WebSockets)
- Microservicios ligeros

**Python (Django/Flask) es mejor para**:
- Aplicaciones web con ORM potente
- Admin panels automáticos
- Data science integrado

---

## Resumen

1. **MVC** separa datos, lógica y presentación en tres capas
2. **En Node.js**, el controlador coordina el modelo y devuelve la respuesta
3. **Los derivados** (MVP, MVVM) ajustan la relación vista-lógica según el entorno
4. **Los controladores delgados** son esenciales para código mantenible
5. **El patrón Repository** desacopla el modelo de la base de datos
6. **La inyección de dependencias** facilita testing y flexibilidad
7. **Python implementa MVC de forma similar** pero con herramientas diferentes

---

## Siguiente Capítulo

→ **[Capítulo 10: Seguridad defensiva](./cap-10)**: Prototype Pollution, sanitización y OWASP.
