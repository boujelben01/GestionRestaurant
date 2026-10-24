/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Adresse publique du site, encodée dans les QR codes des tables. */
  readonly VITE_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
