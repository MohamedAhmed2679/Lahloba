import { normalizeFacetLabel, type FacetType } from '@lahloba/domain';
import type { DbClient } from '../db';

/**
 * Reference taxonomy derived from the product spec (doc 01 §1.5). Pet Shop and Supplements are
 * intentionally excluded from the initial food scope. Labels need copy review before launch.
 */
type FacetSeed = { type: FacetType; slug: string; en: string; ar: string; aliases?: string[] };

export const FACETS: FacetSeed[] = [
  { type: 'CUISINE', slug: 'egyptian', en: 'Egyptian', ar: 'مصري', aliases: ['Egyptian food', 'أكل مصري'] },
  { type: 'CUISINE', slug: 'italian', en: 'Italian', ar: 'إيطالي' },
  { type: 'CUISINE', slug: 'chinese', en: 'Chinese', ar: 'صيني' },
  { type: 'CUISINE', slug: 'japanese', en: 'Japanese', ar: 'ياباني' },
  { type: 'CUISINE', slug: 'mexican', en: 'Mexican', ar: 'مكسيكي' },
  { type: 'CUISINE', slug: 'indian', en: 'Indian', ar: 'هندي' },
  { type: 'CUISINE', slug: 'levantine', en: 'Levantine', ar: 'شامي', aliases: ['Syrian', 'Lebanese'] },
  { type: 'CUISINE', slug: 'american', en: 'American', ar: 'أمريكي' },
  { type: 'COLLECTION', slug: 'arabic', en: 'Arabic', ar: 'عربي' },
  { type: 'COLLECTION', slug: 'asian', en: 'Asian', ar: 'آسيوي' },
  { type: 'COLLECTION', slug: 'international', en: 'International', ar: 'عالمي' },
  { type: 'DISH_TYPE', slug: 'grills', en: 'Grills', ar: 'مشويات', aliases: ['grills', 'Grills', 'grill'] },
  { type: 'DISH_TYPE', slug: 'sandwiches', en: 'Sandwiches', ar: 'سندوتشات' },
  { type: 'DISH_TYPE', slug: 'burgers', en: 'Burgers', ar: 'برجر' },
  { type: 'DISH_TYPE', slug: 'pizza', en: 'Pizza', ar: 'بيتزا' },
  { type: 'DISH_TYPE', slug: 'pasta', en: 'Pasta', ar: 'مكرونة', aliases: ['macaroni', 'مكرونه'] },
  { type: 'DISH_TYPE', slug: 'soup', en: 'Soup', ar: 'شوربة' },
  { type: 'DISH_TYPE', slug: 'salad', en: 'Salad', ar: 'سلطة' },
  { type: 'DISH_TYPE', slug: 'pies', en: 'Pies', ar: 'فطائر', aliases: ['Feteer', 'فطير'] },
  { type: 'DISH_TYPE', slug: 'kebab', en: 'Kebab', ar: 'كباب' },
  { type: 'DISH_TYPE', slug: 'shawarma', en: 'Shawarma', ar: 'شاورما' },
  { type: 'DISH_TYPE', slug: 'mandi', en: 'Mandi', ar: 'مندي' },
  { type: 'DISH_TYPE', slug: 'noodles', en: 'Noodles', ar: 'نودلز' },
  { type: 'DISH_TYPE', slug: 'crepes', en: 'Crepes', ar: 'كريب' },
  { type: 'DISH_TYPE', slug: 'pancakes', en: 'Pancakes', ar: 'بان كيك' },
  { type: 'DISH_TYPE', slug: 'waffles', en: 'Waffles', ar: 'وافل' },
  { type: 'DISH_TYPE', slug: 'seafood', en: 'Seafood', ar: 'مأكولات بحرية', aliases: ['Sea food', 'أسماك'] },
  { type: 'DISH_TYPE', slug: 'stews', en: 'Stews', ar: 'طواجن وطبيخ' },
  { type: 'COURSE', slug: 'breakfast', en: 'Breakfast', ar: 'فطار' },
  { type: 'COURSE', slug: 'main-course', en: 'Main course', ar: 'طبق رئيسي' },
  { type: 'COURSE', slug: 'sides', en: 'Sides', ar: 'أطباق جانبية' },
  { type: 'COURSE', slug: 'desserts', en: 'Desserts', ar: 'حلويات' },
  { type: 'COURSE', slug: 'beverages', en: 'Beverages', ar: 'مشروبات' },
  { type: 'SUPPLIER_CATEGORY', slug: 'grocery', en: 'Grocery', ar: 'بقالة', aliases: ['grocery', 'Grocery', 'Groceries'] },
  { type: 'SUPPLIER_CATEGORY', slug: 'butcher', en: 'Butcher', ar: 'جزارة', aliases: ['Meat', 'Poultry', 'دواجن'] },
  { type: 'SUPPLIER_CATEGORY', slug: 'produce', en: 'Produce', ar: 'خضار وفاكهة', aliases: ['Vegetables', 'Fruits'] },
  { type: 'SUPPLIER_CATEGORY', slug: 'bakery', en: 'Bakery', ar: 'مخبوزات', aliases: ['Bakery & Pastry', 'Bakeries', 'Pastry', 'مخبز'] },
  { type: 'SUPPLIER_CATEGORY', slug: 'dairy', en: 'Dairy', ar: 'ألبان' },
  { type: 'SUPPLIER_CATEGORY', slug: 'pantry', en: 'Pantry', ar: 'مواد تموينية' },
  { type: 'SUPPLIER_CATEGORY', slug: 'beverages', en: 'Beverages', ar: 'مشروبات' },
  { type: 'DIET', slug: 'vegetarian', en: 'Vegetarian (declared by chef)', ar: 'نباتي (حسب إقرار الطاهي)' },
];

