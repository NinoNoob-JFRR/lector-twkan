// ==UserScript==
// @name         Lector limpio para twkan
// @namespace    lector-twkan.local
// @version      1.9.0
// @description  Reestructura los capitulos de twkan.com en parrafos limpios, sin anuncios ni marcas de agua y con espaciado uniforme.
// @match        *://*.twkan.com/txt/*
// @updateURL    https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan.user.js
// @downloadURL  https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan.user.js
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
    const GLOSSARY_KEY = 'lectorTwkan.glossary.v1';
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

    // Glosario: se aplica al texto chino ANTES de traducirlo. Un nombre o una
    // marca escrita en latino el traductor la respeta siempre, asi que esto
    // arregla de raiz los nombres y los juegos de palabras (小黃書 = parodia de
    // 小紅書, que el traductor convertia en "libro pornografico").
    function readGlossary() {
        try {
            const raw = localStorage.getItem(GLOSSARY_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list)
                ? list.filter((pair) => Array.isArray(pair) && pair[0]).map((pair) => [String(pair[0]), String(pair[1] || '')])
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveGlossary() {
        try {
            localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
        } catch (error) {
            /* almacenamiento no disponible */
        }
    }

    let glossary = readGlossary();

    function applyGlossary(text) {
        let out = text;
        for (const pair of glossary) {
            if (pair[0] && pair[1]) {
                out = out.split(pair[0]).join(pair[1]);
            }
        }
        return out;
    }

    // ---------------- Traduccion con IA ----------------
    // Varios servicios en cadena: si uno agota la cuota del dia, se pasa solo
    // al siguiente. Los planes gratuitos tienen limite diario, pero encadenados
    // cubren de sobra la lectura de un dia (una peticion cada 1.400 caracteres).
    const AI_KEY = 'lectorTwkan.ai.v1';
    const AI_CACHE_KEY = 'lectorTwkan.aiCache.v1';

    const AI_BASE = {
        gemini: { key: '', model: 'gemini-flash-latest', until: 0, cool: 0 },
        groq: { key: '', model: 'llama-3.3-70b-versatile', until: 0, cool: 0 },
        openrouter: { key: '', model: 'google/gemma-4-31b-it:free', until: 0, cool: 0 }
    };
    const AI_ORDER = ['gemini', 'groq', 'openrouter'];
    const AI_NAMES = { gemini: 'Gemini (Google)', groq: 'Groq', openrouter: 'OpenRouter' };
    const AI_MODELS = {
        gemini: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        groq: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'],
        openrouter: [
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'inclusionai/ling-3.2-flash:free',
            'baidu/ernie-5.5-flash-preview:free'
        ]
    };
    const AI_SYSTEM = 'Eres un traductor literario de chino a espanol, especializado en novelas web. '
        + 'Traduces con naturalidad, mantienes los nombres propios en pinyin y no anades comentarios. '
        + 'Devuelves solo la traduccion, con los parrafos separados por una linea en blanco.';

    function readAI() {
        const config = { order: AI_ORDER.slice(), providers: JSON.parse(JSON.stringify(AI_BASE)), auto: false, lastGood: '' };
        try {
            const raw = localStorage.getItem(AI_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            if (saved && typeof saved === 'object') {
                config.auto = Boolean(saved.auto);
                config.lastGood = typeof saved.lastGood === 'string' ? saved.lastGood : '';
                if (Array.isArray(saved.order)) {
                    const orden = saved.order.filter((id) => config.providers[id]);
                    for (const id of AI_ORDER) {
                        if (orden.indexOf(id) < 0) {
                            orden.push(id);
                        }
                    }
                    config.order = orden;
                }
                for (const id of AI_ORDER) {
                    const guardado = saved.providers && saved.providers[id];
                    if (guardado) {
                        config.providers[id].key = String(guardado.key || '');
                        config.providers[id].model = String(guardado.model || config.providers[id].model);
                        config.providers[id].until = Number(guardado.until || 0) || 0;
                        config.providers[id].cool = Number(guardado.cool || 0) || 0;
                    }
                }
            }
        } catch (error) {
            /* configuracion ilegible: se usan los valores por defecto */
        }
        return config;
    }

    let ai = readAI();

    function saveAI() {
        try {
            localStorage.setItem(AI_KEY, JSON.stringify(ai));
        } catch (error) {
            /* almacenamiento no disponible */
        }
    }

    function hasAIKey() {
        return ai.order.some((id) => ai.providers[id] && ai.providers[id].key);
    }

    function nextDayStart() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    }

    function aiPrompt(text) {
        const terminos = glossary
            .filter((pair) => pair[0] && pair[1])
            .map((pair) => pair[0] + ' = ' + pair[1])
            .join('; ');
        let prompt = 'Traduce al espanol este fragmento de una novela web china. '
            + 'Manten el tono de novela, los dialogos y los parrafos. '
            + 'Escribe los nombres propios en pinyin y se consistente. '
            + 'No anadas titulos, notas ni explicaciones. '
            + 'Separa los parrafos con una linea en blanco.';
        if (terminos) {
            prompt += ' Glosario obligatorio: ' + terminos + '.';
        }
        return prompt + '\n\n' + text;
    }

    async function fetchJSON(url, options, timeoutMs) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 90000) : null;
        try {
            const res = await fetch(url, controller ? Object.assign({}, options, { signal: controller.signal }) : options);
            const raw = await res.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch (error) {
                data = raw;
            }
            if (!res.ok) {
                const failure = new Error('HTTP ' + res.status + ' ' + String(raw).slice(0, 180));
                failure.status = res.status;
                failure.body = data;
                throw failure;
            }
            return data;
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    async function callGemini(provider, prompt) {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            + encodeURIComponent(provider.model) + ':generateContent?key=' + encodeURIComponent(provider.key);
        const data = await fetchJSON(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: AI_SYSTEM }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
            })
        }, 30000);
        const candidate = data && data.candidates && data.candidates[0];
        const parts = candidate && candidate.content && candidate.content.parts;
        const text = Array.isArray(parts) ? parts.map((part) => part.text || '').join('') : '';
        if (!text.trim()) {
            throw new Error('respuesta vacia de Gemini');
        }
        return text;
    }

    async function callCompatible(provider, prompt, base, extraHeaders) {
        const headers = Object.assign({
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + provider.key
        }, extraHeaders || {});
        const data = await fetchJSON(base + '/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.4,
                max_tokens: 8192,
                messages: [
                    { role: 'system', content: AI_SYSTEM },
                    { role: 'user', content: prompt }
                ]
            })
        }, 30000);
        const choice = data && data.choices && data.choices[0];
        const text = choice && choice.message ? choice.message.content : '';
        if (!text || !text.trim()) {
            throw new Error('respuesta vacia del servicio');
        }
        return text;
    }

    function callOnce(id, provider, prompt) {
        if (id === 'gemini') {
            return callGemini(provider, prompt);
        }
        if (id === 'groq') {
            return callCompatible(provider, prompt, 'https://api.groq.com/openai/v1');
        }
        return callCompatible(provider, prompt, 'https://openrouter.ai/api/v1', {
            'HTTP-Referer': location.origin,
            'X-Title': 'Lector twkan'
        });
    }

    /**
     * Mensaje legible de un fallo de la API: Gemini, Groq y OpenRouter meten el
     * motivo en sitios distintos, pero casi siempre esta en error.message.
     */
    function describeAIError(error) {
        const body = error && error.body;
        if (body && typeof body === 'object') {
            const detalle = body.error && (body.error.message || body.error.status);
            if (detalle) {
                return String(detalle).slice(0, 220);
            }
            if (body.message) {
                return String(body.message).slice(0, 220);
            }
        }
        return String(error && error.message ? error.message : error).slice(0, 220);
    }

    function isQuotaError(error) {
        if (!error) {
            return false;
        }
        if (error.status === 429) {
            return true;
        }
        const text = String(error.message || '') + ' ' + JSON.stringify(error.body || {});
        return /quota|rate.?limit|resource_exhausted|too many requests|exceeded/i.test(text);
    }

    function isModelError(error) {
        if (!error) {
            return false;
        }
        return error.status === 404
            || /model[^.]{0,40}(not found|does not exist|invalid|decommissioned|unknown)/i.test(String(error.message || ''));
    }

    // Fallo pasajero del servicio (saturacion, 5xx, "provider returned error").
    // No es culpa de la clave ni del modelo: merece probar otro modelo y, si
    // no, dejar descansar ese servicio unos minutos.
    function isTransientError(error) {
        if (!error) {
            return false;
        }
        if (error.status >= 500) {
            return true;
        }
        const text = String(error.message || '') + ' ' + JSON.stringify(error.body || {});
        return /high demand|temporarily|unavailable|try again later|overloaded|provider returned error/i.test(text);
    }

    async function callProvider(id, provider, prompt) {
        const modelos = [provider.model].concat(AI_MODELS[id] || [])
            .filter((model, index, all) => model && all.indexOf(model) === index);
        let lastError = null;
        let quotaError = null;
        for (const model of modelos) {
            try {
                const text = await callOnce(id, Object.assign({}, provider, { model }), prompt);
                if (model !== provider.model) {
                    provider.model = model;
                    saveAI();
                }
                return text;
            } catch (error) {
                lastError = error;
                if (isQuotaError(error)) {
                    // La cuota suele ser por modelo: se prueba el siguiente del
                    // mismo servicio antes de darlo por agotado hasta manana.
                    quotaError = error;
                    continue;
                }
                if (!isModelError(error) && !isTransientError(error)) {
                    throw error;
                }
            }
        }
        throw quotaError || lastError || new Error('ningun modelo disponible');
    }

    async function requestTranslation(text, onProvider, promptOverride) {
        let lastError = null;
        // El servicio que funciono la ultima vez se prueba primero: asi no se
        // pierden segundos en uno que esta saturado en cada capitulo.
        const orden = ai.order.slice();
        if (ai.lastGood && orden.indexOf(ai.lastGood) > 0) {
            orden.splice(orden.indexOf(ai.lastGood), 1);
            orden.unshift(ai.lastGood);
        }
        for (const id of orden) {
            const provider = ai.providers[id];
            if (!provider || !provider.key) {
                continue;
            }
            if (provider.until && provider.until > Date.now()) {
                continue;
            }
            if (provider.cool && provider.cool > Date.now()) {
                continue;
            }
            try {
                if (onProvider) {
                    onProvider(id);
                }
                const result = await callProvider(id, provider, promptOverride || aiPrompt(text));
                let cambio = false;
                if (provider.until || provider.cool) {
                    provider.until = 0;
                    provider.cool = 0;
                    cambio = true;
                }
                if (ai.lastGood !== id) {
                    ai.lastGood = id;
                    cambio = true;
                }
                if (cambio) {
                    saveAI();
                }
                return result;
            } catch (error) {
                lastError = error;
                if (isQuotaError(error)) {
                    provider.until = nextDayStart();
                    saveAI();
                } else {
                    // Saturado o con un fallo pasajero: se deja descansar unos
                    // minutos para no repetir el mismo error en cada trozo.
                    provider.cool = Date.now() + 10 * 60 * 1000;
                    saveAI();
                }
            }
        }
        throw lastError || new Error('no hay ninguna IA con clave');
    }

    function splitTranslation(text) {
        const clean = String(text || '')
            .replace(/^```[a-zA-Z]*\s*/, '')
            .replace(/```\s*$/, '')
            .replace(/^(aqui|aquí)\s+(esta|está)\s+la\s+traducci[oó]n[^\n]*\n+/i, '')
            .trim();
        const parts = clean.split(/\n\s*\n+/)
            .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
            .filter(Boolean);
        return parts.length ? parts : [clean];
    }

    function chunkParagraphs(paragraphs, max) {
        const chunks = [];
        let current = [];
        let size = 0;
        for (const paragraph of paragraphs) {
            if (current.length && size + paragraph.length > max) {
                chunks.push(current.join('\n\n'));
                current = [];
                size = 0;
            }
            current.push(paragraph);
            size += paragraph.length + 2;
        }
        if (current.length) {
            chunks.push(current.join('\n\n'));
        }
        return chunks;
    }

    function chapterKey() {
        return location.pathname + location.search;
    }

    function readAICache() {
        try {
            const raw = localStorage.getItem(AI_CACHE_KEY);
            const data = raw ? JSON.parse(raw) : null;
            const entry = data && data[chapterKey()];
            return entry && Array.isArray(entry.p) && entry.p.length ? entry.p : null;
        } catch (error) {
            return null;
        }
    }

    function saveAICache(paragraphs) {
        try {
            const raw = localStorage.getItem(AI_CACHE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            data[chapterKey()] = { t: Date.now(), p: paragraphs };
            const keys = Object.keys(data).sort((a, b) => (data[b].t || 0) - (data[a].t || 0));
            for (const key of keys.slice(30)) {
                delete data[key];
            }
            localStorage.setItem(AI_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            /* sin espacio: se sigue sin cache */
        }
    }

    function saveAICacheTitle(title) {
        try {
            const raw = localStorage.getItem(AI_CACHE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            const key = chapterKey();
            if (!data[key]) {
                data[key] = { t: Date.now(), p: [] };
            }
            data[key].n = title;
            localStorage.setItem(AI_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            /* sin espacio: se sigue sin cache */
        }
    }

    function readAICacheTitle() {
        try {
            const raw = localStorage.getItem(AI_CACHE_KEY);
            const data = raw ? JSON.parse(raw) : null;
            const entry = data && data[chapterKey()];
            return entry && typeof entry.n === 'string' ? entry.n : '';
        } catch (error) {
            return '';
        }
    }

    // El titulo que muestra el <h1> lleva detras el nombre de la novela, el
    // autor y el sitio, separados por guiones. El titulo real es lo primero.
    function headingToTitle() {
        const raw = (document.querySelector('h1')?.innerText || '').trim();
        return raw.split(/\s*[-–—]\s*/)[0].trim();
    }

    function cleanTitle(text) {
        const line = String(text || '')
            .split('\n')
            .map((part) => part.trim())
            .filter(Boolean)[0] || '';
        return line
            .replace(/\*\*/g, '')
            .replace(/^["'«“]+|["'»”]+$/g, '')
            .replace(/^titulo:\s*/i, '')
            .trim();
    }

    function titlePrompt(text) {
        return 'Traduce al espanol este titulo de capitulo de una novela china. '
            + 'Conserva el numero y el formato "Capitulo N" y traduce la parte descriptiva. '
            + 'Devuelve solo el titulo, en una linea, sin comillas ni comentarios.'
            + '\n\n' + text;
    }

    // Escribe el titulo traducido en el <h1> de la pagina, que es donde el
    // lector mira para saber en que capitulo esta.
    function paintTitle(text) {
        const h1 = document.querySelector('h1');
        if (h1 && text && (h1.innerText || '').trim() !== text) {
            h1.textContent = text;
        }
    }

    let aiBusy = false;

    // El titulo se traduce en paralelo con el cuerpo. Es corto, asi que suele
    // llegar antes y el lector ve enseguida "Capitulo 102: ...". Si falla, se
    // queda el titulo original: no bloquea la traduccion del capitulo.
    function translateTitle() {
        const original = sourceTitle;
        if (!original) {
            return;
        }
        requestTranslation(original, null, titlePrompt(original))
            .then((text) => {
                const limpio = cleanTitle(text);
                if (limpio) {
                    paintTitle(limpio);
                    saveAICacheTitle(limpio);
                }
            })
            .catch(() => {
                /* titulo sin traducir: se queda el original */
            });
    }

    async function translateChapter(silent) {
        if (aiBusy) {
            return;
        }
        const content = findContent();
        if (!content) {
            return;
        }
        if (!hasAIKey()) {
            if (!silent) {
                openAISettings();
            }
            return;
        }
        const source = sourceParagraphs && sourceParagraphs.length
            ? sourceParagraphs.slice()
            : collectParagraphs(content);
        if (!source.length) {
            return;
        }
        const chunks = chunkParagraphs(source, 2200);
        const result = [];
        const button = document.getElementById('lector-ia');
        aiBusy = true;
        if (button) {
            button.disabled = true;
            button.style.opacity = '.6';
        }
        showProgress('Preparando la traduccion...');
        translateTitle();
        let pintado = false;
        try {
            for (let index = 0; index < chunks.length; index++) {
                const etiqueta = 'Traduciendo ' + (index + 1) + '/' + chunks.length;
                if (button) {
                    button.textContent = 'IA ' + (index + 1) + '/' + chunks.length;
                }
                showProgress(etiqueta + '...');
                const text = await requestTranslation(chunks[index], (id) => {
                    if (button) {
                        button.textContent = 'IA ' + (index + 1) + '/' + chunks.length;
                        button.title = 'Traduciendo con ' + (AI_NAMES[id] || id);
                    }
                    showProgress(etiqueta + ' con ' + (AI_NAMES[id] || id));
                });
                const trozos = splitTranslation(text);
                result.push.apply(result, trozos);
                // Se pinta cada trozo en cuanto llega, para poder empezar a leer
                // sin esperar a que termine el capitulo entero.
                if (!pintado) {
                    pintado = paint(trozos);
                } else {
                    appendTranslation(trozos);
                }
            }
            if (!result.length) {
                throw new Error('la traduccion vino vacia');
            }
            saveAICache(result);
        } catch (error) {
            const usadas = ai.order.filter((id) => ai.providers[id] && ai.providers[id].key);
            const agotadas = usadas.filter((id) => ai.providers[id].until > Date.now()).length;
            const aviso = agotadas && agotadas === usadas.length
                ? 'Todas las IA agotaron su cuota de hoy. Puedes esperar al reinicio o anadir otra clave.'
                : 'No se pudo traducir: ' + describeAIError(error);
            if (silent) {
                if (button) {
                    button.title = aviso;
                }
            } else {
                alert(aviso);
            }
        } finally {
            aiBusy = false;
            hideProgress();
            if (button) {
                button.disabled = false;
                button.style.opacity = '';
                button.textContent = 'IA';
                if (!silent) {
                    button.title = 'Traduce el capitulo con inteligencia artificial';
                }
            }
        }
    }

    function closeAISettings() {
        const actual = document.getElementById('lector-ai-settings');
        if (actual) {
            actual.remove();
        }
    }

    function openAISettings() {
        closeAISettings();
        const overlay = document.createElement('div');
        overlay.id = 'lector-ai-settings';
        overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;'
            + 'background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;';

        const box = document.createElement('div');
        box.style.cssText = 'background:white;color:rgb(17,17,17);max-width:520px;width:100%;max-height:90vh;'
            + 'overflow:auto;border-radius:12px;padding:16px;'
            + 'font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;';

        const title = document.createElement('h2');
        title.textContent = 'Traduccion con IA';
        title.style.cssText = 'margin:0 0 6px;font-size:18px;';
        box.appendChild(title);

        const intro = document.createElement('p');
        intro.textContent = 'Pega la clave de los servicios que quieras. Se usan en orden: si uno '
            + 'agota su cuota del dia, se pasa solo al siguiente. Con las tres suele alcanzar '
            + 'para unos 100 capitulos al dia; si te quedas corto, anade otro servicio.';
        intro.style.cssText = 'margin:0 0 10px;color:rgb(85,85,85);font-size:13px;';
        box.appendChild(intro);

        const autoRow = document.createElement('label');
        autoRow.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:0 0 6px;'
            + 'font-size:13px;line-height:1.35;cursor:pointer;';
        const autoBox = document.createElement('input');
        autoBox.type = 'checkbox';
        autoBox.checked = Boolean(ai.auto);
        autoBox.style.cssText = 'margin:2px 0 0;flex:0 0 auto;';
        const autoText = document.createElement('span');
        autoText.textContent = 'Traducir automaticamente al abrir cada capitulo. No gasta cuota '
            + 'si el capitulo ya esta traducido; si se agota todo, se queda el texto chino.';
        autoRow.appendChild(autoBox);
        autoRow.appendChild(autoText);
        box.appendChild(autoRow);

        const campos = [];

        const buildRow = (id) => {
            const row = document.createElement('div');
            row.style.cssText = 'border-top:1px solid rgb(221,221,221);padding:10px 0;';

            const name = document.createElement('strong');
            name.textContent = AI_NAMES[id];
            row.appendChild(name);

            const key = document.createElement('input');
            key.type = 'password';
            key.placeholder = 'Clave API';
            key.value = ai.providers[id].key;
            key.autocomplete = 'off';
            key.spellcheck = false;
            key.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;margin-top:6px;'
                + 'border:1px solid rgb(204,204,204);border-radius:6px;font:inherit;';
            row.appendChild(key);

            const model = document.createElement('input');
            model.type = 'text';
            model.placeholder = 'Modelo';
            model.value = ai.providers[id].model;
            model.autocomplete = 'off';
            model.spellcheck = false;
            model.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;margin-top:6px;'
                + 'border:1px solid rgb(204,204,204);border-radius:6px;font:12px ui-monospace,Consolas,monospace;';
            row.appendChild(model);

            const status = document.createElement('p');
            status.style.cssText = 'margin:6px 0 0;font-size:12px;line-height:1.35;'
                + 'white-space:pre-wrap;color:rgb(85,85,85);';
            row.appendChild(status);

            campos.push({ id, key, model, status });
            return row;
        };

        for (const id of ai.order) {
            box.appendChild(buildRow(id));
        }

        const aviso = document.createElement('p');
        aviso.textContent = 'Las claves se guardan solo en este navegador. Si un servicio esta agotado '
            + 'hasta manana, al cambiar su clave se vuelve a probar.';
        aviso.style.cssText = 'margin:10px 0;color:rgb(85,85,85);font-size:12px;';
        box.appendChild(aviso);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;';

        const makeAction = (label, background, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = 'border:0;border-radius:8px;padding:10px 14px;font:inherit;'
                + 'background:' + background + ';color:#fff;cursor:pointer;';
            button.addEventListener('click', handler);
            return button;
        };

        const guardarCampos = () => {
            ai.auto = autoBox.checked;
            for (const campo of campos) {
                const provider = ai.providers[campo.id];
                const nueva = campo.key.value.trim();
                if (nueva !== provider.key) {
                    provider.until = 0;
                    provider.cool = 0;
                }
                provider.key = nueva;
                provider.model = campo.model.value.trim() || provider.model;
            }
            saveAI();
        };

        actions.appendChild(makeAction('Cerrar', 'rgb(87,96,106)', closeAISettings));
        const probarBoton = makeAction('Probar claves', 'rgb(87,96,106)', async () => {
            guardarCampos();
            probarBoton.disabled = true;
            probarBoton.textContent = 'Probando...';
            for (const campo of campos) {
                const provider = ai.providers[campo.id];
                campo.status.style.color = 'rgb(85,85,85)';
                campo.status.textContent = '';
                if (!provider.key) {
                    campo.status.textContent = 'Sin clave: no se prueba.';
                    continue;
                }
                campo.status.textContent = 'Probando ' + provider.model + '...';
                try {
                    const salida = await callProvider(campo.id, Object.assign({}, provider), 'Responde solo: ok');
                    campo.status.style.color = 'rgb(26,127,55)';
                    campo.status.textContent = 'Bien: ' + salida.trim().slice(0, 60);
                } catch (error) {
                    campo.status.style.color = 'rgb(180,30,30)';
                    campo.status.textContent = 'Falla: ' + describeAIError(error);
                }
            }
            probarBoton.disabled = false;
            probarBoton.textContent = 'Probar claves';
        });
        actions.appendChild(probarBoton);
        actions.appendChild(makeAction('Guardar', 'rgb(31,111,235)', () => {
            guardarCampos();
            closeAISettings();
        }));
        actions.appendChild(makeAction('Traducir ahora', 'rgb(26,127,55)', () => {
            guardarCampos();
            closeAISettings();
            translateChapter();
        }));
        box.appendChild(actions);

        overlay.appendChild(box);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeAISettings();
            }
        });
        document.body.appendChild(overlay);
        const primero = campos.find((campo) => !ai.providers[campo.id].key);
        if (primero) {
            primero.key.focus();
        }
    }

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
        // El <h1> lleva detras el nombre de la novela y del sitio: se compara
        // solo con el principio.
        const heading = (document.querySelector('h1')?.innerText || '').trim();
        let paragraphs;
        if (clean) {
            paragraphs = readRendered(clean);
        } else {
            paragraphs = splitParagraphs(htmlToText(root.innerHTML), heading);
        }

        // El capitulo repite al principio el titulo que ya muestra el <h1>.
        const first = paragraphs[0] || '';
        if (first && first.length > 3 && heading.startsWith(first)) {
            paragraphs.shift();
            if (!sourceTitle) {
                sourceTitle = first;
            }
        }

        paragraphs = paragraphs.filter((p) => !isWatermark(p));
        if (splitLongRequested) {
            paragraphs = paragraphs.flatMap(splitLongParagraph);
        }
        return paragraphs;
    }

    // Texto original del capitulo (en chino, ya limpio). Se guarda para poder
    // reaplicar el glosario aunque la pagina ya este traducida.
    let sourceParagraphs = null;
    // Titulo original del capitulo, sin el nombre de la novela ni del sitio.
    let sourceTitle = '';

    /**
     * Escribe los parrafos en la pagina, ya sea el original o una traduccion.
     * Lo usan tanto el formateo normal como la traduccion con IA.
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

    /** Anade mas parrafos al bloque ya pintado (traduccion por trozos). */
    function appendTranslation(paragraphs) {
        const wrapper = document.querySelector('.lector-limpio');
        if (!wrapper || !paragraphs || !paragraphs.length) {
            return false;
        }
        paragraphs.forEach((text) => {
            if (wrapper.childNodes.length) {
                wrapper.appendChild(document.createElement('br'));
                wrapper.appendChild(document.createElement('br'));
            }
            wrapper.appendChild(document.createTextNode(applyFixes(text)));
        });
        watchTranslations(wrapper);
        return true;
    }

    function showProgress(text) {
        let barra = document.getElementById('lector-progreso');
        if (!barra) {
            barra = document.createElement('div');
            barra.id = 'lector-progreso';
            barra.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);'
                + 'z-index:2147483647;background:rgba(24,24,28,.92);color:#fff;'
                + 'padding:8px 14px;border-radius:999px;'
                + 'font:13px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;'
                + 'box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none;max-width:90vw;';
            document.body.appendChild(barra);
        }
        barra.textContent = text;
    }

    function hideProgress() {
        const barra = document.getElementById('lector-progreso');
        if (barra) {
            barra.remove();
        }
    }

    function render(useSource) {
        const content = findContent();
        if (!content) {
            return false;
        }
        let paragraphs;
        if (useSource && sourceParagraphs) {
            paragraphs = sourceParagraphs.map(applyGlossary);
        } else {
            const original = collectParagraphs(content);
            if (!sourceParagraphs) {
                sourceParagraphs = original.slice();
            }
            if (!sourceTitle) {
                sourceTitle = headingToTitle();
            }
            const cachedTitle = readAICacheTitle();
            if (cachedTitle) {
                paintTitle(cachedTitle);
            }
            // Si este capitulo ya se tradujo con IA, se recuerda y se vuelve a
            // mostrar tal cual: no gasta cuota y se lee al instante.
            const cached = readAICache();
            if (cached) {
                paragraphs = splitLongRequested ? cached.flatMap(splitLongParagraph) : cached.slice();
            } else {
                paragraphs = original.map(applyGlossary);
            }
        }
        return paint(paragraphs);
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
        panel.appendChild(makeButton('Glosario', 'Fija como se traduce un nombre o palabra china', () => {
            const original = prompt('Palabra en chino (tal como sale en el original):');
            if (original === null || !original.trim()) {
                return;
            }
            const key = original.trim();
            const right = prompt('Como debe salir (vacio = borrar esta entrada):', '');
            if (right === null) {
                return;
            }
            const value = right.trim();
            glossary = glossary.filter((pair) => pair[0] !== key);
            if (value) {
                glossary.push([key, value]);
            }
            saveGlossary();
            render(true);
            alert('Guardado. El texto vuelve al original: traduce otra vez para verlo aplicado.');
        }));
        const iaButton = makeButton('IA', 'Traduce el capitulo con inteligencia artificial', () => {
            translateChapter();
        });
        iaButton.id = 'lector-ia';
        panel.appendChild(iaButton);
        panel.appendChild(makeButton('⚙', 'Claves de Gemini, Groq y OpenRouter', () => openAISettings()));
        document.body.appendChild(panel);
    }

    document.addEventListener('keydown', (event) => {
        if (event.altKey && !event.ctrlKey && !event.metaKey
                && event.key.toLowerCase() === 'r') {
            event.preventDefault();
            render();
        }
    });

    // Traduccion automatica al abrir un capitulo (se activa en el boton ⚙).
    function autoTranslate() {
        if (!ai.auto || !hasAIKey()) {
            return;
        }
        if (readAICache()) {
            return;
        }
        // Se espera un poco para que la pagina termine de asentarse.
        setTimeout(() => translateChapter(true), 1500);
    }

    let attempts = 0;
    const timer = setInterval(() => {
        if (render()) {
            clearInterval(timer);
            buildPanel();
            autoTranslate();
            return;
        }
        attempts += 1;
        if (attempts >= 40) {
            clearInterval(timer);
        }
    }, 250);
})();
