/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID: string;
  readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface GoogleOauth2Namespace {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
}

interface Window {
  google?: {
    accounts: {
      oauth2: GoogleOauth2Namespace;
    };
  };
}

