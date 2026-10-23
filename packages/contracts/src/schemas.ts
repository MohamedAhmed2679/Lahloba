import { z } from 'zod';

/**
 * API contracts for /v1. Public response schemas are the ONLY shapes the API serializes for
 * anonymous callers: zod object parsing strips unknown keys, so private columns (exact kitchen
 * address, evidence object keys, owner user IDs) cannot leak even if a query selects them.
 */
export const Uuid = z.string().uuid();
export const Piastres = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const LocaleSchema = z.enum(['en', 'ar']);
export const ServiceModeSchema = z.enum(['EAT_NOW', 'HEAT_AT_HOME', 'COOK_AT_HOME']);
export const FacetTypeSchema = z.enum(['CUISINE', 'DISH_TYPE', 'COURSE', 'SUPPLIER_CATEGORY', 'DIET', 'COLLECTION']);
export const UnitSchema = z.enum(['g', 'ml', 'count']);
export const WeightBasisSchema = z.enum(['RAW_EDIBLE', 'AS_PURCHASED', 'COOKED_NET']);
export const RoleSchema = z.enum(['CUSTOMER', 'CHEF_OWNER', 'CHEF_STAFF', 'SUPPLIER_OWNER', 'SUPPLIER_STAFF', 'COURIER', 'OPS_VERIFIER', 'OPS_ADMIN']);
export const ScopeTypeSchema = z.enum(['GLOBAL', 'CHEF', 'SUPPLIER_ORG', 'SUPPLIER_BRANCH', 'COURIER']);
export const ApprovalStateSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REVOKED']);
export const PartnerKindSchema = z.enum(['CHEF', 'SUPPLIER', 'COURIER']);
export const EquipmentSchema = z.enum(['INSULATED_BAG', 'COLD_BOX', 'BICYCLE', 'MOTORCYCLE', 'CAR']);
export const EvidenceTypeSchema = z.enum(['NATIONAL_ID', 'KITCHEN_PHOTO', 'FOOD_HANDLER_CERTIFICATE', 'COMMERCIAL_REGISTRATION', 'TAX_CARD', 'DRIVING_LICENSE', 'VEHICLE_LICENSE', 'OTHER']);
export const EvidenceContentTypeSchema = z.enum(['application/pdf', 'image/jpeg', 'image/png']);
/** Kept under the 4.5 MB request limit of serverless hosting. Photos are compressed on device. */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

const Bilingual = { en: z.string(), ar: z.string() };
export const LocalizedText = z.object(Bilingual);

// ---------- Public catalog ----------
export const Area = z.object({
  id: Uuid,
  slug: z.string(),
  label: LocalizedText,
  status: z.enum(['ACTIVE', 'COMING_SOON']),
  physicalOrderingEnabled: z.boolean(),
});
export type Area = z.infer<typeof Area>;
export const AreaList = z.object({ items: z.array(Area) });

export const Facet = z.object({
  id: Uuid,
  type: FacetTypeSchema,
  slug: z.string(),
  label: LocalizedText,
});
export type Facet = z.infer<typeof Facet>;
export const FacetList = z.object({ items: z.array(Facet) });

export const FacetCount = z.object({ facetId: Uuid, slug: z.string(), label: LocalizedText, count: z.number().int().nonnegative() });
export type FacetCount = z.infer<typeof FacetCount>;

export const OfferCard = z.object({
  offerId: Uuid,
  dishId: Uuid,
  title: LocalizedText,
  serviceMode: ServiceModeSchema,
  chef: z.object({ id: Uuid, publicName: z.string(), area: LocalizedText }),
  laborPerPersonPiastres: Piastres,
  leadTimeMinutes: z.number().int().positive(),
  minServings: z.number().int().positive(),
  cuisines: z.array(z.object({ slug: z.string(), label: LocalizedText })),
  illustrative: z.boolean(),
});
export type OfferCard = z.infer<typeof OfferCard>;

