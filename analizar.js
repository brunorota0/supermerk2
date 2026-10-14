// compras-carrefour · analizar.js  (genérico: no contiene datos de ningún usuario)
// Pegar en la herramienta de JavaScript del navegador, en una página de carrefour.com.ar.
// Con sesión iniciada: lee el historial y precios públicos. No toca el carrito ni la cuenta.
// Devuelve un objeto con la decisión, las listas y las preguntas para el usuario.

await (async () => {
  // ---------- Parámetros generales (no dependen del usuario) ----------
  const CFG = {
    minCompras: 4,          // un producto necesita al menos N compras para analizarse
    minPedidos: 4,          // con menos pedidos no hay cadencia confiable
    diasNecesario: 10,      // vence en ≤ N días → necesario en este pedido
    diasAtrasado: -20,      // vencido hace más de N días → preguntar antes de sugerir
    promoMin: 0.25,         // descuento mínimo para adelantar una compra
    adelantarNoPerec: 60,   // no perecedero: adelantar si vence en ≤ N días
    adelantarPerec: 18,     // perecedero: adelantar si vence en ≤ N días
    // Tipos de producto que suelen cambiar de marca: se cuentan juntos.
    // Punto de partida; los demás productos se agrupan por nombre.
    categorias: {
      'atún': /at[uú]n/i, 'arvejas': /arveja/i, 'choclo': /choclo/i, 'jamón': /jam[oó]n/i,
      'mayonesa': /mayonesa/i, 'preservativos': /preservativ/i, 'lavandina': /lavandina/i,
      'detergente': /detergente/i, 'suavizante': /suavizante/i, 'yerba': /yerba/i,
      'aceite': /aceite/i, 'galletitas': /galletita/i, 'gaseosa': /gaseosa/i, 'cerveza': /cerveza/i,
    },
    perecedero: /yogur|queso|crema de leche|jam[oó]n|fiambre|salame|\bpan\b|finlandia|manteca(?! ghee)|ricota|\bleche\b|fresco/i,
    noPerecedero: /congelad|rebozad|langostino|milanesa|uat|larga vida|papas? (noisette|bast|cong)|mc ?cain/i,
    granel: / x kg| x uni|x 1 atado|x kg\.|seleccion x/i, // a granel: el precio siempre figura rebajado; se excluye
  };

  // ---------- Utilidades ----------
  const H = { credentials: 'include', headers: { Accept: 'application/json' } };
  const DAY = 864e5, TZ = 3 * 3600e3;
  const day = d => Math.floor((new Date(d).getTime() - TZ) / DAY);
  const iso = n => new Date(n * DAY).toISOString().slice(0, 10);
  const today = day(Date.now());
  const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)[.,](\d+)/g, '$1$2').replace(/\b(grs|gr|gramos)\b/g, 'g').replace(/\b(lts|lt|litros?)\b/g, 'l')
    .replace(/\b(unidades|uni|un)\b/g, 'u').replace(/\bcc\b/g, 'ml').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(x|de|con|en|y|el|la|sabor|tipo)\b/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  const catOf = n => Object.keys(CFG.categorias).find(c => CFG.categorias[c].test(n)) || null;

  // ---------- 1) Sesión ----------
  const me = await (await fetch('/api/checkout/pub/orderForm', H)).json();
  if (!me.loggedIn) return { accion: 'LOGIN', mensaje: 'Pedile al usuario que inicie sesión en el panel del navegador. No le pidas ni escribas su contraseña.' };

  // ---------- 2) Historial ----------
  let list = [], page = 1, pages = 1;
  do {
    const j = await (await fetch(`/api/oms/user/orders?page=${page}&per_page=15`, H)).json();
    if (!j || !j.list) break;
    list = list.concat(j.list); pages = (j.paging && j.paging.pages) || 1; page++;
  } while (page <= pages);
  const det = [];
  for (let i = 0; i < list.length; i += 8)
    det.push(...await Promise.all(list.slice(i, i + 8).map(o => fetch('/api/oms/user/orders/' + o.orderId, H).then(r => r.json()).catch(() => null))));
  const orders = det.filter(o => o && o.items && !/cancel/i.test(o.status || '')).sort((a, b) => a.creationDate < b.creationDate ? -1 : 1);
  if (orders.length < CFG.minPedidos) return { accion: 'SIN_HISTORIAL', pedidos: orders.length, mensaje: 'Hay pocos pedidos para calcular la frecuencia. Pedile al usuario la lista de lo que compra seguido.' };

  // ---------- 3) Cadencia y ahorro histórico ----------
  const od = orders.map(o => day(o.creationDate));
  const cadencia = med(od.slice(1).map((d, k) => d - od[k]));
  const diasDesdeUltimo = today - od.at(-1);
  const ahorroPedido = o => { let L = 0, P = 0; o.items.forEach(i => { if (CFG.granel.test(i.name)) return; const b = Math.max(i.listPrice, i.price); L += b * i.quantity; P += Math.min(i.sellingPrice, b) * i.quantity; }); return L ? 1 - P / L : 0; };
  const ahorroHist = avg(orders.filter(o => day(o.creationDate) >= today - 365).map(ahorroPedido));

  // ---------- 4) Agrupar productos (mismo SKU, mismo nombre normalizado, o misma categoría) ----------
  const par = {}, f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const u = (a, b) => { par[a] ??= a; par[b] ??= b; par[f(a)] = f(b); };
  orders.forEach(o => o.items.forEach(i => { u('s' + i.id, 'n' + norm(i.name)); const c = catOf(i.name); if (c) u('s' + i.id, 'c' + c); }));
  const G = {};
  orders.forEach(o => {
    const d = day(o.creationDate), seen = {};
    o.items.forEach(i => {
      if (CFG.granel.test(i.name)) return;
      const k = f('s' + i.id), g = G[k] || (G[k] = { days: [], q: [], promo: 0 });
      g.name = i.name; g.sku = i.id; g.cat = catOf(i.name) || g.cat;
      if (!seen[k]) {
        seen[k] = 1; g.days.push(d); g.q.push(i.quantity);
        const b = Math.max(i.listPrice, i.price); if (b > 0 && i.sellingPrice < b * 0.99) g.promo++;
      } else g.q[g.q.length - 1] += i.quantity;
    });
  });

  // ---------- 5) Productos activos + tendencia de consumo ----------
  const activos = Object.values(G).filter(g => g.days.length >= CFG.minCompras).map(g => {
    const iv = g.days.slice(1).map((d, k) => d - g.days[k]);
    const m = med(iv);
    const qTip = Math.max(1, Math.round(med(g.q)));
    const qUlt = g.q.at(-1);
    const vence = Math.round(g.days.at(-1) + m * Math.max(1, qUlt / qTip) - today);
    // tendencia: últimos intervalos mucho más largos, o cantidades bajando → consumo en baja
    const ivRecientes = med(iv.slice(-3));
    const qRecientes = avg(g.q.slice(-3)), qAntes = avg(g.q.slice(0, -3));
    const bajando = (iv.length >= 5 && ivRecientes > 1.5 * m) || (g.q.length >= 6 && qRecientes < 0.6 * qAntes);
    return { ...g, m, qTip, vence, bajando, desde: today - g.days.at(-1), perecedero: CFG.perecedero.test(g.name) && !CFG.noPerecedero.test(g.name) };
  }).filter(g => g.desde <= Math.max(2 * g.m, 45));

  // ---------- 6) Precios y promos en vivo (público) ----------
  const live = {}, skus = activos.map(g => g.sku);
  for (let i = 0; i < skus.length; i += 25) {
    const c = skus.slice(i, i + 25);
    const j = await (await fetch('/api/catalog_system/pub/products/search?' + c.map(s => 'fq=skuId:' + s).join('&') + '&_from=0&_to=49', H)).json().catch(() => []);
    for (const p of (Array.isArray(j) ? j : [])) for (const it of (p.items || [])) {
      if (!c.includes(it.itemId)) continue;
      const o = it.sellers[0].commertialOffer;
      const names = [...(o.Teasers || []), ...(o.DiscountHighLight || [])].map(t => t['<Name>k__BackingField'] || t.Name || '').filter(n => n.includes('PROMO'));
      // las promos no se suman: nos quedamos con la mejor
      let eff = o.ListPrice > o.Price ? 1 - o.Price / o.ListPrice : 0, multi = false; const lab = [];
      for (const n of names) {
        lab.push(((n.match(/PROMO-(.*?)(?:\s+Max|\s*-Reg)/) || [])[1] || n).trim());
        let m, e = 0;
        if ((m = n.match(/2do al (\d+)%/))) e = m[1] / 200;
        else if (/2x1/i.test(n)) e = .5;
        else if (/3x2/i.test(n)) e = 1 / 3;
        else if ((m = n.match(/(\d+)% Off/i)) && !(o.ListPrice > o.Price)) e = m[1] / 100;
        if (e > eff) { eff = e; multi = !!(/2do|2x1|3x2/i.test(n)); }
      }
      live[it.itemId] = { precio: o.Price, lista: o.ListPrice, stock: o.AvailableQuantity > 0, eff, multi, promo: [...new Set(lab)].join('; ') };
    }
  }

  // ---------- 7) Clasificar ----------
  const out = { necesarios: [], adelantar: [], atrasados: [], sinStock: [], consumoBajando: [] };
  let reg = 0, pag = 0;
  for (const g of activos) {
    const L = live[g.sku] || {};
    const item = { sku: g.sku, nombre: g.name.slice(0, 60), categoria: g.cat, vence: g.vence, cadaDias: g.m, cant: g.qTip, precio: L.precio, promo: L.promo || '', dto: Math.round(100 * (L.eff || 0)) };
    if (g.bajando) { out.consumoBajando.push(item); continue; } // siempre se muestra: la persona decide
    if (g.vence < CFG.diasAtrasado) { out.atrasados.push(item); continue; }
    let dest = null;
    if (g.vence <= CFG.diasNecesario) dest = 'necesarios';
    else if ((L.eff || 0) >= CFG.promoMin && g.vence <= (g.perecedero ? CFG.adelantarPerec : CFG.adelantarNoPerec)) dest = 'adelantar';
    if (!dest) continue;
    if (L.stock === false) { out.sinStock.push(item); continue; }
    if (L.multi && item.cant % 2) item.cant++;
    const unitReg = L.multi ? L.precio : Math.max(L.lista || 0, L.precio || 0), unitPag = L.multi ? L.precio * (1 - L.eff) : (L.precio || 0);
    item.subtotal = Math.round(unitPag * item.cant); reg += unitReg * item.cant; pag += unitPag * item.cant;
    out[dest].push(item);
  }

  // ---------- 8) Decisión (respeta la cadencia; lo que se mueve es estirar una semana) ----------
  const ahorroSemana = reg ? 1 - pag / reg : 0;
  let decision;
  if (diasDesdeUltimo < cadencia - 3) decision = 'TODAVIA_NO';
  else if (diasDesdeUltimo >= cadencia + 10) decision = 'PEDIR_YA';
  else if (ahorroSemana >= ahorroHist) decision = 'PEDIR_ESTA_SEMANA';
  else decision = 'ESTIRAR_UNA_SEMANA';

  // ---------- 9) Lo que se infirió (para que el usuario lo corrija) ----------
  const cats = {};
  activos.forEach(g => { if (g.cat) cats[g.cat] = (cats[g.cat] || 0) + 1; });
  const preguntas = [
    ...out.atrasados.map(i => `¿Todavía necesitás "${i.nombre}"? (lo compraste cada ~${i.cadaDias} días y ya pasó el plazo)`),
    ...out.consumoBajando.map(i => `"${i.nombre}" parece que estás consumiendo menos. ¿Lo querés en el pedido?`),
  ];

  return {
    accion: 'OK',
    hoy: iso(today), ultimoPedido: iso(od.at(-1)), diasDesdeUltimo, cadencia, pedidos: orders.length,
    ahorroHistorico: +(100 * ahorroHist).toFixed(1), ahorroEstaSemana: +(100 * ahorroSemana).toFixed(1),
    decision, totalEstimado: Math.round(pag), ahorroEstimado: Math.round(reg - pag),
    ...out,
    preguntas,
    configInferida: { categorias: cats, productosActivos: activos.length, perecederos: activos.filter(g => g.perecedero).length },
  };
})();
