# JavaScript para Subir de Nivel

> Libro técnico, práctico y **gratuito** para pasar de *"sé usar JavaScript"* a entender de verdad cómo funciona.

**[Leer el libro online → davidxap.github.io/javascript-para-subir-de-nivel](https://davidxap.github.io/javascript-para-subir-de-nivel/)**

Disponible en **español** (original) e **inglés**. Autor: [David Arturo Arroyave Pérez](https://github.com/Davidxap) (Manizales, Colombia).

[![Deploy](https://img.shields.io/github/actions/workflow/status/Davidxap/javascript-para-subir-de-nivel/deploy.yml?branch=main&label=deploy&logo=github)](https://davidxap.github.io/javascript-para-subir-de-nivel/)
[![Astro](https://img.shields.io/badge/hecho_con-Astro%20%2B%20Starlight-f329a7?logo=astro&logoColor=white)](https://astro.build)
[![Contenido](https://img.shields.io/badge/contenido-CC%20BY--NC--SA%204.0-green)](LICENSE-CONTENT)
[![Código](https://img.shields.io/badge/código-MIT-blue)](LICENSE-CODE)

## De usarlo a entenderlo

Casi todo el material en internet enseña a *usar* JavaScript: "escribe esto y funciona". Este libro va al mecanismo de adentro:

- No solo `async/await`, sino la pila, la cola de microtareas y el **Event Loop**.
- No solo funciones, sino el **entorno léxico** y por qué existen los **closures**.
- No solo clases, sino la **cadena de prototipos** que hay debajo.

Cuando entiendes el mecanismo, dejas de memorizar sintaxis: la sintaxis se vuelve obvia.

## Qué contiene

| # | Capítulo | Temas clave |
|---|---|---|
| 1 | [Funciones modernas, destructuring y entorno léxico](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-01/) | funciones de primera clase, closures, `this`, rest/spread |
| 2 | [Objetos, prototipos y clases](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-02/) | cadena de prototipos, campos privados `#`, `Proxy`, `Reflect`, `Symbol` |
| 3 | [Asincronía, promesas y Event Loop](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-03/) | call stack, micro/macrotareas, `async/await`, condiciones de carrera |
| 4 | [Módulos y organización del código](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-04/) | CommonJS vs ES Modules, `import`/`require`, ESM |
| 5 | [Estructuras de datos avanzadas e iteración](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-05/) | `Map`, `Set`, `WeakMap`, generadores, inmutabilidad |
| 6 | [Manejo de errores y depuración](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-06/) | jerarquías de error, `node --inspect`, logging, errores no manejados |
| 7 | [Patrones creacionales](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-07/) | Factory, Singleton, Builder |
| 8 | [Patrones comportamentales y eventos](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-08/) | Observer, Mediator, Strategy |
| 9 | [Arquitecturas de estado](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-09/) | MVC y derivados en Node.js |
| 10 | [Seguridad defensiva](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-10/) | prototype pollution, validación de entrada, OWASP |
| 11 | [Gestión asíncrona de recursos](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-11/) | `using`, `await using` (Explicit Resource Management, ES2027) |
| 12 | [APIs modernas y propuestas TC39](https://davidxap.github.io/javascript-para-subir-de-nivel/cap-12/) | ES2025-ES2026, estándar y propuestas |

Más la [bibliografía](https://davidxap.github.io/javascript-para-subir-de-nivel/bibliografia/) para seguir profundizando después de cada capítulo.

## Para quién es

- Ya escribiste JavaScript (variables, funciones, `fetch`) y sentís que usás el lenguaje por inercia, sin entender qué pasa por dentro.
- Venís de Python, Java o C# y el modelo prototipal, el `this` o la asincronía te confunden.
- Querés leer el código de frameworks y librerías con criterio, o preparar entrevistas técnicas.

**No es** un curso de programación desde cero ni una referencia de sintaxis: asume que ya escribiste algo de JavaScript.

## Cómo sacarle provecho

1. **Leé con el editor abierto.** Cada bloque de código tiene un botón **Run**: cambialo, rompelo, mirá qué pasa.
2. **Hacé los ejercicios antes de mirar las soluciones.** Las pistas y respuestas están colapsadas a propósito.
3. **Leelo dos veces.** La segunda pasada por un capítulo que ya "dominás" es donde las cosas caen en su lugar.
4. **Explicalo con tus palabras.** Si no podés explicar un concepto, todavía no es tuyo.

El sitio funciona sin cuenta, sin tracking y con tema claro/oscuro; tu progreso en las flashcards se guarda en tu navegador.

## Licencias

- **Código** del sitio (Astro/Starlight, componentes, scripts): [MIT](LICENSE-CODE).
- **Contenido** del libro (capítulos en español e inglés): [CC BY-NC-SA 4.0](LICENSE-CONTENT). Podés copiarlo y compartirlo citando al autor, sin uso comercial y manteniendo la misma licencia.

## Contribuir

¿Encontraste un error, un ejemplo que no corre o una explicación que se puede clarificar? Abrí un [issue](https://github.com/Davidxap/javascript-para-subir-de-nivel/issues) o mandá un pull request. Los aportes en traducción también son bienvenidos.

---

## English

**[Read the book online →](https://davidxap.github.io/javascript-para-subir-de-nivel/en/)** — *JavaScript: Level Up* is a free technical book that takes you from "I know how to use JavaScript" to understanding how it really works: closures and lexical scope, prototypes and classes, the event loop, modules, design patterns, defensive security, and the newest TC39 features (ES2025-ES2026). Every code block runs in the browser, and every chapter has exercises with hints and solutions.

---

# Development

## Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | [Astro](https://astro.build) | Islands architecture, fast static output |
| Docs engine | [Starlight](https://starlight.astro.build) | i18n, search, dark/light mode out of the box |
| Content | Markdown (`src/content/docs/`) | Simple, portable |
| Deploy | GitHub Actions → GitHub Pages | Free, automatic on every push |

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # output: dist/
```

## Project structure

```
src/
├── content/
│   └── docs/               # Spanish chapters (default locale)
│       ├── index.md
│       ├── cap-01.md ... cap-12.md
│       └── en/             # English translation (same filenames)
├── components/
│   ├── Flashcard.astro     # Click-to-flip card with localStorage state
│   ├── CodeRunner.astro    # Standalone runnable JS snippet
│   ├── VideoEmbed.astro    # YouTube embed (privacy-enhanced)
│   └── ThemePicker.astro   # Theme selector in header
├── components/overrides/
│   └── SiteTitle.astro     # Injects ThemePicker into Starlight header
├── scripts/interactive.js  # Adds a "Run" button to every JS code block
└── styles/custom.css       # Catppuccin + GitHub + Solarized + Dracula + One Dark themes
tools/
└── make-og.sh              # Regenerates public/og.png (social share card)
```

### SEO checklist

Every page needs its own `description` in the frontmatter — it becomes the `<meta name="description">` and the social preview text. `astro.config.mjs` sets the global `og:image` (`public/og.png`, regenerate with `bash tools/make-og.sh`), and `public/robots.txt` points crawlers at the sitemap (built by `@astrojs/sitemap`).

### Adding a new chapter

1. Create `src/content/docs/cap-13.md` (Spanish) and `src/content/docs/en/cap-13.md` (English) with frontmatter:

   ```yaml
   ---
   title: "Chapter 13: ..."
   description: "One sentence a search engine can index (under 160 characters)."
   ---
   ```

2. Add it to the sidebar in `astro.config.mjs` (sidebars `sidebarEs` / `sidebarEn`).

3. Commit and push — the site redeploys itself.

### Interactivity

1. **Run buttons on code blocks** — `public/js/interactive.js` scans every
   ` ```javascript ` block and adds a **Run** button. Code executes inside a
   sandboxed `<iframe sandbox="allow-scripts">`; `console.log` output is captured
   and displayed below the block.

2. **Flashcards** (`src/components/Flashcard.astro`) — use inside `.mdx` files:

   ```mdx
   import Flashcard from '../../components/Flashcard.astro';
   <Flashcard question="What is a closure?" answer="A function that remembers its lexical scope." />
   ```

   State ("knew it" / "review") persists per card in `localStorage`.

3. **Video embeds** (`src/components/VideoEmbed.astro`) — use in `.mdx` files:

   ```mdx
   import VideoEmbed from '../../components/VideoEmbed.astro';
   <VideoEmbed id="dQw4w9WgXcQ" label="How the Event Loop works" />
   ```

### Translations

The book is available in Spanish (original) and English. If you spot a translation issue, open an issue or PR.
