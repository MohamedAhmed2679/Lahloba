#!/usr/bin/env node
// Lahloba Automated API Test Runner — Zero Dependencies
const http = require('http');

const API = 'http://localhost:3000';
let TOKEN = null;
let ORDER_ID = null;
let PASS = 0, FAIL = 0;

function req(method, path, body = null) {
  return new Promise((resolve) => {
    const url = new URL(API + path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
    if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ ok: false, status: res.statusCode, data: {} }); } });
    });
    r.on('error', (e) => resolve({ ok: false, status: 0, data: { error: e.message } }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function assert(name, condition, detail = '') {
  if (condition) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; console.log(`  ❌ ${name} ${detail}`); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n' + '═'.repeat(55));
  console.log('  🧪 LAHLOBA API TEST SUITE');
  console.log('═'.repeat(55) + '\n');

  // ── Health ──
  console.log('📋 Health Check');
  let r = await req('GET', '/v1/health');
  assert('Health endpoint returns OK', r.ok && r.data.status === 'ok');
  assert('Has seed data', r.data.users >= 6 && r.data.meals >= 3, `users=${r.data.users} meals=${r.data.meals}`);

  // ── Auth ──
  console.log('\n🔐 Authentication');
  r = await req('POST', '/v1/auth/otp/request', { phone: '+201000000001' });
  assert('OTP request succeeds', r.ok && r.data.message === 'OTP sent');
  assert('OTP has dev code', !!r.data._dev_code);

  r = await req('POST', '/v1/auth/otp/verify', { phone: '+201000000001', code: '000000' });
  assert('OTP verify with bypass code', r.ok);
  assert('Returns access_token', !!r.data.access_token);
  assert('Returns user object', r.data.user?.user_id === 'usr_cust_001');
  assert('User has role CUSTOMER', r.data.user?.role === 'CUSTOMER');
  TOKEN = r.data.access_token;

  r = await req('POST', '/v1/auth/otp/verify', { phone: '+201000000099', code: 'wrong' });
  assert('Wrong OTP rejected (401)', r.status === 401);

  r = await req('POST', '/v1/auth/otp/verify', { phone: '+201999999999', code: '000000' });
  assert('New user auto-created', r.ok && r.data.user?.role === 'CUSTOMER');

  // ── Meals ──
  console.log('\n🍽️  Meals');
  r = await req('GET', '/v1/meals');
  assert('List meals returns array', r.ok && Array.isArray(r.data.meals));
  assert('Has 3 seeded meals', r.data.total === 3);
  assert('Meals have chef data', !!r.data.meals[0]?.chef);
  assert('Meals have ingredients', r.data.meals[0]?.ingredients?.length > 0);

  r = await req('GET', '/v1/meals?type=COOKED');
  assert('Filter by type COOKED', r.data.meals.every(m => m.type === 'COOKED'));

  r = await req('GET', '/v1/meals/meal_001');
  assert('Get meal by ID', r.ok && r.data.meal_id === 'meal_001');
  assert('Meal has chef profile', !!r.data.chef_profile);
  assert('Meal has 5 ingredients', r.data.ingredients?.length === 5);

  r = await req('GET', '/v1/meals/nonexistent');
  assert('Missing meal returns 404', r.status === 404);

  // ── Search ──
  console.log('\n🔍 Search');
  r = await req('GET', '/v1/search?q=chicken');
  assert('Search finds chicken rice', r.ok && r.data.total >= 1);

  r = await req('GET', '/v1/search?q=pasta');
  assert('Search finds pasta', r.ok && r.data.total >= 1);

  r = await req('GET', '/v1/search?q=كفتة');
  assert('Arabic search works', r.ok && r.data.total >= 1);

  r = await req('GET', '/v1/search?q=nonexistent_dish');
  assert('No results for gibberish', r.ok && r.data.total === 0);

  // ── Ingredient Combos ──
  console.log('\n📦 Ingredient Combos');
  r = await req('POST', '/v1/ingredient-combos/compute', { meal_id: 'meal_001', servings: 2, address_id: 'addr_001' });
  assert('Compute returns combos', r.ok && r.data.combos);
  assert('Has CHEAPEST combo', !!r.data.combos.CHEAPEST);
  assert('Has FASTEST combo', !!r.data.combos.FASTEST);
  assert('CHEAPEST has total', r.data.combos.CHEAPEST.ingredients_total_minor > 0);
  assert('CHEAPEST <= FASTEST price or equal', r.data.combos.CHEAPEST.ingredients_total_minor <= r.data.combos.FASTEST.ingredients_total_minor);
  assert('FASTEST has lower ETA', r.data.combos.FASTEST.eta_to_chef_minutes <= r.data.combos.CHEAPEST.eta_to_chef_minutes);
  assert('Has expiry', !!r.data.expires_at);

  // ── Orders ──
  console.log('\n🛒 Orders');
  r = await req('POST', '/v1/orders', { meal_id: 'meal_001', servings: 2, ingredient_source: 'STORES', address_id: 'addr_001' });
  assert('Create order succeeds', r.ok && r.status === 201);
  assert('Order has ID', !!r.data.order_id);
  assert('Status is CREATED', r.data.status === 'CREATED');
  assert('Has chat room', !!r.data.chat_room_id);
  assert('Has pricing breakdown', !!r.data.pricing?.total);
  ORDER_ID = r.data.order_id;

  r = await req('GET', '/v1/orders');
  assert('List orders returns array', r.ok && r.data.orders?.length >= 1);

  r = await req('GET', '/v1/orders/' + ORDER_ID);
  assert('Get order by ID', r.ok && r.data.order_id === ORDER_ID);
  assert('Order has delivery tasks', r.data.delivery_tasks?.length >= 1);
  assert('Has INGREDIENT_RUN task', r.data.delivery_tasks?.some(t => t.task_type === 'INGREDIENT_RUN'));
  assert('Has MEAL_RUN task', r.data.delivery_tasks?.some(t => t.task_type === 'MEAL_RUN'));

  // ── Status Flow ──
  console.log('\n📍 Order Status Flow');
  const statuses = ['CONFIRMED', 'INGREDIENTS_SOURCING', 'INGREDIENTS_DELIVERED_TO_CHEF', 'CHEF_PREPARING', 'MEAL_READY', 'MEAL_ON_THE_WAY', 'DELIVERED'];
  for (const s of statuses) {
    r = await req('PATCH', '/v1/orders/' + ORDER_ID, { status: s });
    assert(`Transition to ${s}`, r.ok && r.data.status === s);
  }

  r = await req('GET', '/v1/orders/' + ORDER_ID);
  assert('Final status is DELIVERED', r.data.status === 'DELIVERED');
  assert('Version incremented to 8', r.data.order_version === 8);

  // ── Payments ──
  console.log('\n💳 Payments');
  const ord2 = (await req('POST', '/v1/orders', { meal_id: 'meal_002', servings: 1, ingredient_source: 'STORES', address_id: 'addr_001' })).data;
  r = await req('POST', '/v1/payments/intent', { order_id: ord2.order_id, method: 'CARD', amount_minor: 25000 });
  assert('Payment intent created', r.ok && r.status === 201);
  assert('Payment is PENDING', r.data.status === 'PENDING');
  await sleep(1500);
  r = await req('GET', '/v1/orders/' + ord2.order_id);
  assert('Payment auto-confirmed order', r.data.status === 'CONFIRMED');

  // ── Chat ──
  console.log('\n💬 Chat');
  r = await req('GET', '/v1/chat/rooms');
  assert('Chat rooms exist', r.ok && r.data.rooms?.length >= 1);
  const roomId = r.data.rooms[0]?.chat_room_id;

  r = await req('POST', '/v1/chat/rooms/' + roomId + '/messages', { text: 'Hello chef!', type: 'TEXT' });
  assert('Send message', r.ok && r.status === 201);
  assert('Message has ID', !!r.data.message_id);

  r = await req('GET', '/v1/chat/rooms/' + roomId + '/messages');
  assert('Get messages', r.ok && r.data.messages?.length >= 1);

  // ── Ratings ──
  console.log('\n⭐ Ratings');
  r = await req('POST', '/v1/ratings', { order_id: ORDER_ID, chef_score: 5, delivery_score: 4, meal_score: 5, comment: 'Excellent!' });
  assert('Submit rating', r.ok && r.status === 201);
  assert('Rating has scores', r.data.chef_score === 5 && r.data.delivery_score === 4);

  // ── Favorites ──
  console.log('\n❤️  Favorites');
  r = await req('POST', '/v1/favorites/meal_001');
  assert('Add favorite', r.ok && r.status === 201);

  r = await req('POST', '/v1/favorites/meal_001');
  assert('Duplicate favorite rejected (409)', r.status === 409);

  r = await req('POST', '/v1/favorites/meal_002');
  assert('Add second favorite', r.ok);

  r = await req('GET', '/v1/favorites');
  assert('List favorites returns 2', r.ok && r.data.favorites?.length === 2);
  assert('Favorites include meal data', !!r.data.favorites[0]?.meal);

  r = await req('DELETE', '/v1/favorites/meal_002');
  assert('Remove favorite', r.ok);

  r = await req('GET', '/v1/favorites');
  assert('After removal: 1 favorite', r.data.favorites?.length === 1);

  // ── Loyalty ──
  console.log('\n🏆 Loyalty');
  r = await req('GET', '/v1/loyalty/account');
  assert('Get loyalty account', r.ok);
  assert('Starts at BRONZE', r.data.tier === 'BRONZE');

  r = await req('POST', '/v1/loyalty/earn/order', { order_id: ORDER_ID, total_minor: 28000 });
  assert('Earn points from order', r.ok && r.data.points_earned > 0);
  assert('Points = amount/100', r.data.points_earned === 280);
  const bal1 = r.data.new_balance;

  r = await req('POST', '/v1/loyalty/earn/order', { order_id: ord2.order_id, total_minor: 25000 });
  assert('Earn more points', r.ok && r.data.new_balance > bal1);

  r = await req('GET', '/v1/loyalty/transactions');
  assert('Has transaction history', r.ok && r.data.transactions?.length >= 2);

  // ── Delivery Tasks ──
  console.log('\n🚗 Delivery');
  r = await req('GET', '/v1/delivery/tasks');
  assert('List tasks', r.ok && r.data.tasks?.length >= 2);
  const task = r.data.tasks.find(t => t.status === 'AVAILABLE');
  assert('Has AVAILABLE tasks', !!task);

  if (task) {
    // Login as driver
    const driverAuth = await req('POST', '/v1/auth/otp/verify', { phone: '+201000000005', code: '000000' });
    const driverToken = TOKEN;
    TOKEN = driverAuth.data.access_token;

    r = await req('POST', '/v1/delivery/tasks/' + task.task_id + '/accept');
    assert('Driver accepts task', r.ok && r.data.status === 'ASSIGNED');
    assert('Assigned to driver', r.data.assigned_to === driverAuth.data.user?.user_id);

    r = await req('PATCH', '/v1/delivery/tasks/' + task.task_id, { status: 'IN_PROGRESS' });
    assert('Task moved to IN_PROGRESS', r.ok && r.data.status === 'IN_PROGRESS');

    r = await req('PATCH', '/v1/delivery/tasks/' + task.task_id, { status: 'COMPLETED' });
    assert('Task COMPLETED', r.ok && r.data.status === 'COMPLETED');

    TOKEN = driverToken; // restore customer token
  }

  // ── ETA ──
  console.log('\n⏱️  ETA Prediction');
  r = await req('POST', '/v1/eta/predict', { order_id: ORDER_ID, task_type: 'MEAL_RUN', distance_km: 5, stop_count: 2 });
  assert('ETA prediction returns minutes', r.ok && r.data.eta_minutes > 0);
  assert('Has confidence score', r.data.confidence > 0);
  assert('Has range (min/max)', r.data.eta_range?.min > 0);

  // ── Support ──
  console.log('\n🎫 Support');
  r = await req('POST', '/v1/support/tickets', { order_id: ORDER_ID, category: 'quality', message: 'Test ticket' });
  assert('Create support ticket', r.ok && r.status === 201);
  assert('Ticket is OPEN', r.data.status === 'OPEN');

  // ── Events / Outbox ──
  console.log('\n📋 Events');
  r = await req('GET', '/v1/events');
  assert('Events logged', r.ok && r.data.total >= 5);
  assert('Has order.created events', r.data.events?.some(e => e.type === 'order.created'));
  assert('Has order.status_changed', r.data.events?.some(e => e.type === 'order.status_changed'));

  // ── Analytics ──
  console.log('\n📊 Analytics');
  r = await req('GET', '/v1/analytics/summary');
  assert('Analytics summary', r.ok);
  assert('Has order count', r.data.total_orders >= 2);
  assert('Has GMV', r.data.gmv_minor > 0);

  // ── Auth edge cases ──
  console.log('\n🔒 Auth Edge Cases');
  const savedToken = TOKEN;
  TOKEN = null;
  r = await req('POST', '/v1/orders', { meal_id: 'meal_001' });
  assert('Unauthenticated order rejected (401)', r.status === 401);

  r = await req('GET', '/v1/favorites');
  assert('Unauthenticated favorites rejected', r.status === 401);

  TOKEN = 'invalid.token.here';
  r = await req('GET', '/v1/orders');
  assert('Invalid token rejected (401)', r.status === 401);
  TOKEN = savedToken;

  // ── Summary ──
  console.log('\n' + '═'.repeat(55));
  console.log(`  RESULTS: ${PASS} passed, ${FAIL} failed, ${PASS + FAIL} total`);
  console.log('═'.repeat(55));
  if (FAIL === 0) console.log('  🎉 ALL TESTS PASSED!\n');
  else console.log(`  ⚠️  ${FAIL} test(s) failed\n`);

  process.exit(FAIL > 0 ? 1 : 0);
}

// Wait for server then run
function waitForServer(retries = 30) {
  const r = http.get(API + '/v1/health', (res) => {
    if (res.statusCode === 200) { console.log('  Server is ready!\n'); run(); }
    else if (retries > 0) setTimeout(() => waitForServer(retries - 1), 500);
    else { console.error('Server not responding'); process.exit(1); }
  });
  r.on('error', () => {
    if (retries > 0) setTimeout(() => waitForServer(retries - 1), 500);
    else { console.error('Cannot connect to server on port 3000'); process.exit(1); }
  });
}

console.log('  Waiting for server on port 3000...');
waitForServer();
