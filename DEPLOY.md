# Puesta en marcha en el Contabo existente

El VPS ya utiliza Virtualmin y Apache para otros sitios. Kalu debe instalarse en **un subdominio propio** con proxy inverso hacia la aplicación Node.js. No reemplazar Apache, Virtualmin ni las configuraciones de los demás dominios. El proyecto Laravel de pruebas mencionado antes es independiente: esta versión de Kalu usa Node.js y MongoDB.

## Antes de instalar

1. Confirmar el subdominio definitivo y revisar la configuración actual de Virtualmin y Apache.
2. Medir memoria y espacio disponibles, y comprobar servicios activos. MongoDB debe instalarse solo si el VPS tiene margen suficiente para él, Node.js y los sitios existentes; de lo contrario se requiere ampliar recursos o usar MongoDB en otro servidor privado.
3. Hacer copia de la configuración del sitio y confirmar una forma de revertir el cambio antes de editar Apache.

## Instalación

1. Instalar una versión activa de Node.js y MongoDB Community compatible con la distribución del VPS, siguiendo sus instrucciones oficiales. Crear un usuario de servicio `kalu` sin acceso interactivo.
2. Configurar MongoDB para escuchar solo en `127.0.0.1`, habilitar autenticación y crear un usuario exclusivo de la base `kalu` con permisos de lectura y escritura sobre esa base. El puerto 27017 debe permanecer cerrado al exterior.
3. Copiar este proyecto a `/opt/kalu`, asignar propiedad a `kalu` y ejecutar `npm ci --omit=dev`.
4. Crear `/etc/kalu/kalu.env` legible solo por el administrador y el usuario de servicio. Definir `NODE_ENV=production`, `PORT=3000`, `TZ=America/Santiago`, `APP_ORIGIN=https://SUBDOMINIO`, `MONGODB_URI` con credenciales codificadas para URL, `MONGODB_DB=kalu`, `BOOTSTRAP_USER=admin` y `BOOTSTRAP_PASSWORD` con al menos 16 caracteres aleatorios.
5. Instalar `deploy/kalu.service` como servicio systemd y confirmar que responde localmente en `127.0.0.1:3000`.
6. Crear el subdominio en Virtualmin, apuntar su DNS al VPS y activar su certificado HTTPS. En el VirtualHost HTTPS correspondiente, habilitar `proxy`, `proxy_http` y `headers` e incorporar el fragmento de `deploy/apache-proxy.conf.example`, adaptando el dominio. Validar la configuración de Apache antes de recargarla.
7. Probar la página pública y el login desde el subdominio. Crear un usuario individual de caja. Retirar `BOOTSTRAP_PASSWORD` del entorno tras el primer arranque y reiniciar Kalu.
8. Probar productos del menú, pedidos, apertura y cierre de caja, ventas, inventario e informes con datos de prueba. Programar copias cifradas de MongoDB fuera del VPS y probar una restauración.

La aplicación escucha únicamente en `127.0.0.1:3000`; Apache es la entrada pública. Mantener SSH restringido y aplicar actualizaciones periódicas. No incluir contraseñas ni la URI de MongoDB en capturas o incidencias.

## Antes de operar con clientes reales

Confirmar catálogo, precios, datos del negocio y reglas de caja. Esta versión no emite documentos tributarios ni integra pagos electrónicos. Las ventas se registran manualmente. El inventario se ajusta manualmente hasta definir la receta de insumos de cada producto.
