/**
 * Builds an internal link or asset path under the site's base.
 * With `base` written without a trailing slash, BASE_URL has none either (DESIGN.md 7.2),
 * so every link goes through this helper.
 */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const rest = path.replace(/^\/+/, '');
  return rest ? `${base}/${rest}` : `${base}/`;
}
