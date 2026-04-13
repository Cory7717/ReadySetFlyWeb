import type { ConfigContext, ExpoConfig } from 'expo/config';

const appJson = require('./app.json');

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = appJson.expo;
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const revenueCatAppleApiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
  const revenueCatGoogleApiKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;

  if (!revenueCatGoogleApiKey) {
    console.warn('[RSF:revenuecat] EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY is missing. Android RevenueCat billing will be disabled for this build.');
  }
  if (!revenueCatAppleApiKey) {
    console.warn('[RSF:revenuecat] EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY is missing. iOS RevenueCat billing will be disabled for this build.');
  }

  return {
    ...baseConfig,
    ...config,
    android: {
      ...baseConfig.android,
      ...config.android,
      config: {
        ...baseConfig.android?.config,
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...baseConfig.extra,
      ...config.extra,
      googleMaps: {
        androidApiKeyConfigured: Boolean(googleMapsApiKey),
        androidPackage: baseConfig.android?.package,
      },
      revenueCat: {
        androidApiKeyConfigured: Boolean(revenueCatGoogleApiKey),
        iosApiKeyConfigured: Boolean(revenueCatAppleApiKey),
        androidEnvVar: 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY',
        iosEnvVar: 'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY',
      },
    },
  };
};
