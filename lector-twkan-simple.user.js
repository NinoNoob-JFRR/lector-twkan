// ==UserScript==
// @name         Lector limpio para twkan (simple)
// @namespace    lector-twkan.simple.local
// @version      1.0.0
// @description  Reestructura los capitulos de twkan.com en parrafos limpios, sin anuncios ni marcas de agua. Solo formato, tamano de letra y correcciones.
// @match        *://*.twkan.com/txt/*
// @updateURL    https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan-simple.user.js
// @downloadURL  https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan-simple.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Si la version completa ya esta actuando en esta pagina, esta no se
    // duplica. Asi se pueden tener las dos instaladas y alternar en Tampermonkey.
    if (window.__lectorTwkanActivo) {
        return;
    }
    window.__lectorTwkanActivo = true;

    const CONTENT_SELECTORS = [
        '#txtcontent0', '#txtcontent', '.txtcontent', '#chaptercontent', '.read-content'
    ];
    const STORAGE_KEY = 'lectorTwkan.settings.v1';
    const FIXES_KEY = 'lectorTwkan.fixes.v1';
    const DEFAULTS = { fontSize: 18 };

    const settings = Object.assign({}, DEFAULTS, readSettings());

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
                ? list.filter((pair) => Array.isArray(pair) && pair[0])
                    .map((pair) => [String(pair[0]), String(pair[1] || '')])
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

    /**
     * Deshace una correccion en el texto que ya esta en pantalla, para poder
     * quitarla sin recargar el capitulo (el texto visible ya la tenia aplicada).
     */
    function revertFixOnScreen(pair) {
        const wrapper = document.querySelector('.lector-limpio');
        if (!wrapper || !pair || !pair[1] || pair[1] === pair[0]) {
            return;
        }
        const walk = (node) => {
            if (node.nodeType === 3) {
                const value = node.nodeValue;
                if (value && value.indexOf(pair[1]) >= 0) {
                    node.nodeValue = value.split(pair[1]).join(pair[0]);
                }
                return;
            }
            for (const child of Array.from(node.childNodes || [])) {
                walk(child);
            }
        };
        walk(wrapper);
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

    function findContentIn(root) {
        for (const selector of CONTENT_SELECTORS) {
            const element = root.querySelector(selector);
            if (!element) {
                continue;
            }
            // Tambien vale si ya es el bloque limpio, aunque el texto sea corto.
            if (element.querySelector('.lector-limpio') || (element.textContent || '').length > 200) {
                return element;
            }
        }
        return null;
    }

    function findContent() {
        return findContentIn(document);
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
    const TERMINAL_PUNCTUATION = /[。！？…!?.;:][」』”"’）)】》\]]*$/;
    const HEADING_LINE = /^第[0-9０-９一二三四五六七八九十百千零〇]+章/;
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

    function splitParagraphs(text, heading) {
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

        // El capitulo repite al principio el titulo que ya muestra el <h1>.
        // Se quita antes de unir frases, o acabaria pegado al primer parrafo.
        if (heading && parts[0] && parts[0].length > 3 && heading.startsWith(parts[0])) {
            parts.shift();
        }

        // Solo se unen los trozos que la web corta a mitad de frase (sin
        // puntuacion final). El texto de cada parrafo completo no se toca.
        const paragraphs = [];
        for (const part of parts) {
            const previous = paragraphs[paragraphs.length - 1];
            const cortada = previous && !TERMINAL_PUNCTUATION.test(previous)
                && !HEADING_LINE.test(previous);
            if (cortada) {
                paragraphs[paragraphs.length - 1] = joinText(previous, part);
            } else {
                paragraphs.push(part);
            }
        }
        return paragraphs;
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
        // El <h1> lleva detras el nombre de la novela y del sitio: se compara
        // solo con el principio.
        const heading = (document.querySelector('h1')?.innerText || '').trim();
        const paragraphs = clean
            ? readRendered(clean)
            : splitParagraphs(htmlToText(root.innerHTML), heading);
        return paragraphs.filter((p) => !isWatermark(p));
    }

    /**
     * Escribe los parrafos en la pagina.
     *
     * Todo el capitulo va en un solo bloque separado por <br><br>, igual que en
     * la pagina original. Asi el traductor recibe el texto entero como una
     * unidad y conserva el contexto: con un <p> por parrafo traducia cada uno
     * aislado y cambiaba nombres, frases y cifras.
     */
    function paint(paragraphs) {
        const content = findContent();
        if (!content || !paragraphs || !paragraphs.length) {
            return false;
        }
        injectStyles();

        const wrapper = document.createElement('div');
        wrapper.className = 'lector-limpio';
        wrapper.style.setProperty('--lector-font-size', settings.fontSize + 'px');

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

    function render() {
        const content = findContent();
        if (!content) {
            return false;
        }
        return paint(collectParagraphs(content));
    }

    function changeFontSize(delta) {
        settings.fontSize = Math.min(28, Math.max(14, settings.fontSize + delta));
        saveSettings();
        const wrapper = document.querySelector('.lector-limpio');
        if (wrapper) {
            wrapper.style.setProperty('--lector-font-size', settings.fontSize + 'px');
        }
    }

    function closeFixes() {
        const actual = document.getElementById('lector-fixes');
        if (actual) {
            actual.remove();
        }
    }

    /**
     * Ventana de correcciones: lista las que hay (con su boton de borrar) y
     * permite anadir nuevas sin salir de ella.
     */
    function openFixes() {
        closeFixes();
        const overlay = document.createElement('div');
        overlay.id = 'lector-fixes';
        overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;'
            + 'background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;';

        const box = document.createElement('div');
        box.style.cssText = 'background:white;color:rgb(17,17,17);max-width:520px;width:100%;max-height:90vh;'
            + 'overflow:auto;border-radius:12px;padding:16px;'
            + 'font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;';

        const title = document.createElement('h2');
        title.textContent = 'Correcciones';
        title.style.cssText = 'margin:0 0 6px;font-size:18px;';
        box.appendChild(title);

        const intro = document.createElement('p');
        intro.textContent = 'Si el traductor cambia un nombre o una palabra, escribe como sale y como '
            + 'debe salir. Se aplica a todos los capitulos. Si dejas el segundo campo vacio, la palabra '
            + 'se quita del texto.';
        intro.style.cssText = 'margin:0 0 10px;color:rgb(85,85,85);font-size:13px;';
        box.appendChild(intro);

        const lista = document.createElement('div');
        lista.style.cssText = 'margin:0 0 12px;';
        box.appendChild(lista);

        const pintarLista = () => {
            lista.replaceChildren();
            if (!fixes.length) {
                const vacio = document.createElement('p');
                vacio.textContent = 'Todavia no hay correcciones.';
                vacio.style.cssText = 'margin:6px 0;color:rgb(120,120,120);font-size:13px;';
                lista.appendChild(vacio);
                return;
            }
            fixes.forEach((pair, index) => {
                const fila = document.createElement('div');
                fila.style.cssText = 'display:flex;gap:8px;align-items:center;'
                    + 'border-top:1px solid rgb(230,230,230);padding:7px 0;';

                const texto = document.createElement('span');
                texto.textContent = pair[0] + '  ->  ' + (pair[1] || '(quitarla)');
                texto.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;';
                fila.appendChild(texto);

                const borrar = document.createElement('button');
                borrar.type = 'button';
                borrar.textContent = 'Borrar';
                borrar.style.cssText = 'border:0;border-radius:6px;padding:7px 10px;font:inherit;'
                    + 'font-size:13px;background:rgb(180,30,30);color:white;cursor:pointer;';
                borrar.addEventListener('click', () => {
                    const pair = fixes[index];
                    fixes.splice(index, 1);
                    saveFixes();
                    revertFixOnScreen(pair);
                    pintarLista();
                    render();
                });
                fila.appendChild(borrar);
                lista.appendChild(fila);
            });
        };
        pintarLista();

        const form = document.createElement('div');
        form.style.cssText = 'border-top:1px solid rgb(221,221,221);padding-top:12px;';

        const label = document.createElement('p');
        label.textContent = 'Anadir una correccion';
        label.style.cssText = 'margin:0 0 6px;font-weight:600;font-size:13px;';
        form.appendChild(label);

        const inputStyle = 'width:100%;box-sizing:border-box;padding:8px;margin:0 0 6px;'
            + 'border:1px solid rgb(204,204,204);border-radius:6px;font:inherit;';

        const desde = document.createElement('input');
        desde.type = 'text';
        desde.placeholder = 'Sale como (ej. Han Lu)';
        desde.spellcheck = false;
        desde.autocomplete = 'off';
        desde.style.cssText = inputStyle;
        form.appendChild(desde);

        const hacia = document.createElement('input');
        hacia.type = 'text';
        hacia.placeholder = 'Debe salir (vacio = quitarla)';
        hacia.spellcheck = false;
        hacia.autocomplete = 'off';
        hacia.style.cssText = inputStyle;
        form.appendChild(hacia);

        const anadir = document.createElement('button');
        anadir.type = 'button';
        anadir.textContent = 'Anadir';
        anadir.style.cssText = 'border:0;border-radius:8px;padding:9px 14px;font:inherit;'
            + 'background:rgb(31,111,235);color:white;cursor:pointer;';
        form.appendChild(anadir);

        const guardar = () => {
            const from = desde.value.trim();
            const to = hacia.value.trim();
            if (!from) {
                desde.focus();
                return;
            }
            const existente = fixes.find((pair) => pair[0] === from);
            if (existente) {
                revertFixOnScreen(existente);
                existente[1] = to;
            } else {
                fixes.push([from, to]);
            }
            saveFixes();
            desde.value = '';
            hacia.value = '';
            desde.focus();
            pintarLista();
            render();
        };
        anadir.addEventListener('click', guardar);
        desde.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                guardar();
            }
        });
        hacia.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                guardar();
            }
        });
        box.appendChild(form);

        const acciones = document.createElement('div');
        acciones.style.cssText = 'display:flex;justify-content:flex-end;margin-top:14px;';
        const cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.textContent = 'Cerrar';
        cerrar.style.cssText = 'border:0;border-radius:8px;padding:10px 14px;font:inherit;'
            + 'background:rgb(87,96,106);color:white;cursor:pointer;';
        cerrar.addEventListener('click', closeFixes);
        acciones.appendChild(cerrar);
        box.appendChild(acciones);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        desde.focus();
    }

    function buildPanel() {
        if (document.getElementById('lector-twkan-panel')) {
            return;
        }
        // En el movil los botones son mas grandes, para poder pulsarlos con el dedo.
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const panel = document.createElement('div');
        panel.id = 'lector-twkan-panel';
        // Centrada abajo, sin tapar los laterales de la pantalla.
        panel.style.cssText = [
            'position:fixed', 'left:50%', 'bottom:10px',
            'transform:translateX(-50%)',
            'z-index:2147483647',
            'display:flex', 'flex-wrap:wrap', 'gap:4px', 'align-items:center',
            'justify-content:center',
            'max-width:calc(100vw - 16px)', 'box-sizing:border-box',
            'padding:' + (isMobile ? '7px' : '5px'), 'border-radius:10px',
            'background:rgba(24,24,28,.9)', 'color:white',
            'font:' + (isMobile ? '13px' : '12px') + '/1.2 system-ui,-apple-system,Segoe UI,sans-serif',
            'box-shadow:0 4px 14px rgba(0,0,0,.35)'
        ].join(';');
        if (isMobile) {
            panel.style.bottom = 'calc(8px + env(safe-area-inset-bottom))';
        }

        const makeButton = (label, title, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.title = title;
            button.style.cssText = 'border:0;border-radius:6px;padding:'
                + (isMobile ? '9px 12px' : '5px 8px') + ';'
                + 'background:rgb(58,58,68);color:white;font:inherit;cursor:pointer;'
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
        panel.appendChild(makeButton('Corregir', 'Ver, anadir y borrar correcciones de palabras', openFixes));
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
