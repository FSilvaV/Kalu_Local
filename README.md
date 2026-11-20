# Kalu Comida Rápida

Aplicación inicial de Kalu con página pública y panel privado para pedidos, ventas, caja, productos, inventario e informes. Los datos se guardan en MongoDB y los importes se muestran en CLP. El menú público muestra los productos visibles que ingresa administración.

## Inicio local

1. Instalar Node.js 22 o superior y MongoDB.
2. Copiar `.env.example` a `.env` y definir una contraseña inicial larga y única.
3. Ejecutar `npm ci` y `npm start`.
4. Abrir `http://localhost:3000` y entrar con el usuario inicial.

La cuenta inicial se crea solo si no existe ningún usuario. Retirar `BOOTSTRAP_PASSWORD` del entorno después del primer inicio. No publicar MongoDB en Internet.

## Despliegue previsto en Contabo

El Contabo existente usa Virtualmin y Apache para otros sitios. Kalu se alojará en un subdominio con Apache como proxy inverso hacia Node.js, sin reemplazar los servicios existentes. Antes de instalar MongoDB hay que revisar memoria y espacio disponibles. MongoDB quedará accesible solo desde `127.0.0.1`, con autenticación y un usuario de aplicación de permisos limitados. Consultar [DEPLOY.md](DEPLOY.md) para el procedimiento.

Esta primera versión permite gestionar operaciones manualmente. Se debe abrir la caja antes de registrar ventas o movimientos. El cierre compara el efectivo contado con el esperado. Una venta no descuenta existencias automáticamente: para ello hacen falta recetas o componentes por producto. Los informes muestran ventas por día, estados de pedidos y cierres recientes.