export const OfferSearchQuery = z.object({
  area: Uuid,
  mode: ServiceModeSchema,
  cuisine: z.array(z.string()).max(20).default([]),
  dishType: z.array(z.string()).max(20).default([]),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type OfferSearchQuery = z.infer<typeof OfferSearchQuery>;

export const OfferSearchResponse = z.object({
  serviceability: z.enum(['SERVICEABLE', 'UNSUPPORTED_AREA']),
  items: z.array(OfferCard),
  facetCounts: z.object({ cuisine: z.array(FacetCount), dishType: z.array(FacetCount) }),
  nextCursor: z.string().nullable(),
});
export type OfferSearchResponse = z.infer<typeof OfferSearchResponse>;

export const PublicChef = z.object({
  id: Uuid,
  publicName: z.string(),
  bio: LocalizedText,
  area: LocalizedText,
  acceptingOrders: z.boolean(),
  /** No real verification badges exist in Slice 1; listing approval is not a verification claim. */
  verifiedClaims: z.array(z.never()),
  illustrative: z.boolean(),
  offers: z.array(OfferCard),
});
export type PublicChef = z.infer<typeof PublicChef>;

export const IngredientLine = z.object({
  ingredientId: Uuid,
  name: LocalizedText,
  quantityPerServing: z.number().positive(),
  unit: UnitSchema,
  weightBasis: WeightBasisSchema,
  isPantry: z.boolean(),
  allowedOmission: z.boolean(),
  allergens: z.array(z.string()),
  allergenDataStatus: z.enum(['DECLARED', 'UNKNOWN']),
});
export type IngredientLine = z.infer<typeof IngredientLine>;

export const OfferDetail = z.object({
  offerId: Uuid,
  dishId: Uuid,
  title: LocalizedText,
  description: LocalizedText,
  serviceMode: ServiceModeSchema,
  chef: z.object({ id: Uuid, publicName: z.string(), area: LocalizedText, acceptingOrders: z.boolean() }),
  laborPerPersonPiastres: Piastres,
  packagingPiastres: Piastres,
  chefIngredientsOffered: z.boolean(),
  supplierSourcingAllowed: z.boolean(),
  leadTimeMinutes: z.number().int().positive(),
  servingRules: z.object({ minServings: z.number().int(), maxServings: z.number().int(), servingStep: z.number().int() }),
  portion: z.object({ grams: z.number().int().positive(), basis: WeightBasisSchema }).nullable(),
  safetyInstructions: LocalizedText,
  recipeVersion: z.number().int().positive(),
  ingredients: z.array(IngredientLine),
  siblingVariants: z.array(z.object({ offerId: Uuid, serviceMode: ServiceModeSchema })),
  cuisines: z.array(z.object({ slug: z.string(), label: LocalizedText })),
  illustrative: z.boolean(),
  /** H04: whether the kitchen has capacity in the booking window. Never a guarantee of timing. */
  availability: z.enum(['AVAILABLE', 'FULLY_BOOKED', 'KITCHEN_CLOSED']),
  slots: z.array(z.object({ slotId: Uuid, startsAt: z.string(), endsAt: z.string(), maxServings: z.number().int() })),
});
export type OfferDetail = z.infer<typeof OfferDetail>;

export const GroceryCategory = z.object({ facetId: Uuid, slug: z.string(), label: LocalizedText, productCount: z.number().int().nonnegative() });
export const GroceryCategoryList = z.object({ serviceability: z.enum(['SERVICEABLE', 'UNSUPPORTED_AREA']), items: z.array(GroceryCategory) });
export type GroceryCategoryList = z.infer<typeof GroceryCategoryList>;

export const GroceryProduct = z.object({
  productId: Uuid,
  ingredient: LocalizedText,
  brand: z.string().nullable(),
  packQuantity: z.number().positive(),
  packUnit: UnitSchema,
  pricePiastres: Piastres,
  variableWeight: z.boolean(),
  shop: z.object({ branchId: Uuid, publicName: z.string() }),
  illustrative: z.boolean(),
});
export type GroceryProduct = z.infer<typeof GroceryProduct>;
export const GroceryProductList = z.object({ serviceability: z.enum(['SERVICEABLE', 'UNSUPPORTED_AREA']), items: z.array(GroceryProduct) });
export type GroceryProductList = z.infer<typeof GroceryProductList>;

export const RecipeSummary = z.object({ recipeId: Uuid, title: LocalizedText, chefName: z.string(), illustrative: z.boolean() });
export const RecipeList = z.object({ items: z.array(RecipeSummary) });
export type RecipeList = z.infer<typeof RecipeList>;
export const RecipeDetail = z.object({
  recipeId: Uuid,
  title: LocalizedText,
  chefName: z.string(),
  version: z.number().int().positive(),
  steps: z.array(LocalizedText),
  equipment: z.array(LocalizedText),
  ingredients: z.array(IngredientLine),
  illustrative: z.boolean(),
});
export type RecipeDetail = z.infer<typeof RecipeDetail>;

// ---------- Identity / roles ----------
export const MembershipDto = z.object({
  id: Uuid, role: RoleSchema, scopeType: ScopeTypeSchema, scopeId: Uuid.nullable(), approvalState: ApprovalStateSchema,
});
export const Me = z.object({
  userId: Uuid,
  displayName: z.string().nullable(),
  locale: LocaleSchema,
  memberships: z.array(MembershipDto),
});
export type Me = z.infer<typeof Me>;
export const UpdateMeRequest = z.object({ locale: LocaleSchema.optional(), displayName: z.string().trim().min(1).max(80).optional() }).strict();

// ---------- Partner applications ----------
const ManualAddress = z.object({ addressText: z.string().trim().min(5).max(500), areaId: Uuid }).strict();

export const CreatePartnerApplication = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CHEF'),
    chef: z.object({
      publicName: z.string().trim().min(2).max(80),
      publicAreaId: Uuid,
      serviceAreaIds: z.array(Uuid).min(1).max(20),
      kitchenAddress: ManualAddress,
    }).strict(),
  }).strict(),
  z.object({
    kind: z.literal('SUPPLIER'),
    supplier: z.object({
      organizationName: z.string().trim().min(2).max(120),
      branch: z.object({
        publicName: z.string().trim().min(2).max(120),
        areaId: Uuid,
        serviceAreaIds: z.array(Uuid).min(1).max(20),
        address: ManualAddress,
      }).strict(),
    }).strict(),
  }).strict(),
  z.object({
    kind: z.literal('COURIER'),
    courier: z.object({
      displayName: z.string().trim().min(2).max(80),
      equipment: z.array(EquipmentSchema).min(1).max(5),
    }).strict(),
  }).strict(),
]);
export type CreatePartnerApplication = z.infer<typeof CreatePartnerApplication>;

