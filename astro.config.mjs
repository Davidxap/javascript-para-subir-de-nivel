import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const sidebarEs = [
  { label: 'Inicio', link: '/' },
  { label: 'Introducción', link: '/introduccion/' },
  {
    label: 'Capítulos',
    items: [
      { label: '1 · Funciones modernas', link: '/cap-01/' },
      { label: '2 · Objetos, prototipos y clases', link: '/cap-02/' },
      { label: '3 · Asincronía y Event Loop', link: '/cap-03/' },
      { label: '4 · Módulos', link: '/cap-04/' },
      { label: '5 · Estructuras avanzadas', link: '/cap-05/' },
      { label: '6 · Errores y depuración', link: '/cap-06/' },
      { label: '7 · Patrones creacionales', link: '/cap-07/' },
      { label: '8 · Patrones comportamentales', link: '/cap-08/' },
      { label: '9 · Arquitecturas de estado', link: '/cap-09/' },
      { label: '10 · Seguridad defensiva', link: '/cap-10/' },
      { label: '11 · Gestión de recursos async', link: '/cap-11/' },
      { label: '12 · APIs modernas (TC39)', link: '/cap-12/' },
    ],
  },
  { label: 'Bibliografía', link: '/bibliografia/' },
];

const sidebarEn = [
  { label: 'Home', link: '/en/' },
  { label: 'Introduction', link: '/en/introduccion/' },
  {
    label: 'Chapters',
    items: [
      { label: '1 · Modern functions', link: '/en/cap-01/' },
      { label: '2 · Objects & classes', link: '/en/cap-02/' },
      { label: '3 · Async & Event Loop', link: '/en/cap-03/' },
      { label: '4 · Modules', link: '/en/cap-04/' },
      { label: '5 · Data structures', link: '/en/cap-05/' },
      { label: '6 · Error handling', link: '/en/cap-06/' },
      { label: '7 · Creational patterns', link: '/en/cap-07/' },
      { label: '8 · Behavioral patterns', link: '/en/cap-08/' },
      { label: '9 · State architecture', link: '/en/cap-09/' },
      { label: '10 · Defensive security', link: '/en/cap-10/' },
      { label: '11 · Async resources', link: '/en/cap-11/' },
      { label: '12 · TC39 proposals', link: '/en/cap-12/' },
    ],
  },
  { label: 'References', link: '/en/bibliografia/' },
];

export default defineConfig({
  site: 'https://davidxap.github.io/javascript-para-subir-de-nivel', base: '/javascript-para-subir-de-nivel',
  integrations: [
    starlight({
      title: {
        es: 'JavaScript para Subir de Nivel',
        en: 'JavaScript: Level Up',
      },
      logo: {
        src: './public/favicon.svg',
        alt: 'JS',
      },
      description: 'Libro técnico — de usarlo a entenderlo · David Arroyave',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Español', lang: 'es' },
        en: { label: 'English', lang: 'en' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Davidxap/javascript-para-subir-de-nivel' },
      ],
      head: [
        { tag: "script", attrs: {}, content: "(function(){try{var t=localStorage.getItem('jpsn-theme');if(t){document.documentElement.setAttribute('data-custom-theme',t);if(['mocha','dracula','one-dark','gruvbox','nord','tokyo-night','everforest','kanagawa'].includes(t))document.documentElement.setAttribute('data-theme','dark');else if(t==='light')document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();void 0;" },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true } },
        { tag: "link", attrs: { href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap", rel: "stylesheet" } },
        { tag: "script", attrs: { src: "/javascript-para-subir-de-nivel/js/interactive.js", defer: true } },
        { tag: "script", attrs: { src: "/javascript-para-subir-de-nivel/js/theme-restore.js", defer: true } },
      ],
      customCss: ['./src/styles/custom.css'],
      editLink: { baseUrl: 'https://github.com/Davidxap/javascript-para-subir-de-nivel/edit/main/' },
      lastUpdated: true,
      components: {
        SiteTitle: './src/components/overrides/SiteTitle.astro',
      },
    }),
  ],
});
