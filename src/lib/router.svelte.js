// Hash-based router: GitHub Pages has no SPA fallback, so deep links must live after "#".

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts, params: new URLSearchParams(query) };
}

export const route = $state(parse());

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => Object.assign(route, parse()));
}

export function navigate(path) {
  location.hash = path;
}
