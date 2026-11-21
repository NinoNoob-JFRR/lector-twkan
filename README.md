# Lector limpio para twkan

Reestructura los capítulos de `twkan.com` para que se lean como en MVLEMPYR:
párrafos separados, espaciado uniforme, sin anuncios incrustados y sin la marca
de agua del sitio.

## Por qué se ve raro el original

El capítulo de twkan no usa párrafos HTML (`<p>`). Mete todo el texto en un
`<div>` y separa los párrafos con dos `<br>` seguidos. Eso provoca:

- un hueco vertical grande y desigual entre párrafos;
- anuncios (`div.txtad`) y líneas de marca de agua (`（請記住 ... twkan.com ...）`)
  metidos en medio del texto;
- bloques que parecen un párrafo de 15 líneas porque el original pegó varios
  párrafos sin salto (la única pista es la sangría de dos espacios chinos `　　`);
- al traducir con Chrome, el traductor puede colapsar los `<br>` y juntar varios
  párrafos en un bloque enorme.

MVLEMPYR, en cambio, usa un `<p>` por párrafo con `margin: 18px 0`,
`line-height: 1.6` y `text-align: justify`. Ese es el ritmo visual que replica
este lector, pero **sin partir el texto en bloques independientes**: el capítulo
entero se entrega al traductor como una sola unidad (igual que la página
original) para que no pierda el contexto.

## Qué hace

- Deja el capítulo en un solo bloque con los mismos saltos que el original, con
  el ritmo visual de MVLEMPYR (18 px, interlineado 1,65, separación de un
  renglón, texto justificado, ancho máximo de 900 px).
- Separa los párrafos que la web pegó sin salto usando la sangría `　　`.
- Elimina los anuncios que van dentro del texto.
- Elimina la línea de marca de agua del sitio.
- Quita el título duplicado (el `<h1>` ya lo muestra la página).
- Une solo las frases que la web corta a mitad (sin puntuación final), para que
  las cifras y las palabras lleguen completas al traductor.
- Añade una barra discreta abajo a la derecha:
  - **Reformatear**: vuelve a aplicar el formato (útil después de traducir).
  - **A− / A+**: tamaño de letra (se recuerda entre capítulos).
  - **Dividir largos**: parte los párrafos de más de 240 caracteres en bloques
    de 2-3 frases. Solo afecta a la vista actual; al recargar vuelve al original.
  - **Corregir**: fija un nombre o palabra que el traductor cambia mal.
  - **Glosario**: fija cómo se traduce un término chino (nombres, marcas,
    juegos de palabras) antes de traducir.
  - **IA**: traduce el capítulo con un modelo de lenguaje (Gemini, Groq u
    OpenRouter), sin pasar por Google Translate. Traduce también el título
    («Capítulo 102: …»), se puede activar la traducción automática al abrir cada
    capítulo y precarga el siguiente para que salga al instante.
  - **⚙**: claves de los servicios de IA, orden de respaldo, traducción
    automática y precarga del capítulo siguiente.
- Atajo **Alt+R** para reformatear.

No envía datos a ningún sitio salvo cuando pulsas **IA**: en ese momento el
texto del capítulo viaja al servicio de IA que tengas configurado. El resto del
tiempo todo ocurre en tu navegador.

## Instalación en Chrome

Hay dos caminos. Si Tampermonkey ya te falló, usa la **opción A**.

### Opción A: extensión de Chrome (no depende de Tampermonkey)

La carpeta `lector-twkan-extension` es una extensión normal de Chrome.

1. Escribe `chrome://extensions` en la barra de direcciones.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta:
   `C:\Users\JFran\Documents\Proyecto predeterminado\lector-twkan-extension`
   (la carpeta, no un archivo suelto).
5. Abre o recarga el capítulo con `Ctrl+F5`.

Si Chrome avisa de que la extensión no es de la tienda, es normal: pulsa
**Mantener** / **Continuar**.

### Opción B: Tampermonkey

