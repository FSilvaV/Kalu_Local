(() => {
  const clp = amount => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount || 0);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function mount(host, catalog, customers, onSave, onCancel) {
    const state = { lines: [], query: '', category: 'Todos', customerName: '', payment: 'efectivo', service: 'local', freeName: '', freePrice: '', cashDifferenceAccepted: false, showCreditWarning: false };
    const root = document.createElement('div');
    root.className = 'ticket-workspace';
    host.replaceChildren(root);
    const total = () => state.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const categories = ['Todos', ...new Set(catalog.map(product => product.category))];
    const linkedClient = () => customers.find(client => client.name.toLocaleLowerCase('es-CL') === state.customerName.trim().toLocaleLowerCase('es-CL'));
    function collect() {
      for (const [name, key] of [['customer', 'customerName'], ['search', 'query'], ['freeName', 'freeName'], ['freePrice', 'freePrice']]) {
        const input = root.querySelector(`[name="${name}"]`);
        if (input) state[key] = input.value;
      }
    }
    function notice(message) { const el = root.querySelector('.ticket-error'); if (el) el.textContent = message; }
    function render() {
      const products = catalog.filter(product => (state.category === 'Todos' || product.category === state.category) && (product.name + ' ' + product.category).toLocaleLowerCase('es-CL').includes(state.query.toLocaleLowerCase('es-CL')));
      const client = linkedClient();
      if (!client && state.payment === 'fiado') state.payment = 'efectivo';
      const available = client?.creditEnabled ? Math.max(0, client.creditLimit - client.debt) : total();
      const creditAmount = Math.min(total(), available);
      const cashDifference = Math.max(0, total() - creditAmount);
root.innerHTML = `<section class="ticket-catalog"><div class="ticket-heading"><span class="eyebrow">Nuevo pedido</span><h4>Selecciona los productos</h4><p>Agrega los platos del pedido. Los datos son de muestra.</p></div><label class="ticket-search">Buscar producto<input name="search" type="search" value="${safe(state.query)}" placeholder="Ej.: completo italiano"></label><div class="ticket-categories">${categories.map(category => `<button type="button" data-category="${safe(category)}" class="${category === state.category ? 'active' : ''}">${safe(category)}</button>`).join('')}</div><div class="ticket-products">${products.map(product => `<article class="ticket-product"><div><small>${safe(product.category)}</small><strong>${safe(product.name)}</strong><span>${clp(product.price)}</span></div><button type="button" data-add="${safe(product.id)}" aria-label="Agregar ${safe(product.name)}">Agregar</button></article>`).join('') || '<p>No hay productos con este filtro.</p>'}</div><div class="ticket-free"><h5>Venta libre</h5><div><label>Descripción<input name="freeName" maxlength="100" value="${safe(state.freeName)}" placeholder="Producto especial"></label><label>Precio<input name="freePrice" type="number" min="1" step="1" value="${safe(state.freePrice)}" placeholder="CLP"></label><button type="button" data-action="free">Agregar</button></div></div></section><aside class="ticket-paper ${state.lines.length ? 'has-items' : ''}" aria-label="Resumen del pedido"><div class="ticket-top"><span>KALU</span><strong>Pedido nuevo</strong><small>Comprobante interno · vista previa</small></div><div class="ticket-rule"></div><div class="ticket-items">${state.lines.length ? state.lines.map(line => `<div class="ticket-item"><div><strong>${safe(line.name)}</strong><small>${line.quantity} × ${clp(line.price)}</small></div><div><strong>${clp(line.quantity * line.price)}</strong><div class="ticket-qty"><button type="button" data-minus="${safe(line.id)}" aria-label="Quitar uno de ${safe(line.name)}">−</button><span>${line.quantity}</span><button type="button" data-plus="${safe(line.id)}" aria-label="Agregar uno de ${safe(line.name)}">+</button></div></div></div>`).join('') : '<p class="ticket-empty">Todavía no hay productos.</p>'}</div><div class="ticket-total"><span>Total</span><strong>${clp(total())}</strong></div><div class="ticket-rule"></div><div class="ticket-group"><label for="ticket-customer">Cliente <small>(opcional)</small></label><input id="ticket-customer" name="customer" list="ticket-customers" autocomplete="off" value="${safe(state.customerName)}" placeholder="Buscar cliente por nombre"><datalist id="ticket-customers">${customers.map(c => `<option value="${safe(c.name)}"></option>`).join('')}</datalist><small class="ticket-client-hint">${client ? 'Vinculado a ' + safe(client.name) : state.customerName ? 'Selecciona un nombre sugerido para vincularlo.' : 'Puedes dejarlo vacío.'}</small></div><div class="ticket-rule"></div><div class="ticket-group"><span class="ticket-label">Pago</span><div class="ticket-options">${[['efectivo','Efectivo'],['debito','Débito'],['credito','Crédito'],['transferencia','Transferencia'],...(client && available > 0 ? [['fiado','Fiado']] : [])].map(([value,label]) => `<button type="button" data-payment="${value}" class="${state.payment === value ? 'active' : ''}">${label}</button>`).join('')}</div>${state.payment === 'fiado' && client ? `<div class="ticket-credit"><small>Crédito disponible: ${clp(available)}</small><small>Al crédito: ${clp(creditAmount)}</small>${cashDifference ? `<small>Diferencia por cubrir: ${clp(cashDifference)}</small>` : ''}</div>` : ''}</div><div class="ticket-rule"></div><div class="ticket-group"><span class="ticket-label">Servir</span><div class="ticket-options">${[['local','Local'],['retiro','Retiro'],['delivery','Delivery']].map(([value,label]) => `<button type="button" data-service="${value}" class="${state.service === value ? 'active' : ''}">${label}</button>`).join('')}</div></div><div class="ticket-rule"></div>${state.showCreditWarning && state.payment === 'fiado' && cashDifference ? `<div class="ticket-warning" role="alert"><strong>El pedido supera el crédito disponible</strong><p>El cupo de ${safe(client.name)} es ${clp(available)} y el pedido suma ${clp(total())}. Puedes cobrar ${clp(cashDifference)} en efectivo junto con ${clp(creditAmount)} fiados, o modificar el pedido para no sobrepasar el cupo.</p><div><button type="button" data-action="revise">Modificar pedido</button><button type="button" data-action="mixed">Fiado + ${clp(cashDifference)} en efectivo</button></div></div>` : ''}<p class="ticket-error" role="alert"></p><div class="ticket-actions"><button type="button" data-action="cancel">Anular</button><button type="button" class="primary" data-action="confirm">Confirmar pedido</button></div><small class="ticket-foot">Vista previa · No se guardan datos reales</small></aside>`;
    }
    root.addEventListener('input', event => {
      collect();
      if (event.target.name === 'search') { const start = event.target.selectionStart; render(); const search = root.querySelector('[name="search"]'); search.focus(); search.setSelectionRange(start, start); }
      if (event.target.name === 'customer') {
        const input = event.target;
        const position = input.selectionStart;
        state.cashDifferenceAccepted = false;
        state.showCreditWarning = false;
        render();
        const replacement = root.querySelector('[name="customer"]');
        replacement.focus();
        replacement.setSelectionRange(position, position);
      }
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      collect();
      if (button.dataset.category) { state.category = button.dataset.category; render(); return; }
      if (button.dataset.add) { state.cashDifferenceAccepted = false; state.showCreditWarning = false; const product = catalog.find(item => item.id === button.dataset.add); if (!product) return; const line = state.lines.find(item => item.id === product.id); if (line) line.quantity++; else state.lines.push({ id: product.id, name: product.name, price: product.price, quantity: 1 }); render(); return; }
      if (button.dataset.plus) { state.cashDifferenceAccepted = false; state.showCreditWarning = false; state.lines.find(item => item.id === button.dataset.plus).quantity++; render(); return; }
      if (button.dataset.minus) { state.cashDifferenceAccepted = false; state.showCreditWarning = false; const line = state.lines.find(item => item.id === button.dataset.minus); line.quantity--; if (line.quantity === 0) state.lines = state.lines.filter(item => item !== line); render(); return; }
      if (button.dataset.payment) { state.payment = button.dataset.payment; state.cashDifferenceAccepted = false; state.showCreditWarning = false; render(); return; }
      if (button.dataset.service) { state.service = button.dataset.service; render(); return; }
      if (button.dataset.action === 'free') { state.cashDifferenceAccepted = false; state.showCreditWarning = false; const price = Number(state.freePrice); if (!state.freeName.trim() || !Number.isSafeInteger(price) || price <= 0) return notice('Indica descripción y precio válido.'); state.lines.push({ id: `free-${Date.now()}`, name: state.freeName.trim(), price, quantity: 1 }); state.freeName = ''; state.freePrice = ''; render(); return; }
      if (button.dataset.action === 'revise') { state.showCreditWarning = false; render(); root.querySelector('.ticket-catalog').scrollIntoView?.({ behavior: 'smooth' }); return; }
      if (button.dataset.action === 'mixed') { state.cashDifferenceAccepted = true; state.showCreditWarning = false; render(); root.querySelector('[data-action="confirm"]').click(); return; }
      if (button.dataset.action === 'cancel') { if (window.confirm('¿Anular este pedido de muestra?')) onCancel(); return; }
      if (button.dataset.action === 'confirm') {
        if (!state.lines.length) return notice('Agrega al menos un producto.');
        const client = linkedClient();
        if (state.payment === 'fiado' && !client) return notice('Para fiado, elige un cliente existente de la lista.');
        const available = client?.creditEnabled ? Math.max(0, client.creditLimit - client.debt) : total();
        if (state.payment === 'fiado' && client?.creditEnabled && total() > available && !state.cashDifferenceAccepted) {
          state.showCreditWarning = true;
          render();
          return;
        }
        const error = onSave({ customer: client?.name || state.customerName.trim() || 'Sin cliente', customerId: client?.id || null, items: state.lines.map(line => `${line.quantity} × ${line.name}`).join(', '), lines: state.lines.map(line => ({ ...line })), total: total(), status: 'pendiente', paymentMethod: state.payment, cashDifferenceAccepted: state.cashDifferenceAccepted, serviceType: state.service, createdAt: new Date().toISOString() });
        if (error) notice(error);
      }
    });
    render();
  }
  window.KaluOrderTicket = { mount };
})();