export const PartnerApplicationDto = z.object({
  id: Uuid,
  kind: PartnerKindSchema,
  subjectId: Uuid,
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN']),
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  decisionReason: z.string().nullable(),
  permittedNextStep: z.string().nullable(),
  version: z.number().int().positive(),
  evidenceCount: z.number().int().nonnegative(),
});
export type PartnerApplicationDto = z.infer<typeof PartnerApplicationDto>;
export const PartnerApplicationList = z.object({ items: z.array(PartnerApplicationDto) });

export const RegisterEvidenceRequest = z.object({
  evidenceType: EvidenceTypeSchema,
  contentType: EvidenceContentTypeSchema,
  byteSize: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();
export const EvidenceRegistered = z.object({
  evidenceId: Uuid,
  /** PENDING_UPLOAD: send the file bytes with PUT to uploadPath. Other states accept no file. */
  upload: z.object({ status: z.enum(['STORAGE_DISABLED', 'DEV_METADATA_ONLY', 'PENDING_UPLOAD']), uploadPath: z.string().nullable() }),
});
export const EvidenceUploaded = z.object({ evidenceId: Uuid, fileState: z.literal('UPLOADED'), byteSize: z.number().int(), scanState: z.enum(['NOT_SCANNED', 'CLEAN', 'INFECTED']) });
export const EvidenceLink = z.object({ url: z.string(), expiresAt: z.string() });

/** Ops view: evidence metadata only. Object keys and files are never returned. */
export const EvidenceMetadata = z.object({
  evidenceId: Uuid, evidenceType: EvidenceTypeSchema, contentType: z.string(), byteSize: z.number().int(),
  expiresOn: z.string().nullable(), reviewState: z.enum(['PENDING_REVIEW', 'ACCEPTED', 'REJECTED']), createdAt: z.string(),
  fileState: z.enum(['STORAGE_DISABLED', 'DEV_METADATA_ONLY', 'PENDING_UPLOAD', 'UPLOADED', 'REJECTED_FILE']),
  scanState: z.enum(['NOT_SCANNED', 'CLEAN', 'INFECTED']),
});
export const OpsApplicationDetail = PartnerApplicationDto.extend({
  applicant: z.object({ userId: Uuid, displayName: z.string().nullable() }),
  subjectSummary: z.object({ publicName: z.string(), area: LocalizedText.nullable(), equipment: z.array(EquipmentSchema) }),
  evidence: z.array(EvidenceMetadata),
});
export type OpsApplicationDetail = z.infer<typeof OpsApplicationDetail>;

export const ApplicationDecisionRequest = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE'), reason: z.string().trim().min(3).max(500), expectedVersion: z.number().int().positive() }).strict(),
  z.object({
    decision: z.literal('REJECT'), reason: z.string().trim().min(3).max(500),
    permittedNextStep: z.string().trim().min(3).max(500), expectedVersion: z.number().int().positive(),
  }).strict(),
]);
export type ApplicationDecisionRequest = z.infer<typeof ApplicationDecisionRequest>;