1. Abre el panel de Tampermonkey → **Utilidades** → **Importar desde archivo**
   y elige `lector-twkan.user.js`. También puedes abrir
   `https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan.user.js` y pulsar
   **Instalar**.
2. Entra en un capítulo de `twkan.com/txt/...`.

El script lleva `@updateURL` y `@downloadURL` apuntando a GitHub Pages, así que
Tampermonkey comprueba si hay versión nueva y la instala solo (normalmente una
vez al día). Para forzarlo: panel de Tampermonkey → **Buscar actualizaciones**.

#### Si Tampermonkey dice que el script no se ejecutó

Chrome 138 y posteriores exigen activar un permiso aparte para los userscripts:

1. Escribe `chrome://extensions`.
2. Busca **Tampermonkey** y pulsa **Detalles**.
3. Activa **Permitir scripts de usuario** (Allow user scripts).
4. Recarga el capítulo con `Ctrl+F5`.

Si no aparece esa opción, activa antes **Modo de desarrollador** y vuelve a
mirar. Si aun así no funciona, usa la opción A.

### Android

En Android, **Chrome no acepta extensiones ni userscripts**, así que ahí hay
dos caminos reales:

**Opción 1: Firefox + Tampermonkey (se aplica solo).**

1. Instala Firefox desde Play Store.
2. Abre `https://addons.mozilla.org/android/addon/tampermonkey/` en Firefox y
   pulsa **Añadir a Firefox**.
3. Abre `lector-twkan.user.js` desde donde lo tengas (por ejemplo, la página
   `movil.html` del servidor local) y pulsa **Instalar** cuando Tampermonkey
   muestre la pantalla de instalación.
4. Abre un capítulo de twkan. El formato se aplica solo.

**Opción 2: Chrome + marcador (mantiene la traducción de Google).**

Un marcador puede contener `javascript:` y ejecutar el script en la página
abierta. Hay dos versiones:

- **Marcador corto** (`bookmarklet-corto.txt`, 351 caracteres): descarga el
  script de `https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan.user.js`.
  Es el recomendado en el móvil porque se pega sin cortarse y siempre trae la
  última versión (GitHub Pages tarda alrededor de un minuto tras publicar).
  Necesita conexión.
- **Marcador completo** (`bookmarklet.txt`, unos 11 KB): lleva todo el código
  dentro y funciona sin conexión, pero es fácil que el móvil lo pegue a medias.

Pasos (iguales para los dos):

1. Copia el código desde `movil.html` o desde el archivo correspondiente.
2. En Chrome, abre un capítulo de twkan y guárdalo en marcadores (**⋮ → ★**).
3. Abre **⋮ → Marcadores**, mantén pulsado ese marcador y elige **Editar**.
4. Borra la URL y pega el código copiado. Guarda.
5. En cada capítulo, escribe el nombre del marcador en la barra de direcciones
   y tócalo.

Si no pasa nada al tocarlo, comprueba antes que Chrome ejecuta marcadores: crea
un marcador con `javascript:alert('ok')` y tócalo en cualquier página. Si no sale
el aviso, ese Chrome los tiene bloqueados y la vía fiable es Firefox.

**Servidor local para instalar en el móvil**: `node serve.js` dentro de
`lector-twkan` deja disponible `http://IP-DEL-PC:8765/` en la red Wi-Fi. Esa
página explica las dos opciones y trae el botón de copiar el marcador. Solo hace
falta mientras instalas; después puedes cerrarlo.

### iPhone / iPad

- Safari + la app **Userscripts** (App Store).
- Guarda `lector-twkan.user.js` en la carpeta que use la app y actívalo para
  `twkan.com`.

## Si usas traducción automática

El script se ejecuta al cargar la página, antes de que el traductor haga su
trabajo. El texto que llega al traductor es el mismo que en la página original:
solo se quitan los anuncios, la marca de agua y el título repetido.

### Por qué la traducción con y sin script no sale palabra por palabra igual

