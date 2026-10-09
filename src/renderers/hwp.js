import { Viewer } from 'hwp.js';

export async function renderHwp(buffer, container) {
  const host = document.createElement('div');
  container.appendChild(host);
  const viewer = new Viewer(host, new Uint8Array(buffer), { type: 'array' });

  // hwp.js wraps pages in its own toolbar and scroll box; keep only the pages
  // so they share the app's layout, scrolling and zoom.
  const pages = [...viewer.pages];
  viewer.distory(); // (sic) — that's the library's method name
  for (const page of pages) page.classList.add('doc-page', 'hwp-page');
  host.replaceChildren(...pages);

  return { pages: pages.length };
}
