# compras-carrefour

Skill para Claude que planifica las compras en **Carrefour Argentina** (carrefour.com.ar) a partir del historial de pedidos de quien la usa:

- calcula cada cuánto compra cada producto (mediana entre pedidos)
- detecta lo que le toca reponer y lo que conviene adelantar por promo
- recomienda si pedir esta semana o estirar una más
- arma el carrito, sin pasar por el checkout ni pagar

No contiene datos de ningún usuario: todo se infiere del historial de la persona que la use.

## Requisitos
- Claude con la app de escritorio y el navegador integrado.
- Una cuenta de Carrefour Argentina con pedidos previos (mínimo 4).

## Uso
1. Instalá la skill (carpeta `compras-carrefour/` o el archivo `.skill`).
2. Pedile a Claude "¿me toca pedir al súper?" o "armame el carrito de Carrefour".
3. Si no tiene sesión, iniciá sesión vos en el panel del navegador. Claude nunca pide ni guarda tu contraseña.

## Estructura
- `SKILL.md`: instrucciones para Claude.
- `scripts/analizar.js`: lee historial y precios y devuelve la decisión (solo lectura).
- `scripts/cargar_carrito.js`: carga la lista aprobada en el carrito (no paga).
- `references/api-carrefour.md`: endpoints y formato de precios.

## Limitaciones
- Los endpoints de Carrefour (VTEX) no son públicos ni documentados: pueden cambiar sin aviso.
- Revisá los términos de uso de Carrefour antes de automatizar compras.
- Las categorías de sustitución y los perecederos son heurísticas: la skill las muestra para que la persona las corrija.

## Licencia
MIT
