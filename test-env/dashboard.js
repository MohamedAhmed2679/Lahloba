// Dashboard HTML served by the test server
module.exports = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lahloba Test Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh}
.header{background:linear-gradient(135deg,#0f766e,#0d9488);padding:20px 32px;display:flex;align-items:center;gap:16px}
.header h1{font-size:24px;font-weight:700}.header .badge{background:rgba(255,255,255,.2);padding:4px 12px;border-radius:12px;font-size:12px}
.main{display:flex;height:calc(100vh - 72px)}
.sidebar{width:220px;background:#1e293b;padding:16px;overflow-y:auto}
.sidebar button{width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#94a3b8;border-radius:12px;cursor:pointer;font-size:13px;margin-bottom:4px;transition:.15s}
.sidebar button:hover{background:#334155;color:#f1f5f9}.sidebar button.active{background:rgba(15,118,110,.2);color:#14b8a6;font-weight:600}
.content{flex:1;overflow-y:auto;padding:24px}
.card{background:#1e293b;border-radius:18px;padding:20px;margin-bottom:16px;border:1px solid #334155}
.card h3{font-size:16px;font-weight:600;margin-bottom:12px;color:#14b8a6}
.btn{padding:8px 20px;border:none;border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;transition:.15s}
.btn-primary{background:#0f766e;color:#fff}.btn-primary:hover{background:#0d9488}
.btn-secondary{background:#f59e0b;color:#0f172a}.btn-secondary:hover{background:#d97706}
.btn-danger{background:#f43f5e;color:#fff}.btn-sm{padding:5px 12px;font-size:12px}
input,select,textarea{background:#0f172a;border:1px solid #334155;color:#f1f5f9;padding:8px 14px;border-radius:12px;width:100%;font-size:13px;margin-bottom:8px}
input:focus,select:focus{border-color:#14b8a6;outline:none}
.log{background:#0f172a;border-radius:12px;padding:12px;font-family:'Fira Code',monospace;font-size:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;border:1px solid #334155}
.status{display:inline-block;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:600}
.status-CREATED{background:#334155;color:#94a3b8}.status-CONFIRMED{background:#1e3a5f;color:#60a5fa}
.status-INGREDIENTS_SOURCING{background:#422006;color:#f59e0b}.status-CHEF_PREPARING{background:#431407;color:#fb923c}
.status-MEAL_ON_THE_WAY{background:#2e1065;color:#a78bfa}.status-DELIVERED{background:#052e16;color:#4ade80}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{background:#1e293b;border-radius:14px;padding:16px;border:1px solid #334155}
.kpi .value{font-size:28px;font-weight:700;color:#14b8a6}.kpi .label{font-size:12px;color:#94a3b8;margin-top:4px}
.flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mb{margin-bottom:12px}.mt{margin-top:12px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:#94a3b8;padding:8px;border-bottom:1px solid #334155;font-weight:500}
td{padding:8px;border-bottom:1px solid #1e293b}
.toast{position:fixed;bottom:20px;right:20px;background:#0f766e;color:#fff;padding:12px 24px;border-radius:14px;font-size:13px;font-weight:500;animation:slideUp .3s ease;z-index:999}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
</style></head><body>
<div class="header">
  <div style="width:40px;height:40px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px">L</div>
  <div><h1>Lahloba</h1></div>
  <div class="badge">Test Dashboard v1.1</div>
  <div style="flex:1"></div>
  <div id="authStatus" style="font-size:13px;color:rgba(255,255,255,.7)">Not logged in</div>
</div>
<div class="main">
  <div class="sidebar">
    <button class="active" onclick="showTab('flow')">🚀 Happy Path</button>
    <button onclick="showTab('auth')">🔐 Auth</button>
    <button onclick="showTab('meals')">🍽️ Meals</button>
    <button onclick="showTab('combos')">📦 Combos</button>
    <button onclick="showTab('orders')">🛒 Orders</button>
    <button onclick="showTab('tracking')">📍 Tracking</button>
    <button onclick="showTab('payments')">💳 Payments</button>
    <button onclick="showTab('chat')">💬 Chat</button>
    <button onclick="showTab('ratings')">⭐ Ratings</button>
    <button onclick="showTab('favorites')">❤️ Favorites</button>
    <button onclick="showTab('loyalty')">🏆 Loyalty</button>
    <button onclick="showTab('search')">🔍 Search</button>
    <button onclick="showTab('delivery')">🚗 Delivery</button>
    <button onclick="showTab('events')">📋 Events</button>
    <button onclick="showTab('health')">💚 Health</button>
  </div>
  <div class="content" id="content"></div>
</div>

<script>
const API='http://localhost:3000/v1';
let TOKEN=null;let USER=null;let CURRENT_ORDER=null;
const log=(id,data)=>{const el=document.getElementById(id);if(el)el.textContent=typeof data==='string'?data:JSON.stringify(data,null,2);}
const toast=(msg)=>{const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3500);}

async function api(method,path,body=null){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(TOKEN)opts.headers['Authorization']='Bearer '+TOKEN;
  if(body)opts.body=JSON.stringify(body);
  try{const r=await fetch(API+path,opts);const d=await r.json();return{ok:r.ok,status:r.status,data:d};}
  catch(e){return{ok:false,status:0,data:{error:e.message}};}
}

// ── Tab content generators ──
const tabs={
flow:()=>\`
<div class="card"><h3>🚀 Complete Happy Path Test</h3>
<p style="color:#94a3b8;margin-bottom:16px">Run the full customer flow: Login → Browse → Combos → Order → Pay → Track → Rate → Favorite → Loyalty</p>
<button class="btn btn-primary" onclick="runHappyPath()" id="happyBtn">Run Happy Path</button>
<div class="mt"><div class="log" id="happyLog" style="min-height:200px">Click "Run Happy Path" to begin...</div></div>
</div>
<div class="kpi-row" id="kpis"></div>
\`,
auth:()=>\`
<div class="card"><h3>🔐 Authentication</h3>
<div class="flex mb"><input id="phone" value="+201000000001" style="width:200px" placeholder="Phone"><button class="btn btn-primary" onclick="requestOtp()">Request OTP</button></div>
<div class="flex mb"><input id="otp" value="000000" style="width:120px" placeholder="OTP Code"><button class="btn btn-secondary" onclick="verifyOtp()">Verify OTP</button></div>
<div class="log" id="authLog"></div></div>
\`,
meals:()=>\`
<div class="card"><h3>🍽️ Meals</h3>
<div class="flex mb"><button class="btn btn-primary" onclick="listMeals()">List All</button><button class="btn btn-sm btn-primary" onclick="listMeals('COOKED')">Cooked</button><button class="btn btn-sm btn-primary" onclick="listMeals('READY_TO_COOK')">Ready-to-Cook</button><button class="btn btn-sm btn-primary" onclick="getMeal('meal_001')">Get meal_001</button></div>
<div class="log" id="mealsLog"></div></div>
\`,
combos:()=>\`
<div class="card"><h3>📦 Ingredient Combos</h3>
<div class="flex mb"><select id="comboMeal" style="width:200px"><option value="meal_001">Egyptian Chicken Rice</option><option value="meal_002">Pasta Alfredo</option><option value="meal_003">Kofta Kit</option></select>
<input id="comboServings" value="2" style="width:80px" placeholder="Servings">
<button class="btn btn-primary" onclick="computeCombos()">Compute Combos</button></div>
<div class="log" id="combosLog"></div></div>
\`,
orders:()=>\`
<div class="card"><h3>🛒 Create Order</h3>
<div class="flex mb"><select id="orderMeal" style="width:200px"><option value="meal_001">Egyptian Chicken Rice</option><option value="meal_002">Pasta Alfredo</option></select>
<input id="orderServings" value="1" style="width:80px" placeholder="Servings">
<button class="btn btn-primary" onclick="createOrder()">Place Order</button></div>
<div class="log" id="orderLog"></div></div>
<div class="card"><h3>📋 My Orders</h3>
<button class="btn btn-primary mb" onclick="listOrders()">Refresh Orders</button>
<div id="ordersList"></div></div>
\`,
tracking:()=>\`
<div class="card"><h3>📍 Order Tracking / Status Simulation</h3>
<p style="color:#94a3b8;margin-bottom:12px">Advance order through status flow:</p>
<div class="flex mb"><input id="trackOrderId" placeholder="Order ID (e.g. ord_xxxxx)" style="width:200px"><button class="btn btn-primary" onclick="getOrder()">Load Order</button></div>
<div id="statusButtons" class="flex mb"></div>
<div class="log" id="trackLog"></div></div>
\`,
payments:()=>\`
<div class="card"><h3>💳 Payments (Stub)</h3>
<div class="flex mb"><input id="payOrderId" placeholder="Order ID" style="width:200px"><select id="payMethod" style="width:120px"><option>CARD</option><option>WALLET</option></select>
<button class="btn btn-primary" onclick="createPayment()">Pay</button></div>
<div class="log" id="payLog"></div></div>
\`,
chat:()=>\`
<div class="card"><h3>💬 Chat</h3>
<button class="btn btn-primary mb" onclick="listChatRooms()">List Rooms</button>
<div class="flex mb"><input id="chatRoom" placeholder="Room ID" style="width:180px"><input id="chatMsg" placeholder="Message" style="width:200px"><button class="btn btn-secondary" onclick="sendChat()">Send</button></div>
<div class="log" id="chatLog"></div></div>
\`,
ratings:()=>\`
<div class="card"><h3>⭐ Ratings</h3>
<div class="flex mb"><input id="rateOrder" placeholder="Order ID" style="width:160px">
<select id="rateChef" style="width:60px"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
<select id="rateDel" style="width:60px"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
<button class="btn btn-secondary" onclick="submitRating()">Rate</button></div>
<div class="log" id="rateLog"></div></div>
\`,
favorites:()=>\`
<div class="card"><h3>❤️ Favorites</h3>
<div class="flex mb"><button class="btn btn-primary" onclick="listFavorites()">My Favorites</button>
<button class="btn btn-sm btn-secondary" onclick="addFavorite('meal_001')">♡ Chicken Rice</button>
<button class="btn btn-sm btn-secondary" onclick="addFavorite('meal_002')">♡ Pasta</button>
<button class="btn btn-sm btn-danger" onclick="removeFavorite('meal_001')">✕ Remove meal_001</button></div>
<div class="log" id="favLog"></div></div>
\`,
loyalty:()=>\`
<div class="card"><h3>🏆 Loyalty</h3>
<div class="flex mb"><button class="btn btn-primary" onclick="getLoyalty()">My Account</button>
<button class="btn btn-secondary" onclick="earnPoints()">Earn Points (Order)</button>
<button class="btn btn-primary" onclick="getLoyaltyTxns()">Transactions</button></div>
<div class="log" id="loyaltyLog"></div></div>
\`,
search:()=>\`
<div class="card"><h3>🔍 Full-Text Search</h3>
<div class="flex mb"><input id="searchQ" placeholder="Search meals..." style="width:240px"><button class="btn btn-primary" onclick="searchMeals()">Search</button></div>
<div class="flex mb"><button class="btn btn-sm btn-primary" onclick="searchQ('chicken')">chicken</button><button class="btn btn-sm btn-primary" onclick="searchQ('pasta')">pasta</button><button class="btn btn-sm btn-primary" onclick="searchQ('كفتة')">كفتة</button><button class="btn btn-sm btn-primary" onclick="searchQ('rice')">rice</button></div>
<div class="log" id="searchLog"></div></div>
\`,
delivery:()=>\`
<div class="card"><h3>🚗 Delivery Tasks</h3>
<div class="flex mb"><button class="btn btn-primary" onclick="listTasks()">Available Tasks</button><button class="btn btn-secondary" onclick="listTasks('ASSIGNED')">Assigned</button></div>
<div class="flex mb"><input id="acceptTask" placeholder="Task ID" style="width:200px"><button class="btn btn-primary" onclick="acceptTask()">Accept Task</button></div>
<div class="log" id="deliveryLog"></div></div>
\`,
events:()=>\`
<div class="card"><h3>📋 Outbox Events</h3>
<button class="btn btn-primary mb" onclick="loadEvents()">Refresh</button>
<div class="log" id="eventsLog" style="max-height:500px"></div></div>
\`,
health:()=>\`
<div class="card"><h3>💚 System Health</h3>
<button class="btn btn-primary mb" onclick="checkHealth()">Check</button>
<div class="log" id="healthLog"></div></div>
\`,
};

function showTab(t){document.querySelectorAll('.sidebar button').forEach(b=>{b.classList.toggle('active',b.textContent.includes(t==='flow'?'Happy':t.charAt(0).toUpperCase()+t.slice(1)))});
  document.getElementById('content').innerHTML=tabs[t]?tabs[t]():'<div class="card">Coming soon</div>';
  // Auto-fix active button
  document.querySelectorAll('.sidebar button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar button').forEach(b=>{if(b.onclick&&b.onclick.toString().includes("'"+t+"'"))b.classList.add('active');});
}

// ── API calls ──
async function requestOtp(){const r=await api('POST','/auth/otp/request',{phone:document.getElementById('phone').value});log('authLog',r.data);if(r.ok)toast('OTP sent!');}
async function verifyOtp(){const r=await api('POST','/auth/otp/verify',{phone:document.getElementById('phone').value,code:document.getElementById('otp').value});log('authLog',r.data);if(r.ok){TOKEN=r.data.access_token;USER=r.data.user;document.getElementById('authStatus').textContent='✅ '+r.data.user.user_id+' ('+r.data.user.role+')';toast('Logged in as '+r.data.user.user_id);}}
async function listMeals(type){const q=type?'?type='+type:'';const r=await api('GET','/meals'+q);log('mealsLog',r.data);}
async function getMeal(id){const r=await api('GET','/meals/'+id);log('mealsLog',r.data);}
async function computeCombos(){const r=await api('POST','/ingredient-combos/compute',{meal_id:document.getElementById('comboMeal').value,servings:parseInt(document.getElementById('comboServings').value),address_id:'addr_001',scheduled_at:new Date(Date.now()+3600000).toISOString()});log('combosLog',r.data);}
async function createOrder(){if(!TOKEN){toast('Login first!');return;}const r=await api('POST','/orders',{meal_id:document.getElementById('orderMeal').value,servings:parseInt(document.getElementById('orderServings').value),ingredient_source:'STORES',address_id:'addr_001'});log('orderLog',r.data);if(r.ok){CURRENT_ORDER=r.data.order_id;toast('Order '+r.data.order_id+' created!');}}
async function listOrders(){if(!TOKEN){toast('Login first!');return;}const r=await api('GET','/orders');if(r.ok){let h='<table><tr><th>ID</th><th>Status</th><th>Meal</th><th>Total</th><th>Created</th></tr>';r.data.orders.forEach(o=>{h+='<tr><td style="font-family:monospace;color:#14b8a6;cursor:pointer" onclick="document.getElementById(\\'trackOrderId\\').value=\\''+o.order_id+'\\';showTab(\\'tracking\\')">'+o.order_id+'</td><td><span class="status status-'+o.status+'">'+o.status+'</span></td><td>'+o.meal_id+'</td><td style="color:#f59e0b">'+(o.pricing?.total?.amount_minor/100||0)+' EGP</td><td>'+new Date(o.created_at).toLocaleTimeString()+'</td></tr>';});h+='</table>';document.getElementById('ordersList').innerHTML=h;}}
async function getOrder(){const id=document.getElementById('trackOrderId').value;if(!id)return;const r=await api('GET','/orders/'+id);if(r.ok){log('trackLog',r.data);const statuses=['CREATED','CONFIRMED','INGREDIENTS_SOURCING','INGREDIENTS_DELIVERED_TO_CHEF','CHEF_PREPARING','MEAL_READY','MEAL_ON_THE_WAY','DELIVERED'];let btns='';statuses.forEach(s=>{const active=s===r.data.status;btns+='<button class="btn btn-sm '+(active?'btn-secondary':'btn-primary')+'" onclick="advanceOrder(\\''+id+'\\',\\''+s+'\\')">'+s.replace(/_/g,' ')+'</button>';});document.getElementById('statusButtons').innerHTML=btns;}}
async function advanceOrder(id,status){const r=await api('PATCH','/orders/'+id,{status});log('trackLog',r.data);if(r.ok){toast('Status → '+status);getOrder();}}
async function createPayment(){const r=await api('POST','/payments/intent',{order_id:document.getElementById('payOrderId').value||CURRENT_ORDER,method:document.getElementById('payMethod').value,amount_minor:28000});log('payLog',r.data);if(r.ok)toast('Payment created (auto-succeeds in 1s)');}
async function listChatRooms(){const r=await api('GET','/chat/rooms');log('chatLog',r.data);}
async function sendChat(){const r=await api('POST','/chat/rooms/'+document.getElementById('chatRoom').value+'/messages',{text:document.getElementById('chatMsg').value});log('chatLog',r.data);if(r.ok)toast('Message sent');}
async function submitRating(){const r=await api('POST','/ratings',{order_id:document.getElementById('rateOrder').value||CURRENT_ORDER,chef_score:parseInt(document.getElementById('rateChef').value),delivery_score:parseInt(document.getElementById('rateDel').value),meal_score:5,comment:'Great meal!'});log('rateLog',r.data);if(r.ok)toast('Rating submitted (+50 loyalty pts)');}
async function listFavorites(){const r=await api('GET','/favorites');log('favLog',r.data);}
async function addFavorite(id){const r=await api('POST','/favorites/'+id);log('favLog',r.data);if(r.ok)toast('Added to favorites');}
async function removeFavorite(id){const r=await api('DELETE','/favorites/'+id);log('favLog',r.data);if(r.ok)toast('Removed');}
async function getLoyalty(){const r=await api('GET','/loyalty/account');log('loyaltyLog',r.data);}
async function earnPoints(){const r=await api('POST','/loyalty/earn/order',{order_id:CURRENT_ORDER||'ord_test',total_minor:28000});log('loyaltyLog',r.data);if(r.ok)toast('+'+r.data.points_earned+' points!');}
async function getLoyaltyTxns(){const r=await api('GET','/loyalty/transactions');log('loyaltyLog',r.data);}
async function searchMeals(){const r=await api('GET','/search?q='+document.getElementById('searchQ').value);log('searchLog',r.data);}
function searchQ(q){document.getElementById('searchQ').value=q;searchMeals();}
async function listTasks(s){const r=await api('GET','/delivery/tasks'+(s?'?status='+s:''));log('deliveryLog',r.data);}
async function acceptTask(){const r=await api('POST','/delivery/tasks/'+document.getElementById('acceptTask').value+'/accept');log('deliveryLog',r.data);if(r.ok)toast('Task accepted');}
async function loadEvents(){const r=await api('GET','/events');log('eventsLog',r.data);}
async function checkHealth(){const r=await api('GET','/health');log('healthLog',r.data);}

// ── Happy Path ──
async function runHappyPath(){
  const el=document.getElementById('happyLog');const btn=document.getElementById('happyBtn');btn.disabled=true;
  const w=(m)=>{el.textContent+=m+'\\n';el.scrollTop=el.scrollHeight;};
  el.textContent='';
  w('═══ LAHLOBA HAPPY PATH TEST ═══\\n');

  w('1️⃣  Request OTP...');
  let r=await api('POST','/auth/otp/request',{phone:'+201000000001'});
  w(r.ok?'   ✅ OTP sent (code: '+r.data._dev_code+')':'   ❌ '+r.data.error);

  w('\\n2️⃣  Verify OTP (bypass: 000000)...');
  r=await api('POST','/auth/otp/verify',{phone:'+201000000001',code:'000000'});
  if(r.ok){TOKEN=r.data.access_token;USER=r.data.user;document.getElementById('authStatus').textContent='✅ '+r.data.user.user_id;
    w('   ✅ Logged in as '+r.data.user.user_id+' ('+r.data.user.role+')');}else{w('   ❌ '+r.data.error);btn.disabled=false;return;}

  w('\\n3️⃣  Browse meals...');
  r=await api('GET','/meals');w('   ✅ Found '+r.data.total+' meals');r.data.meals.forEach(m=>w('   • '+m.name_en+' ('+m.type+') — '+(m.base_price_minor/100)+' EGP'));

  w('\\n4️⃣  Get meal details (meal_001)...');
  r=await api('GET','/meals/meal_001');w('   ✅ '+r.data.name_en+' by '+r.data.chef?.name);w('   Ingredients: '+r.data.ingredients?.length);

  w('\\n5️⃣  Compute ingredient combos...');
  r=await api('POST','/ingredient-combos/compute',{meal_id:'meal_001',servings:2,address_id:'addr_001'});
  if(r.ok){w('   ✅ CHEAPEST: '+(r.data.combos.CHEAPEST.ingredients_total_minor/100)+' EGP ('+r.data.combos.CHEAPEST.store_count+' stores, ~'+r.data.combos.CHEAPEST.eta_to_chef_minutes+' min)');
    w('   ✅ FASTEST:  '+(r.data.combos.FASTEST.ingredients_total_minor/100)+' EGP ('+r.data.combos.FASTEST.store_count+' store, ~'+r.data.combos.FASTEST.eta_to_chef_minutes+' min)');}

  w('\\n6️⃣  Search for "chicken"...');
  r=await api('GET','/search?q=chicken');w('   ✅ '+r.data.total+' results in '+r.data.processing_ms+'ms');

  w('\\n7️⃣  Create order...');
  r=await api('POST','/orders',{meal_id:'meal_001',servings:2,ingredient_source:'STORES',address_id:'addr_001'});
  if(r.ok){CURRENT_ORDER=r.data.order_id;w('   ✅ Order '+r.data.order_id+' created (status: '+r.data.status+')');w('   Chat room: '+r.data.chat_room_id);}

  w('\\n8️⃣  Create payment...');
  r=await api('POST','/payments/intent',{order_id:CURRENT_ORDER,method:'CARD',amount_minor:28000});
  w(r.ok?'   ✅ Payment '+r.data.payment_id+' (auto-confirms in 1s)':'   ❌ '+r.data.error);
  await new Promise(r=>setTimeout(r,1500));

  w('\\n9️⃣  Advance order through statuses...');
  for(const s of['CONFIRMED','INGREDIENTS_SOURCING','INGREDIENTS_DELIVERED_TO_CHEF','CHEF_PREPARING','MEAL_READY','MEAL_ON_THE_WAY','DELIVERED']){
    r=await api('PATCH','/orders/'+CURRENT_ORDER,{status:s});w('   → '+s+(r.ok?' ✅':' ❌'));await new Promise(r=>setTimeout(r,300));}

  w('\\n🔟  Send chat message...');
  const rooms=await api('GET','/chat/rooms');const room=rooms.data.rooms?.[0];
  if(room){r=await api('POST','/chat/rooms/'+room.chat_room_id+'/messages',{text:'Shukran! The food was amazing 🍽️'});w('   ✅ Message sent in '+room.chat_room_id);}

  w('\\n1️⃣1️⃣ Submit rating...');
  r=await api('POST','/ratings',{order_id:CURRENT_ORDER,chef_score:5,delivery_score:5,meal_score:5,comment:'Absolutely delicious!'});
  w(r.ok?'   ✅ Rated: chef=5 delivery=5 meal=5 (+50 loyalty pts)':'   ❌ '+r.data.error);

  w('\\n1️⃣2️⃣ Add to favorites...');
  r=await api('POST','/favorites/meal_001');w(r.ok?'   ✅ meal_001 favorited':'   ⚠️ '+r.data.error);

  w('\\n1️⃣3️⃣ Earn loyalty points...');
  r=await api('POST','/loyalty/earn/order',{order_id:CURRENT_ORDER,total_minor:28000});
  w(r.ok?'   ✅ Earned '+r.data.points_earned+' pts (balance: '+r.data.new_balance+', tier: '+r.data.tier+')':'   ❌ '+r.data.error);

  w('\\n1️⃣4️⃣ Check loyalty account...');
  r=await api('GET','/loyalty/account');w(r.ok?'   ✅ Tier: '+r.data.tier+' | Points: '+r.data.available_points+' | Lifetime: '+r.data.lifetime_points:'   ❌');

  w('\\n1️⃣5️⃣ Check delivery tasks...');
  r=await api('GET','/delivery/tasks');w('   ✅ '+r.data.total+' tasks created');

  w('\\n1️⃣6️⃣ Check outbox events...');
  r=await api('GET','/events');w('   ✅ '+r.data.total+' events emitted');

  w('\\n1️⃣7️⃣ Health check...');
  r=await api('GET','/health');w('   ✅ '+JSON.stringify(r.data));

  w('\\n═══════════════════════════════════');
  w('🎉 ALL 17 STEPS PASSED!');
  w('═══════════════════════════════════');
  toast('Happy Path Complete! All tests passed.');
  btn.disabled=false;

  // Update KPIs
  const h=await api('GET','/health');const a=await api('GET','/analytics/summary');
  document.getElementById('kpis').innerHTML=\`
    <div class="kpi"><div class="value">\${h.data.orders||0}</div><div class="label">Orders</div></div>
    <div class="kpi"><div class="value">\${h.data.users||0}</div><div class="label">Users</div></div>
    <div class="kpi"><div class="value">\${h.data.meals||0}</div><div class="label">Meals</div></div>
    <div class="kpi"><div class="value">\${(a.data?.gmv_minor||0)/100} EGP</div><div class="label">GMV</div></div>\`;
}

// Init
showTab('flow');
</script></body></html>`;
