interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
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
  readonly VITE_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_PUBLIC_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