Porque Google Translate no traduce el texto aislado: lo trocea y cada trozo lo
resuelve por su cuenta. Si el script entregara un `<p>` por párrafo, cada párrafo
sería un trozo independiente y el traductor perdería el contexto (nombres
recortados, frases reformuladas, cifras partidas).

Por eso desde la versión 1.4 el capítulo se entrega en **un solo bloque**, como
en la página original: menos troceo, más contexto y menos cambios arbitrarios.

Aun así, Google Translate no es determinista entre trozos distintos: la misma
frase puede salir algo distinta según el tamaño del bloque, y ningún script puede
evitarlo. Lo que sí se puede fijar son los nombres.

### Corregir nombres y palabras

Hay dos herramientas, según el problema:

**Glosario** (lo recomendado para nombres, marcas y juegos de palabras).
Cambia el término chino **antes** de que lo vea el traductor: si `韓路一` llega
como `Han Luyi`, el traductor lo copia tal cual y no lo recorta nunca.

Pulsa **Glosario** en la barra:

1. Escribe la palabra en chino, tal como sale en el original (`小黃書`).
2. Escribe cómo debe salir (`Xiaohuangshu`). Si lo dejas vacío, se borra.
3. Vuelve a traducir: el texto se pone otra vez en chino y el traductor lo
   recibe con el nombre ya fijado.

Ejemplo real: `小黃書` es una parodia de `小紅書` (Xiaohongshu). El traductor
automático lo lee literal («libro amarillo» = porno) y escribe «un libro
pornográfico» o «una publicación pornográfica». Con la entrada
`小黃書 → Xiaohuangshu` sale «una captura de pantalla de Xiaohuangshu», que es
lo que dice el original.

**Corregir** (para el texto ya traducido). Cambia una palabra en español cuando
el traductor ya ha escrito el texto. Pulsa **Corregir** y se abre una ventana con
**todas** las correcciones guardadas:

- Cada una se ve como `Han Lu -> Han Luyi` con su botón **Borrar**; al borrarla,
  el texto vuelve al momento a como estaba.
- Abajo hay dos campos para añadir otra sin cerrar la ventana: el primero es lo
  que sale mal (`Han Lu`) y el segundo cómo debe salir (`Han Luyi`). Si dejas el
  segundo vacío, esa palabra se quita del texto.

Se guarda en el navegador y se aplica en todos los capítulos, también después de
que el traductor reescriba el texto. No se duplica: si ya pone `Han Luyi`, no lo
convierte en `Han Luyii`.

Las dos listas son por navegador: lo que añadas en el PC no aparece en el móvil
(son `localStorage` distintos).

### Frases cortadas a la mitad (números y palabras raras)

twkan corta el texto con un salto de párrafo en medio de la frase, incluso
dentro de una cifra. Un ejemplo real:

```
月均雲消耗100元/用戶=月流水100
萬。開物拿15%返傭=15萬/月。
```

Eso es «…月流水 100萬» (un millón), pero partido en dos párrafos. Si el script
los deja como dos párrafos, el traductor ve `100` por un lado y `萬` por otro, y
salen cosas como «un ingreso mensual de 100 yuanes / 10.000» en lugar de «un
ingreso mensual de 1 millón».

Desde la versión 1.9.7 (1.0.2 en la simple) el script une esos trozos: si un
párrafo no termina en puntuación final, se considera que la frase sigue y se
enlaza con el siguiente. Al enlazar **no mete espacio cuando hay caracteres
chinos de por medio**, así que `穩` + `定` vuelve a ser `穩定` y no `穩 定`; solo
separa con espacio entre palabras latinas. Tampoco pega líneas sueltas como
`RT` o `>` al párrafo siguiente.

Comprobado con el capítulo 402 de *首富從AI浪潮開始*
(`twkan.com/txt/104687/60049939`): el texto resultante es idéntico al original
carácter por carácter, sin espacios añadidos dentro de las palabras.

### Marcas de agua metidas entre párrafos

