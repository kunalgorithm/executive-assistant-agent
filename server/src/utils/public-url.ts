type PublicUrlConfig = {
  PUBLIC_API_URL?: string;
  RENDER_EXTERNAL_URL?: string;
  NODE_ENV: string;
  PORT: number;
};

// Only use operator/platform configuration, never untrusted Host/Forwarded headers.
export function resolvePublicApiUrl(config: PublicUrlConfig): string {
  const configured = config.PUBLIC_API_URL || config.RENDER_EXTERNAL_URL;
  if (!configured) {
    if (config.NODE_ENV === 'development') return `http://localhost:${config.PORT}`;
    throw new Error('Set PUBLIC_API_URL to the public server origin for account connection links');
  }
  const url = new URL(configured);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('PUBLIC_API_URL must be an HTTP(S) origin without a path, credentials, query, or fragment');
  }
  if (config.NODE_ENV !== 'development' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_API_URL must use HTTPS outside development');
  }
  return url.origin;
}
