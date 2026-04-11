#!/usr/bin/env node
/**
 * Lahloba Mock API Server
 * Runs with zero dependencies — Node.js builtins only
 * Tests: Auth, Meals, Orders, Search, Favorites, Loyalty, ETA, Routing, Analytics
 */

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// ══════════════════════════════════════════════════
// IN-MEMORY DATABASE
// ══════════════════════════════════════════════════
const DB = {
  users: [
    { user_id: 'usr_cust_001', role: 'CUSTOMER', phone: '+201000000001', name: 'Ahmed Hassan', locale: 'ar', rating_avg: 0, is_active: true },
    { user_id: 'usr_chef_001', role: 'CHEF', phone: '+201000000002', name: 'Fatma Ali', locale: 'ar', rating_avg: 4.8, is_active: true },
    { user_id: 'usr_store_001', role: 'STORE', phone: '+201000000003', name: 'Metro Market', locale: 'en', rating_avg: 0, is_active: true },
    { user_id: 'usr_store_002', role: 'STORE', phone: '+201000000004', name: 'Fresh Corner', locale: 'ar', rating_avg: 0, is_active: true },
    { user_id: 'usr_driver_001', role: 'DELIVERY', phone: '+201000000005', name: 'Omar Mahmoud', locale: 'ar', rating_avg: 4.5, is_active: true },
    { user_id: 'usr_admin_001', role: 'ADMIN', phone: '+201000000006', name: 'Admin User', locale: 'en', rating_avg: 0, is_active: true },
  ],
  addresses: [
    { address_id: 'addr_001', user_id: 'usr_cust_001', label: 'Home', line1: '15 Tahrir St', city: 'Giza', region: 'Giza', lat: 30.0131, lng: 31.2089, is_default: true },
    { address_id: 'addr_002', user_id: 'usr_chef_001', label: 'Kitchen', line1: '42 Pyramid Rd', city: 'Giza', region: 'Giza', lat: 30.005, lng: 31.212, is_default: true },
    { address_id: 'addr_003', user_id: 'usr_store_001', label: 'Store', line1: '8 Dokki St', city: 'Giza', region: 'Giza', lat: 30.038, lng: 31.201, is_default: true },
  ],
  ingredients: [
    { ingredient_id: 'ing_rice', name_en: 'Egyptian Rice', name_ar: 'أرز مصري', unit: 'kg', category: 'grains' },
    { ingredient_id: 'ing_chicken', name_en: 'Chicken Breast', name_ar: 'صدور دجاج', unit: 'kg', category: 'protein' },
    { ingredient_id: 'ing_onion', name_en: 'Yellow Onion', name_ar: 'بصل أصفر', unit: 'kg', category: 'vegetables' },
    { ingredient_id: 'ing_tomato', name_en: 'Tomatoes', name_ar: 'طماطم', unit: 'kg', category: 'vegetables' },
    { ingredient_id: 'ing_oil', name_en: 'Sunflower Oil', name_ar: 'زيت عباد الشمس', unit: 'liter', category: 'oils' },
    { ingredient_id: 'ing_pasta', name_en: 'Penne Pasta', name_ar: 'مكرونة بيني', unit: 'kg', category: 'grains' },
    { ingredient_id: 'ing_cream', name_en: 'Cooking Cream', name_ar: 'كريمة طبخ', unit: 'ml', category: 'dairy' },
    { ingredient_id: 'ing_mushroom', name_en: 'Mushrooms', name_ar: 'مشروم', unit: 'kg', category: 'vegetables' },
  ],
  meals: [
    { meal_id: 'meal_001', chef_id: 'usr_chef_001', name_en: 'Egyptian Chicken Rice', name_ar: 'فتة بالأرز والدجاج', description_en: 'Traditional rice with grilled chicken', type: 'COOKED', base_price_minor: 15000, prep_time_min: 45, allergens: [], rating_avg: 4.8, order_count: 120, is_active: true, ingredients: ['ing_rice', 'ing_chicken', 'ing_onion', 'ing_tomato', 'ing_oil'] },
    { meal_id: 'meal_002', chef_id: 'usr_chef_001', name_en: 'Pasta Alfredo', name_ar: 'باستا ألفريدو', description_en: 'Creamy penne with mushrooms', type: 'COOKED', base_price_minor: 12000, prep_time_min: 30, allergens: ['dairy'], rating_avg: 4.5, order_count: 80, is_active: true, ingredients: ['ing_pasta', 'ing_cream', 'ing_mushroom'] },
    { meal_id: 'meal_003', chef_id: 'usr_chef_001', name_en: 'Kofta Kit', name_ar: 'كيت كفتة', description_en: 'Seasoned kofta ready to grill', type: 'READY_TO_COOK', base_price_minor: 10000, prep_time_min: 15, allergens: [], rating_avg: 4.6, order_count: 45, is_active: true, ingredients: [] },
  ],
  orders: [],
  favorites: [],
  loyalty_accounts: [],
  loyalty_transactions: [],
  ratings: [],
  chat_rooms: [],
  chat_messages: [],
  delivery_tasks: [],
  delivery_stops: [],
  search_queries: [],
  eta_predictions: [],
  outbox_events: [],
  notifications_sent: [],
};

