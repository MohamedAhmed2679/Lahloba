// In-memory database for Lahloba test environment
// Mirrors PostgreSQL schema with full seed data

const crypto = require('crypto');
const uid = () => crypto.randomUUID().slice(0, 8);

class Database {
  constructor() {
    this.tables = {};
    this.seed();
  }

  seed() {
    // ── Zones & Fee Rules ──
    this.tables.zones = [
      { zone_id: 'zone_giza', name_en: 'Giza', name_ar: 'الجيزة', base_delivery_fee_minor: 2500, per_km_fee_minor: 500, per_stop_fee_minor: 300, is_active: true },
    ];
    this.tables.fee_rules = [
      { rule_id: 'fee_giza_v1', zone_id: 'zone_giza', platform_fee_pct: 5.00, threshold_minor: 100000, above_threshold_pct: 6.00, promo_active: true },
    ];

    // ── Users ──
    this.tables.users = [
      { user_id: 'usr_cust_001', role: 'CUSTOMER', phone: '+201000000001', email: 'customer@test.lahloba.com', name: 'Ahmed Hassan', locale: 'ar', rating_avg: 0, is_active: true, push_token: null, created_at: new Date().toISOString() },
      { user_id: 'usr_chef_001', role: 'CHEF', phone: '+201000000002', email: 'chef@test.lahloba.com', name: 'Fatma Ali', locale: 'ar', rating_avg: 4.8, is_active: true, push_token: null, created_at: new Date().toISOString() },
      { user_id: 'usr_store_001', role: 'STORE', phone: '+201000000003', email: 'store@test.lahloba.com', name: 'Metro Market', locale: 'en', rating_avg: 0, is_active: true, push_token: null, created_at: new Date().toISOString() },
      { user_id: 'usr_store_002', role: 'STORE', phone: '+201000000004', email: 'store2@test.lahloba.com', name: 'Fresh Corner', locale: 'ar', rating_avg: 0, is_active: true, push_token: null, created_at: new Date().toISOString() },
      { user_id: 'usr_driver_001', role: 'DELIVERY', phone: '+201000000005', email: 'driver@test.lahloba.com', name: 'Omar Mahmoud', locale: 'ar', rating_avg: 4.6, is_active: true, push_token: null, created_at: new Date().toISOString() },
      { user_id: 'usr_admin_001', role: 'ADMIN', phone: '+201000000006', email: 'admin@test.lahloba.com', name: 'Admin User', locale: 'en', rating_avg: 0, is_active: true, push_token: null, created_at: new Date().toISOString() },
    ];

    // ── Addresses ──
    this.tables.addresses = [
      { address_id: 'addr_001', user_id: 'usr_cust_001', label: 'Home', line1: '15 Tahrir St', city: 'Giza', region: 'Giza', lat: 30.0131, lng: 31.2089, is_default: true },
      { address_id: 'addr_002', user_id: 'usr_chef_001', label: 'Kitchen', line1: '42 Pyramid Rd', city: 'Giza', region: 'Giza', lat: 30.005, lng: 31.212, is_default: true },
      { address_id: 'addr_003', user_id: 'usr_store_001', label: 'Store', line1: '8 Dokki St', city: 'Giza', region: 'Giza', lat: 30.038, lng: 31.201, is_default: true },
      { address_id: 'addr_004', user_id: 'usr_store_002', label: 'Store', line1: '22 Mohandessin', city: 'Giza', region: 'Giza', lat: 30.056, lng: 31.199, is_default: true },
    ];

    // ── Chef & Store Profiles ──
    this.tables.chef_profiles = [
      { chef_id: 'usr_chef_001', bio: 'Authentic Egyptian home cooking with love', hygiene_score: 4.80, max_concurrent: 5, is_available: true, zone_id: 'zone_giza' },
    ];
    this.tables.store_profiles = [
      { store_id: 'usr_store_001', name_en: 'Metro Market', name_ar: 'ميترو ماركت', address_id: 'addr_003', zone_id: 'zone_giza', acceptance_rate: 100, avg_pack_min: 15 },
      { store_id: 'usr_store_002', name_en: 'Fresh Corner', name_ar: 'الركن الطازج', address_id: 'addr_004', zone_id: 'zone_giza', acceptance_rate: 100, avg_pack_min: 12 },
    ];

    // ── Ingredients ──
    this.tables.ingredients = [
      { ingredient_id: 'ing_rice', name_en: 'Egyptian Rice', name_ar: 'أرز مصري', unit: 'kg', category: 'grains' },
      { ingredient_id: 'ing_chicken', name_en: 'Chicken Breast', name_ar: 'صدور دجاج', unit: 'kg', category: 'protein' },
      { ingredient_id: 'ing_onion', name_en: 'Yellow Onion', name_ar: 'بصل أصفر', unit: 'kg', category: 'vegetables' },
      { ingredient_id: 'ing_tomato', name_en: 'Tomatoes', name_ar: 'طماطم', unit: 'kg', category: 'vegetables' },
      { ingredient_id: 'ing_oil', name_en: 'Sunflower Oil', name_ar: 'زيت عباد الشمس', unit: 'liter', category: 'oils' },
      { ingredient_id: 'ing_pasta', name_en: 'Penne Pasta', name_ar: 'مكرونة بيني', unit: 'kg', category: 'grains' },
      { ingredient_id: 'ing_cream', name_en: 'Cooking Cream', name_ar: 'كريمة طبخ', unit: 'ml', category: 'dairy' },
      { ingredient_id: 'ing_mushroom', name_en: 'Mushrooms', name_ar: 'مشروم', unit: 'kg', category: 'vegetables' },
    ];

    // ── Meals ──
    this.tables.meals = [
      { meal_id: 'meal_001', chef_id: 'usr_chef_001', name_en: 'Egyptian Chicken Rice', name_ar: 'فتة بالأرز والدجاج', description_en: 'Traditional rice with grilled chicken and homemade sauce', description_ar: 'أرز مصري مع دجاج مشوي وصوص بلدي', type: 'COOKED', base_price_minor: 15000, prep_time_min: 45, allergens: [], image_url: null, is_active: true, rating_avg: 4.8, order_count: 120 },
      { meal_id: 'meal_002', chef_id: 'usr_chef_001', name_en: 'Pasta Alfredo', name_ar: 'باستا ألفريدو', description_en: 'Creamy penne with mushrooms', description_ar: 'باستا كريمية بالمشروم', type: 'COOKED', base_price_minor: 12000, prep_time_min: 30, allergens: ['dairy'], image_url: null, is_active: true, rating_avg: 4.5, order_count: 80 },
      { meal_id: 'meal_003', chef_id: 'usr_chef_001', name_en: 'Ready-to-Cook Kofta Kit', name_ar: 'كيت كفتة جاهز للطبخ', description_en: 'Seasoned kofta mix ready to grill', description_ar: 'كفتة متبلة جاهزة للشوي', type: 'READY_TO_COOK', base_price_minor: 10000, prep_time_min: 15, allergens: [], image_url: null, is_active: true, rating_avg: 4.6, order_count: 45 },
    ];

    // ── Meal Ingredients ──
    this.tables.meal_ingredients = [
      { meal_id: 'meal_001', ingredient_id: 'ing_rice', qty: 0.5, unit: 'kg' },
      { meal_id: 'meal_001', ingredient_id: 'ing_chicken', qty: 0.5, unit: 'kg' },
      { meal_id: 'meal_001', ingredient_id: 'ing_onion', qty: 0.2, unit: 'kg' },
      { meal_id: 'meal_001', ingredient_id: 'ing_tomato', qty: 0.3, unit: 'kg' },
      { meal_id: 'meal_001', ingredient_id: 'ing_oil', qty: 0.05, unit: 'liter' },
      { meal_id: 'meal_002', ingredient_id: 'ing_pasta', qty: 0.4, unit: 'kg' },
      { meal_id: 'meal_002', ingredient_id: 'ing_cream', qty: 200, unit: 'ml' },
      { meal_id: 'meal_002', ingredient_id: 'ing_mushroom', qty: 0.2, unit: 'kg' },
    ];

    // ── Store Products ──
    this.tables.store_products = [
      { product_id: 'prod_001', store_id: 'usr_store_001', name_en: 'Egyptian Rice 1kg', name_ar: 'أرز مصري', price_minor: 4500, unit: 'kg', in_stock: true },
      { product_id: 'prod_002', store_id: 'usr_store_001', name_en: 'Chicken Breast 1kg', name_ar: 'صدور دجاج', price_minor: 18000, unit: 'kg', in_stock: true },
      { product_id: 'prod_003', store_id: 'usr_store_001', name_en: 'Yellow Onion 1kg', name_ar: 'بصل أصفر', price_minor: 1500, unit: 'kg', in_stock: true },
      { product_id: 'prod_004', store_id: 'usr_store_001', name_en: 'Tomatoes 1kg', name_ar: 'طماطم', price_minor: 2000, unit: 'kg', in_stock: true },
      { product_id: 'prod_005', store_id: 'usr_store_002', name_en: 'Egyptian Rice 1kg', name_ar: 'أرز مصري', price_minor: 4200, unit: 'kg', in_stock: true },
      { product_id: 'prod_006', store_id: 'usr_store_002', name_en: 'Chicken Breast 1kg', name_ar: 'صدور دجاج', price_minor: 19000, unit: 'kg', in_stock: true },
      { product_id: 'prod_007', store_id: 'usr_store_001', name_en: 'Sunflower Oil 1L', name_ar: 'زيت عباد شمس', price_minor: 7500, unit: 'liter', in_stock: true },
      { product_id: 'prod_008', store_id: 'usr_store_001', name_en: 'Penne Pasta 500g', name_ar: 'مكرونة بيني', price_minor: 3000, unit: 'kg', in_stock: true },
    ];

    // ── Product-Ingredient Mapping ──
    this.tables.product_ingredient_map = [
      { product_id: 'prod_001', ingredient_id: 'ing_rice' },
      { product_id: 'prod_002', ingredient_id: 'ing_chicken' },
      { product_id: 'prod_003', ingredient_id: 'ing_onion' },
      { product_id: 'prod_004', ingredient_id: 'ing_tomato' },
      { product_id: 'prod_005', ingredient_id: 'ing_rice' },
      { product_id: 'prod_006', ingredient_id: 'ing_chicken' },
      { product_id: 'prod_007', ingredient_id: 'ing_oil' },
      { product_id: 'prod_008', ingredient_id: 'ing_pasta' },
    ];

    // ── Dynamic tables ──
    this.tables.orders = [];
    this.tables.store_fulfillments = [];
    this.tables.delivery_tasks = [];
    this.tables.delivery_stops = [];
    this.tables.payments = [];
    this.tables.chat_rooms = [];
    this.tables.chat_messages = [];
    this.tables.ratings = [];
    this.tables.support_tickets = [];
    this.tables.favorites = [];
    this.tables.loyalty_accounts = [];
    this.tables.loyalty_transactions = [];
    this.tables.outbox_events = [];
    this.tables.otp_store = {};
  }

  // Query helpers
  find(table, filter = {}) {
    let rows = this.tables[table] || [];
    for (const [key, val] of Object.entries(filter)) {
      rows = rows.filter(r => r[key] === val);
    }
    return rows;
  }

  findOne(table, filter) {
    return this.find(table, filter)[0] || null;
  }

  insert(table, row) {
    if (!this.tables[table]) this.tables[table] = [];
    this.tables[table].push(row);
    return row;
  }

  update(table, filter, updates) {
    const rows = this.find(table, filter);
    rows.forEach(row => Object.assign(row, updates));
    return rows.length;
  }

  delete(table, filter) {
    const before = (this.tables[table] || []).length;
    this.tables[table] = (this.tables[table] || []).filter(row => {
      return !Object.entries(filter).every(([k, v]) => row[k] === v);
    });
    return before - this.tables[table].length;
  }

  count(table, filter = {}) {
    return this.find(table, filter).length;
  }
}

module.exports = { Database, uid };
