import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic';
import { ReadexPro_600SemiBold, ReadexPro_700Bold } from '@expo-google-fonts/readex-pro';
import { useFonts } from 'expo-font';

/**
 * Brand fonts (SIL OFL 1.1, see branding/14_Licenses_and_Approvals/font_licenses), bundled in the
 * app. Keys match packages/ui tokens.fonts. Returns [loaded, error]; apps keep the splash screen
 * up until loaded and fall back to system fonts on error rather than blocking.
 */
export function useBrandFonts(): [boolean, Error | null] {
  return useFonts({
    ReadexPro_600SemiBold, ReadexPro_700Bold,
    IBMPlexSans_400Regular, IBMPlexSans_600SemiBold,
    IBMPlexSansArabic_400Regular, IBMPlexSansArabic_600SemiBold,
  });
}