// ---------- Chef menu ----------
export const CreateDishRequest = z.object({
  titleEn: z.string().trim().min(2).max(120),
  titleAr: z.string().trim().min(2).max(120),
  descriptionEn: z.string().trim().max(2000).default(''),
  descriptionAr: z.string().trim().max(2000).default(''),
  facetIds: z.array(Uuid).max(20).default([]),
}).strict();
export type CreateDishRequest = z.infer<typeof CreateDishRequest>;

export const CreateRecipeVersionRequest = z.object({
  steps: z.array(z.object({ en: z.string().trim().min(1).max(2000), ar: z.string().trim().min(1).max(2000) }).strict()).min(1).max(60),
  equipment: z.array(z.object({ en: z.string().trim().min(1).max(200), ar: z.string().trim().min(1).max(200) }).strict()).max(30).default([]),
  isPublicRecipe: z.boolean().default(false),
  requirements: z.array(z.object({
    ingredientId: Uuid,
    quantityPerServing: z.number().int().positive().max(100_000),
    unit: UnitSchema,
    weightBasis: WeightBasisSchema,
    isPantry: z.boolean().default(false),
    allowedOmission: z.boolean().default(false),
  }).strict()).min(1).max(80),
}).strict();
export type CreateRecipeVersionRequest = z.infer<typeof CreateRecipeVersionRequest>;

export const CreateVariantRequest = z.object({
  serviceMode: ServiceModeSchema,
  recipeVersionId: Uuid,
  laborPerPersonPiastres: Piastres.max(10_000_000),
  packagingPiastres: Piastres.max(10_000_000),
  chefIngredientsPerServingPiastres: Piastres.max(10_000_000).nullable(),
  supplierSourcingAllowed: z.boolean(),
  leadTimeMinutes: z.number().int().min(1).max(60 * 24 * 14),
  minServings: z.number().int().min(1).max(500),
  maxServings: z.number().int().min(1).max(500),
  servingStep: z.number().int().min(1).max(100),
  portionWeightGrams: z.number().int().positive().max(100_000).nullable(),
  portionWeightBasis: WeightBasisSchema.nullable(),
  safetyInstructionsEn: z.string().trim().min(1).max(2000),
  safetyInstructionsAr: z.string().trim().min(1).max(2000),
}).strict()
  .refine((v) => v.maxServings >= v.minServings, { message: 'maxServings must be >= minServings', path: ['maxServings'] })
  .refine((v) => v.chefIngredientsPerServingPiastres !== null || v.supplierSourcingAllowed, { message: 'At least one sourcing strategy is required', path: ['supplierSourcingAllowed'] })
  .refine((v) => (v.portionWeightGrams === null) === (v.portionWeightBasis === null), { message: 'Portion weight and basis go together', path: ['portionWeightBasis'] });
