#!/usr/bin/env node
const http = require('http');
const crypto = require('crypto');
const { Database, uid } = require('./db');
const db = new Database();
const PORT = 3000;
const SECRET = 'test-lahloba-2026';

// JWT
function signJwt(p) { const h = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'); const b = Buffer.from(JSON.stringify({...p, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'); const s = crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url'); return `${h}.${b}.${s}`; }
function verifyJwt(t) { try { const [h,b,s]=t.split('.'); if(crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url')!==s)return null; const p=JSON.parse(Buffer.from(b,'base64url').toString()); return p.exp>Date.now()/1000?p:null; } catch{return null;} }

function parseBody(req){return new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{r(JSON.parse(d))}catch{r({})}});})}
function parseQuery(u){const q={};(u.split('?')[1]||'').split('&').forEach(p=>{const[k,v]=p.split('=');if(k)q[k]=decodeURIComponent(v||'')});return q;}
function getAuth(req){const a=req.headers.authorization;if(!a||!a.startsWith('Bearer '))return null;return verifyJwt(a.slice(7));}
function json(res,data,s=200){res.writeHead(s,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});res.end(JSON.stringify(data,null,2));}
function err(res,m,s=400){json(res,{error:m},s);}

const STATUS_FLOW=['CREATED','CONFIRMED','INGREDIENTS_SOURCING','INGREDIENTS_DELIVERED_TO_CHEF','CHEF_PREPARING','MEAL_READY','MEAL_ON_THE_WAY','DELIVERED'];

const routes=[];
function route(method,path,handler){routes.push({method,regex:new RegExp('^'+path.replace(/:(\w+)/g,'(?<$1>[^/]+)')+'$'),handler});}
function match(method,url){const p=url.split('?')[0];for(const r of routes){if(r.method!==method)continue;const m=p.match(r.regex);if(m)return{handler:r.handler,params:m.groups||{}};}return null;}

// ── AUTH ──
route('POST','/v1/auth/otp/request',async(req,res,{body})=>{
  const dest=body.phone||body.email;if(!dest)return err(res,'Phone or email required');
  const code=String(Math.floor(100000+Math.random()*900000));
  db.tables.otp_store[dest]={code,expires:Date.now()+300000};
  console.log(`📱 OTP for ${dest}: ${code} (bypass: 000000)`);
  json(res,{message:'OTP sent',expires_in:300,_dev_code:code});
});

route('POST','/v1/auth/otp/verify',async(req,res,{body})=>{
  const dest=body.phone||body.email;if(!dest)return err(res,'Phone or email required');
  const stored=db.tables.otp_store[dest];
  if(body.code!=='000000'){if(!stored||stored.code!==body.code)return err(res,'Invalid OTP',401);if(Date.now()>stored.expires)return err(res,'OTP expired',401);}
  delete db.tables.otp_store[dest];
  let user=body.phone?db.findOne('users',{phone:body.phone}):db.findOne('users',{email:body.email});
  if(!user){user={user_id:`usr_${uid()}`,role:'CUSTOMER',phone:body.phone,email:body.email,name:null,locale:'en',rating_avg:0,is_active:true,created_at:new Date().toISOString()};db.insert('users',user);}
  json(res,{access_token:signJwt({sub:user.user_id,role:user.role}),refresh_token:signJwt({sub:user.user_id,role:user.role,ref:1}),user:{user_id:user.user_id,role:user.role,phone:user.phone,name:user.name,locale:user.locale}});
});

// ── MEALS ──
route('GET','/v1/meals',async(req,res,{query})=>{
  let meals=db.find('meals',{is_active:true});
  if(query.type)meals=meals.filter(m=>m.type===query.type);
  if(query.q)meals=meals.filter(m=>m.name_en.toLowerCase().includes(query.q.toLowerCase())||m.name_ar.includes(query.q));
  const enriched=meals.map(m=>({...m,chef:db.findOne('users',{user_id:m.chef_id}),ingredients:db.find('meal_ingredients',{meal_id:m.meal_id}).map(mi=>({...mi,ingredient:db.findOne('ingredients',{ingredient_id:mi.ingredient_id})}))}));
  json(res,{meals:enriched,total:enriched.length,page:1,page_size:20});
});

