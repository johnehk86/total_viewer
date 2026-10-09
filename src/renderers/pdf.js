import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdf(buffer, container) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  let currentScale = 1;
  let renderToken = 0;

  async function draw(scale) {
    const token = ++renderToken;
    const frag = document.createDocumentFragment();
    const dpr = window.devicePixelRatio || 1;

    for (let i = 1; i <= pdf.numPages; i++) {
      if (token !== renderToken) return; // a newer zoom request superseded this one
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: scale * 1.5 });
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page doc-page';
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      await page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      frag.appendChild(canvas);
      // Show the first page as soon as it's ready so large files feel responsive.
      if (i === 1) container.replaceChildren(frag);
    }
    if (token === renderToken) container.appendChild(frag);
  }

  await draw(currentScale);

  return {
    pages: pdf.numPages,
    setZoom(scale) {
      currentScale = scale;
      return draw(scale);
    },
    destroy() {
      renderToken++;
      loadingTask.destroy();
    },
  };
}
