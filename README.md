# ALFRED IOS STORES

Proyecto base para una tienda de productos digitales.

## Incluye
- Registro e inicio de sesión de clientes.
- Saldo por cliente.
- Solicitud de recarga mediante comprobante (imagen/PDF).
- Panel de administración para aprobar/rechazar recargas.
- Compra de productos usando saldo.
- Categorías: Sensibilidades, Filza, 3105 e iMazing.
- Precio, imagen, video y enlace de MediaFire por producto.
- Sección "Mis productos".
- Estructura para desplegar en Render.

## Productos iniciales
- Sensibilidad Alto — RD$45
- Sensibilidad cuello — RD$40
- Sensibilidad pecho — RD$50
- Sensibilidad barriga — RD$50
- Sensibilidad mágica — RD$50
- Ver arma y personaje — RD$15

## Avisos de la tienda
- Entrega: puede tardar de 1 a 2 horas después de la verificación.
- Compatibilidad indicada por el propietario: iPhone/iOS 14–27, excepto iOS 18.7.1–18.7.10 por el momento.

## Antes de producción
1. Cambia ADMIN_EMAIL y ADMIN_PASSWORD en Render.
2. Cambia SESSION_SECRET (Render puede generarlo).
3. Configura un almacenamiento persistente para SQLite (incluido en render.yaml).
4. Configura HTTPS/dominio.
5. Revisa límites y políticas de comprobantes.
6. Los enlaces de MediaFire son visibles para compradores que hayan adquirido el producto; MediaFire no impide que un enlace sea compartido. Para mayor control, posteriormente se puede migrar a almacenamiento privado con enlaces temporales.

## Ejecutar localmente
npm install
npm start
Abrir http://localhost:10000


## Configuración solicitada
- Correo de administrador: Blackblack1000130@gmail.com
- Método de pago: Banreservas
- Dato de pago: 9605206264
- La contraseña del administrador NO se guarda en el proyecto ni en GitHub. Debe colocarse en Render como `ADMIN_PASSWORD`.