// ══════════════════════════════════════════════════
// JWT (simplified — HMAC-SHA256)
// ══════════════════════════════════════════════════
const JWT_SECRET = 'lahloba-test-secret-32chars-min!!';

function jwtSign(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 900 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function jwtVerify(token) {
  if (!token) return null;
  try {
    const [header, body, sig] = token.replace('Bearer ', '').split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

// ══════════════════════════════════════════════════
// OTP STORE
// ══════════════════════════════════════════════════
const otpStore = new Map();

// ══════════════════════════════════════════════════
// PUSH DECISION ENGINE (Redis-simulated)
// ══════════════════════════════════════════════════
const pushKeys = new Map();

function pushDecide(userId, orderId, storeId, templateId, isCritical, isStoreProgress) {
  const dedupeKey = `push:dedupe:${orderId}:${storeId||'none'}:${templateId}`;
  if (pushKeys.has(dedupeKey)) return { send: false, reason: 'DEDUPLICATED' };
  if (isCritical) { pushKeys.set(dedupeKey, Date.now()); return { send: true }; }

  const presenceKey = `ws:presence:${userId}`;
  const fgKey = `app:fg:${userId}`;
  if (pushKeys.has(presenceKey) && pushKeys.has(fgKey)) return { send: false, reason: 'FOREGROUND_SUPPRESSED' };

  if (isStoreProgress) {
    const suppressKey = `push:suppress:${userId}:${orderId}:sp`;
    if (pushKeys.has(suppressKey)) return { send: false, reason: 'BURST_SUPPRESSED' };

    const rateKey = `push:rate:${userId}:${orderId}:sp`;
    const cnt = (pushKeys.get(rateKey) || 0) + 1;
    pushKeys.set(rateKey, cnt);

    if (cnt > 1) {
      const burstKey = `push:burst:${userId}:${orderId}:sp`;
      const bc = (pushKeys.get(burstKey) || 0) + 1;
      pushKeys.set(burstKey, bc);
      if (bc >= 3) { pushKeys.set(suppressKey, Date.now()); pushKeys.set(dedupeKey, Date.now()); return { send: true, summary: true }; }
      return { send: false, reason: 'THROTTLED' };
    }
  }
  pushKeys.set(dedupeKey, Date.now());
  return { send: true };
}

// ══════════════════════════════════════════════════
// ETA PREDICTION
// ══════════════════════════════════════════════════
function predictEta(distanceKm, stopCount, taskType) {
  const hour = new Date().getHours();
  const dow = new Date().getDay();
  const isRush = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);
  const isWeekend = dow === 5 || dow === 6;

  let eta = 10 + 3.5 * distanceKm + 8 * Math.max(0, stopCount - 1);
  if (isRush) eta += 12;
  if (isWeekend) eta -= 3;
  if (taskType === 'INGREDIENT_RUN') eta *= 1.2;
  if (taskType === 'MEAL_RUN') eta *= 0.9;
  eta = Math.max(10, Math.round(eta));

  return { minutes: eta, confidence: 0.82, range: { min: Math.max(5, eta - 10), max: eta + 15 } };
}

// ══════════════════════════════════════════════════
// ROUTE OPTIMIZATION (Nearest Neighbor + 2-opt)
// ══════════════════════════════════════════════════
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function optimizeRoute(stops) {
  if (stops.length < 3) return { optimized: false, reason: 'Too few stops' };
  const totalDist = (arr) => arr.reduce((s,_,i) => i > 0 ? s + haversine(arr[i-1].lat, arr[i-1].lng, arr[i].lat, arr[i].lng) : s, 0);
  const original = totalDist(stops);
  // Nearest neighbor
  const unvisited = [...stops]; const route = [unvisited.shift()];
  while (unvisited.length) {
    let best = 0, bestD = Infinity;
    const last = route[route.length-1];
    unvisited.forEach((s,i) => { const d = haversine(last.lat, last.lng, s.lat, s.lng); if (d < bestD) { bestD = d; best = i; } });
    route.push(unvisited.splice(best, 1)[0]);
  }
  const optimized = totalDist(route);
  return { optimized: true, original_km: +original.toFixed(2), optimized_km: +optimized.toFixed(2), saved_km: +(original-optimized).toFixed(2), saved_min: Math.round((original-optimized)*3) };
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
const uid = () => crypto.randomBytes(4).toString('hex');
const now = () => new Date().toISOString();

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

function err(res, message, status = 400) {
  json(res, { error: message, correlation_id: `corr_${uid()}` }, status);
}

function auth(req) {
  const token = req.headers.authorization;
  return jwtVerify(token);
}

// ══════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════
async function handleRequest(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/v1/, '');
  const method = req.method;
  const query = Object.fromEntries(url.searchParams);
  const body = method !== 'GET' ? await parseBody(req) : {};

  // ── Health ──
  if (path === '/health') return json(res, { status: 'ok', version: '1.1.0', timestamp: now() });

  // ── Auth ──
  if (path === '/auth/otp/request' && method === 'POST') {
    const dest = body.phone || body.email;
    if (!dest) return err(res, 'Phone or email required');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(dest, { code, exp: Date.now() + 300000 });
    console.log(`  📱 OTP for ${dest}: ${code} (bypass: 000000)`);
    return json(res, { message: 'OTP sent', expires_in: 300, _dev_code: code });
  }

  if (path === '/auth/otp/verify' && method === 'POST') {
    const dest = body.phone || body.email;
    if (!dest) return err(res, 'Phone or email required');
    if (body.code !== '000000') {
      const stored = otpStore.get(dest);
      if (!stored || stored.code !== body.code) return err(res, 'Invalid OTP', 401);
      if (Date.now() > stored.exp) { otpStore.delete(dest); return err(res, 'OTP expired', 401); }
    }
    otpStore.delete(dest);
    let user = DB.users.find(u => u.phone === body.phone || u.email === body.email);
    if (!user) {
      user = { user_id: `usr_${uid()}`, role: 'CUSTOMER', phone: body.phone, email: body.email, name: null, locale: 'en', rating_avg: 0, is_active: true };
      DB.users.push(user);
    }
    const access_token = jwtSign({ sub: user.user_id, role: user.role });
    const refresh_token = jwtSign({ sub: user.user_id, role: user.role, type: 'refresh' });
    return json(res, { access_token, refresh_token, user: { user_id: user.user_id, role: user.role, phone: user.phone, name: user.name, locale: user.locale } });
  }

  // ── Meals ──
  if (path === '/meals' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const size = parseInt(query.page_size) || 20;
    let meals = DB.meals.filter(m => m.is_active);
    if (query.type) meals = meals.filter(m => m.type === query.type);
    if (query.chef_id) meals = meals.filter(m => m.chef_id === query.chef_id);
    const enriched = meals.map(m => ({ ...m, chef_name: DB.users.find(u => u.user_id === m.chef_id)?.name }));
    return json(res, { items: enriched.slice((page-1)*size, page*size), total: enriched.length, page, page_size: size });
  }

  if (path.match(/^\/meals\/[\w]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const meal = DB.meals.find(m => m.meal_id === id);
    if (!meal) return err(res, 'Meal not found', 404);
    const chef = DB.users.find(u => u.user_id === meal.chef_id);
    const ingredients = meal.ingredients.map(iid => DB.ingredients.find(i => i.ingredient_id === iid)).filter(Boolean);
    return json(res, { ...meal, chef_name: chef?.name, chef_rating: chef?.rating_avg, ingredients_detail: ingredients });
  }

  // ── Search ──
  if (path === '/search' && method === 'GET') {
    const q = (query.q || '').toLowerCase();
    if (!q) return err(res, 'Query parameter q is required');
    const results = DB.meals.filter(m => m.is_active && (m.name_en.toLowerCase().includes(q) || m.name_ar.includes(q) || m.description_en?.toLowerCase().includes(q)));
    if (query.type) results.filter(m => m.type === query.type);
    DB.search_queries.push({ query_id: `sq_${uid()}`, query_text: q, results_count: results.length, created_at: now() });
    return json(res, { meals: results, total: results.length, query: q, processing_ms: 2 });
  }

  if (path === '/search/popular' && method === 'GET') {
    const counts = {};
    DB.search_queries.forEach(sq => { counts[sq.query_text] = (counts[sq.query_text] || 0) + 1; });
    const popular = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([q,c]) => ({ query: q, count: c }));
    return json(res, { popular });
  }

  // ── Ingredient Combos ──
  if (path === '/ingredient-combos/compute' && method === 'POST') {
    const meal = DB.meals.find(m => m.meal_id === body.meal_id);
    if (!meal) return err(res, 'Meal not found', 404);
    return json(res, {
      meal_id: body.meal_id, address_id: body.address_id, scheduled_at: body.scheduled_at,
      combos: {
        CHEAPEST: { combo_id: `combo_${uid()}`, ingredients_total_minor: 8500, eta_to_chef_minutes: 50, store_count: 3 },
        FASTEST: { combo_id: `combo_${uid()}`, ingredients_total_minor: 9500, eta_to_chef_minutes: 25, store_count: 1 },
      },
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
  }

  // ── Orders ──
  if (path === '/orders' && method === 'POST') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const order = {
      order_id: `ord_${uid()}`, customer_id: user.sub, chef_id: body.chef_id, meal_id: body.meal_id,
      servings: body.servings || 1, ingredient_source: body.ingredient_source || 'STORES',
      ingredient_combo_mode: body.combo_mode || 'CHEAPEST', scheduled_at: body.scheduled_at || now(),
      address_id: body.address_id, notes_to_chef: body.notes_to_chef,
      pricing: body.pricing || { chef_service_fee: { amount_minor: 15000, currency: 'EGP' }, ingredients_total: { amount_minor: 8500, currency: 'EGP' }, delivery_fees: { ingredients_run_fee: { amount_minor: 2500, currency: 'EGP' }, meal_run_fee: { amount_minor: 2000, currency: 'EGP' } }, platform_fee: { amount_minor: 0, currency: 'EGP' }, total: { amount_minor: 28000, currency: 'EGP' } },
      status: 'CREATED', order_version: 1, created_at: now(), updated_at: now(),
    };
    DB.orders.push(order);

    // Create chat room
    const room = { chat_room_id: `chat_${uid()}`, order_id: order.order_id, created_at: now() };
    DB.chat_rooms.push(room);

    // Create delivery tasks
    if (order.ingredient_source === 'STORES') {
      const iTask = { task_id: `task_${uid()}`, order_id: order.order_id, task_type: 'INGREDIENT_RUN', status: 'AVAILABLE', payout_minor: 2500, stop_count: 3, created_at: now() };
      DB.delivery_tasks.push(iTask);
      DB.delivery_stops.push(
        { stop_id: `stop_${uid()}`, task_id: iTask.task_id, stop_type: 'STORE', stop_ref_id: 'usr_store_001', sequence: 1, lat: 30.038, lng: 31.201 },
        { stop_id: `stop_${uid()}`, task_id: iTask.task_id, stop_type: 'STORE', stop_ref_id: 'usr_store_002', sequence: 2, lat: 30.056, lng: 31.199 },
        { stop_id: `stop_${uid()}`, task_id: iTask.task_id, stop_type: 'CHEF', stop_ref_id: 'usr_chef_001', sequence: 3, lat: 30.005, lng: 31.212 },
      );
    }
    const mTask = { task_id: `task_${uid()}`, order_id: order.order_id, task_type: 'MEAL_RUN', status: 'AVAILABLE', payout_minor: 2000, stop_count: 2, created_at: now() };
    DB.delivery_tasks.push(mTask);

    // Outbox event
    DB.outbox_events.push({ id: `evt_${uid()}`, type: 'order.created', version: '1.0', data: { order_id: order.order_id }, status: 'PENDING', created_at: now() });

    console.log(`  📦 Order created: ${order.order_id} (${order.status})`);
    return json(res, { ...order, chat_room_id: room.chat_room_id }, 201);
  }

  if (path === '/orders' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const orders = DB.orders.filter(o => o.customer_id === user.sub || user.role === 'ADMIN');
    return json(res, { items: orders, total: orders.length, page: 1 });
  }

  if (path.match(/^\/orders\/[\w]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const order = DB.orders.find(o => o.order_id === id);
    if (!order) return err(res, 'Order not found', 404);
    const tasks = DB.delivery_tasks.filter(t => t.order_id === id);
    const room = DB.chat_rooms.find(r => r.order_id === id);
    const eta = predictEta(5.2, 3, 'INGREDIENT_RUN');
    return json(res, { ...order, delivery_tasks: tasks, chat_room_id: room?.chat_room_id, eta });
  }

  if (path.match(/^\/orders\/[\w]+$/) && method === 'PATCH') {
    const id = path.split('/')[2];
    const order = DB.orders.find(o => o.order_id === id);
    if (!order) return err(res, 'Order not found', 404);
    const prev = order.status;
    if (body.status) order.status = body.status;
    order.order_version++;
    order.updated_at = now();
    DB.outbox_events.push({ id: `evt_${uid()}`, type: 'order.status_changed', version: '1.0', data: { order_id: id, previous_status: prev, new_status: order.status, order_version: order.order_version }, status: 'PENDING', created_at: now() });
    console.log(`  🔄 Order ${id}: ${prev} → ${order.status}`);
    return json(res, order);
  }

  // ── Favorites ──
  if (path === '/favorites' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const favs = DB.favorites.filter(f => f.user_id === user.sub);
    const enriched = favs.map(f => ({ ...f, meal: DB.meals.find(m => m.meal_id === f.meal_id) }));
    return json(res, { favorites: enriched, total: enriched.length });
  }

  if (path.match(/^\/favorites\/[\w]+$/) && method === 'POST') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const mealId = path.split('/')[2];
    if (DB.favorites.find(f => f.user_id === user.sub && f.meal_id === mealId)) return err(res, 'Already favorited', 409);
    const fav = { favorite_id: `fav_${uid()}`, user_id: user.sub, meal_id: mealId, created_at: now() };
    DB.favorites.push(fav);
    return json(res, fav, 201);
  }

  if (path.match(/^\/favorites\/[\w]+$/) && method === 'DELETE') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const mealId = path.split('/')[2];
    DB.favorites = DB.favorites.filter(f => !(f.user_id === user.sub && f.meal_id === mealId));
    return json(res, { removed: true });
  }

  if (path === '/favorites/reorder-suggestions' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const delivered = DB.orders.filter(o => o.customer_id === user.sub && o.status === 'DELIVERED');
    const suggestions = delivered.map(o => ({ meal_id: o.meal_id, meal: DB.meals.find(m => m.meal_id === o.meal_id), last_ordered: o.created_at, servings: o.servings, pricing: o.pricing }));
    return json(res, { suggestions });
  }

  // ── Loyalty ──
  if (path === '/loyalty/account' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    let account = DB.loyalty_accounts.find(a => a.user_id === user.sub);
    if (!account) {
      account = { account_id: `la_${uid()}`, user_id: user.sub, tier: 'BRONZE', available_points: 0, lifetime_points: 0, created_at: now() };
      DB.loyalty_accounts.push(account);
    }
    const thresholds = { BRONZE: 0, SILVER: 5000, GOLD: 15000, PLATINUM: 50000 };
    let nextTier = null;
    if (account.tier !== 'PLATINUM') {
      const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
      const nextIdx = tiers.indexOf(account.tier) + 1;
      nextTier = { tier: tiers[nextIdx], points_needed: thresholds[tiers[nextIdx]] - account.lifetime_points };
    }
    return json(res, { ...account, next_tier: nextTier });
  }

  if (path === '/loyalty/earn/order' && method === 'POST') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    let account = DB.loyalty_accounts.find(a => a.user_id === user.sub);
    if (!account) {
      account = { account_id: `la_${uid()}`, user_id: user.sub, tier: 'BRONZE', available_points: 0, lifetime_points: 0, created_at: now() };
      DB.loyalty_accounts.push(account);
    }
    const multipliers = { BRONZE: 1, SILVER: 1.25, GOLD: 1.5, PLATINUM: 2 };
    const basePoints = Math.round((body.total_minor || 0) / 100);
    const earned = Math.round(basePoints * (multipliers[account.tier] || 1));
    account.available_points += earned;
    account.lifetime_points += earned;
    // Check tier upgrade
    const thresholds = { SILVER: 5000, GOLD: 15000, PLATINUM: 50000 };
    for (const [tier, min] of Object.entries(thresholds)) { if (account.lifetime_points >= min && ['BRONZE','SILVER','GOLD'].indexOf(account.tier) < ['BRONZE','SILVER','GOLD','PLATINUM'].indexOf(tier)) account.tier = tier; }
    const txn = { txn_id: `ltx_${uid()}`, account_id: account.account_id, action: 'EARN_ORDER', points: earned, balance_after: account.available_points, reference_id: body.order_id, created_at: now() };
    DB.loyalty_transactions.push(txn);
    console.log(`  ⭐ Loyalty: +${earned} pts (${account.tier}) for ${user.sub}`);
    return json(res, { points_earned: earned, multiplier: multipliers[account.tier], new_balance: account.available_points, tier: account.tier, lifetime: account.lifetime_points });
  }

  if (path === '/loyalty/transactions' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const account = DB.loyalty_accounts.find(a => a.user_id === user.sub);
    const txns = account ? DB.loyalty_transactions.filter(t => t.account_id === account.account_id) : [];
    return json(res, { transactions: txns.reverse(), total: txns.length });
  }

  // ── ETA ──
  if (path === '/eta/predict' && method === 'POST') {
    const eta = predictEta(body.distance_km || 5, body.stop_count || 2, body.task_type || 'MEAL_RUN');
    const pred = { prediction_id: `eta_${uid()}`, order_id: body.order_id, ...eta, model_version: 'v1.0', created_at: now() };
    DB.eta_predictions.push(pred);
    return json(res, pred);
  }

  // ── Route Optimization ──
  if (path.match(/^\/routing\/optimize\/[\w]+$/) && method === 'POST') {
    const taskId = path.split('/')[3];
    const stops = DB.delivery_stops.filter(s => s.task_id === taskId);
    if (stops.length === 0) return err(res, 'No stops for task', 404);
    const result = optimizeRoute(stops);
    return json(res, { task_id: taskId, ...result });
  }

  // ── Delivery Tasks ──
  if (path === '/delivery/tasks' && method === 'GET') {
    const tasks = DB.delivery_tasks.filter(t => query.status ? t.status === query.status : true);
    return json(res, { items: tasks, total: tasks.length });
  }

  if (path.match(/^\/delivery\/tasks\/[\w]+\/accept$/) && method === 'POST') {
    const taskId = path.split('/')[3];
    const task = DB.delivery_tasks.find(t => t.task_id === taskId);
    if (!task) return err(res, 'Task not found', 404);
    const user = auth(req);
    task.status = 'ASSIGNED';
    task.assigned_to = user?.sub || 'usr_driver_001';
    console.log(`  🚗 Task ${taskId} accepted by ${task.assigned_to}`);
    return json(res, task);
  }

  // ── Chat ──
  if (path === '/chat/rooms' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    return json(res, { rooms: DB.chat_rooms });
  }

  if (path.match(/^\/chat\/rooms\/[\w]+\/messages$/) && method === 'POST') {
    const roomId = path.split('/')[3];
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const msg = { message_id: `msg_${uid()}`, chat_room_id: roomId, sender_id: user.sub, sender_role: user.role, message_type: body.type || 'TEXT', text: body.text, created_at: now() };
    DB.chat_messages.push(msg);
    return json(res, msg, 201);
  }

  // ── Ratings ──
  if (path === '/ratings' && method === 'POST') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const rating = { rating_id: `rat_${uid()}`, order_id: body.order_id, customer_id: user.sub, chef_score: body.chef_score, delivery_score: body.delivery_score, meal_score: body.meal_score, comment: body.comment, created_at: now() };
    DB.ratings.push(rating);
    return json(res, rating, 201);
  }

  // ── Payments ──
  if (path === '/payments/intent' && method === 'POST') {
    return json(res, { payment_id: `pay_${uid()}`, order_id: body.order_id, status: 'SUCCEEDED', amount_minor: body.amount_minor || 28000, currency: 'EGP', provider: 'stub', paid_at: now() });
  }

  // ── Availability ──
  if (path.match(/^\/availability\/[\w]+$/) && method === 'GET') {
    const chefId = path.split('/')[2];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const dow = d.getDay();
      days.push({
        date: d.toISOString().split('T')[0], day_of_week: dow,
        is_available: dow !== 5, // Friday off
        slots: dow === 5 ? [] : [{ start: '10:00', end: '14:00', max_orders: 5 }, { start: '17:00', end: '22:00', max_orders: 5 }],
      });
    }
    return json(res, { chef_id: chefId, days });
  }

  // ── Analytics ──
  if (path.match(/^\/analytics\/chef\/[\w]+$/) && method === 'GET') {
    const chefId = path.split('/')[3];
    return json(res, {
      chef_id: chefId, period: { from: query.from, to: query.to },
      summary: { total_orders: 42, completed: 38, cancelled: 2, total_revenue_minor: 630000, avg_rating: 4.8, avg_prep_time: 32 },
      top_meals: DB.meals.filter(m => m.chef_id === chefId).map(m => ({ meal_id: m.meal_id, name: m.name_en, orders: m.order_count, revenue: m.base_price_minor * m.order_count })),
      peak_hours: { 12: 8, 13: 12, 14: 10, 19: 15, 20: 14, 21: 8 },
    });
  }

  // ── Push decision test ──
  if (path === '/push/test' && method === 'POST') {
    const result = pushDecide(body.user_id, body.order_id, body.store_id, body.template_id, body.is_critical, body.is_store_progress);
    if (result.send) DB.notifications_sent.push({ ...body, ...result, sent_at: now() });
    return json(res, result);
  }

  // ── Outbox events ──
  if (path === '/events' && method === 'GET') {
    return json(res, { events: DB.outbox_events, total: DB.outbox_events.length });
  }

  // ── Users ──
  if (path === '/users/me' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    const u = DB.users.find(x => x.user_id === user.sub);
    return json(res, u || { error: 'Not found' });
  }

  if (path === '/users/me/addresses' && method === 'GET') {
    const user = auth(req);
    if (!user) return err(res, 'Unauthorized', 401);
    return json(res, { addresses: DB.addresses.filter(a => a.user_id === user.sub) });
  }

  // ── DB Stats (debug) ──
  if (path === '/debug/stats') {
    return json(res, Object.fromEntries(Object.entries(DB).map(([k,v]) => [k, Array.isArray(v) ? v.length : 'N/A'])));
  }

  // ── 404 ──
  return err(res, `Not found: ${method} ${path}`, 404);
}

// ══════════════════════════════════════════════════
// SERVER
// ══════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
  const start = Date.now();
  try {
    await handleRequest(req, res);
  } catch (e) {
    console.error('  ❌ Error:', e.message);
    err(res, 'Internal server error', 500);
  }
  const ms = Date.now() - start;
  console.log(`  ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║          🍽️  LAHLOBA MOCK API SERVER             ║
║                                                  ║
║  Port: ${PORT}                                      ║
║  Docs: http://localhost:${PORT}/health               ║
║  Stats: http://localhost:${PORT}/v1/debug/stats       ║
║                                                  ║
║  Auth bypass OTP: 000000                         ║
║  Seed data: 6 users, 3 meals, 8 ingredients     ║
║                                                  ║
║  Endpoints: Auth, Meals, Search, Orders,         ║
║  Favorites, Loyalty, ETA, Routing, Chat,         ║
║  Delivery, Payments, Ratings, Analytics,         ║
║  Push Decision Engine, Outbox Events             ║
╚══════════════════════════════════════════════════╝
`);
});
