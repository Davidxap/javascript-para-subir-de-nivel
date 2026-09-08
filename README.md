# JavaScript para Subir de Nivel

Interactive technical book site built with **Astro + Starlight**, in Spanish (original) and English.

- Live: https://davidxap.github.io/javascript-para-subir-de-nivel/
- Author: David Arturo Arroyave Perez
- License: MIT (code) + CC BY-NC-SA 4.0 (book content)

## How this site works

### Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | [Astro](https://astro.build) | Islands architecture, fast static output |
| Docs engine | [Starlight](https://starlight.astro.build) | i18n, search, dark/light mode out of the box |
| Content | Markdown (`src/content/docs/`) | Simple, portable |
| Deploy | GitHub Actions -> GitHub Pages | Free, automatic on every push |

## How to get the most out of this book

1. **Read with your editor open.** Every example below has a Run button. Change the code, break it, watch what happens.
2. **Do the exercises before looking at the answers.** Hints and solutions are collapsed on purpose. Click "Show hints" only if you get stuck, and "Show solution" only after you've written your own attempt. Struggling first is where the learning happens.
3. **Read it twice.** The second pass over a chapter you already "mastered" is where the chapters really land.
4. **Explain it back.** If you can't explain a concept in your own words, it isn't yours yet.

The book assumes you've written some JavaScript already. It goes from functions and closures to prototypes, the Event Loop, patterns, security, and the newest language features (ES2025-ES2026).

## Project structure

```
src/
├── content/
│   └── docs/               # Spanish chapters (default locale)
│       ├── index.md
│       ├── introduccion.md
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
```

### Themes

Six developer-friendly themes via the header selector:
- **Latte** (Catppuccin light)
- **GitHub Light**
- **Solarized Light**
- **Mocha** (Catppuccin dark, default)
- **Dracula**
- **One Dark**

### Interactivity

1. **Run buttons on code blocks** -- `public/js/interactive.js` scans every
   ` ```javascript ` block and adds a **Run** button. Code executes inside a
   sandboxed `<iframe sandbox="allow-scripts">`; `console.log` output is captured
   and displayed below the block.

2. **Flashcards** (`src/components/Flashcard.astro`) -- use inside `.mdx` files:

   ```mdx
   import Flashcard from '../../components/Flashcard.astro';
   <Flashcard question="What is a closure?" answer="A function that remembers its lexical scope." />
   ```

   State ("knew it" / "review") persists per card in `localStorage`.

3. **Video embeds** (`src/components/VideoEmbed.astro`) -- use in `.mdx` files:

   ```mdx
   import VideoEmbed from '../../components/VideoEmbed.astro';
   <VideoEmbed id="dQw4w9WgXcQ" label="How the Event Loop works" />
   ```

### Adding a new chapter

1. Create `src/content/docs/cap-13.md` (Spanish) and `src/content/docs/en/cap-13.md` (English) with frontmatter:

   ```yaml
   ---
   title: "Chapter 13: ..."
   ---
   ```

2. Add it to the sidebar in `astro.config.mjs` (sidebars `sidebarEs` / `sidebarEn`).

3. Commit and push -- the site redeploys itself.

### Local development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # output: dist/
```

### Translations

The book is available in Spanish (original) and English. If you spot a translation issue, open an issue or PR.

## Contributing

Found a typo, a code example that doesn't run, or an explanation that could be clearer? Pull requests and suggestions are welcome. This book is study material for everyone who wants to learn JavaScript deeply — if it can help more people, let's improve it together.

---


