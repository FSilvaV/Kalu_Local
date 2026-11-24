const $ = selector => document.querySelector(selector);
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n || 0);
const data = {
  dashboard:[{name:'Pedidos recientes',value:'Revisa la actividad del local desde el menú lateral.'}],
  orders:[{customer:'Camila Rojas',customerId:1,lines:[{name:'Ass italiano',quantity:1,price:3500},{name:'Hamburguesa',quantity:1,price:2500}],total:6000,status:'pendiente',serviceType:'local',createdAt:new Date(Date.now()-12*60000).toISOString()},{customer:'Matías Pérez',customerId:2,lines:[{name:'Churrasco con papas',quantity:1,price:10900}],total:10900,status:'preparando',serviceType:'retiro',createdAt:new Date(Date.now()-34*60000).toISOString()},{customer:'Valentina Soto',customerId:3,lines:[{name:'Waffle con frutillas',quantity:2,price:6900},{name:'Café latte',quantity:1,price:3200}],total:17000,status:'entregado',serviceType:'local',createdAt:new Date(Date.now()-72*60000).toISOString()}],
  sales:[{description:'Waffle con frutillas + café',amount:9900,method:'efectivo',createdAt:new Date(Date.now()-50*60000).toISOString()},{description:'Churrasco con papas',amount:10900,method:'debito',createdAt:new Date(Date.now()-30*60000).toISOString()}],
  cash:[],
  cashiers:[{id:1,name:'Cajera de muestra'}],
  turnTemplates:[{id:1,name:'Turno 1',startTime:'09:00',endTime:'13:00'},{id:2,name:'Turno 2',startTime:'13:00',endTime:'18:00'}],
  cashSessions:[],
  debtPayments:[],
  products:[{name:'Ass italiano',category:'Sándwiches',price:3500},{name:'Hamburguesa',category:'Salados',price:2500},{name:'Completo italiano',category:'Salados',price:3900},{name:'Churrasco con papas',category:'Sándwiches',price:10900},{name:'Chorrillana',category:'Salados',price:12900},{name:'Waffle con frutillas',category:'Waffles',price:6900},{name:'Café latte',category:'Café',price:3200}],
  customers:[{id:1,name:'Camila Rojas',debt:0,creditEnabled:false,creditLimit:0},{id:2,name:'Matías Pérez',debt:0,creditEnabled:false,creditLimit:0},{id:3,name:'Valentina Soto',debt:0,creditEnabled:false,creditLimit:0}],
  settings:[{name:'Configuración',value:'Sección de muestra para ajustes del local y usuarios.'}],
  inventory:[{name:'Mezcla para waffles',quantity:5,unit:'kg'},{name:'Café en grano',quantity:3,unit:'kg'},{name:'Pan',quantity:28,unit:'unidades'}],
  reports:[{name:'Ventas de hoy',value:'$20.800'},{name:'Pedidos pendientes',value:'1'},{name:'Último cierre de caja',value:'$68.500'}],
  users:[{username:'admin',role:'Administrador'},{username:'cajero',role:'Caja'}]
};
const schemas={
  dashboard:['Dashboard administrativo','Actividad del local',[]],
  'new-order':['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  orders:['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  sales:['Ventas','Historial de ventas y documentos',[]],
  cash:['Abrir turno','Historial de turnos',[]],
  customers:['Nuevo cliente','Clientes registrados',[]],
  products:['Nuevo producto','Menú y precios',[['name','Producto','text'],['category','Categoría','text'],['price','Precio (CLP)','number']]],
  inventory:['Nuevo insumo','Inventario',[['name','Insumo','text'],['quantity','Cantidad','number'],['unit','Unidad','text']]],
  reports:['Resultados','Resumen de muestra',[]],
  settings:['Configuración','Cajeras y horarios',[]],
  users:['Nuevo usuario','Usuarios',[['username','Usuario','text'],['role','Perfil','select',['Administrador','Caja']]]]
};
data['new-order']=data.orders;
let section='dashboard',currentRole='admin',editingCustomerId=null,viewingCustomerId=null,nextCustomerId=4,nextDemoCheckoutId=1,nextCashierId=2,nextTurnTemplateId=3,nextCashSessionId=1;
let customerAction='',selectedCustomerIds=new Set();
const salesDateRange={from:'',to:''};
const sectionsByRole={
  admin:['dashboard','sales','customers','cash','inventory','products','settings'],
  ventas:['new-order','orders','sales','customers','cash','inventory','products']
};
function text(parent,tag,value){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function setupCreateDisclosure(){
  const card=document.querySelector('.workspace .form-card');
  const details=document.createElement('details');details.id='create-details';details.open=true;
  const summary=text(details,'summary','Crear');summary.id='create-summary';
  const content=document.createElement('div');content.className='create-content';
  while(card.firstChild)content.append(card.firstChild);
  details.append(content);card.append(details);
}
function view(name){for(const id of ['home','login-view','dashboard'])$('#'+id).hidden=id!==name;$('#access-button').hidden=name==='dashboard';$('#logout-button').hidden=name!=='dashboard';}
function field([name,label,type,options]){const wrap=text(document.createElement('label'),'span',label).parentElement;const input=document.createElement(type==='select'?'select':'input');input.name=name;input.required=true;if(type==='select'){for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}}else{input.type=type;if(type==='number'){input.min='0';input.step=name==='quantity'?'any':'1';}}wrap.append(input);return wrap;}
function orderLines(order){if(Array.isArray(order.lines)&&order.lines.length)return order.lines;if(!order._displayLines)order._displayLines=String(order.items||'').split(/,|\+/).map(name=>({name:name.trim(),quantity:1,prepared:false})).filter(line=>line.name);return order._displayLines;}
function elapsedText(dateValue){const minutes=Math.max(0,Math.floor((Date.now()-new Date(dateValue).getTime())/60000));return minutes<60 ? minutes+' min' : Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min';}
function refreshOrderTimes(){document.querySelectorAll('[data-started-at]').forEach(el=>{el.textContent='Lleva '+elapsedText(el.dataset.startedAt);});}
function drawOrders(container){
  container.className='orders-grid';
  for(const [index,order] of data.orders.entries()){
    const card=document.createElement('article');card.className='order-card';
    const content=document.createElement('div');content.className='order-card-content';
    const heading=document.createElement('div');heading.className='order-card-heading';
    text(heading,'strong','Pedido '+String(index+1).padStart(2,'0'));
    text(heading,'small',order.customer||'Sin cliente');content.append(heading);
    const checklist=document.createElement('div');checklist.className='order-checklist';
    for(const line of orderLines(order)){
      const label=document.createElement('label');label.className='order-check';
      const delivered=order.status==='entregado';
      const check=document.createElement('input');check.type='checkbox';check.checked=delivered||!!line.prepared;check.disabled=delivered;
      check.setAttribute('aria-label','Preparado: '+line.name);
      check.addEventListener('change',()=>{line.prepared=check.checked;label.classList.toggle('done',check.checked);});
      label.classList.toggle('done',!delivered&&check.checked);label.classList.toggle('delivered',delivered);label.append(check);
      text(label,'span',(line.quantity||1)+' × '+line.name);checklist.append(label);
    }
    content.append(checklist);
    const total=document.createElement('div');total.className='order-card-total';
    text(total,'span','Total');text(total,'strong',money(order.total));content.append(total);
    const side=document.createElement('div');side.className='order-card-side';
    text(side,'small','Estado del pedido');
    const select=document.createElement('select');select.setAttribute('aria-label','Estado del pedido '+(index+1));
    for(const status of ['pendiente','preparando','entregado','cancelado']){
      const option=document.createElement('option');option.value=status;
      option.textContent=status[0].toUpperCase()+status.slice(1);select.append(option);
    }
    select.value=order.status||'pendiente';side.dataset.status=select.value;
    select.addEventListener('change',()=>{order.status=select.value;side.dataset.status=select.value;draw();});
    side.append(select);
    const started=new Date(order.createdAt||Date.now());
    text(side,'small','Inicio '+started.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}));
    const elapsed=text(side,'small','');elapsed.dataset.startedAt=started.toISOString();
    if(order.serviceType)text(side,'small',({local:'Servicio local',retiro:'Retiro',delivery:'Delivery'})[order.serviceType]||order.serviceType);
    if(order.paymentMethod==='fiado')text(side,'small','Fiado: '+money(order.creditAmount||order.total)+(order.cashAmount?' · Efectivo: '+money(order.cashAmount):''));
    card.append(content,side);container.append(card);
  }
  refreshOrderTimes();
}
function activeCashSession(){return data.cashSessions.find(session=>session.status==='abierta')||null;}
function currentCashSession(){return activeCashSession()||data.cashSessions.at(-1)||null;}
function entriesForSession(entries,session){if(!session)return[];const start=new Date(session.openedAt).getTime(),end=session.closedAt?new Date(session.closedAt).getTime():Infinity;return entries.filter(entry=>{const when=new Date(entry.createdAt).getTime();return when>=start&&when<=end;});}
function shiftSales(){return entriesForSession(data.sales,currentCashSession());}
function cardMethod(method){return ['debito','credito','tarjeta'].includes(method);}
function cashPaid(sale){return sale.method==='efectivo'?sale.amount:(sale.cashAmount||0);}
function creditUsed(sale){return sale.method==='fiado'?(sale.creditAmount??sale.amount):0;}
function sessionTotals(session){
  const sales=entriesForSession(data.sales,session),payments=entriesForSession(data.debtPayments,session);
  const cashSales=sales.reduce((sum,sale)=>sum+cashPaid(sale),0);
  const cashPayments=payments.filter(payment=>payment.method==='efectivo').reduce((sum,payment)=>sum+payment.amount,0);
  const cardReceived=sales.filter(sale=>cardMethod(sale.method)).reduce((sum,sale)=>sum+sale.amount,0)+payments.filter(payment=>cardMethod(payment.method)).reduce((sum,payment)=>sum+payment.amount,0);
  const salesAmount=sales.reduce((sum,sale)=>sum+sale.amount,0);
  const creditIssued=sales.reduce((sum,sale)=>sum+creditUsed(sale),0);
  const transferReceived=sales.filter(sale=>sale.method==='transferencia').reduce((sum,sale)=>sum+sale.amount,0)+payments.filter(payment=>payment.method==='transferencia').reduce((sum,payment)=>sum+payment.amount,0);
  return{sales,payments,cashSales,cashPayments,cardReceived,salesAmount,creditIssued,transferReceived,expected:(session?.openingAmount||0)+cashSales+cashPayments};
}
function dateTime(value){return new Date(value).toLocaleString('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function chileDate(value){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const part=type=>parts.find(item=>item.type===type).value;return part('year')+'-'+part('month')+'-'+part('day');}
function drawSales(container){
  const filters=document.createElement('form');filters.className='sales-filters';
  const fromLabel=text(filters,'label','Desde');const from=document.createElement('input');from.type='date';from.name='from';from.value=salesDateRange.from;fromLabel.append(from);
  const toLabel=text(filters,'label','Hasta');const to=document.createElement('input');to.type='date';to.name='to';to.value=salesDateRange.to;toLabel.append(to);
  const apply=text(filters,'button','Aplicar rango');apply.type='submit';apply.className='primary';
  const clear=text(filters,'button','Limpiar');clear.type='button';clear.onclick=()=>{salesDateRange.from='';salesDateRange.to='';draw();};
  const error=text(filters,'span','');error.className='sales-filter-error';error.setAttribute('role','alert');
  filters.onsubmit=event=>{event.preventDefault();if(from.value&&to.value&&from.value>to.value){error.textContent='La fecha inicial no puede ser posterior a la final.';return;}salesDateRange.from=from.value;salesDateRange.to=to.value;draw();};
  container.append(filters);
  const list=document.createElement('div');list.className='sales-history';container.append(list);
  const sales=data.sales.filter(sale=>{const day=chileDate(sale.createdAt||Date.now());return(!salesDateRange.from||day>=salesDateRange.from)&&(!salesDateRange.to||day<=salesDateRange.to);}).slice().reverse();
  for(const sale of sales){
    const row=document.createElement('article');row.className='sale-record';
    const info=document.createElement('div');text(info,'b',sale.description);text(info,'small',dateTime(sale.createdAt));
    const method=sale.method==='fiado'?'Fiado '+money(creditUsed(sale))+(sale.cashAmount?' · Efectivo '+money(sale.cashAmount):''):({debito:'Tarjeta · débito',credito:'Tarjeta · crédito',tarjeta:'Tarjeta',efectivo:'Efectivo',transferencia:'Transferencia'})[sale.method]||sale.method;
    text(info,'small',method);row.append(info);text(row,'strong',money(sale.amount));
    const documentCell=document.createElement('div');documentCell.className='sale-document';text(documentCell,'small','Documento: pendiente de API');
    const download=text(documentCell,'button','Descargar boleta');download.type='button';download.disabled=true;download.title='Disponible cuando se conecte la API de documentos';row.append(documentCell);list.append(row);
  }
  if(!sales.length)text(list,'p','No hay ventas en este rango de fechas.');
  const bulk=document.createElement('div');bulk.className='sales-bulk';const bulkButton=text(bulk,'button','Descargar documentos del rango');bulkButton.type='button';bulkButton.disabled=true;bulkButton.title='Disponible cuando se conecte la API de documentos';text(bulk,'small','Las descargas se activarán al conectar la API de boletas.');container.append(bulk);
}
function drawDashboard(container){
  container.className='admin-overview';
  const today=chileDate(Date.now());
  const todayOrders=data.orders.filter(order=>chileDate(order.createdAt||Date.now())===today);
  const todaySales=data.sales.filter(sale=>chileDate(sale.createdAt||Date.now())===today);
  const groups=[
    {title:'Pedidos de hoy',lines:[['Total',todayOrders.length],['Pendientes',todayOrders.filter(order=>order.status==='pendiente').length],['Preparando',todayOrders.filter(order=>order.status==='preparando').length],['Entregados',todayOrders.filter(order=>order.status==='entregado').length]]},
    {title:'Resultado de ventas',lines:[['Ventas registradas',todaySales.length],['Monto de ventas',money(todaySales.reduce((sum,sale)=>sum+sale.amount,0))],['Fiado pendiente',money(data.customers.reduce((sum,customer)=>sum+customer.debt,0))]]},
    {title:'Inventario visible',lines:data.inventory.map(item=>[item.name,item.quantity+' '+item.unit])}
  ];
  for(const group of groups){const card=document.createElement('section');card.className='overview-card';text(card,'h4',group.title);for(const [label,value] of group.lines){const row=document.createElement('div');text(row,'span',label);text(row,'strong',String(value));card.append(row);}container.append(card);}
}
function drawCustomerDetails(customer,host){
  const detail=document.createElement('div');detail.className='customer-detail';detail.id='customer-detail-'+customer.id;
  text(detail,'h4','Historial de #'+String(customer.id).padStart(3,'0')+' · '+customer.name);
  const purchases=data.orders.filter(order=>order.customerId===customer.id);
  const payments=data.debtPayments.filter(payment=>payment.customerId===customer.id);
  const totalCredit=purchases.reduce((sum,order)=>sum+(order.creditAmount||0),0);
  const totalPaid=payments.reduce((sum,payment)=>sum+payment.amount,0);
  const totals=document.createElement('div');totals.className='customer-detail-totals';
  text(totals,'span','Compras fiadas: '+money(totalCredit));text(totals,'span','Abonos: '+money(totalPaid));text(totals,'strong','Deuda actual: '+money(customer.debt));detail.append(totals);
  const entries=[
    ...purchases.map(order=>({kind:'Compra',when:order.createdAt,amount:order.total,detail:(order.items||orderLines(order).map(line=>line.quantity+' × '+line.name).join(', '))+(order.creditAmount?' · Fiado '+money(order.creditAmount):'')+(order.cashAmount?' · Efectivo '+money(order.cashAmount):'')})),
    ...payments.map(payment=>({kind:'Abono',when:payment.createdAt,amount:payment.amount,detail:({efectivo:'Efectivo',debito:'Tarjeta de débito',credito:'Tarjeta de crédito',transferencia:'Transferencia'})[payment.method]||payment.method}))
  ].sort((a,b)=>new Date(b.when)-new Date(a.when));
  if(!entries.length)text(detail,'p','Sin compras ni abonos registrados.');
  for(const entry of entries){const row=document.createElement('div');row.className='customer-history-row';const left=document.createElement('div');text(left,'b',entry.kind+' · '+dateTime(entry.when));text(left,'small',entry.detail);row.append(left);text(row,'strong',money(entry.amount));detail.append(row);}
  if(customer.debt>0){const button=text(detail,'button','Abonar deuda');button.type='button';button.className='primary';button.onclick=()=>payCustomer(customer.id);}
  host.append(detail);
}
function drawCustomers(container){
  const tools=document.createElement('div');tools.className='customer-toolbar';
  const single=text(tools,'button','Abono individual');single.type='button';single.onclick=()=>openCustomerAction('single');
  const multiple=text(tools,'button','Abono múltiple');multiple.type='button';multiple.onclick=()=>openCustomerAction('multiple');
  const remove=text(tools,'button',customerAction==='delete'?'Cancelar selección':'Eliminar clientes');remove.type='button';remove.onclick=()=>openCustomerAction(customerAction==='delete'?'':'delete');
  container.append(tools);
  if(customerAction==='single'||customerAction==='multiple')drawPaymentPanel(container);
  if(customerAction==='delete'){
    const panel=document.createElement('div');panel.className='customer-action-panel';
    text(panel,'p','Marca los clientes que deseas eliminar. Los clientes con deuda o compras vinculadas se conservan.');
    const notice=text(panel,'p','');notice.id='customer-action-message';notice.className='error';notice.setAttribute('role','status');
    const count=text(panel,'strong',selectedCustomerIds.size+' seleccionados');
    const confirm=text(panel,'button','Eliminar seleccionados');confirm.type='button';confirm.className='danger-button';
    confirm.onclick=()=>{const selected=data.customers.filter(item=>selectedCustomerIds.has(item.id));if(!selected.length)return;
      const blocked=selected.filter(item=>item.debt>0||data.orders.some(order=>order.customerId===item.id)||data.sales.some(sale=>sale.customerId===item.id)||data.debtPayments.some(payment=>payment.customerId===item.id));
      if(blocked.length){showCustomerMessage('No se puede eliminar: '+blocked.map(item=>'#'+String(item.id).padStart(3,'0')+' '+item.name).join(', ')+' tiene deuda o historial.');return;}
      if(!window.confirm('¿Eliminar '+selected.length+' cliente(s) seleccionados? Esta acción no se puede deshacer.'))return;
      data.customers=data.customers.filter(item=>!selectedCustomerIds.has(item.id));selectedCustomerIds.clear();customerAction='';viewingCustomerId=null;draw();
    };
    panel.append(count,confirm);container.append(panel);
  }
  for(const customer of data.customers){
    const row=document.createElement('div');row.className='record customer-record';row.dataset.customerId=String(customer.id);
    if(customerAction==='delete'){const label=document.createElement('label');label.className='customer-select';const check=document.createElement('input');check.type='checkbox';check.checked=selectedCustomerIds.has(customer.id);check.setAttribute('aria-label','Seleccionar '+customer.name+' para eliminar');check.onchange=()=>{if(check.checked)selectedCustomerIds.add(customer.id);else selectedCustomerIds.delete(customer.id);container.querySelector('.customer-action-panel strong').textContent=selectedCustomerIds.size+' seleccionados';};label.append(check);row.append(label);}
    const left=document.createElement('div');text(left,'b','#'+String(customer.id).padStart(3,'0')+' · '+customer.name);text(left,'small','Adeudado: '+money(customer.debt));
    if(customer.creditEnabled)text(left,'small','Límite: '+money(customer.creditLimit)+' · Disponible: '+money(Math.max(0,customer.creditLimit-customer.debt)));
    else text(left,'small','Sin límite de crédito configurado');
    const lastPayment=data.debtPayments.filter(payment=>payment.customerId===customer.id).at(-1);
    if(lastPayment)text(left,'small','Último abono: '+money(lastPayment.amount)+' · '+dateTime(lastPayment.createdAt)+' · '+lastPayment.method);
    const actions=document.createElement('div');actions.className='customer-actions';
    const details=text(actions,'button','Detalles');details.type='button';details.className='customer-details-button';details.setAttribute('aria-label','Ver detalles de '+customer.name);details.setAttribute('aria-expanded',String(viewingCustomerId===customer.id));details.setAttribute('aria-controls','customer-detail-'+customer.id);details.onclick=()=>{viewingCustomerId=viewingCustomerId===customer.id?null:customer.id;draw();};
    const edit=text(actions,'button','✎');edit.type='button';edit.title='Modificar cliente';edit.setAttribute('aria-label','Modificar '+customer.name);edit.onclick=()=>editCustomer(customer.id);
    if(customer.debt>0){const pay=text(actions,'button','Abonar');pay.type='button';pay.className='customer-pay';pay.setAttribute('aria-label','Abonar deuda de '+customer.name);pay.onclick=()=>payCustomer(customer.id);}
    row.append(left,actions);container.append(row);
    if(viewingCustomerId===customer.id)drawCustomerDetails(customer,container);
  }
}
function showCustomerMessage(message){const notice=document.querySelector('#customer-action-message');if(notice)notice.textContent=message;else $('#form-error').textContent=message;}
function openCustomerAction(action,id=null){
  customerAction=action;selectedCustomerIds=new Set(id===null?[]:[id]);
  $('#form-error').textContent='';draw();
  if(action==='single'||action==='multiple')document.querySelector('.customer-action-panel')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function drawPaymentPanel(container){
  const panel=document.createElement('form');panel.className='customer-action-panel';panel.noValidate=true;
  text(panel,'h4',customerAction==='single'?'Abono individual':'Abono múltiple');
  const notice=text(panel,'p','');notice.id='customer-action-message';notice.className='error';notice.setAttribute('role','status');
  const debts=data.customers.filter(item=>item.debt>0);
  if(!debts.length){text(panel,'p','No hay clientes con deuda pendiente.');container.append(panel);return;}
  if(customerAction==='single'){
    const label=text(panel,'label','Cliente');
    const select=document.createElement('select');select.name='customerId';select.required=true;
    for(const item of debts){const option=document.createElement('option');option.value=String(item.id);option.textContent='#'+String(item.id).padStart(3,'0')+' · '+item.name+' · '+money(item.debt);select.append(option);}
    if(selectedCustomerIds.size)select.value=String([...selectedCustomerIds][0]);label.append(select);
  }else{
    const list=document.createElement('fieldset');list.className='customer-payment-list';text(list,'legend','Selecciona las deudas que cubrirá este abono');
    for(const item of debts){const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.value=String(item.id);check.name='customerIds';check.checked=selectedCustomerIds.has(item.id);label.append(check,document.createTextNode(' #'+String(item.id).padStart(3,'0')+' · '+item.name+' · '+money(item.debt)));list.append(label);}
    panel.append(list);
  }
  const amountLabel=text(panel,'label','Monto recibido (CLP)');const amount=document.createElement('input');amount.name='paymentAmount';amount.type='number';amount.min='1';amount.step='1';amount.required=true;amountLabel.append(amount);
  const methodLabel=text(panel,'label','Medio de pago');const method=document.createElement('select');method.name='paymentMethod';
  for(const [value,label] of [['efectivo','Efectivo'],['debito','Tarjeta de débito'],['credito','Tarjeta de crédito'],['transferencia','Transferencia']]){const option=document.createElement('option');option.value=value;option.textContent=label;method.append(option);}methodLabel.append(method);
  const balance=text(panel,'div','');balance.className='payment-balance';balance.setAttribute('aria-live','polite');
  const update=()=>{
    const ids=customerAction==='single'?[Number(panel.elements.customerId.value)]:[...panel.querySelectorAll('input[name="customerIds"]:checked')].map(input=>Number(input.value));
    const due=ids.reduce((sum,id)=>sum+(data.customers.find(item=>item.id===id)?.debt||0),0);
    const received=amount.value===''?0:Number(amount.value),difference=received-due;
    balance.textContent='Deuda seleccionada: '+money(due)+' · Monto ingresado: '+money(received)+' · '+(difference<0?'Falta: '+money(-difference):difference>0?'Sobra: '+money(difference):'Cuadra: '+money(0));
  };
  panel.oninput=update;panel.onchange=update;update();
  const submit=text(panel,'button','Registrar abono');submit.type='submit';submit.className='primary';
  const cancel=text(panel,'button','Cancelar');cancel.type='button';cancel.className='customer-cancel';cancel.onclick=()=>openCustomerAction('');
  panel.onsubmit=e=>{
    e.preventDefault();if(!activeCashSession()){notice.textContent='Abre un turno en Caja antes de registrar un abono.';return;}
    const ids=customerAction==='single'?[Number(panel.elements.customerId.value)]:[...panel.querySelectorAll('input[name="customerIds"]:checked')].map(input=>Number(input.value));
    const chosen=ids.map(id=>data.customers.find(item=>item.id===id)).filter(Boolean);
    const received=Number(amount.value);if(!chosen.length||!Number.isSafeInteger(received)||received<=0){notice.textContent='Selecciona clientes e indica un monto válido.';return;}
    const due=chosen.reduce((sum,item)=>sum+item.debt,0);
    if(customerAction==='multiple'&&received!==due){notice.textContent=received<due?'Faltan '+money(due-received)+' para cubrir las deudas seleccionadas.':'Sobran '+money(received-due)+'. Ajusta el monto o la selección.';return;}
    if(customerAction==='single'&&received>due){notice.textContent='Sobran '+money(received-due)+'. El abono no puede superar la deuda.';return;}
    const stamp=new Date().toISOString(),batchId='abono-'+stamp+'-'+Math.random().toString(36).slice(2,8);
    for(const item of chosen){const allocated=customerAction==='single'?received:item.debt;item.debt-=allocated;data.debtPayments.push({customerId:item.id,customer:item.name,amount:allocated,method:method.value,createdAt:stamp,batchId});}
    customerAction='';selectedCustomerIds.clear();draw();
  };
  container.append(panel);
}
function editCustomer(id){
  const customer=data.customers.find(item=>item.id===id);if(!customer)return;
  $('#create-details').open=true;$('#create-summary').textContent='Modificar cliente #'+String(id).padStart(3,'0');
  editingCustomerId=id;mountCustomerForm($('#record-form'),customer);
  $('#form-title').textContent='Modificar cliente #'+String(id).padStart(3,'0');$('#form-error').textContent='';
  $('.form-card').scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function payCustomer(id){
  const customer=data.customers.find(item=>item.id===id);if(customer?.debt>0)openCustomerAction('single',id);
}
function chileTime(value){return new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}
function mountCashForm(form){
  const active=activeCashSession();form.replaceChildren();
  if(active){
    $('#form-title').textContent='Cerrar '+active.name;
    const totals=sessionTotals(active);
    text(form,'p','Cajera: '+active.cashierName+' · Horario: '+active.startTime+'–'+active.endTime);
    text(form,'p','Inicio: '+money(active.openingAmount)+' · Ventas en efectivo: '+money(totals.cashSales)+' · Abonos en efectivo: '+money(totals.cashPayments));
    text(form,'p','Efectivo esperado al cierre: '+money(totals.expected));
    const countLabel=text(form,'label','Efectivo contado al cierre (CLP)');const count=document.createElement('input');count.name='countedAmount';count.type='number';count.min='0';count.step='1';count.required=true;countLabel.append(count);
    const timeLabel=text(form,'label','Hora de cierre');const time=document.createElement('input');time.name='closeTime';time.type='time';time.value=chileTime(Date.now());time.required=true;timeLabel.append(time);
    const button=text(form,'button','Cerrar turno');button.type='submit';button.className='primary';
    return;
  }
  $('#form-title').textContent='Abrir turno';
  const last=data.cashSessions.at(-1);if(last)text(form,'p','Último cierre contado: '+money(last.countedAmount)+'. Indica cuánto efectivo recibes para el nuevo turno.');
  const templateLabel=text(form,'label','Turno');const templateSelect=document.createElement('select');templateSelect.name='turnTemplate';templateSelect.required=true;
  for(const template of data.turnTemplates){const option=document.createElement('option');option.value=String(template.id);option.textContent=template.name+' · '+template.startTime+'–'+template.endTime;templateSelect.append(option);}templateLabel.append(templateSelect);
  const cashierLabel=text(form,'label','Cajera de turno');const cashierSelect=document.createElement('select');cashierSelect.name='cashier';cashierSelect.required=true;
  for(const cashier of data.cashiers){const option=document.createElement('option');option.value=String(cashier.id);option.textContent=cashier.name;cashierSelect.append(option);}cashierLabel.append(cashierSelect);
  for(const [name,label] of [['startTime','Hora de inicio'],['endTime','Hora de término']]){const wrap=text(form,'label',label);const input=document.createElement('input');input.type='time';input.name=name;input.required=true;wrap.append(input);}
  const selected=data.turnTemplates[0];if(selected){form.elements.startTime.value=selected.startTime;form.elements.endTime.value=selected.endTime;}
  templateSelect.onchange=()=>{const template=data.turnTemplates.find(item=>item.id===Number(templateSelect.value));if(template){form.elements.startTime.value=template.startTime;form.elements.endTime.value=template.endTime;}};
  const amountLabel=text(form,'label','Efectivo recibido al abrir (CLP)');const amount=document.createElement('input');amount.name='openingAmount';amount.type='number';amount.min='0';amount.step='1';amount.required=true;amountLabel.append(amount);
  const button=text(form,'button','Abrir turno');button.type='submit';button.className='primary';
}
function drawCash(container){
  container.className='turn-history';
  if(!data.cashSessions.length){text(container,'p','Aún no hay turnos registrados. Abre el primero desde la opción superior.');return;}
  for(const session of data.cashSessions.slice().reverse()){
    const totals=sessionTotals(session),card=document.createElement('article');card.className='turn-card';
    const head=document.createElement('div');head.className='turn-card-head';text(head,'strong',session.name+' · '+session.cashierName);text(head,'span',session.status==='abierta'?'Abierto':'Cerrado');card.append(head);
    text(card,'small','Horario '+session.startTime+'–'+session.endTime+' · Abierto '+dateTime(session.openedAt));
    if(session.closedAt)text(card,'small','Cerrado '+dateTime(session.closedAt)+' · Hora indicada '+session.closeTime);
    const rows=[['Efectivo recibido al abrir',money(session.openingAmount)],['Ventas del turno',String(totals.sales.length)],['Monto de ventas',money(totals.salesAmount)],['Ventas en efectivo',money(totals.cashSales)],['Recibido con tarjeta',money(totals.cardReceived)],['Fiado del turno',money(totals.creditIssued)],['Transferencias',money(totals.transferReceived)],['Abonos en efectivo',money(totals.cashPayments)],['Efectivo esperado',money(totals.expected)]];
    if(session.status==='cerrada')rows.push(['Efectivo contado',money(session.countedAmount)],['Diferencia',money(session.countedAmount-totals.expected)]);
    for(const [label,value] of rows){const row=document.createElement('div');row.className='turn-card-row';text(row,'span',label);text(row,'strong',value);card.append(row);}
    const detail=document.createElement('details');detail.className='turn-entries';text(detail,'summary','Ver ventas y abonos del turno');
    if(!totals.sales.length&&!totals.payments.length)text(detail,'p','Todavía no hay ventas ni abonos en este turno.');
    for(const sale of totals.sales){const row=document.createElement('div');row.className='turn-entry';text(row,'span','Venta · '+dateTime(sale.createdAt)+' · '+sale.description);text(row,'strong',money(sale.amount));detail.append(row);}
    for(const payment of totals.payments){const row=document.createElement('div');row.className='turn-entry';text(row,'span','Abono · '+dateTime(payment.createdAt)+' · '+payment.customer);text(row,'strong',money(payment.amount));detail.append(row);}
    card.append(detail);
    const actions=document.createElement('div');actions.className='turn-card-actions';
    const print=text(actions,'button','Imprimir / PDF');print.type='button';print.onclick=()=>printTurnReport(session);
    const csv=text(actions,'button','Abrir en Excel (CSV)');csv.type='button';csv.onclick=()=>downloadTurnCsv(session);
    card.append(actions);container.append(card);
  }
}
function drawSettings(container){
  container.className='settings-lists';
  const cashierPanel=document.createElement('section');cashierPanel.className='settings-panel';text(cashierPanel,'h4','Cajeras');
  const cashierDetails=document.createElement('details');text(cashierDetails,'summary','Crear cajera');const cashierForm=document.createElement('form');cashierForm.innerHTML='<label>Nombre<input name="firstName" required maxlength="60"></label><label>Apellido<input name="lastName" required maxlength="60"></label><button type="submit" class="primary">Guardar cajera</button>';
  cashierForm.onsubmit=event=>{event.preventDefault();const first=cashierForm.elements.firstName.value.trim(),last=cashierForm.elements.lastName.value.trim();if(!first||!last)return;data.cashiers.push({id:nextCashierId++,name:first+' '+last});draw();};cashierDetails.append(cashierForm);cashierPanel.append(cashierDetails);
  for(const cashier of data.cashiers){const row=document.createElement('div');row.className='setting-row';text(row,'span',cashier.name);cashierPanel.append(row);}container.append(cashierPanel);
  const turnPanel=document.createElement('section');turnPanel.className='settings-panel';text(turnPanel,'h4','Horarios de turno');
  const turnDetails=document.createElement('details');text(turnDetails,'summary','Crear turno');const turnForm=document.createElement('form');turnForm.innerHTML='<label>Nombre del turno<input name="name" required maxlength="60" placeholder="Ej.: Turno 3"></label><label>Desde<input name="startTime" type="time" required></label><label>Hasta<input name="endTime" type="time" required></label><button type="submit" class="primary">Guardar turno</button>';
  let editingTemplateId=null;
  turnForm.onsubmit=event=>{event.preventDefault();const name=turnForm.elements.name.value.trim(),startTime=turnForm.elements.startTime.value,endTime=turnForm.elements.endTime.value;if(!name||!startTime||!endTime)return;const existing=data.turnTemplates.find(item=>item.id===editingTemplateId);if(existing)Object.assign(existing,{name,startTime,endTime});else data.turnTemplates.push({id:nextTurnTemplateId++,name,startTime,endTime});draw();};turnDetails.append(turnForm);turnPanel.append(turnDetails);
  for(const template of data.turnTemplates){const row=document.createElement('div');row.className='setting-row';text(row,'span',template.name);text(row,'strong',template.startTime+'–'+template.endTime);const edit=text(row,'button','Editar');edit.type='button';edit.setAttribute('aria-label','Editar horario de '+template.name);edit.onclick=()=>{editingTemplateId=template.id;turnForm.elements.name.value=template.name;turnForm.elements.startTime.value=template.startTime;turnForm.elements.endTime.value=template.endTime;turnForm.querySelector('button[type="submit"]').textContent='Guardar cambios';turnDetails.open=true;};turnPanel.append(row);}container.append(turnPanel);
}
function turnReportRows(session){
  const totals=sessionTotals(session);
  const rows=[['Apertura',dateTime(session.openedAt),'Efectivo inicial','',session.openingAmount]];
  const entries=[...totals.sales.map(sale=>({kind:'Venta',when:sale.createdAt,detail:sale.description,method:sale.method,amount:sale.amount})),...totals.payments.map(payment=>({kind:'Abono',when:payment.createdAt,detail:payment.customer,method:payment.method,amount:payment.amount}))].sort((a,b)=>new Date(a.when)-new Date(b.when));
  for(const entry of entries)rows.push([entry.kind,dateTime(entry.when),entry.detail,entry.method,entry.amount]);
  if(session.closedAt)rows.push(['Cierre',dateTime(session.closedAt),'Efectivo contado','',session.countedAmount]);
  return rows;
}
function buildTurnCsv(session){
  const totals=sessionTotals(session);
  const rows=[['Resumen interno de turno',session.name],['Cajera',session.cashierName],['Horario',session.startTime+'–'+session.endTime],['Monto de ventas',totals.salesAmount],['Recibido con tarjeta',totals.cardReceived],['Fiado del turno',totals.creditIssued],['Efectivo esperado',totals.expected],['Diferencia',session.closedAt?session.countedAmount-totals.expected:'Pendiente de cierre'],[],['Tipo','Fecha y hora','Detalle','Medio de pago','Monto CLP'],...turnReportRows(session)];
  const cell=value=>{let content=String(value??'');if(/^[=+@\-\t\r]/.test(content))content="'"+content;return '"'+content.replaceAll('"','""')+'"';};
  return'\ufeffsep=;\r\n'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
function downloadTurnCsv(session){
  const csv=buildTurnCsv(session);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='kalu-turno-'+session.id+'.csv';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function printTurnReport(session){
  const popup=window.open('','_blank');if(!popup){window.alert('Permite la ventana de impresión para guardar el resumen en PDF.');return;}
  const doc=popup.document;doc.title='Kalu · '+session.name+' · resumen interno';
  const style=doc.createElement('style');style.textContent='body{font:14px Arial,sans-serif;color:#2e1d18;margin:32px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;border-bottom:1px solid #ccc;padding:8px}th{background:#f5eee8}small{color:#666}@media print{body{margin:12mm}}';doc.head.append(style);
  text(doc.body,'h1','Kalu · Resumen interno de '+session.name);
  text(doc.body,'p','Cajera: '+session.cashierName+' · Horario: '+session.startTime+'–'+session.endTime);
  text(doc.body,'p','Apertura: '+dateTime(session.openedAt)+(session.closedAt?' · Cierre: '+dateTime(session.closedAt):' · Turno abierto'));
  const totals=sessionTotals(session);
  text(doc.body,'p','Ventas: '+money(totals.salesAmount)+' · Tarjeta: '+money(totals.cardReceived)+' · Fiado: '+money(totals.creditIssued));
  text(doc.body,'p','Efectivo inicial: '+money(session.openingAmount)+' · Ventas en efectivo: '+money(totals.cashSales)+' · Abonos en efectivo: '+money(totals.cashPayments)+' · Esperado: '+money(totals.expected));
  if(session.closedAt)text(doc.body,'p','Contado: '+money(session.countedAmount)+' · Diferencia: '+money(session.countedAmount-totals.expected));
  const table=doc.createElement('table'),head=doc.createElement('thead'),headRow=doc.createElement('tr');for(const label of ['Tipo','Fecha y hora','Detalle','Medio','Monto'])text(headRow,'th',label);head.append(headRow);table.append(head);
  const body=doc.createElement('tbody');for(const values of turnReportRows(session)){const row=doc.createElement('tr');for(const value of values)text(row,'td',String(value));body.append(row);}table.append(body);doc.body.append(table);
  text(doc.body,'small','Resumen operativo de muestra. Este archivo no es una boleta tributaria.');popup.focus();popup.print();
}
function draw(){
  const items=$('#records');items.replaceChildren();items.className='';
  $('#orders-stat').textContent=data.orders.filter(order=>new Date(order.createdAt||Date.now()).toDateString()===new Date().toDateString()).length;
  $('#pending-stat').textContent=data.orders.filter(order=>order.status==='pendiente').length;
  const session=currentCashSession(),turn=sessionTotals(session);
  $('#card-stat').textContent=money(turn.cardReceived);
  $('#cash-sales-stat').textContent=money(turn.cashSales+turn.cashPayments);
  $('#credit-stat').textContent=money(data.customers.reduce((sum,customer)=>sum+customer.debt,0));
  $('#cash-stat').textContent=money(turn.expected);
  if(section==='orders'){drawOrders(items);return;}
  if(section==='dashboard'){drawDashboard(items);return;}
  if(section==='customers'){drawCustomers(items);return;}
  if(section==='cash'){drawCash(items);return;}
  if(section==='settings'){drawSettings(items);return;}
  if(section==='sales'){drawSales(items);return;}
  const source=data[section];
  for(const item of source){
    const row=document.createElement('div');row.className='record';
    const left=document.createElement('div'),right=document.createElement('div');
    const name=item.description||item.concept||item.name||item.username||item.customer;
    let detail=item.method||item.type||item.category||item.unit||item.value||item.role||'';
    if(section==='products')detail+=' · '+money(item.price);
    if(section==='inventory')detail=item.quantity+' '+item.unit;
    text(left,'b',name);text(left,'small',detail);
    row.append(left);
    if(section==='cash')text(right,'strong',money(item.amount));
    row.append(right);items.append(row);
  }
}
function mountCustomerForm(form,customer=null){
  form.innerHTML='<label>Nombre<input name="firstName" maxlength="60" autocomplete="given-name" required></label><label>Apellido<input name="lastName" maxlength="60" autocomplete="family-name" required></label><label class="credit-toggle"><input type="checkbox" name="creditEnabled"> Habilitar límite de crédito</label><label class="credit-limit" hidden>Límite de crédito (CLP)<input type="number" name="creditLimit" min="1" step="1"></label><button type="submit" class="primary">'+(customer?'Guardar cambios':'Crear cliente')+'</button>';
  const toggle=form.querySelector('[name="creditEnabled"]'),limit=form.querySelector('.credit-limit'),input=form.querySelector('[name="creditLimit"]');
  toggle.onchange=()=>{limit.hidden=!toggle.checked;input.required=toggle.checked;input.disabled=!toggle.checked;};input.disabled=true;
  if(customer){
    const parts=customer.name.trim().split(/\s+/);form.elements.firstName.value=parts.shift()||'';form.elements.lastName.value=parts.join(' ');
    toggle.checked=customer.creditEnabled;input.value=customer.creditEnabled?customer.creditLimit:'';toggle.dispatchEvent(new Event('change'));
    const cancel=text(form,'button','Cancelar edición');cancel.type='button';cancel.className='customer-cancel';cancel.onclick=()=>{editingCustomerId=null;$('#form-title').textContent='Nuevo cliente';$('#create-summary').textContent='Crear cliente';$('#create-details').open=false;$('#form-error').textContent='';mountCustomerForm(form);};
  }
}
function saveOrder(item){
  if(!activeCashSession())return 'Abre un turno en Caja antes de confirmar el pedido.';
  const customer=data.customers.find(entry=>entry.id===item.customerId);
  if(item.paymentMethod==='fiado'){
    if(!customer)return 'Para fiado, elige un cliente existente de la lista.';
    const available=customer.creditEnabled?Math.max(0,customer.creditLimit-customer.debt):item.total;
    if(available<=0)return 'El cupo de '+customer.name+' está agotado. Elige Efectivo.';
    item.creditAmount=Math.min(item.total,available);
    item.cashAmount=item.total-item.creditAmount;
    if(item.cashAmount&&!item.cashDifferenceAccepted)return 'Confirma el cobro de '+money(item.cashAmount)+' en efectivo.';
    customer.debt+=item.creditAmount;
  }
  item.checkoutId='demo-'+Date.now()+'-'+nextDemoCheckoutId++;
  data.orders.unshift(item);
  data.sales.push({checkoutId:item.checkoutId,description:item.items,amount:item.total,method:item.paymentMethod,customerId:item.customerId,creditAmount:item.creditAmount||0,cashAmount:item.cashAmount||0,createdAt:item.createdAt});
  selectSection('orders');
  return '';
}
function selectSection(value){
  if(!schemas[value]||!sectionsByRole[currentRole].includes(value))return;
  if(value!=='customers'){customerAction='';selectedCustomerIds.clear();}
  section=value;
  const workspace=document.querySelector('.workspace');
  workspace.classList.toggle('wizard-mode',value==='new-order');
  workspace.classList.toggle('orders-mode',value==='orders');
  workspace.classList.toggle('sales-mode',value==='sales');
  workspace.classList.toggle('dashboard-mode',value==='dashboard');
  const createLabels={customers:'Crear cliente',cash:activeCashSession()?'Cerrar turno':'Abrir turno',inventory:'Crear insumo',products:'Crear producto'};
  const compactCreate=value in createLabels;
  workspace.classList.toggle('compact-create',compactCreate);
  workspace.classList.toggle('settings-mode',value==='settings');
  $('#create-details').open=!compactCreate;
  $('#create-summary').textContent=createLabels[value]||'Crear';
  document.querySelector('#dashboard .stats').hidden=!(currentRole==='admin'&&value==='dashboard'||currentRole==='ventas'&&value==='cash');
  document.querySelectorAll('#section-nav button').forEach(button=>{const active=button.dataset.section===value;button.classList.toggle('selected',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('#dashboard .dashboard-head h2').textContent=currentRole==='admin'?(value==='dashboard'?'Dashboard de Kalu':({sales:'Ventas',customers:'Clientes',cash:'Caja',inventory:'Inventario',products:'Menú / Productos',settings:'Configuración'})[value]||'Administración'):({ 'new-order':'Nuevo pedido',orders:'Pedidos',sales:'Ventas',customers:'Clientes',cash:'Caja',inventory:'Inventario',products:'Menú / Productos'})[value]||'Ventas';
  const [title,list,fields]=schemas[value],form=$('#record-form');
  $('#form-title').textContent=title;$('#list-title').textContent=list;form.replaceChildren();$('#form-error').textContent='';
  if(value==='new-order'){
    const catalog=data.products.map((product,index)=>({...product,id:String(index)}));
    KaluOrderTicket.mount(form,catalog,data.customers,saveOrder,()=>selectSection('orders'));
  }else if(value==='customers'){editingCustomerId=null;mountCustomerForm(form);}
  else if(value==='cash')mountCashForm(form);
  else if(value==='orders'||value==='sales'||value==='dashboard'||value==='settings'){}
  else{
    for(const spec of fields)form.append(field(spec));
    if(fields.length){const button=text(form,'button','Agregar a la demostración');button.type='submit';button.className='primary';}
    else form.textContent='Esta sección se completará con los datos y reglas de Kalu.';
  }
  $('#cash-controls').hidden=true;
  draw();
}
$('#home-button').onclick=()=>view('home');$('#access-button').onclick=()=>view('login-view');$('#logout-button').onclick=()=>view('home');$('#login-form').onsubmit=e=>{e.preventDefault();const username=new FormData(e.currentTarget).get('username');currentRole=username==='ventaskalu'?'ventas':'admin';$('#welcome').textContent=`${username} · ${currentRole==='admin'?'Administración':'Ventas'} · datos de muestra`;document.querySelector('.sidebar-brand small').textContent=currentRole==='admin'?'Administración':'Ventas';document.querySelectorAll('#section-nav button').forEach(button=>button.hidden=!sectionsByRole[currentRole].includes(button.dataset.section));view('dashboard');selectSection(currentRole==='admin'?'dashboard':'new-order');};$('#section-nav').onclick=e=>{const b=e.target.closest('button[data-section]');if(b)selectSection(b.dataset.section);};
$('#record-form').onsubmit=e=>{
  e.preventDefault();if(['new-order','orders','sales'].includes(section))return;
  const form=e.currentTarget;
  if(section==='cash'){
    const active=activeCashSession();
    if(active){
      const countedAmount=Number(form.elements.countedAmount.value),closeTime=form.elements.closeTime.value;
      if(!Number.isSafeInteger(countedAmount)||countedAmount<0||!closeTime){$('#form-error').textContent='Indica el efectivo contado y la hora de cierre.';return;}
      active.closedAt=new Date().toISOString();active.closeTime=closeTime;active.countedAmount=countedAmount;active.status='cerrada';
      active.expectedAmount=sessionTotals(active).expected;active.difference=countedAmount-active.expectedAmount;
      $('#create-summary').textContent='Abrir turno';mountCashForm(form);$('#create-details').open=false;$('#form-error').textContent='';draw();return;
    }
    const template=data.turnTemplates.find(item=>item.id===Number(form.elements.turnTemplate.value));
    const cashier=data.cashiers.find(item=>item.id===Number(form.elements.cashier.value));
    const openingAmount=Number(form.elements.openingAmount.value),startTime=form.elements.startTime.value,endTime=form.elements.endTime.value;
    if(!template||!cashier||!Number.isSafeInteger(openingAmount)||openingAmount<0||!startTime||!endTime){$('#form-error').textContent='Completa cajera, horario y efectivo recibido.';return;}
    data.cashSessions.push({id:nextCashSessionId++,name:template.name,templateId:template.id,cashierId:cashier.id,cashierName:cashier.name,startTime,endTime,openedAt:new Date().toISOString(),openingAmount,status:'abierta'});
    $('#create-summary').textContent='Cerrar turno';mountCashForm(form);$('#create-details').open=false;$('#form-error').textContent='';draw();return;
  }
  if(section==='customers'){
    const firstName=form.elements.firstName.value.trim(),lastName=form.elements.lastName.value.trim();
    const name=firstName+' '+lastName;
    if(data.customers.some(customer=>customer.id!==editingCustomerId&&customer.name.toLocaleLowerCase('es-CL')===name.toLocaleLowerCase('es-CL'))){$('#form-error').textContent='Este cliente ya existe.';return;}
    const creditEnabled=form.elements.creditEnabled.checked;
    const creditLimit=creditEnabled?Number(form.elements.creditLimit.value):0;
    if(creditEnabled&&(!Number.isSafeInteger(creditLimit)||creditLimit<=0)){$('#form-error').textContent='Indica un límite válido.';return;}
    const editing=editingCustomerId===null?null:data.customers.find(customer=>customer.id===editingCustomerId);
    if(editing&&creditEnabled&&creditLimit<editing.debt){$('#form-error').textContent='El límite no puede ser menor que la deuda actual de '+money(editing.debt)+'.';return;}
    if(editing){Object.assign(editing,{name,creditEnabled,creditLimit});for(const order of data.orders)if(order.customerId===editing.id)order.customer=name;}
    else data.customers.unshift({id:nextCustomerId++,name,debt:0,creditEnabled,creditLimit});
    editingCustomerId=null;$('#form-title').textContent='Nuevo cliente';$('#create-summary').textContent='Crear cliente';$('#create-details').open=false;mountCustomerForm(form);$('#form-error').textContent='';draw();return;
  }
  const item=Object.fromEntries(new FormData(form));
  for(const key of ['total','amount','quantity','price'])if(key in item)item[key]=Number(item[key]);
  if(section==='cash')item.createdAt=new Date().toISOString();
  data[section].unshift(item);form.reset();if(['cash','inventory','products'].includes(section))$('#create-details').open=false;draw();
};
setupCreateDisclosure();view('home');selectSection('dashboard');
window.setInterval(refreshOrderTimes,30000);
