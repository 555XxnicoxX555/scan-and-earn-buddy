# Sistema visual y movimiento

Sumi separa la identidad estable del producto de la identidad del comercio.
El panel usa superficies neutras, tinta oscura y verde Sumi para acciones
principales; el acento del negocio se reserva para marca y señales puntuales.
El menú público puede ser más expresivo porque representa al comercio.

## Reglas de interfaz

- Radios de hasta 8 px en paneles y tarjetas operativas.
- Botones con icono familiar cuando la acción lo permite y texto cuando la
  orden necesita ser explícita.
- Un solo nivel de tarjetas: no anidar cards dentro de cards.
- Drawers para detalle de clientes/consumos sin contraer tablas.
- Popovers para idioma y presentaciones; modales solo para tareas bloqueantes.
- Controles de formulario con foco visible y tamaño táctil mínimo de 42 px.
- Scroll horizontal de carruseles con snap y barra oculta; tablas conservan su
  scroll cuando es información densa.

## Movimiento

Tokens compartidos:

- rápido: 120 ms para hover y presión;
- normal: 180 ms para popovers y estados;
- lento: 240 ms para drawers, pasos y cambios de superficie;
- easing: `cubic-bezier(.2, .8, .2, 1)`.

El admin usa desplazamientos de pocos píxeles y fades cortos. El menú público
puede usar entrada escalonada o slide sutil, pero nunca debe mover contenido ya
posicionado durante una carga. Los estados de IA mantienen dimensiones fijas y
solo animan el barrido sobre la imagen.

`prefers-reduced-motion: reduce` desactiva animaciones y transiciones no
esenciales. Toda animación nueva debe probarse con esta preferencia.

## Checklist visual

- Desktop 1280x720 y móvil 390x844 sin overflow de página accidental.
- Nombres largos en dos líneas o altura flexible, nunca elipsis si oculta el
  nombre del plato.
- Hover no cambia ancho/alto del control.
- Popovers quedan dentro del viewport y por encima del contenido correcto.
- Drawers y modales solo se cierran con acción explícita o control documentado.
- No aparecen scrollbars internas cuando el contenido puede distribuirse sin
  recortar información.