twkan inyecta marcas como `GOOGLE搜索TWKAN` entre párrafos y a veces pegadas al
principio del texto real. Antes sobrevivían al formateo y se traducían como si
formaran parte de la frase, así que el resultado no se entendía. Ahora se borran
siempre, tanto si ocupan un párrafo entero como si van dentro de uno.

También aparece otra variante escrita con letras «negrita» de Unicode, que no se
parece a las letras normales:

```
臺灣小説網→𝘁𝘄𝗸𝗮𝗻.𝗰𝗼𝗺
```

Se reconoce y se borra igual, aunque cambie entre 說 y 説.

### Letras que la web borra (AI → A, API → AP)

En el texto de los capítulos twkan quita la letra `I` de algunos términos
latinos: `AI` aparece como `A` y `API` como `AP`. No es un fallo del script; el
HTML que envía el servidor ya viene así (el título de la novela sí conserva el
`AI`).

- `AP` se repara solo con la corrección de fábrica **AP → API**.
- Para `A` → `AI` hay que añadir la corrección en **Corregir**.

Las correcciones de **una sola letra** se aplican únicamente al texto original,
no a la traducción. Si se aplicaran también al español, una preposición `A`
suelta («A veces») se convertiría en `AI veces`. Además, la sustitución solo
toca la palabra completa: `AP` no estropea `APP` ni `Han` estropea `Hangzhou`.

## Traducir con IA (opcional)

Google Translate es gratis e ilimitado, pero traduce literal. Para los casos en
que eso falla (juegos de palabras, marcas parodia, nombres que cambian según el
párrafo), el botón **IA** manda el capítulo a un modelo de lenguaje y pinta la
traducción en la misma página.

### Cómo funciona la cadena

Se pueden configurar tres servicios. El script los usa **en este orden**:

1. **Gemini** (Google)
2. **Groq**
3. **OpenRouter**

Si uno responde que se agotó la cuota **del día**, se marca como agotado hasta
mañana y se pasa solo al siguiente, sin que tengas que hacer nada. Si lo que
responde es el límite **por minuto** (habitual con las claves gratuitas), solo
descansa lo que pida el servicio —normalmente unos segundos— y se reintenta; no
se da el día por perdido. Si un modelo concreto ya no existe, prueba el siguiente
modelo del mismo servicio.

El capítulo se envía en trozos de ~2.200 caracteres (normalmente 1-3 peticiones
por capítulo). Los planes gratuitos dan del orden de cientos de peticiones al
día entre los tres servicios, y la cuota suele ser **por modelo**: el script
rota varios modelos de cada servicio antes de darlo por agotado. Para 100
capítulos al día suele llegar; si un día te quedas corto, añade otra clave de
otro servicio en **⚙**.

### Velocidad

El capítulo se pinta **por trozos**: en cuanto llega el primero puedes empezar a
leer mientras se traducen los demás. Una barra arriba indica el progreso y con
qué servicio está trabajando.

Además, el servicio que funcionó la última vez se prueba primero (`lastGood`), y
el que falla descansa 10 minutos. Los capítulos ya traducidos salen al instante
de la caché.

Para que el cambio de capítulo sea casi instantáneo, mientras lees uno el script
**precarga el siguiente**: descarga esa página (es pequeña y del mismo sitio) y
la traduce en segundo plano. Al pulsar «siguiente» el texto ya está listo y
aparece en menos de un segundo, sin esperar a la IA. Se puede desactivar en **⚙**
si prefieres no gastar cuota por adelantado.

Un capítulo nuevo tarda unos segundos la primera vez: cada petición a un servicio
gratuito tarda lo suyo en generar el texto. Lo que elimina la espera al navegar
es la precarga.

La traducción se guarda en el navegador: si vuelves a abrir ese capítulo, se
muestra al instante y no gasta cuota. Se recuerdan los últimos 30 capítulos.

El **Glosario** también se aplica aquí: los términos fijados se envían como
instrucción obligatoria al modelo.

### Traducción automática al cambiar de capítulo

