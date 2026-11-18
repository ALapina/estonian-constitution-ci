// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// GitHub Pages project site: https://alapina.github.io/estonian-constitution-ci/
// Moving to another host means changing `site` and `base` only (DESIGN.md 7.1).
export default defineConfig({
  site: 'https://alapina.github.io',
  base: '/estonian-constitution-ci',
  integrations: [preact()],
});
