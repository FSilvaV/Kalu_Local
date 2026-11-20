import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { MongoClient, ObjectId } from 'mongodb';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';

try { for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const match = line.match(/^([A-Z_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2]; } } catch {}
const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT || 3000);
const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const secure = process.env.NODE_ENV === 'production';
if (secure && !origin.startsWith('https://')) throw new Error('APP_ORIGIN debe usar HTTPS en producción');
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
await client.connect();
const db = client.db(process.env.MONGODB_DB || 'kalu');
const users = db.collection('users'), sessions = db.collection('sessions');
await Promise.all([
  sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  db.collection('orders').createIndex({ createdAt: -1 }),
  db.collection('sales').createIndex({ createdAt: -1 }),
  db.collection('cash').createIndex({ createdAt: -1 }),
  db.collection('inventory').createIndex({ name: 1 }, { unique: true }),
  db.collection('products').createIndex({ name: 1 }, { unique: true }),
  db.collection('cashSessions').createIndex({ status: 1 }, { unique: true, partialFilterExpression: { status: 'abierta' } }),
  users.createIndex({ username: 1 }, { unique: true })
]);
async function hashPassword(password) { const salt = randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64); return `${salt}:${hash.toString('hex')}`; }
async function checkPassword(password, saved) { if (!saved) return false; const [salt, hex] = saved.split(':'); if (!salt || !hex) return false; const hash = await scrypt(password, salt, 64); const expected = Buffer.from(hex, 'hex'); return hash.length === expected.length && timingSafeEqual(hash, expected); }
if (await users.countDocuments() === 0) {
  const password = process.env.BOOTSTRAP_PASSWORD;
  if (!password || password.length < 16 || password === 'replace-with-a-long-random-password') throw new Error('Configure BOOTSTRAP_PASSWORD con al menos 16 caracteres para crear el primer administrador');
  await users.insertOne({ username: process.env.BOOTSTRAP_USER || 'admin', passwordHash: await hashPassword(password), role: 'admin', createdAt: new Date() });
  console.log('Cuenta inicial de administrador creada');
}
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', secure ? 'loopback' : false);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'] } } }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static('public', { extensions: ['html'], index: 'index.html' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
function bad(res, message, code = 400) { return res.status(code).json({ error: message }); }
function cookie(req, name) { return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1); }
function sessionKey(token) { return createHash('sha256').update(token).digest('hex'); }
function setCookie(res, token, age) { res.cookie('kalu_session', token, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: age }); }
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('origin') !== origin) return bad(res, 'Origen no permitido', 403);
  next();
});
app.post('/api/login', loginLimit, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length > 256) return bad(res, 'Credenciales inválidas');
  const user = await users.findOne({ username: username.trim().toLowerCase() });
  if (!user || !await checkPassword(password, user.passwordHash)) return bad(res, 'Usuario o contraseña incorrectos', 401);
  const token = randomBytes(32).toString('hex');
  await sessions.insertOne({ key: sessionKey(token), userId: user._id, expiresAt: new Date(Date.now() + 8 * 3600000) });
  setCookie(res, token, 8 * 3600000);
  res.json({ username: user.username, role: user.role });
});
async function auth(req, res, next) {
  const token = cookie(req, 'kalu_session');
  if (!token) return bad(res, 'Inicia sesión', 401);
  const session = await sessions.findOne({ key: sessionKey(token), expiresAt: { $gt: new Date() } });
  if (!session) return bad(res, 'Sesión vencida', 401);
  req.user = await users.findOne({ _id: session.userId }, { projection: { passwordHash: 0 } });
  if (!req.user) return bad(res, 'Usuario no disponible', 401);
  next();
}
function admin(req, res, next) { if (req.user.role !== 'admin') return bad(res, 'Solo administración', 403); next(); }
app.get('/api/me', auth, (req, res) => res.json({ username: req.user.username, role: req.user.role }));
app.post('/api/logout', auth, async (req, res) => { await sessions.deleteOne({ key: sessionKey(cookie(req, 'kalu_session')) }); setCookie(res, '', 0); res.json({ ok: true }); });
function text(value, max = 120) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null; }
function money(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 100000000 ? value : null; }
function id(value) { return ObjectId.isValid(value) && String(new ObjectId(value)) === value ? new ObjectId(value) : null; }
const orders = db.collection('orders'), sales = db.collection('sales'), cash = db.collection('cash'), inventory = db.collection('inventory'), products = db.collection('products'), cashSessions = db.collection('cashSessions');
app.get('/api/public/products', async (_req, res) => res.json(await products.find({ active: true }, { projection: { name: 1, category: 1, price: 1 } }).sort({ category: 1, name: 1 }).limit(100).toArray()));
app.get('/api/summary', auth, async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeCash = await cashSessions.findOne({ status: 'abierta' });
  const cashStart = activeCash?.openedAt || new Date(8640000000000000);
  const [orderCount, dailySales, cashSales, cashMovements] = await Promise.all([
    orders.countDocuments({ createdAt: { $gte: today } }),
    sales.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
    sales.aggregate([{ $match: { createdAt: { $gte: cashStart }, method: 'efectivo' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
    cash.aggregate([{ $match: { createdAt: { $gte: cashStart } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$type', 'ingreso'] }, '$amount', { $multiply: ['$amount', -1] }] } } } }]).toArray()
  ]);
  res.json({ orders: orderCount, sales: dailySales[0]?.total || 0, cash: activeCash ? activeCash.openingAmount + (cashMovements[0]?.total || 0) + (cashSales[0]?.total || 0) : 0 });
});
app.get('/api/orders', auth, async (_req, res) => res.json(await orders.find().sort({ createdAt: -1 }).limit(100).toArray()));
app.post('/api/orders', auth, async (req, res) => {
  const customer = text(req.body.customer, 80), items = text(req.body.items, 300), total = money(req.body.total);
  if (!customer || !items || total === null) return bad(res, 'Revisa cliente, productos y total');
  const doc = { customer, items, total, status: 'pendiente', createdAt: new Date(), createdBy: req.user.username };
  const result = await orders.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId });
});
app.patch('/api/orders/:id', auth, async (req, res) => {
  const _id = id(req.params.id), status = req.body.status;
  if (!_id || !['pendiente', 'preparando', 'entregado', 'cancelado'].includes(status)) return bad(res, 'Estado inválido');
  const result = await orders.updateOne({ _id }, { $set: { status, updatedAt: new Date() } });
  if (!result.matchedCount) return bad(res, 'Pedido no encontrado', 404); res.json({ ok: true });
});
app.get('/api/sales', auth, async (_req, res) => res.json(await sales.find().sort({ createdAt: -1 }).limit(100).toArray()));
app.post('/api/sales', auth, async (req, res) => {
  const description = text(req.body.description, 300), amount = money(req.body.amount), method = req.body.method;
  if (!description || amount === null || amount === 0 || !['efectivo', 'tarjeta', 'transferencia'].includes(method)) return bad(res, 'Venta inválida');
  if (!await cashSessions.findOne({ status: 'abierta' })) return bad(res, 'Abre la caja antes de registrar ventas', 409);
  const doc = { description, amount, method, createdAt: new Date(), createdBy: req.user.username };
  const result = await sales.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId });
});
app.get('/api/cash', auth, async (_req, res) => res.json(await cash.find().sort({ createdAt: -1 }).limit(100).toArray()));
app.get('/api/cash/session', auth, async (_req, res) => res.json(await cashSessions.findOne({ status: 'abierta' }) || { status: 'cerrada' }));
app.post('/api/cash/open', auth, async (req, res) => {
  const openingAmount = money(req.body.openingAmount);
  if (openingAmount === null) return bad(res, 'Monto inicial inválido');
  try {
    const doc = { status: 'abierta', openingAmount, openedAt: new Date(), openedBy: req.user.username };
    const result = await cashSessions.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (error) { if (error.code === 11000) return bad(res, 'Ya existe una caja abierta', 409); throw error; }
});
app.post('/api/cash/close', auth, async (req, res) => {
  const countedAmount = money(req.body.countedAmount);
  if (countedAmount === null) return bad(res, 'Monto contado inválido');
  const session = await cashSessions.findOne({ status: 'abierta' });
  if (!session) return bad(res, 'No hay una caja abierta', 409);
  const [cashSales, movements] = await Promise.all([
    sales.aggregate([{ $match: { createdAt: { $gte: session.openedAt }, method: 'efectivo' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
    cash.aggregate([{ $match: { createdAt: { $gte: session.openedAt } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$type', 'ingreso'] }, '$amount', { $multiply: ['$amount', -1] }] } } } }]).toArray()
  ]);
  const expectedAmount = session.openingAmount + (cashSales[0]?.total || 0) + (movements[0]?.total || 0);
  const result = await cashSessions.updateOne({ _id: session._id, status: 'abierta' }, { $set: { status: 'cerrada', countedAmount, expectedAmount, difference: countedAmount - expectedAmount, closedAt: new Date(), closedBy: req.user.username } });
  if (!result.modifiedCount) return bad(res, 'La caja ya fue cerrada', 409);
  res.json({ expectedAmount, countedAmount, difference: countedAmount - expectedAmount });
});
app.post('/api/cash', auth, async (req, res) => {
  const concept = text(req.body.concept, 200), amount = money(req.body.amount), type = req.body.type;
  if (!concept || amount === null || amount === 0 || !['ingreso', 'egreso'].includes(type)) return bad(res, 'Movimiento inválido');
  if (!await cashSessions.findOne({ status: 'abierta' })) return bad(res, 'Abre la caja antes de registrar movimientos', 409);
  const doc = { concept, amount, type, createdAt: new Date(), createdBy: req.user.username };
  const result = await cash.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId });
});
app.get('/api/inventory', auth, async (_req, res) => res.json(await inventory.find().sort({ name: 1 }).toArray()));
app.post('/api/inventory', auth, admin, async (req, res) => {
  const name = text(req.body.name, 100), unit = text(req.body.unit, 30), quantity = req.body.quantity;
  if (!name || !unit || !Number.isFinite(quantity) || quantity < 0 || quantity > 1000000) return bad(res, 'Producto inválido');
  try { const doc = { name, unit, quantity, updatedAt: new Date() }; const result = await inventory.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId }); }
  catch (error) { if (error.code === 11000) return bad(res, 'Ya existe ese producto', 409); throw error; }
});
app.patch('/api/inventory/:id', auth, admin, async (req, res) => {
  const _id = id(req.params.id), quantity = req.body.quantity;
  if (!_id || !Number.isFinite(quantity) || quantity < 0 || quantity > 1000000) return bad(res, 'Cantidad inválida');
  const result = await inventory.updateOne({ _id }, { $set: { quantity, updatedAt: new Date() } });
  if (!result.matchedCount) return bad(res, 'Producto no encontrado', 404); res.json({ ok: true });
});
app.get('/api/products', auth, async (_req, res) => res.json(await products.find().sort({ category: 1, name: 1 }).limit(100).toArray()));
app.post('/api/products', auth, admin, async (req, res) => {
  const name = text(req.body.name, 100), category = text(req.body.category, 60), price = money(req.body.price);
  if (!name || !category || price === null || price === 0) return bad(res, 'Producto inválido');
  try { const doc = { name, category, price, active: true, createdAt: new Date() }; const result = await products.insertOne(doc); res.status(201).json({ ...doc, _id: result.insertedId }); }
  catch (error) { if (error.code === 11000) return bad(res, 'Ya existe ese producto', 409); throw error; }
});
app.patch('/api/products/:id', auth, admin, async (req, res) => {
  const _id = id(req.params.id), price = money(req.body.price), active = req.body.active;
  if (!_id || price === null || price === 0 || typeof active !== 'boolean') return bad(res, 'Producto inválido');
  const result = await products.updateOne({ _id }, { $set: { price, active, updatedAt: new Date() } });
  if (!result.matchedCount) return bad(res, 'Producto no encontrado', 404); res.json({ ok: true });
});
app.get('/api/reports', auth, admin, async (_req, res) => {
  const days = new Date(); days.setHours(0, 0, 0, 0); days.setDate(days.getDate() - 6);
  const [daily, statuses, sessions] = await Promise.all([
    sales.aggregate([{ $match: { createdAt: { $gte: days } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'America/Santiago' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
    orders.aggregate([{ $match: { createdAt: { $gte: days } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    cashSessions.find({ status: 'cerrada' }).sort({ closedAt: -1 }).limit(7).toArray()
  ]);
  res.json({ daily, statuses, sessions });
});
app.get('/api/users', auth, admin, async (_req, res) => res.json(await users.find({}, { projection: { passwordHash: 0 } }).sort({ username: 1 }).toArray()));
app.post('/api/users', auth, admin, async (req, res) => {
  const username = text(req.body.username, 80)?.toLowerCase(), password = req.body.password, role = req.body.role;
  if (!username || !/^[a-z0-9._-]+$/.test(username) || typeof password !== 'string' || password.length < 16 || !['admin', 'caja'].includes(role)) return bad(res, 'Usuario inválido; contraseña de al menos 16 caracteres');
  try { const result = await users.insertOne({ username, passwordHash: await hashPassword(password), role, createdAt: new Date() }); res.status(201).json({ _id: result.insertedId, username, role }); }
  catch (error) { if (error.code === 11000) return bad(res, 'El usuario ya existe', 409); throw error; }
});
app.use((error, _req, res, _next) => { console.error(error); bad(res, 'Error interno', 500); });
app.listen(port, '127.0.0.1', () => console.log(`Kalu escuchando en 127.0.0.1:${port}`));
