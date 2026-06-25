interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly BASE_URL: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_STORE_URL?: string;
  readonly VITE_CESIUM_ION_TOKEN?: string;
  readonly VITE_GPS_PANEL_BASE_URL?: string;
  readonly VITE_SIX_PACK_PANEL_URL?: string;
  readonly VITE_SOFT_AUTH_ENABLED?: string;
  readonly VITE_PARTNER_AV8MAPS_ACTIVE?: string;
  readonly VITE_AV8MAPS_BASE_URL?: string;
  readonly VITE_AV8MAPS_EMBED_ENABLED?: string;
  readonly VITE_AV8MAPS_EMBED_URL?: string;
  readonly VITE_AV8MAPS_UTM_SOURCE?: string;
  readonly VITE_AV8MAPS_UTM_MEDIUM?: string;
  readonly VITE_AV8MAPS_UTM_CAMPAIGN?: string;
  readonly VITE_NOTAM_SOURCE?: string;
  readonly VITE_NOTAM_HTTP_BASE_URL?: string;
  readonly VITE_NOTAM_HTTP_HEADERS_JSON?: string;
  readonly VITE_WEB_MAP_ENGINE?: string;
  readonly VITE_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_PUBLIC_MAPBOX_TOKEN?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.JPG";
declare module "*.svg";
declare module "*.mp4";
declare module "*.css";
