const $ = selector => document.querySelector(selector);
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n || 0);
const data = {
  dashboard:[{name:'Pedidos recientes',value:'Revisa la actividad del local desde el menú lateral.'}],
  orders:[{customer:'Camila Rojas',customerId:1,lines:[{name:'Ass italiano',quantity:1,price:3500},{name:'Hamburguesa',quantity:1,price:2500}],total:6000,status:'pendiente',serviceType:'local',createdAt:new Date(Date.now()-12*60000).toISOString()},{customer:'Matías Pérez',customerId:2,lines:[{name:'Churrasco con papas',quantity:1,price:10900}],total:10900,status:'preparando',serviceType:'retiro',createdAt:new Date(Date.now()-34*60000).toISOString()},{customer:'Valentina Soto',customerId:3,lines:[{name:'Waffle con frutillas',quantity:2,price:6900},{name:'Café latte',quantity:1,price:3200}],total:17000,status:'entregado',serviceType:'local',createdAt:new Date(Date.now()-72*60000).toISOString()}],
  sales:[{description:'Waffle con frutillas + café',amount:9900,method:'efectivo',createdAt:new Date(Date.now()-50*60000).toISOString()},{description:'Churrasco con papas',amount:10900,method:'debito',createdAt:new Date(Date.now()-30*60000).toISOString()}],
  cash:[{concept:'Apertura de caja',amount:40000,type:'ingreso',createdAt:new Date(Date.now()-3*3600000).toISOString()},{concept:'Compra de insumos',amount:8500,type:'egreso',createdAt:new Date(Date.now()-2*3600000).toISOString()}],
  debtPayments:[],
  products:[{name:'Ass italiano',category:'Sándwiches',price:3500},{name:'Hamburguesa',category:'Salados',price:2500},{name:'Completo italiano',category:'Salados',price:3900},{name:'Churrasco con papas',category:'Sándwiches',price:10900},{name:'Chorrillana',category:'Salados',price:12900},{name:'Waffle con frutillas',category:'Waffles',price:6900},{name:'Café latte',category:'Café',price:3200}],
  customers:[{id:1,name:'Camila Rojas',debt:0,creditEnabled:false,creditLimit:0},{id:2,name:'Matías Pérez',debt:0,creditEnabled:false,creditLimit:0},{id:3,name:'Valentina Soto',debt:0,creditEnabled:false,creditLimit:0}],
  settings:[{name:'Configuración',value:'Sección de muestra para ajustes del local y usuarios.'}],
  inventory:[{name:'Mezcla para waffles',quantity:5,unit:'kg'},{name:'Café en grano',quantity:3,unit:'kg'},{name:'Pan',quantity:28,unit:'unidades'}],
  reports:[{name:'Ventas de hoy',value:'$20.800'},{name:'Pedidos pendientes',value:'1'},{name:'Último cierre de caja',value:'$68.500'}],
  users:[{username:'admin',role:'Administrador'},{username:'cajero',role:'Caja'}]
};
const schemas={
  dashboard:['Resumen del local','Actividad del local',[]],
  'new-order':['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  orders:['Nuevo pedido','Pedidos recientes',[['customer','Cliente','text'],['items','Productos y cantidades','text'],['total','Total (CLP)','number']]],
  sales:['Ventas del turno','Historial desde la apertura de caja',[]],
  cash:['Movimiento de caja','Movimientos de caja',[['concept','Concepto','text'],['amount','Monto (CLP)','number'],['type','Tipo','select',['ingreso','egreso']]]],
  customers:['Nuevo cliente','Clientes registrados',[]],
  products:['Nuevo producto','Menú y precios',[['name','Producto','text'],['category','Categoría','text'],['price','Precio (CLP)','number']]],
  inventory:['Nuevo insumo','Inventario',[['name','Insumo','text'],['quantity','Cantidad','number'],['unit','Unidad','text']]],
  reports:['Resultados','Resumen de muestra',[]],
  settings:['Configuración','Ajustes del local',[]],
  users:['Nuevo usuario','Usuarios',[['username','Usuario','text'],['role','Perfil','select',['Administrador','Caja']]]]
};
data['new-order']=data.orders;
let section='dashboard',currentRole='admin',editingCustomerId=null,payingCustomerId=null,viewingCustomerId=null,nextCustomerId=4;
function text(parent,tag,value){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
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
function shiftStart(){return data.cash.find(item=>item.concept==='Apertura de caja')?.createdAt||new Date().toISOString();}
function shiftSales(){return data.sales.filter(item=>new Date(item.createdAt||0)>=new Date(shiftStart()));}
function cardMethod(method){return ['debito','credito','tarjeta'].includes(method);}
function cashPaid(sale){return sale.method==='efectivo'?sale.amount:(sale.cashAmount||0);}
function creditUsed(sale){return sale.method==='fiado'?(sale.creditAmount??sale.amount):0;}
function dateTime(value){return new Date(value).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function drawCustomerDetails(customer,host){
  const detail=document.createElement('div');detail.className='customer-detail';
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
  for(const customer of data.customers){
    const row=document.createElement('div');row.className='record customer-record';row.dataset.customerId=String(customer.id);
    const left=document.createElement('div');text(left,'b','#'+String(customer.id).padStart(3,'0')+' · '+customer.name);text(left,'small','Adeudado: '+money(customer.debt));
    if(customer.creditEnabled)text(left,'small','Límite: '+money(customer.creditLimit)+' · Disponible: '+money(Math.max(0,customer.creditLimit-customer.debt)));
    else text(left,'small','Sin límite de crédito configurado');
    const lastPayment=data.debtPayments.filter(payment=>payment.customerId===customer.id).at(-1);
    if(lastPayment)text(left,'small','Último abono: '+money(lastPayment.amount)+' · '+dateTime(lastPayment.createdAt)+' · '+lastPayment.method);
    const actions=document.createElement('div');actions.className='customer-actions';
    const details=text(actions,'button','Detalles');details.type='button';details.className='customer-details-button';details.setAttribute('aria-label','Ver detalles de '+customer.name);details.setAttribute('aria-expanded',String(viewingCustomerId===customer.id));details.onclick=()=>{viewingCustomerId=viewingCustomerId===customer.id?null:customer.id;draw();};
    const edit=text(actions,'button','✎');edit.type='button';edit.title='Modificar cliente';edit.setAttribute('aria-label','Modificar '+customer.name);edit.onclick=()=>editCustomer(customer.id);
    if(customer.debt>0){const pay=text(actions,'button','Abonar');pay.type='button';pay.className='customer-pay';pay.setAttribute('aria-label','Abonar deuda de '+customer.name);pay.onclick=()=>payCustomer(customer.id);}
    const remove=text(actions,'button','×');remove.type='button';remove.title='Eliminar cliente';remove.setAttribute('aria-label','Eliminar '+customer.name);remove.onclick=()=>deleteCustomer(customer.id);
    row.append(left,actions);container.append(row);
    if(viewingCustomerId===customer.id)drawCustomerDetails(customer,container);
  }
}
function editCustomer(id){
  const customer=data.customers.find(item=>item.id===id);if(!customer)return;
  payingCustomerId=null;editingCustomerId=id;mountCustomerForm($('#record-form'),customer);
  $('#form-title').textContent='Modificar cliente #'+String(id).padStart(3,'0');$('#form-error').textContent='';
  $('.form-card').scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function payCustomer(id){
  const customer=data.customers.find(item=>item.id===id);if(!customer||customer.debt<=0)return;
  editingCustomerId=null;payingCustomerId=id;
  $('#form-title').textContent='Abonar deuda · #'+String(id).padStart(3,'0');
  const form=$('#record-form');form.innerHTML='';
  text(form,'p',customer.name+' · Adeudado: '+money(customer.debt));
  const amountLabel=text(form,'label','Monto a abonar (CLP)');
  const amount=document.createElement('input');amount.name='paymentAmount';amount.type='number';amount.min='1';amount.max=String(customer.debt);amount.step='1';amount.required=true;amountLabel.append(amount);
  const methodLabel=text(form,'label','Medio de pago');
  const method=document.createElement('select');method.name='paymentMethod';
  for(const [value,label] of [['efectivo','Efectivo'],['debito','Tarjeta de débito'],['credito','Tarjeta de crédito'],['transferencia','Transferencia']]){const option=document.createElement('option');option.value=value;option.textContent=label;method.append(option);}methodLabel.append(method);
  const submit=text(form,'button','Registrar abono');submit.type='submit';submit.className='primary';
  const cancel=text(form,'button','Cancelar');cancel.type='button';cancel.className='customer-cancel';cancel.onclick=()=>{payingCustomerId=null;$('#form-title').textContent='Nuevo cliente';$('#form-error').textContent='';mountCustomerForm(form);};
  $('#form-error').textContent='';$('.form-card').scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function deleteCustomer(id){
  const customer=data.customers.find(item=>item.id===id);if(!customer)return;
  if(customer.debt>0||data.orders.some(order=>order.customerId===id)||data.sales.some(sale=>sale.customerId===id)){
    $('#form-error').textContent='No se puede eliminar a '+customer.name+': tiene deuda o compras vinculadas.';return;
  }
  if(!window.confirm('¿Eliminar al cliente #'+String(id).padStart(3,'0')+' · '+customer.name+'?'))return;
  data.customers=data.customers.filter(item=>item.id!==id);
  if(viewingCustomerId===id)viewingCustomerId=null;
  if(editingCustomerId===id){editingCustomerId=null;$('#form-title').textContent='Nuevo cliente';mountCustomerForm($('#record-form'));}
  $('#form-error').textContent='';draw();
}
function draw(){
  const items=$('#records');items.replaceChildren();items.className='';
  $('#orders-stat').textContent=data.orders.filter(order=>new Date(order.createdAt||Date.now()).toDateString()===new Date().toDateString()).length;
  $('#pending-stat').textContent=data.orders.filter(order=>order.status==='pendiente').length;
  const sales=shiftSales();
  const payments=data.debtPayments.filter(item=>new Date(item.createdAt)>=new Date(shiftStart()));
  $('#card-stat').textContent=money(sales.filter(item=>cardMethod(item.method)).reduce((sum,item)=>sum+item.amount,0)+payments.filter(item=>cardMethod(item.method)).reduce((sum,item)=>sum+item.amount,0));
  $('#cash-sales-stat').textContent=money(sales.reduce((sum,item)=>sum+cashPaid(item),0)+payments.filter(item=>item.method==='efectivo').reduce((sum,item)=>sum+item.amount,0));
  $('#credit-stat').textContent=money(data.customers.reduce((sum,customer)=>sum+customer.debt,0));
  $('#cash-stat').textContent=money(data.cash.filter(item=>new Date(item.createdAt||0)>=new Date(shiftStart())).reduce((sum,item)=>sum+(item.type==='ingreso'?item.amount:-item.amount),0)+sales.reduce((sum,item)=>sum+cashPaid(item),0)+payments.filter(item=>item.method==='efectivo').reduce((sum,item)=>sum+item.amount,0));
  if(section==='orders'){drawOrders(items);return;}
  if(section==='customers'){drawCustomers(items);return;}
  const source=section==='sales'?sales.slice().reverse():data[section];
  for(const item of source){
    const row=document.createElement('div');row.className='record';
    const left=document.createElement('div'),right=document.createElement('div');
    const name=item.description||item.concept||item.name||item.username||item.customer;
    let detail=item.method||item.type||item.category||item.unit||item.value||item.role||'';
    if(section==='sales')detail=item.method==='fiado'?'Fiado '+money(creditUsed(item))+(item.cashAmount?' · Efectivo '+money(item.cashAmount):''):({debito:'Tarjeta · débito',credito:'Tarjeta · crédito',tarjeta:'Tarjeta',efectivo:'Efectivo',transferencia:'Transferencia'})[item.method]||item.method;
    if(section==='products')detail+=' · '+money(item.price);
    if(section==='inventory')detail=item.quantity+' '+item.unit;
    text(left,'b',name);text(left,'small',detail);
    if(section==='sales'&&item.createdAt)text(left,'small',new Date(item.createdAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}));
    row.append(left);
    if(section==='sales'||section==='cash')text(right,'strong',money(item.amount));
    row.append(right);items.append(row);
  }
  if(section==='sales'&&!source.length)text(items,'p','Aún no hay ventas desde la apertura de caja.');
}
function mountCustomerForm(form,customer=null){
  form.innerHTML='<label>Nombre<input name="firstName" maxlength="60" autocomplete="given-name" required></label><label>Apellido<input name="lastName" maxlength="60" autocomplete="family-name" required></label><label class="credit-toggle"><input type="checkbox" name="creditEnabled"> Habilitar límite de crédito</label><label class="credit-limit" hidden>Límite de crédito (CLP)<input type="number" name="creditLimit" min="1" step="1"></label><button type="submit" class="primary">'+(customer?'Guardar cambios':'Crear cliente')+'</button>';
  const toggle=form.querySelector('[name="creditEnabled"]'),limit=form.querySelector('.credit-limit'),input=form.querySelector('[name="creditLimit"]');
  toggle.onchange=()=>{limit.hidden=!toggle.checked;input.required=toggle.checked;input.disabled=!toggle.checked;};input.disabled=true;
  if(customer){
    const parts=customer.name.trim().split(/\s+/);form.elements.firstName.value=parts.shift()||'';form.elements.lastName.value=parts.join(' ');
    toggle.checked=customer.creditEnabled;input.value=customer.creditEnabled?customer.creditLimit:'';toggle.dispatchEvent(new Event('change'));
    const cancel=text(form,'button','Cancelar edición');cancel.type='button';cancel.className='customer-cancel';cancel.onclick=()=>{editingCustomerId=null;$('#form-title').textContent='Nuevo cliente';$('#form-error').textContent='';mountCustomerForm(form);};
  }
}
function saveOrder(item){
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
  data.orders.unshift(item);
  data.sales.push({description:item.items,amount:item.total,method:item.paymentMethod,customerId:item.customerId,creditAmount:item.creditAmount||0,cashAmount:item.cashAmount||0,createdAt:item.createdAt});
  selectSection('orders');
  return '';
}
function selectSection(value){
  if(!schemas[value])return;
  section=value;
  const workspace=document.querySelector('.workspace');
  workspace.classList.toggle('wizard-mode',value==='new-order');
  workspace.classList.toggle('orders-mode',value==='orders');
  workspace.classList.toggle('sales-mode',value==='sales');
  document.querySelectorAll('#section-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.section===value));
  const [title,list,fields]=schemas[value],form=$('#record-form');
  $('#form-title').textContent=title;$('#list-title').textContent=list;form.replaceChildren();$('#form-error').textContent='';
  if(value==='new-order'){
    const catalog=data.products.map((product,index)=>({...product,id:String(index)}));
    KaluOrderTicket.mount(form,catalog,data.customers,saveOrder,()=>selectSection('orders'));
  }else if(value==='customers'){editingCustomerId=null;payingCustomerId=null;mountCustomerForm(form);}
  else if(value==='orders'||value==='sales'){}
  else{
    for(const spec of fields)form.append(field(spec));
    if(fields.length){const button=text(form,'button','Agregar a la demostración');button.type='submit';button.className='primary';}
    else form.textContent='Esta sección se completará con los datos y reglas de Kalu.';
  }
  $('#cash-controls').hidden=value!=='cash';
  if(value==='cash')$('#cash-controls').textContent='Caja de muestra · apertura y cierre se conectarán al servidor.';
  draw();
}
$('#home-button').onclick=()=>view('home');$('#access-button').onclick=()=>view('login-view');$('#logout-button').onclick=()=>view('home');$('#login-form').onsubmit=e=>{e.preventDefault();const username=new FormData(e.currentTarget).get('username');currentRole=username==='ventaskalu'?'ventas':'admin';$('#welcome').textContent=`${username} · ${currentRole==='admin'?'Administración':'Ventas'} · datos de muestra`;view('dashboard');selectSection('dashboard');};$('#section-nav').onclick=e=>{const b=e.target.closest('button[data-section]');if(b)selectSection(b.dataset.section);};
$('#record-form').onsubmit=e=>{
  e.preventDefault();if(['new-order','orders','sales'].includes(section))return;
  const form=e.currentTarget;
  if(section==='customers'){
    if(payingCustomerId!==null){
      const customer=data.customers.find(item=>item.id===payingCustomerId);
      const amount=Number(form.elements.paymentAmount.value),method=form.elements.paymentMethod.value;
      if(!customer||!Number.isSafeInteger(amount)||amount<=0||amount>customer.debt){$('#form-error').textContent='Indica un monto mayor que cero y no superior a la deuda.';return;}
      customer.debt-=amount;
      data.debtPayments.push({customerId:customer.id,customer:customer.name,amount,method,createdAt:new Date().toISOString()});
      payingCustomerId=null;$('#form-title').textContent='Nuevo cliente';mountCustomerForm(form);$('#form-error').textContent='';draw();return;
    }
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
    editingCustomerId=null;$('#form-title').textContent='Nuevo cliente';mountCustomerForm(form);$('#form-error').textContent='';draw();return;
  }
  const item=Object.fromEntries(new FormData(form));
  for(const key of ['total','amount','quantity','price'])if(key in item)item[key]=Number(item[key]);
  if(section==='cash')item.createdAt=new Date().toISOString();
  data[section].unshift(item);form.reset();draw();
};
view('home');selectSection('dashboard');
window.setInterval(refreshOrderTimes,30000);
