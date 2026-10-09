import { renderAsync } from 'docx-preview';

export async function renderDocx(buffer, container) {
  await renderAsync(buffer, container, undefined, {
    className: 'docx',
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    experimental: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  });
  const pages = container.querySelectorAll('section.docx');
  pages.forEach((page) => page.classList.add('doc-page'));
  return { pages: pages.length };
}