export const COLLECTIONS: Record<string, string[]> = {
  arabic: ['egyptian', 'levantine'],
  asian: ['chinese', 'japanese', 'indian'],
  international: ['italian', 'mexican', 'american'],
};

type IngredientSeed = { slug: string; en: string; ar: string; unit: 'g' | 'ml' | 'count'; allergens?: string[]; status: 'DECLARED' | 'UNKNOWN' };

/** Allergen declarations here are illustrative reference data and must be reviewed per product. */
export const INGREDIENTS: IngredientSeed[] = [
  { slug: 'chicken-raw', en: 'Chicken (raw, bone-in)', ar: 'دجاج (نيء بالعظم)', unit: 'g', status: 'DECLARED' },
  { slug: 'molokhia-leaves', en: 'Molokhia leaves (chopped, frozen)', ar: 'ملوخية مفرومة مجمدة', unit: 'g', status: 'DECLARED' },
  { slug: 'garlic', en: 'Garlic', ar: 'ثوم', unit: 'g', status: 'DECLARED' },
  { slug: 'ghee', en: 'Ghee', ar: 'سمن', unit: 'g', allergens: ['milk'], status: 'DECLARED' },
  { slug: 'rice-egyptian', en: 'Egyptian rice', ar: 'أرز مصري', unit: 'g', status: 'DECLARED' },
  { slug: 'lentils-brown', en: 'Brown lentils', ar: 'عدس بجبة', unit: 'g', status: 'DECLARED' },
  { slug: 'lentils-red', en: 'Red lentils', ar: 'عدس أصفر', unit: 'g', status: 'DECLARED' },
  { slug: 'macaroni', en: 'Macaroni (wheat)', ar: 'مكرونة (قمح)', unit: 'g', allergens: ['gluten'], status: 'DECLARED' },
  { slug: 'tomato', en: 'Tomatoes', ar: 'طماطم', unit: 'g', status: 'DECLARED' },
  { slug: 'onion', en: 'Onions', ar: 'بصل', unit: 'g', status: 'DECLARED' },
  { slug: 'vegetable-oil', en: 'Vegetable oil', ar: 'زيت نباتي', unit: 'ml', status: 'UNKNOWN' },
  { slug: 'salt', en: 'Salt', ar: 'ملح', unit: 'g', status: 'DECLARED' },
  { slug: 'eggs', en: 'Eggs', ar: 'بيض', unit: 'count', allergens: ['egg'], status: 'DECLARED' },
  { slug: 'tahini', en: 'Tahini', ar: 'طحينة', unit: 'g', allergens: ['sesame'], status: 'DECLARED' },
  { slug: 'yogurt', en: 'Plain yogurt', ar: 'زبادي', unit: 'g', allergens: ['milk'], status: 'DECLARED' },
  { slug: 'baladi-bread', en: 'Baladi bread', ar: 'عيش بلدي', unit: 'count', allergens: ['gluten'], status: 'DECLARED' },
  { slug: 'spice-mix', en: 'House spice mix', ar: 'خلطة بهارات', unit: 'g', status: 'UNKNOWN' },
];