export type CreateVariantRequest = z.infer<typeof CreateVariantRequest>;

export const UpdateVariantPricingRequest = z.object({
  laborPerPersonPiastres: Piastres.max(10_000_000),
  packagingPiastres: Piastres.max(10_000_000),
  chefIngredientsPerServingPiastres: Piastres.max(10_000_000).nullable(),
  expectedVersion: z.number().int().positive(),
}).strict();

export const ExpectedVersion = z.object({ expectedVersion: z.number().int().positive() }).strict();

export const ChefDishDto = z.object({
  id: Uuid, title: LocalizedText, publicationState: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'SUSPENDED']), version: z.number().int(),
  variants: z.array(z.object({ id: Uuid, serviceMode: ServiceModeSchema, laborPerPersonPiastres: Piastres, priceVersion: z.number().int(), version: z.number().int(), status: z.enum(['ACTIVE', 'INACTIVE']) })),
  recipeVersions: z.array(z.object({ id: Uuid, version: z.number().int(), published: z.boolean() })),
});
export type ChefDishDto = z.infer<typeof ChefDishDto>;
export const ChefDishList = z.object({ items: z.array(ChefDishDto) });

export const IngredientDto = z.object({ id: Uuid, slug: z.string(), name: LocalizedText, unit: UnitSchema, allergens: z.array(z.string()), allergenDataStatus: z.enum(['DECLARED', 'UNKNOWN']) });
export const IngredientList = z.object({ items: z.array(IngredientDto) });

// ---------- Supplier products ----------
export const CreateProductRequest = z.object({
  ingredientId: Uuid,
  sku: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/),
  packQuantity: z.number().int().positive().max(1_000_000),
  packUnit: UnitSchema,
  pricePiastres: Piastres.max(100_000_000),
  variableWeight: z.boolean(),
  brand: z.string().trim().max(120).nullable(),
  categoryFacetId: Uuid,
  availablePacks: z.number().int().nonnegative().max(1_000_000),
  minimumOrderPacks: z.number().int().positive().max(1000).default(1),
}).strict();
export type CreateProductRequest = z.infer<typeof CreateProductRequest>;

export const SupplierProductDto = z.object({
  id: Uuid, sku: z.string(), ingredient: LocalizedText, packQuantity: z.number(), packUnit: UnitSchema,
  pricePiastres: Piastres, priceVersion: z.number().int(), variableWeight: z.boolean(), availablePacks: z.number(), status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const SupplierProductList = z.object({ items: z.array(SupplierProductDto) });
export const SupplierBranchList = z.object({
  items: z.array(z.object({ id: Uuid, publicName: z.string(), status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']), isOpen: z.boolean(), organizationId: Uuid })),
});

export const DevTokenRequest = z.object({ subject: z.string().trim().regex(/^[a-z0-9._-]{3,64}$/), displayName: z.string().trim().min(1).max(80).optional() }).strict();
export const DevTokenResponse = z.object({ token: z.string(), expiresInSeconds: z.number().int(), warning: z.string() });

// ---------- Kitchen capacity (H04) ----------
export const CreateCapacitySlotRequest = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  totalWorkUnits: z.number().int().min(1).max(10000),
}).strict();
export const CapacitySlotDto = z.object({
  id: Uuid, startsAt: z.string(), endsAt: z.string(), totalWorkUnits: z.number().int(), reservedWorkUnits: z.number().int(),
  status: z.enum(['ACTIVE', 'CANCELLED']), version: z.number().int(),
});
export const CapacitySlotList = z.object({ items: z.array(CapacitySlotDto) });
