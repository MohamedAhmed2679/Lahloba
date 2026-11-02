import { createElement, type ReactElement } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useLocale } from '../LocaleContext';
import { ART, type ArtNode } from './art';

/**
 * Renders the brand kit's drawn artwork (logo, wordmarks, service and role icons) with
 * react-native-svg. Colours are semantic so the same art works on light, dark and Hibiscus grounds:
 * ink (Molasses/Tahini), accent (Hibiscus portion), paper (Tahini), turmeric.
 * The wordmarks are drawn paths, never re-set in a font (Logo spec rule 6).
 */
type Palette = { ink: string; accent: string; paper: string; turmeric: string };
const COMPONENTS: Record<string, unknown> = { g: G, path: Path, circle: Circle, rect: Rect };

function renderNode(n: ArtNode, pal: Palette, key: string): ReactElement | null {
  const C = COMPONENTS[n.t];
  if (!C) return null;
  const { t: _t, c, fill, stroke, ...rest } = n;
  const color = (v: string | undefined) => (v === undefined ? undefined : v === 'none' ? 'none' : (pal as Record<string, string>)[v] ?? v);
  const props: Record<string, unknown> = { ...rest, key };
  if (fill !== undefined) props.fill = color(fill);
  if (stroke !== undefined) props.stroke = color(stroke);
  return createElement(C as never, props, ...(c ?? []).map((k, i) => renderNode(k, pal, `${key}.${i}`)));
}

export type ArtName = keyof typeof ART & string;

export function BrandArt(props: { name: ArtName; size?: number; width?: number; height?: number; palette?: Partial<Palette>; label?: string; testID?: string }) {
  const { colors } = useLocale();
  const art = ART[props.name];
  if (!art) return null;
  const [, , w, h] = art.viewBox.split(' ').map(Number) as [number, number, number, number];
  const height = props.height ?? props.size ?? 24;
  const width = props.width ?? (props.size ?? height * (w / h));
  const pal: Palette = { ink: colors.ink, accent: colors.portion, paper: colors.paper, turmeric: colors.turmeric, ...props.palette };
  return (
    <Svg width={width} height={height} viewBox={art.viewBox} accessibilityRole={props.label ? 'image' : undefined}
      accessibilityLabel={props.label} accessible={!!props.label} testID={props.testID}>
      {art.c.map((n, i) => renderNode(n, pal, String(i)))}
    </Svg>
  );
}

/** Primary logo: Arabic lockup in Arabic-first contexts, English lockup otherwise. */
export function BrandLockup(props: { height?: number; reversed?: boolean; testID?: string }) {
  const { locale, t } = useLocale();
  const pal = props.reversed ? { ink: '#F7F0E3', accent: '#E9A23B' } : undefined;
  return <BrandArt name={locale === 'ar' ? 'lockupAr' : 'lockupEn'} height={props.height ?? 32} palette={pal} label={t('app.name')} testID={props.testID ?? 'brand-lockup'} />;
}

export function BrandSymbol(props: { size?: number; reversed?: boolean }) {
  const pal = props.reversed ? { ink: '#F7F0E3', accent: '#E9A23B' } : undefined;
  return <BrandArt name="symbol" size={props.size ?? 32} palette={pal} />;
}
