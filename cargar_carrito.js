// compras-carrefour · cargar_carrito.js
// Run with the browser pane's javascript tool on a carrefour.com.ar page, logged in.
// Loads products into the user's cart. It never goes to checkout, never pays, never confirms anything.
// Before running, replace ITEMS with the list the user approved, and choose MODO:
//   'agregar'   -> adds/updates these SKUs and leaves the rest of the cart as is (default)
//   'reemplazar'-> the cart ends up with exactly ITEMS (only if the user asked to start from scratch)

const ITEMS = [ /* { sku: '10209', cant: 4 }, ... */ ];
const MODO = 'agregar';

const H = { credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
let of = await (await fetch('/api/checkout/pub/orderForm', H)).json();
if (!of.loggedIn) throw new Error('NO_LOGUEADO');
const id = of.orderFormId, want = Object.fromEntries(ITEMS.map(i => [String(i.sku), i.cant]));

// update what is already in the cart
const upd = of.items.map((it, index) => ({ index, quantity: it.id in want ? want[it.id] : (MODO === 'reemplazar' ? 0 : it.quantity) }));
if (upd.length) of = await (await fetch(`/api/checkout/pub/orderForm/${id}/items/update`, { ...H, method: 'POST', body: JSON.stringify({ orderItems: upd }) })).json();

// add what is missing
const have = new Set(of.items.map(i => i.id));
const add = Object.entries(want).filter(([s]) => !have.has(s)).map(([id, quantity]) => ({ id, quantity, seller: '1' }));
if (add.length) of = await (await fetch(`/api/checkout/pub/orderForm/${id}/items?sc=1`, { ...H, method: 'POST', body: JSON.stringify({ orderItems: add }) })).json();

const tot = Object.fromEntries((of.totalizers || []).map(t => [t.id, t.value / 100]));
({
  productos: of.items.length,
  total: of.value / 100,
  descuentos: -(tot.Discounts || 0),
  pctDescuento: tot.Items ? +(100 * -(tot.Discounts || 0) / tot.Items).toFixed(1) : 0,
  noDisponibles: of.items.filter(i => i.availability !== 'available').map(i => i.name),
  // the cart keeps old messages; only show the ones about products still in it
  avisos: (of.messages || []).map(m => m.text).filter(t => of.items.some(i => t.includes(i.name))),
  items: of.items.map(i => `${i.name.slice(0, 45)} x${i.quantity} $${Math.round(i.sellingPrice * i.quantity / 100)}`),
})
