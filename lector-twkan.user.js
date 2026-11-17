// ==UserScript==
// @name         Lector limpio para twkan
// @namespace    lector-twkan.local
// @version      1.4.0
// @description  Reestructura los capitulos de twkan.com en parrafos limpios, sin anuncios ni marcas de agua y con espaciado uniforme.
// @match        *://*.twkan.com/txt/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONTENT_SELECTORS = [
        '#txtcontent0', '#txtcontent', '.txtcontent', '#chaptercontent', '.read-content'
    ];
    const STORAGE_KEY = 'lectorTwkan.settings.v1';
    const FIXES_KEY = 'lectorTwkan.fixes.v1';
    const DEFAULTS = { fontSize: 18 };
    const LONG_PARAGRAPH = 240;

    const settings = Object.assign({}, DEFAULTS, readSettings());
    let splitLongRequested = false;

    function readSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            /* almacenamiento no disponible */
        }
    }

    // Correcciones propias del lector: el traductor a veces cambia un nombre
    // segun el parrafo. El usuario lo corrige una vez y se aplica en todos.
    function readFixes() {
        try {
            const raw = localStorage.getItem(FIXES_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list)
                ? list.filter((pair) => Array.isArray(pair) && pair[0]).map((pair) => [String(pair[0]), String(pair[1] || '')])
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveFixes() {
        try {
            localStorage.setItem(FIXES_KEY, JSON.stringify(fixes));
        } catch (error) {
            /* almacenamiento no disponible */
        }
    }

    let fixes = readFixes();

    /**
     * Sustituye "from" por "to" sin repetirse: si el texto ya lleva el
     * resultado ("Han Luyi" cuando se cambia "Han Lu"), no se vuelve a tocar.
     */
    function replaceOnce(text, from, to) {
        if (!from) {
            return text;
        }
        const rest = to.startsWith(from) ? to.slice(from.length) : null;
        let out = '';
        let index = 0;
        for (;;) {
            const found = text.indexOf(from, index);
            if (found < 0) {
                return out + text.slice(index);
            }
            out += text.slice(index, found);
            const already = rest && text.startsWith(rest, found + from.length);
            out += already ? from : to;
            index = found + from.length;
        }
    }

    function applyFixes(text) {
        let out = text;
        for (const pair of fixes) {
            out = replaceOnce(out, pair[0], pair[1]);
        }
        return out;
    }

    function fixTextNode(node) {
        if (!fixes.length) {
            return;
        }
        if (node.nodeType === 3) {
            const value = node.nodeValue;
            if (!value) {
                return;
            }
            const fixed = applyFixes(value);
            if (fixed !== value) {
                node.nodeValue = fixed;
            }
            return;
        }
        // El traductor sustituye parrafos enteros por elementos nuevos, asi que
        // tambien hay que recorrer el subarbol que acaba de insertar.
        if (node.nodeType === 1 && node.childNodes) {
            for (const child of Array.from(node.childNodes)) {
                fixTextNode(child);
            }
        }
    }

    let translationWatcher = null;

    /** Aplica las correcciones tambien cuando el traductor cambia el texto. */
    function watchTranslations(wrapper) {
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        if (!translationWatcher) {
            translationWatcher = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'characterData') {
                        fixTextNode(mutation.target);
                        continue;
                    }
                    for (const node of mutation.addedNodes) {
                        fixTextNode(node);
                    }
                }
            });
        }
        translationWatcher.disconnect();
        translationWatcher.observe(wrapper, { subtree: true, childList: true, characterData: true });
    }

    function findContent() {
        for (const selector of CONTENT_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && (element.innerText || '').length > 200) {
                return element;
            }
        }
        return null;
    }

    function isWatermark(text) {
        if (!text) {
            return false;
        }
        if (/^[（(]?\s*[請请]記住/.test(text)) {
            return true;
        }
        if (/台灣小說網|台湾小说网/.test(text)) {
            return true;
        }
        if (/解書荒|解书荒/.test(text)) {
            return true;
        }
        if (/(章節更新|章节更新)/.test(text) && /(網站|网站)/.test(text)) {
            return true;
        }
        return false;
    }

    function htmlToText(html) {
        const box = document.createElement('div');
        box.innerHTML = html;
        // Solo se quitan los contenedores de anuncio de twkan. Nunca se borra
        // por patrones amplios como [class*="ad-"]: eso podia eliminar tramos
        // de texto real del capitulo.
        box.querySelectorAll('.txtad, .ad, ins.adsbygoogle, script, style, iframe, noscript')
            .forEach((node) => node.remove());
        box.querySelectorAll('.txtcenter').forEach((node) => {
            if (!(node.textContent || '').trim()) {
                node.remove();
            }
        });
        const normalized = box.innerHTML
            .replace(/(?:<br\s*\/?>\s*){2,}/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n');
        const textBox = document.createElement('div');
        textBox.innerHTML = normalized;
        return textBox.textContent || '';
    }

    // Un parrafo que no termina en puntuacion final esta cortado a la mitad:
    // la frase continua en el siguiente trozo.
    const DIGIT_CHAR = /[0-9０-９]/;

    /**
     * Une dos trozos con un espacio, salvo cuando se parte una cifra: ahi el
     * espacio cambiaria el numero ("100" + "000" seria 100 000 y no 100000).
     */
    function joinText(left, right) {
        const before = left.slice(-1);
        const after = right.slice(0, 1);
        if (DIGIT_CHAR.test(before) && DIGIT_CHAR.test(after)) {
            return left + right;
        }
        return left + ' ' + right;
    }

    /**
     * Une las lineas de un mismo parrafo. Los saltos sueltos solo son cortes
     * de linea de la web: no deben dejar espacios dentro de una palabra.
     */
    function foldLines(part) {
        const lines = part.split('\n')
            .map((line) => line.replace(/^[\u3000\u2003\u2002 ]+/, '').replace(/[ \t]+$/, ''))
            .filter((line) => line.length > 0);
        return lines.reduce((acc, line) => (acc ? joinText(acc, line) : line), '');
    }

    function splitParagraphs(text) {
        const normalized = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
        const parts = [];
        for (const block of normalized.split(/\n{2,}/)) {
            // La web corta frases (y numeros como "100萬") a la mitad con un
            // salto de parrafo. La sangria doble delata donde empieza el nuevo.
            for (const piece of block.split(/(?=[\u3000\u2003\u2002]{2})/)) {
                const part = foldLines(piece);
                if (part && !isWatermark(part)) {
                    parts.push(part);
                }
            }
        }
        // No se une nada mas: el texto se entrega tal cual al traductor, para
        // que traduzca lo mismo que la pagina original.
        return parts;
    }

    function splitLongParagraph(paragraph) {
        if (paragraph.length <= LONG_PARAGRAPH) {
            return [paragraph];
        }
        let sentences = paragraph.match(/[^。！？!?…]+[。！？!?…]+[」』”"’）)]*|[^。！？!?…]+$/g);
        if (!sentences || sentences.length < 2) {
            // Solo se corta en un punto seguido de espacio o de final: asi no
            // se parte un decimal (10.5) ni una cifra con separadores.
            sentences = paragraph.match(/[^.!?]+[.!?]+["'”’)\]]*(?=\s|$)|[^.!?]+$/g);
        }
        if (!sentences || sentences.length < 2) {
            return [paragraph];
        }
        const result = [];
        let buffer = '';
        for (const sentence of sentences) {
            buffer += sentence;
            if (buffer.length >= 120) {
                result.push(buffer.trim());
                buffer = '';
            }
        }
        if (buffer.trim()) {
            result.push(buffer.trim());
        }
        return result.length ? result : [paragraph];
    }

    function injectStyles() {
        if (document.getElementById('lector-twkan-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'lector-twkan-styles';
        style.textContent = `
            #txtcontent0 .txtad,
            #txtcontent0 ins { display: none !important; }
            #txtcontent0 .lector-limpio,
            .lector-limpio {
                box-sizing: border-box;
                max-width: 900px;
                margin: 0 auto;
                padding: 4px 0 44px;
                font-size: var(--lector-font-size, 18px);
                line-height: 1.65;
                text-align: justify;
                overflow-wrap: break-word;
                word-break: normal;
                hyphens: none;
            }
            @media (max-width: 600px) {
                #txtcontent0 .lector-limpio,
                .lector-limpio { padding-bottom: 92px; }
            }
        `;
        document.head.appendChild(style);
    }

    /** Lee los parrafos del bloque ya limpio (tambien si esta traducido). */
    function readRendered(wrapper) {
        const parts = [];
        let buffer = '';
        const flush = () => {
            const text = buffer.replace(/[\u2003\u2002]/g, ' ').trim();
            if (text) {
                parts.push(text);
            }
            buffer = '';
        };
        const walk = (node) => {
            if (node.nodeType === 3) {
                buffer += node.nodeValue;
                return;
            }
            if (node.nodeName === 'BR') {
                flush();
                return;
            }
            for (const child of Array.from(node.childNodes || [])) {
                walk(child);
            }
        };
        for (const child of Array.from(wrapper.childNodes)) {
            walk(child);
        }
        flush();
        return parts;
    }

    function collectParagraphs(root) {
        const clean = root.querySelector('.lector-limpio');
        let paragraphs;
        if (clean) {
            paragraphs = readRendered(clean);
        } else {
            paragraphs = splitParagraphs(htmlToText(root.innerHTML));
        }

        // El capitulo suele empezar repitiendo el titulo que ya muestra la
        // pagina en el <h1>: no hace falta leerlo dos veces.
        const title = (document.querySelector('h1')?.innerText || '').trim();
        if (title && paragraphs[0] === title) {
            paragraphs.shift();
        }

        paragraphs = paragraphs.filter((p) => !isWatermark(p));

        if (splitLongRequested) {
            paragraphs = paragraphs.flatMap(splitLongParagraph);
        }
        return paragraphs;
    }

    function render() {
        const content = findContent();
        if (!content) {
            return false;
        }
        const paragraphs = collectParagraphs(content);
        if (!paragraphs.length) {
            return false;
        }
        injectStyles();

        const wrapper = document.createElement('div');
        wrapper.className = 'lector-limpio';
        wrapper.style.setProperty('--lector-font-size', settings.fontSize + 'px');

        // Todo el capitulo va en un solo bloque separado por <br><br>, igual
        // que en la pagina original. Asi el traductor recibe el texto entero
        // como una unidad y conserva el contexto: con un <p> por parrafo
        // traducia cada uno aislado y cambiaba nombres, frases y cifras.
        paragraphs.forEach((text, index) => {
            if (index) {
                wrapper.appendChild(document.createElement('br'));
                wrapper.appendChild(document.createElement('br'));
            }
            wrapper.appendChild(document.createTextNode(applyFixes(text)));
        });
        content.replaceChildren(wrapper);
        watchTranslations(wrapper);
        return true;
    }

    function changeFontSize(delta) {
        settings.fontSize = Math.min(28, Math.max(14, settings.fontSize + delta));
        saveSettings();
        const wrapper = document.querySelector('.lector-limpio');
        if (wrapper) {
            wrapper.style.setProperty('--lector-font-size', settings.fontSize + 'px');
        }
    }

    function buildPanel() {
        if (document.getElementById('lector-twkan-panel')) {
            return;
        }
        // En el movil la barra ocupa el ancho disponible y los botones son
        // mas grandes, para que se puedan pulsar con el dedo.
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const panel = document.createElement('div');
        panel.id = 'lector-twkan-panel';
        panel.style.cssText = [
            'position:fixed', 'right:10px', 'bottom:10px', 'z-index:2147483647',
            'display:flex', 'flex-wrap:wrap', 'gap:4px', 'align-items:center',
            'padding:' + (isMobile ? '7px' : '5px'), 'border-radius:10px',
            'background:rgba(24,24,28,.9)', 'color:#fff',
            'font:' + (isMobile ? '13px' : '12px') + '/1.2 system-ui,-apple-system,Segoe UI,sans-serif',
            'box-shadow:0 4px 14px rgba(0,0,0,.35)'
        ].join(';');
        if (isMobile) {
            panel.style.left = '8px';
            panel.style.bottom = 'calc(8px + env(safe-area-inset-bottom))';
            panel.style.justifyContent = 'center';
        }

        const makeButton = (label, title, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.title = title;
            button.style.cssText = 'border:0;border-radius:6px;padding:'
                + (isMobile ? '9px 12px' : '5px 8px') + ';'
                + 'background:#3a3a44;color:#fff;font:inherit;cursor:pointer;'
                + 'touch-action:manipulation';
            button.addEventListener('click', handler);
            return button;
        };

        panel.appendChild(makeButton('Reformatear', 'Vuelve a aplicar el formato (Alt+R)', () => {
            if (!render()) {
                location.reload();
            }
        }));
        panel.appendChild(makeButton('A-', 'Reducir el tamano de letra', () => changeFontSize(-1)));
        panel.appendChild(makeButton('A+', 'Aumentar el tamano de letra', () => changeFontSize(1)));
        panel.appendChild(makeButton('Dividir largos', 'Separa los parrafos muy largos en bloques mas cortos', () => {
            splitLongRequested = true;
            render();
        }));
        panel.appendChild(makeButton('Corregir', 'Arregla nombres o palabras que el traductor cambia', () => {
            const wrong = prompt('Palabra o nombre que sale mal (tal como se lee ahora):');
            if (wrong === null || !wrong.trim()) {
                return;
            }
            const from = wrong.trim();
            const right = prompt('Como debe salir (vacio = borrar esta correccion):', '');
            if (right === null) {
                return;
            }
            const to = right.trim();
            fixes = fixes.filter((pair) => pair[0] !== from);
            if (to) {
                fixes.push([from, to]);
            }
            saveFixes();
            render();
        }));
        document.body.appendChild(panel);
    }

    document.addEventListener('keydown', (event) => {
        if (event.altKey && !event.ctrlKey && !event.metaKey
                && event.key.toLowerCase() === 'r') {
            event.preventDefault();
            render();
        }
    });

    let attempts = 0;
    const timer = setInterval(() => {
        if (render()) {
            clearInterval(timer);
            buildPanel();
            return;
        }
        attempts += 1;
        if (attempts >= 40) {
            clearInterval(timer);
        }
    }, 250);
})();
