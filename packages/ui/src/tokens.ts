/**
 * Lahloba brand tokens — "The Honest Ladle" (brand kit v0.1, PROPOSAL, not yet founder-approved).
 * Source: branding/03_Color/lahloba_tokens.json and Color_System.md (computed WCAG ratios).
 * Rules enforced here: never white text on Turmeric (2.17:1), never Molasses on Hibiscus (1.94:1),
 * Pending never uses success colours, Clay 500 only for meta text >= 14px.
 */
export const brand = {
  hibiscus700: '#8E2443', hibiscus600: '#A8325A', hibiscus300: '#E58AA6', hibiscus100: '#F7DDE5',
  turmeric500: '#E9A23B', turmeric700: '#8A5309', turmeric300: '#F3C477', turmeric100: '#FCEBCB',
  molasses900: '#2A1C17', clay700: '#5E4A40', clay500: '#7A665B', sesame300: '#D9CDBE', tahini100: '#F7F0E3', white: '#FFFFFF',
  basil700: '#225E44', basil600: '#2E7D5A', basil300: '#7CC7A1', basil100: '#DCEFE4',
  nile700: '#20506C', nile600: '#2D6A8E', nile300: '#8DBEDC', nile100: '#DDEBF3',
  error600: '#B3261E', error300: '#F28B82', error100: '#FBE3E1',
  night900: '#1A1311', night800: '#241B18', night700: '#33281F',
} as const;

export const palette = {
  light: {
    background: brand.tahini100,
    surface: brand.white,
    surfaceMuted: brand.tahini100,
    border: brand.sesame300,
    text: brand.molasses900,
    textMuted: brand.clay700,
    textMeta: brand.clay500,
    accent: brand.hibiscus700,
    accentSoft: brand.hibiscus100,
    onAccent: brand.white,
    portion: brand.hibiscus700,
    focus: brand.hibiscus700,
    danger: brand.error600,
    dangerSurface: brand.error100,
    warning: brand.turmeric700,
    warningSurface: brand.turmeric100,
    pending: brand.turmeric700,
    pendingSurface: brand.turmeric100,
    success: brand.basil700,
    successSurface: brand.basil100,
    info: brand.nile700,
    infoSurface: brand.nile100,
    ink: brand.molasses900,
    paper: brand.tahini100,
    turmeric: brand.turmeric500,
  },
  dark: {
    background: brand.night900,
    surface: brand.night800,
    surfaceMuted: brand.night700,
    border: brand.night700,
    text: brand.tahini100,
    textMuted: brand.sesame300,
    textMeta: brand.sesame300,
    accent: brand.hibiscus300,
    accentSoft: brand.night700,
    onAccent: brand.night900,
    portion: brand.turmeric500,
    focus: brand.hibiscus300,
    danger: brand.error300,
    dangerSurface: brand.night700,
    warning: brand.turmeric300,
    warningSurface: brand.night700,
    pending: brand.turmeric300,
    pendingSurface: brand.night700,
    success: brand.basil300,
    successSurface: brand.night700,
    info: brand.nile300,
    infoSurface: brand.night700,
    ink: brand.tahini100,
    paper: brand.night900,
    turmeric: brand.turmeric500,
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Colors = { [K in keyof (typeof palette)['light']]: string };

/** Role accents appear only in header strips, active nav and role chips (Product_Design_Expression). */
export const roleAccent = {
  CUSTOMER: { strip: brand.hibiscus700, onStrip: brand.white, chip: brand.hibiscus100, chipText: brand.hibiscus700 },
  CHEF: { strip: brand.turmeric500, onStrip: brand.molasses900, chip: brand.turmeric100, chipText: brand.turmeric700 },
  SUPPLIER: { strip: brand.basil600, onStrip: brand.white, chip: brand.basil100, chipText: brand.basil700 },
  COURIER: { strip: brand.nile600, onStrip: brand.white, chip: brand.nile100, chipText: brand.nile700 },
  OPERATIONS: { strip: brand.molasses900, onStrip: brand.tahini100, chip: brand.sesame300, chipText: brand.molasses900 },
} as const;
export type RoleAccentKey = keyof typeof roleAccent;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { xs: 4, sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Font family names registered by the apps (expo-google-fonts / @fontsource). */
export const fonts = {
  display: 'ReadexPro_700Bold',
  heading: 'ReadexPro_600SemiBold',
  bodyEn: 'IBMPlexSans_400Regular',
  bodyEnStrong: 'IBMPlexSans_600SemiBold',
  bodyAr: 'IBMPlexSansArabic_400Regular',
  bodyArStrong: 'IBMPlexSansArabic_600SemiBold',
} as const;

/** Mobile type scale (size/line-height). Arabic gets the extra line-height from the brand spec. */
export const type = {
  caption: { fontSize: 13, lineHeight: 20, arLineHeight: 22 },
  body: { fontSize: 15, lineHeight: 24, arLineHeight: 26 },
  bodyLarge: { fontSize: 17, lineHeight: 26, arLineHeight: 28 },
  label: { fontSize: 16, lineHeight: 24, arLineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28, arLineHeight: 30 },
  heading: { fontSize: 24, lineHeight: 32, arLineHeight: 34 },
  display: { fontSize: 30, lineHeight: 40, arLineHeight: 42 },
  price: { fontSize: 17, lineHeight: 24, arLineHeight: 24 },
  priceLarge: { fontSize: 22, lineHeight: 28, arLineHeight: 28 },
} as const;
export type TypeVariant = keyof typeof type;

export const motion = { fast: 120, base: 200, slow: 320 } as const;

/** Minimum interactive target (brand spec: 48 x 48). */
export const minTouchTarget = 48;