route('GET','/v1/meals/:id',async(req,res,{params})=>{
  const m=db.findOne('meals',{meal_id:params.id});if(!m)return err(res,'Not found',404);
  m.chef=db.findOne('users',{user_id:m.chef_id});m.chef_profile=db.findOne('chef_profiles',{chef_id:m.chef_id});
  m.ingredients=db.find('meal_ingredients',{meal_id:m.meal_id}).map(mi=>({...mi,ingredient:db.findOne('ingredients',{ingredient_id:mi.ingredient_id})}));
  json(res,m);
});

// ── SEARCH ──
route('GET','/v1/search',async(req,res,{query})=>{
  if(!query.q)return err(res,'q is required');
  let meals=db.find('meals',{is_active:true}).filter(m=>m.name_en.toLowerCase().includes(query.q.toLowerCase())||m.name_ar.includes(query.q)||m.description_en?.toLowerCase().includes(query.q.toLowerCase()));
  if(query.type)meals=meals.filter(m=>m.type===query.type);
  json(res,{meals,total:meals.length,query:query.q,processing_ms:2});
});

// ── INGREDIENT COMBOS ──
route('POST','/v1/ingredient-combos/compute',async(req,res,{body})=>{
  if(!body.meal_id)return err(res,'meal_id required');
  const mi=db.find('meal_ingredients',{meal_id:body.meal_id});const svgs=body.servings||1;
  let cheapTotal=0,cheapStores=new Set();
  for(const ing of mi){const maps=db.find('product_ingredient_map',{ingredient_id:ing.ingredient_id});let best=Infinity,bestS=null;
    for(const m of maps){const p=db.findOne('store_products',{product_id:m.product_id});if(p&&p.in_stock&&p.price_minor<best){best=p.price_minor;bestS=p.store_id;}}
    if(bestS){cheapTotal+=Math.ceil(best*ing.qty*svgs);cheapStores.add(bestS);}}
  const fastStore='usr_store_001';let fastTotal=0;
  for(const ing of mi){const maps=db.find('product_ingredient_map',{ingredient_id:ing.ingredient_id});const sm=maps.find(m=>{const p=db.findOne('store_products',{product_id:m.product_id});return p&&p.store_id===fastStore&&p.in_stock;});
    if(sm){const p=db.findOne('store_products',{product_id:sm.product_id});fastTotal+=Math.ceil(p.price_minor*ing.qty*svgs);}}
  json(res,{meal_id:body.meal_id,servings:svgs,combos:{CHEAPEST:{combo_id:`cc_${uid()}`,ingredients_total_minor:cheapTotal,eta_to_chef_minutes:15+(cheapStores.size-1)*12,store_count:cheapStores.size},FASTEST:{combo_id:`cf_${uid()}`,ingredients_total_minor:fastTotal,eta_to_chef_minutes:20,store_count:1}},expires_at:new Date(Date.now()+900000).toISOString()});
});