En **⚙** hay una casilla: «Traducir automáticamente al abrir cada capítulo».
Con ella marcada no hay que pulsar **IA**: al cargar el capítulo, el script
traduce solo.

- Si el capítulo ya está en la caché, lo pinta al instante y no gasta cuota.
- La traducción empieza ~1,5 s después de cargar: así la página termina de
  asentarse y no compite con el traductor de Chrome.
- Si se agotan todos los servicios, deja el texto en chino y no muestra ningún
  aviso (el motivo aparece al pasar el ratón por **IA**). Al día siguiente se
  reintenta solo.

### Precarga del capítulo siguiente

En **⚙** hay otra casilla: «Traducir también el capítulo siguiente mientras
lees». Está marcada por defecto.

- Al terminar el capítulo actual, el script descarga y traduce el siguiente en
  segundo plano (una petición de página y las mismas 2-3 de IA que usaría luego).
- Al pasar de capítulo, el texto ya está en la caché y aparece en menos de un
  segundo: solo se pinta, no se pide nada a la IA.
- Si no continúas leyendo, esa traducción se queda guardada y se aprovecha
  cuando vuelvas.
- Gasta la cuota un poco antes (un capítulo por delante). Si vas justo de cuota,
  desmárcala y se traducirá al entrar, como antes.
- No precarga si el siguiente capítulo ya está traducido o si el enlace
  «下一章» no existe (último capítulo).
- Desmarca la casilla para volver a traducir a mano.

Con Tampermonkey funciona en cada capítulo que abras, incluidos los que enlaza
«siguiente capítulo»: cada uno es una página nueva y el script se ejecuta otra
vez.

### Crear las claves gratuitas

**Gemini**

1. Entra en `https://aistudio.google.com/apikey` con tu cuenta de Google.
2. Pulsa **Create API key** y copia la clave (empieza por `AIza...`).
3. Si te pide crear un proyecto, acepta el que propone.

**Groq** (gratis; no confundir con Grok, que es de pago)

1. Entra en `https://console.groq.com/keys` y crea una cuenta.
2. Pulsa **Create API Key**, ponle un nombre y copia la clave (empieza por
   `gsk_...`). Solo se muestra una vez.

**OpenRouter** (opcional)

1. Entra en `https://openrouter.ai/keys`, crea la cuenta y copia la clave
   (empieza por `sk-or-...`).
2. Los modelos con sufijo `:free` no cuestan nada; el script usa
   `google/gemma-4-31b-it:free` por defecto.

### Pegar las claves

1. Abre un capítulo y pulsa **⚙** en la barra.
2. Pega cada clave en su casilla. El campo de modelo ya viene relleno; solo
   cámbialo si quieres otro.
3. Pulsa **Guardar**. Para traducir en ese momento, **Traducir ahora**.

Las claves se quedan en `localStorage`, en ese navegador: no se envían a ningún
sitio que no sea el propio servicio. En el móvil hay que pegarlas otra vez (es
otro navegador); funciona igual con el marcador, porque Gemini, Groq y
OpenRouter permiten llamarse desde la página.

### Qué esperar

- **Primera vez**: tarda unos segundos por capítulo; el botón muestra
  `IA 1/3`, `IA 2/3`… según los trozos.
- **Capítulo ya traducido**: aparece directamente desde la caché, sin gastar
  cuota.
- **Cuota del día agotada en todos**: aviso «Las IA agotaron su cuota de hoy».
  Al día siguiente se reintentan solos, o añade otra clave.
- **Límite por minuto**: aviso «Las IA están limitadas ahora mismo». Espera un
  minuto y vuelve a pulsar **IA**; no hay que esperar al día siguiente.
- **Reformatear** no pierde la traducción: vuelve a pintar la copia guardada.
- **Glosario** devuelve el texto al chino (para volver a traducir con los
  términos nuevos); la traducción anterior sigue en la caché hasta que pulses
  **IA** otra vez.

### Título del capítulo

