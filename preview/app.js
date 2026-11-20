const $ = selector => document.querySelector(selector);
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n || 0);
const data = {
  dashboard:[{name:'Pedidos recientes',value:'Revisa la actividad del local desde el menú lateral.'}],
  orders:[{customer:'Camila',items:'Waffle con frutillas + café',total:9900,status:'preparando'},{customer:'Matías',items:'Churrasco con papas',total:10900,status:'pendiente'},{customer:'Valentina',items:'2 completos italianos',total:15900,status:'entregado'}],
  sales:[{description:'Waffle con frutillas + café',amount:9900,method:'efectivo'},{description:'Churrasco con papas',amount:10900,method:'tarjeta'}],
  cash:[{concept:'Apertura de caja',amount:40000,type:'ingreso'},{concept:'Compra de insumos',amount:8500,type:'egreso'}],
  products:[{name:'Waffle con frutillas',category:'Waffles',price:6900},{name:'Café latte',category:'Café',price:3200},{name:'Churrasco con papas',category:'Salados',price:10900}],
  tables:[{name:'Mesas',value:'Sección de muestra; definiremos mesas y estados más adelante.'}],
  customers:[{name:'Clientes',value:'Sección de muestra; definiremos qué datos guardar.'}],
  settings:[{name:'Configuración',value:'Sección de muestra para ajustes del local y usuarios.'}],
  inventory:[{name:'Mezcla para waffles',quantity:5,unit:'kg'},{name:'Café en grano',quantity:3,unit:'kg'},{name:'Pan',quantity:28,unit:'unidades'}],
  reports:[{name:'Ventas de hoy',value:'$20.800'},{name:'Pedidos pendientes',value:'1'},{name:'Último cierre de caja',value:'$68.500'}],
  users:[{username:'admin',role:'Administrador'},{username:'cajero',role:'Caja'}]
};
const schemas={
  dashboard:['Resumen del local','Actividad del local',[]],
  'new-order':['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  orders:['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  sales:['Registrar venta','Últimas ventas',[['description','Descripción','text'],['amount','Monto (CLP)','number'],['method','Medio de pago','select',['efectivo','tarjeta','transferencia']]]],
  cash:['Movimiento de caja','Movimientos de caja',[['concept','Concepto','text'],['amount','Monto (CLP)','number'],['type','Tipo','select',['ingreso','egreso']]]],
  tables:['Mesas','Estado de mesas',[]],
  customers:['Clientes','Listado de clientes',[]],
  products:['Nuevo producto','Menú y precios',[['name','Producto','text'],['category','Categoría','text'],['price','Precio (CLP)','number']]],
  inventory:['Nuevo insumo','Inventario',[['name','Insumo','text'],['quantity','Cantidad','number'],['unit','Unidad','text']]],
  reports:['Resultados','Resumen de muestra',[]],
  settings:['Configuración','Ajustes del local',[]],
  users:['Nuevo usuario','Usuarios',[['username','Usuario','text'],['role','Perfil','select',['Administrador','Caja']]]]
};
data['new-order']=data.orders;
let section='dashboard',currentRole='admin';
function text(parent,tag,value){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function view(name){for(const id of ['home','login-view','dashboard'])$('#'+id).hidden=id!==name;$('#access-button').hidden=name==='dashboard';$('#logout-button').hidden=name!=='dashboard';}
function field([name,label,type,options]){const wrap=text(document.createElement('label'),'span',label).parentElement;const input=document.createElement(type==='select'?'select':'input');input.name=name;input.required=true;if(type==='select'){for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}}else{input.type=type;if(type==='number'){input.min='0';input.step=name==='quantity'?'any':'1';}}wrap.append(input);return wrap;}
function draw(){const items=$('#records');items.replaceChildren();$('#orders-stat').textContent=data.orders.length;$('#sales-stat').textContent=money(data.sales.reduce((n,x)=>n+x.amount,0));$('#cash-stat').textContent=money(data.cash.reduce((n,x)=>n+(x.type==='ingreso'?x.amount:-x.amount),0)+data.sales.filter(x=>x.method==='efectivo').reduce((n,x)=>n+x.amount,0));for(const item of data[section]){const row=document.createElement('div');row.className='record';const left=document.createElement('div'),right=document.createElement('div');const name=item.customer||item.description||item.concept||item.name||item.username;let detail=item.items||item.method||item.type||item.category||item.unit||item.value||item.role||'';if(['orders','new-order'].includes(section))detail+=` · ${money(item.total)}`;if(section==='products')detail+=` · ${money(item.price)}`;if(section==='inventory')detail=`${item.quantity} ${item.unit}`;text(left,'b',name);text(left,'small',detail);row.append(left);if(['orders','new-order'].includes(section)){const select=document.createElement('select');for(const value of ['pendiente','preparando','entregado','cancelado']){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}select.value=item.status;select.setAttribute('aria-label','Estado de '+item.customer);select.onchange=()=>{item.status=select.value;};right.append(select);}if(section==='sales'||section==='cash')text(right,'strong',money(item.amount));row.append(right);items.append(row);}}
function selectSection(value){section=value;document.querySelectorAll('#section-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.section===value));const [title,list,fields]=schemas[value],form=$('#record-form');$('#form-title').textContent=title;$('#list-title').textContent=list;form.replaceChildren();for(const spec of fields)form.append(field(spec));if(fields.length){const button=text(form,'button','Agregar a la demostración');button.type='submit';button.className='primary';}else form.textContent='Esta sección se completará con los datos y reglas de Kalu.';$('#cash-controls').hidden=value!=='cash';if(value==='cash'){$('#cash-controls').textContent='Caja de muestra · apertura y cierre se conectarán al servidor.';}draw();}
$('#home-button').onclick=()=>view('home');$('#access-button').onclick=()=>view('login-view');$('#logout-button').onclick=()=>view('home');$('#login-form').onsubmit=e=>{e.preventDefault();const username=new FormData(e.currentTarget).get('username');currentRole=username==='ventaskalu'?'ventas':'admin';$('#welcome').textContent=`${username} · ${currentRole==='admin'?'Administración':'Ventas'} · datos de muestra`;view('dashboard');selectSection('dashboard');};$('#section-nav').onclick=e=>{const b=e.target.closest('button[data-section]');if(b)selectSection(b.dataset.section);};$('#record-form').onsubmit=e=>{e.preventDefault();const item=Object.fromEntries(new FormData(e.currentTarget));for(const key of ['total','amount','quantity','price'])if(key in item)item[key]=Number(item[key]);if(section==='orders'||section==='new-order')item.status='pendiente';data[section].unshift(item);e.currentTarget.reset();draw();};
view('home');selectSection('dashboard');
