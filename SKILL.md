---
name: compras-carrefour
description: Planifica las compras de supermercado en Carrefour Argentina (carrefour.com.ar) a partir del historial de pedidos de quien la usa. Detecta cuándo le toca reponer cada producto, cruza eso con las promos vigentes, recomienda si pedir esta semana o estirar una más, y arma el carrito para que el usuario lo pague. Usala cuando pregunten qué tienen que comprar, si conviene hacer el pedido del súper, qué promos hay en lo que compran, cuándo pedir, o pidan armar o cargar el carrito de Carrefour, aunque no digan "Carrefour" ni nombren la skill.
---

# Compras Carrefour

Ayudá a la persona a decidir **cuándo** pedir y **qué** llevar, usando su propio historial y las promos del momento. Todo se calcula desde su historial: no hay listas de productos escritas a mano. El carrito lo arma con ella, y **el pago y la confirmación los hace siempre ella**.

## Reglas que no se negocian
- **Nunca** pidas, escribas ni guardes la contraseña. El login es siempre en el panel del navegador, a cargo de la persona.
- **Nunca** vayas al checkout, elijas carrito, toques "Continuar con disponibles" (borra los productos sin stock) ni ingreses datos de pago.
- Ningún dato de la persona se guarda en la skill. Lo que se infiere del historial se muestra para que lo corrija, y queda en la conversación.

## Cómo piensa la gente que compra así
- Pide cada cierta cantidad de días (la cadencia sale del historial). **No adelanta el pedido solo porque una semana tenga buenas promos.** Lo que hace es estirar una semana cuando la semana es mala.
- El consumo varía de semana a semana; por eso se usa la mediana de días entre compras, no el promedio.
- Algunos productos se cambian de marca o variante. Esos se cuentan por categoría, no por código.
- Si el consumo de algo está bajando, no se sugiere por frecuencia: se pregunta, y solo si está en promo fuerte.

## Pasos

### 1. Abrir Carrefour con la sesión de la persona
Abrí `https://www.carrefour.com.ar/` en el navegador integrado de la app. Si el sitio no está permitido, pedí acceso para ese sitio.

### 2. Verificar la sesión y bajar el historial
Leé `scripts/analizar.js` y pasá **su contenido completo** a la herramienta de JavaScript del navegador, en la página de Carrefour. Solo lee: historial y precios públicos.

Según lo que devuelva, `accion`:
- **`LOGIN`**: pedile a la persona que inicie sesión en el panel del navegador y avisale cuando termine. Volvé a correr el script.
- **`SIN_HISTORIAL`**: hay menos de 4 pedidos. Pedile la lista de lo que compra seguido y seguí con esa lista en el paso 4, sin cadencia.
- **`OK`**: seguí con el paso 3.

### 3. Explicar la decisión
Según `decision`:
- **TODAVIA_NO**: todavía no le toca. Decí el día en que entra en ventana (último pedido + cadencia − 3). Si las promos de esta semana son muy buenas, mencionalo como dato, sin empujarla a pedir.
- **PEDIR_ESTA_SEMANA**: le toca y la semana es buena (ahorro estimado ≥ su promedio). Pedir antes de que terminen las promos.
- **ESTIRAR_UNA_SEMANA**: le toca pero la semana es floja. Sugerí esperar a la semana siguiente, salvo que algo necesario no pueda esperar; preguntale.
- **PEDIR_YA**: se pasó bastante de su cadencia; conviene pedir aunque las promos no sean buenas.

Mostrá el ahorro estimado comparado con su promedio histórico. Es una estimación: el total real sale al cargar el carrito.

### 4. Repasar la lista con la persona
- **Necesarios** y **para adelantar** (promo ≥ 25% en algo que le toca pronto).
- **Preguntas** (campo `preguntas` del resultado): atrasados y consumo en baja. Preguntá una por una. Motivos habituales: compró otra marca o envase, le sobró porque llevó de más, o consume menos.
- **Sin stock**: buscá reemplazos (paso 5).
- **Configuración inferida**: en la primera corrida, mostrá las categorías que detectó (`configInferida.categorias`) y preguntá si alguna está mal. Si una categoría no le sirve, decilo y se ajusta en el análisis.

### 5. Reemplazos para lo que no tiene stock
En la página de Carrefour, con la herramienta de JavaScript:
```js
const t = 'texto a buscar'; // marca y producto
const j = await (await fetch('/api/catalog_system/pub/products/search?ft=' + encodeURIComponent(t) + '&_from=0&_to=29', {credentials:'include'})).json();
j.flatMap(p => p.items.map(i => { const o = i.sellers[0].commertialOffer; return { sku: i.itemId, n: i.name, p: o.Price, l: o.ListPrice, st: o.AvailableQuantity > 0 }; })).filter(x => x.st).slice(0, 8)
```
Primero la misma marca en otro sabor o tamaño. Si no hay, una equivalente.

### 6. Cargar el carrito (solo cuando la persona lo pida)
Leé `scripts/cargar_carrito.js`, reemplazá `ITEMS` por la lista que aprobó (`{ sku, cant }`) y corrélo. Por defecto `MODO = 'agregar'`, que no borra lo que ya tenga. Usá `'reemplazar'` solo si pidió empezar de cero.

Contale el total real, los descuentos y si algo quedó no disponible. Decile que lo revise y lo pague ella.

## Cómo responder
Corto y en lenguaje cercano. Primero la decisión en una línea, después las listas, y al final las preguntas. Precios en pesos sin centavos.

## Detalles técnicos
Ver `references/api-carrefour.md`: endpoints, formato de precios, cómo leer las promos y limitaciones.