Con IA también se traduce el título de la cabecera (`第102章 反客為主` →
`Capítulo 102: …`), que es donde se mira para saber por dónde vas. Se traduce
antes que el cuerpo, con una petición corta, y se guarda en la caché: al volver
al capítulo sale ya traducido sin gastar cuota. Título y cuerpo van en serie
(no a la vez) para no disparar el límite de peticiones por minuto. Si la
traducción del título falla, se queda el original y el capítulo se traduce igual.

Con Google Translate no hace falta: el navegador ya traduce ese `<h1>`. Esta
parte solo actúa cuando usas el botón **IA**.

## Versión simple (sin IA)

Hay un segundo userscript con el mismo lector, pero sin IA ni glosario:

- **Instalar**: <https://ninonoob-jfrr.github.io/lector-twkan/lector-twkan-simple.user.js>
- Barra **centrada** con tres funciones: **Reformatear**, **A-** / **A+** y
  **Corregir**.
- **Corregir** abre una ventana con **todas** las correcciones guardadas. Cada
  una tiene su botón **Borrar**, y abajo hay dos campos para añadir otra sin
  cerrar la ventana. El texto se actualiza al momento.
- No tiene **Dividir largos**, ni **Glosario**, ni **IA** (y por tanto no traduce
  el título ni precarga capítulos: eso lo hace el traductor del navegador).

Se pueden tener los dos scripts instalados en Tampermonkey y activar solo el que
quieras con el interruptor de cada uno en el panel de Tampermonkey. Si por
descuido están los dos activos, solo actúa uno (el primero que se ejecuta), así
que nunca verás dos barras.

El tamaño de letra y las correcciones se guardan en las mismas claves, así que al
cambiar de script lo tienes todo igual.

## Si el sitio cambia de dominio

El script está limitado a `*.twkan.com`. Si usas un espejo, añade su dominio en
la cabecera:

```js
// @match        *://*.ejemplo.com/txt/*
```

## Mi biblioteca (capítulos traducidos a mano)

`biblioteca.html` es una página aparte para leer y guardar lo que traduzcas tú
con Gemini. No traduce nada: recibe el texto ya traducido y le da formato de
lectura.

- **Nueva novela**: título y autor.
- **Añadir capítulo**: pega el texto; si empieza por `第12章 …` o
  `Capítulo 12`, el título se detecta solo.
- **Leer**: fuente con serifa, justificado, temas claro/sepia/oscuro, tamaño de
  letra, interlineado, ancho y posición recordada por capítulo.
- **Híbrido**: los capítulos se guardan en el navegador (IndexedDB) y además se
  pueden descargar como `.txt`, exportar la novela entera o hacer una copia
  `.json` para pasarla al móvil.
- **Importar**: `.txt` sueltos como capítulos o un `.txt` completo, que se
  separa por encabezados.

Se abre en `https://ninonoob-jfrr.github.io/lector-twkan/biblioteca.html` o con
el servidor local. No la abras con doble clic (`file://`): Chrome bloquea el
almacenamiento en ese modo.

Los datos no se suben a GitHub: viven en el navegador de cada dispositivo. Para
pasarlos de uno a otro, usa **Copia de seguridad** (`.json`).

## Regenerar y publicar

`node build.js` dentro de `lector-twkan` regenera todo a partir del userscript:

- `../lector-twkan-extension/content.js`
- `bookmarklet.txt` y `bookmarklet-corto.txt`
- `movil.html` e `instalar.html`

Si existe la variable de entorno `GITHUB_PERSONAL_ACCESS_TOKEN`, además publica
`lector-twkan.user.js`, `lector-twkan-simple.user.js`, `movil.html` y
`biblioteca.html` en `https://github.com/NinoNoob-JFRR/lector-twkan`, que es de
donde tira GitHub Pages
(`https://ninonoob-jfrr.github.io/lector-twkan/`).

## Desinstalar

- Extensión: `chrome://extensions` → **Quitar**.
- Tampermonkey: desactiva o borra el script desde el panel.

La web volverá a su formato original.
