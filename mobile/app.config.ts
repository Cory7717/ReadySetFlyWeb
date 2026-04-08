import type { ConfigContext, ExpoConfig } from 'expo/config';

const appJson = require('./app.json');

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig: ExpoConfig = appJson.expo;
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

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
    },
  };
};