// ── ORDERS ──
route('POST','/v1/orders',async(req,res,{body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const meal=db.findOne('meals',{meal_id:body.meal_id});if(!meal)return err(res,'Meal not found',404);
  const oid=`ord_${uid()}`;const now=new Date().toISOString();
  const pricing=body.pricing||{chef_service_fee:{amount_minor:meal.base_price_minor,currency:'EGP'},ingredients_total:{amount_minor:8500,currency:'EGP'},delivery_fees:{ingredients_run_fee:{amount_minor:2500,currency:'EGP'},meal_run_fee:{amount_minor:2000,currency:'EGP'}},platform_fee:{amount_minor:0,currency:'EGP'},total:{amount_minor:meal.base_price_minor+13000,currency:'EGP'}};
  const order={order_id:oid,customer_id:auth.sub,chef_id:body.chef_id||meal.chef_id,meal_id:body.meal_id,servings:body.servings||1,ingredient_source:body.ingredient_source||'STORES',status:'CREATED',pricing,order_version:1,created_at:now,updated_at:now};
  db.insert('orders',order);
  db.insert('chat_rooms',{chat_room_id:`chat_${uid()}`,order_id:oid,created_at:now});
  if(order.ingredient_source==='STORES')db.insert('delivery_tasks',{task_id:`tir_${uid()}`,order_id:oid,task_type:'INGREDIENT_RUN',status:'AVAILABLE',payout_minor:2500,stop_count:2,created_at:now});
  db.insert('delivery_tasks',{task_id:`tmr_${uid()}`,order_id:oid,task_type:'MEAL_RUN',status:'AVAILABLE',payout_minor:2000,stop_count:2,created_at:now});
  db.insert('outbox_events',{id:`evt_${uid()}`,type:'order.created',version:'1.0',data:{order_id:oid},status:'PENDING',created_at:now});
  let la=db.findOne('loyalty_accounts',{user_id:auth.sub});if(!la){la={account_id:`la_${uid()}`,user_id:auth.sub,tier:'BRONZE',total_points:0,available_points:0,lifetime_points:0};db.insert('loyalty_accounts',la);}
  console.log(`🛒 Order ${oid} created`);json(res,{...order,chat_room_id:db.findOne('chat_rooms',{order_id:oid})?.chat_room_id},201);
});

route('GET','/v1/orders',async(req,res,{query,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  let orders=auth.role==='ADMIN'?db.tables.orders:db.find('orders',{customer_id:auth.sub});
  if(query.status)orders=orders.filter(o=>o.status===query.status);
  orders.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  json(res,{orders,total:orders.length});
});

route('GET','/v1/orders/:id',async(req,res,{params,auth})=>{
  const o=db.findOne('orders',{order_id:params.id});if(!o)return err(res,'Not found',404);
  o.meal=db.findOne('meals',{meal_id:o.meal_id});o.chef=db.findOne('users',{user_id:o.chef_id});
  o.customer=db.findOne('users',{user_id:o.customer_id});o.address=db.findOne('addresses',{address_id:o.address_id||'addr_001'});
  o.delivery_tasks=db.find('delivery_tasks',{order_id:o.order_id});
  o.chat_room=db.findOne('chat_rooms',{order_id:o.order_id});
  o.payments=db.find('payments',{order_id:o.order_id});o.ratings=db.find('ratings',{order_id:o.order_id});
  json(res,o);
});

route('PATCH','/v1/orders/:id',async(req,res,{params,body,auth})=>{
  const o=db.findOne('orders',{order_id:params.id});if(!o)return err(res,'Not found',404);
  const prev=o.status;if(body.status){o.status=body.status;o.order_version++;o.updated_at=new Date().toISOString();
    db.insert('outbox_events',{id:`evt_${uid()}`,type:'order.status_changed',version:'1.0',data:{order_id:o.order_id,previous_status:prev,new_status:o.status,order_version:o.order_version},status:'PENDING',created_at:new Date().toISOString()});
    console.log(`📦 Order ${o.order_id}: ${prev} → ${o.status}`);}
  json(res,o);
});

// ── PAYMENTS ──
route('POST','/v1/payments/intent',async(req,res,{body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const pid=`pay_${uid()}`;const now=new Date().toISOString();
  const payment={payment_id:pid,order_id:body.order_id,provider:'stub',method:body.method||'CARD',status:'PENDING',amount_minor:body.amount_minor||28000,currency:'EGP',created_at:now};
  db.insert('payments',payment);
  // Auto-succeed in test mode
  setTimeout(()=>{payment.status='SUCCEEDED';payment.paid_at=new Date().toISOString();
    db.insert('outbox_events',{id:`evt_${uid()}`,type:'payment.succeeded',version:'1.0',data:{payment_id:pid,order_id:body.order_id},status:'PENDING',created_at:new Date().toISOString()});
    const order=db.findOne('orders',{order_id:body.order_id});if(order&&order.status==='CREATED'){order.status='CONFIRMED';order.order_version++;order.updated_at=new Date().toISOString();}
    console.log(`💳 Payment ${pid} succeeded`);},1000);
  json(res,payment,201);
});

// ── DELIVERY ──
route('GET','/v1/delivery/tasks',async(req,res,{query,auth})=>{
  let tasks=query.status?db.find('delivery_tasks',{status:query.status}):db.tables.delivery_tasks;
  if(auth&&auth.role==='DELIVERY')tasks=tasks.filter(t=>t.status==='AVAILABLE'||t.assigned_to===auth.sub);
  json(res,{tasks,total:tasks.length});
});

route('POST','/v1/delivery/tasks/:id/accept',async(req,res,{params,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const t=db.findOne('delivery_tasks',{task_id:params.id});if(!t)return err(res,'Not found',404);
  if(t.status!=='AVAILABLE')return err(res,'Task not available');
  t.status='ASSIGNED';t.assigned_to=auth.sub;t.updated_at=new Date().toISOString();
  console.log(`🚗 Task ${t.task_id} accepted by ${auth.sub}`);json(res,t);
});

route('PATCH','/v1/delivery/tasks/:id',async(req,res,{params,body})=>{
  const t=db.findOne('delivery_tasks',{task_id:params.id});if(!t)return err(res,'Not found',404);
  if(body.status){t.status=body.status;t.updated_at=new Date().toISOString();}json(res,t);
});

// ── CHAT ──
route('GET','/v1/chat/rooms',async(req,res,{auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const rooms=db.tables.chat_rooms.map(r=>({...r,last_message:db.find('chat_messages',{chat_room_id:r.chat_room_id}).pop(),message_count:db.count('chat_messages',{chat_room_id:r.chat_room_id})}));
  json(res,{rooms});
});

route('POST','/v1/chat/rooms/:id/messages',async(req,res,{params,body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const msg={message_id:`msg_${uid()}`,chat_room_id:params.id,sender_id:auth.sub,sender_role:auth.role,message_type:body.type||'TEXT',text:body.text,created_at:new Date().toISOString()};
  db.insert('chat_messages',msg);json(res,msg,201);
});

route('GET','/v1/chat/rooms/:id/messages',async(req,res,{params})=>{
  const msgs=db.find('chat_messages',{chat_room_id:params.id}).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  json(res,{messages:msgs,total:msgs.length});
});

// ── RATINGS ──
route('POST','/v1/ratings',async(req,res,{body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const r={rating_id:`rat_${uid()}`,order_id:body.order_id,customer_id:auth.sub,chef_score:body.chef_score,delivery_score:body.delivery_score,meal_score:body.meal_score,comment:body.comment,created_at:new Date().toISOString()};
  db.insert('ratings',r);
  // Award loyalty points for review
  const la=db.findOne('loyalty_accounts',{user_id:auth.sub});
  if(la){la.available_points+=50;la.total_points+=50;la.lifetime_points+=50;
    db.insert('loyalty_transactions',{txn_id:`ltx_${uid()}`,account_id:la.account_id,action:'EARN_REVIEW',points:50,balance_after:la.available_points,description:'Rating bonus',created_at:new Date().toISOString()});}
  console.log(`⭐ Rating for order ${body.order_id}: chef=${body.chef_score} delivery=${body.delivery_score}`);json(res,r,201);
});

// ── FAVORITES ──
route('POST','/v1/favorites/:mealId',async(req,res,{params,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  if(db.findOne('favorites',{user_id:auth.sub,meal_id:params.mealId}))return err(res,'Already favorited',409);
  const f={favorite_id:`fav_${uid()}`,user_id:auth.sub,meal_id:params.mealId,created_at:new Date().toISOString()};
  db.insert('favorites',f);json(res,f,201);
});

route('DELETE','/v1/favorites/:mealId',async(req,res,{params,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  db.delete('favorites',{user_id:auth.sub,meal_id:params.mealId});json(res,{removed:true});
});

route('GET','/v1/favorites',async(req,res,{auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const favs=db.find('favorites',{user_id:auth.sub}).map(f=>({...f,meal:db.findOne('meals',{meal_id:f.meal_id})}));
  json(res,{favorites:favs,total:favs.length});
});

// ── LOYALTY ──
route('GET','/v1/loyalty/account',async(req,res,{auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  let la=db.findOne('loyalty_accounts',{user_id:auth.sub});
  if(!la){la={account_id:`la_${uid()}`,user_id:auth.sub,tier:'BRONZE',total_points:0,available_points:0,lifetime_points:0};db.insert('loyalty_accounts',la);}
  json(res,la);
});

route('POST','/v1/loyalty/earn/order',async(req,res,{body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  let la=db.findOne('loyalty_accounts',{user_id:auth.sub});
  if(!la){la={account_id:`la_${uid()}`,user_id:auth.sub,tier:'BRONZE',total_points:0,available_points:0,lifetime_points:0};db.insert('loyalty_accounts',la);}
  const pts=Math.round((body.total_minor||28000)/100);
  la.available_points+=pts;la.total_points+=pts;la.lifetime_points+=pts;
  if(la.lifetime_points>=50000)la.tier='PLATINUM';else if(la.lifetime_points>=15000)la.tier='GOLD';else if(la.lifetime_points>=5000)la.tier='SILVER';
  db.insert('loyalty_transactions',{txn_id:`ltx_${uid()}`,account_id:la.account_id,action:'EARN_ORDER',points:pts,balance_after:la.available_points,reference_id:body.order_id,description:`Order ${body.order_id}`,created_at:new Date().toISOString()});
  json(res,{points_earned:pts,new_balance:la.available_points,tier:la.tier});
});

route('GET','/v1/loyalty/transactions',async(req,res,{auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const la=db.findOne('loyalty_accounts',{user_id:auth.sub});if(!la)return json(res,{transactions:[]});
  json(res,{transactions:db.find('loyalty_transactions',{account_id:la.account_id})});
});

// ── SUPPORT ──
route('POST','/v1/support/tickets',async(req,res,{body,auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  const t={ticket_id:`tkt_${uid()}`,order_id:body.order_id,created_by_id:auth.sub,category:body.category||'general',message:body.message,status:'OPEN',created_at:new Date().toISOString()};
  db.insert('support_tickets',t);json(res,t,201);
});

// ── ETA ──
route('POST','/v1/eta/predict',async(req,res,{body})=>{
  const eta=predictEta(body.distance_km||5,body.stop_count||2,body.task_type||'MEAL_RUN');
  json(res,{order_id:body.order_id,eta_minutes:eta.minutes,eta_range:{min:Math.max(5,eta.minutes-10),max:eta.minutes+15},confidence:eta.confidence});
});
function predictEta(dist,stops,type){const h=new Date().getHours();const rush=(h>=12&&h<=14)||(h>=18&&h<=21);let e=10+3.5*dist+8*Math.max(0,stops-1);if(rush)e+=12;if(type==='INGREDIENT_RUN')e*=1.2;return{minutes:Math.max(10,Math.round(e)),confidence:0.82};}

// ── ANALYTICS ──
route('GET','/v1/analytics/summary',async(req,res)=>{
  const orders=db.tables.orders;json(res,{total_orders:orders.length,delivered:orders.filter(o=>o.status==='DELIVERED').length,gmv_minor:orders.reduce((s,o)=>s+(o.pricing?.total?.amount_minor||0),0),active:orders.filter(o=>!['DELIVERED','CANCELLED'].includes(o.status)).length});
});

// ── EVENTS / OUTBOX ──
route('GET','/v1/events',async(req,res)=>{json(res,{events:db.tables.outbox_events.slice(-50).reverse(),total:db.tables.outbox_events.length});});

// ── USERS ──
route('GET','/v1/users/me',async(req,res,{auth})=>{
  if(!auth)return err(res,'Unauthorized',401);
  json(res,db.findOne('users',{user_id:auth.sub}));
});

// ── HEALTH ──
route('GET','/v1/health',async(req,res)=>{json(res,{status:'ok',version:'1.1.0',tables:Object.keys(db.tables).length,users:db.count('users'),meals:db.count('meals'),orders:db.count('orders')});});

// ── SERVER ──
const server = http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return res.end();}
  const body=await parseBody(req);const query=parseQuery(req.url);const auth=getAuth(req);
  const m=match(req.method,req.url);
  if(m)return m.handler(req,res,{body,query,params:m.params,auth});
  // Serve dashboard
  if(req.url==='/'||req.url==='/dashboard'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(getDashboardHtml());}
  err(res,`Not found: ${req.method} ${req.url}`,404);
});

server.listen(PORT,()=>{
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  🍽️  LAHLOBA TEST SERVER v1.1`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  API:       http://localhost:${PORT}/v1`);
  console.log(`  Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`  Health:    http://localhost:${PORT}/v1/health`);
  console.log(`  Swagger:   http://localhost:${PORT}/v1/health`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  Users: ${db.count('users')} | Meals: ${db.count('meals')} | Stores: ${db.count('store_profiles')}`);
  console.log(`  OTP bypass code: 000000`);
  console.log(`${'═'.repeat(50)}\n`);
});

function getDashboardHtml(){return require('./dashboard');}
module.exports={server,db};
