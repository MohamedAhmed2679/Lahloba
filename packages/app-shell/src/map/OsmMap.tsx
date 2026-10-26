import { createElement, type ComponentType } from 'react';
import { Platform, View } from 'react-native';
import { radius, useLocale } from '@lahloba/ui';
import { osmHtml, type MapMarker, type MapRoute } from './osmHtml';

export type { MapMarker, MapRoute };
export { osmHtml };

declare const require: (id: string) => { WebView: ComponentType<Record<string, unknown>> };

/**
 * OpenStreetMap view: Leaflet in a WebView on iOS/Android, a sandboxed iframe on web.
 * The map is decorative for screen readers; `summary` carries its meaning in words.
 */
export function OsmMap(props: { markers: MapMarker[]; routes?: MapRoute[]; height?: number; summary: string; testID?: string }) {
  const { colors } = useLocale();
  const html = osmHtml(props.markers, props.routes ?? [], { route: colors.accent, done: colors.success, start: colors.turmeric, end: colors.accent });
  let body;
  if (Platform.OS === 'web') {
    body = createElement('iframe', { srcDoc: html, title: props.summary, sandbox: 'allow-scripts', style: { border: 0, width: '100%', height: '100%' }, 'aria-hidden': true, tabIndex: -1 });
  } else {
    const { WebView } = require('react-native-webview');
    body = (
      <WebView source={{ html, baseUrl: 'https://lahloba.local/' }} originWhitelist={['*']} scrollEnabled={false}
        importantForAccessibility="no-hide-descendants" accessibilityElementsHidden javaScriptEnabled setSupportMultipleWindows={false} />
    );
  }
  return (
    <View style={{ height: props.height ?? 220, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
      accessible accessibilityRole="image" accessibilityLabel={props.summary} testID={props.testID}>
      {body}
    </View>
  );
}