export interface AreaSeed { slug: string; en: string; ar: string; status: 'ACTIVE' | 'COMING_SOON'; physical: boolean }
export const AREAS: AreaSeed[] = [
  { slug: 'maadi', en: 'Maadi', ar: 'المعادي', status: 'ACTIVE', physical: true },
  { slug: 'nasr-city', en: 'Nasr City', ar: 'مدينة نصر', status: 'ACTIVE', physical: true },
  { slug: 'heliopolis', en: 'Heliopolis', ar: 'مصر الجديدة', status: 'ACTIVE', physical: true },
  { slug: 'zamalek', en: 'Zamalek', ar: 'الزمالك', status: 'COMING_SOON', physical: false },
  { slug: 'sixth-of-october', en: '6th of October', ar: '٦ أكتوبر', status: 'COMING_SOON', physical: false },
];

export type Ids = Record<string, string>;

/** Inserts reference taxonomy. Returns slug->id maps. Safe to run once on an empty catalog. */
export async function seedReference(db: DbClient, areas: AreaSeed[] = AREAS) {
  const facet: Ids = {};
  const area: Ids = {};
  const ingredient: Ids = {};
  let order = 0;
  for (const a of areas) {
    const r = await db.query(
      `INSERT INTO service_areas (slug, label_en, label_ar, status, physical_ordering_enabled, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [a.slug, a.en, a.ar, a.status, a.physical, order++],
    );
    area[a.slug] = r.rows[0].id;
  }
  order = 0;
  for (const f of FACETS) {
    const r = await db.query(`INSERT INTO facets (facet_type, slug, label_en, label_ar, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [f.type, f.slug, f.en, f.ar, order++]);
    facet[`${f.type}:${f.slug}`] = r.rows[0].id;
    const aliases = new Set([f.en, f.ar, f.slug, ...(f.aliases ?? [])].map(normalizeFacetLabel));
    for (const alias of aliases) {
      await db.query(`INSERT INTO facet_aliases (facet_id, facet_type, alias_normalized) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [r.rows[0].id, f.type, alias]);
    }
  }
  for (const [col, members] of Object.entries(COLLECTIONS)) {
    for (const m of members) {
      await db.query(`INSERT INTO collection_members (collection_id, cuisine_id) VALUES ($1, $2)`, [facet[`COLLECTION:${col}`], facet[`CUISINE:${m}`]]);
    }
  }
  for (const i of INGREDIENTS) {
    const r = await db.query(
      `INSERT INTO ingredients (slug, name_en, name_ar, canonical_unit, allergens, allergen_data_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [i.slug, i.en, i.ar, i.unit, i.allergens ?? [], i.status],
    );
    ingredient[i.slug] = r.rows[0].id;
  }
  return { facet, area, ingredient };
}
