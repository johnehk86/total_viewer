import JSZip from 'jszip';

// HWPX is a zip of OWPML XML files. There's no mature browser renderer for it,
// so this extracts the body text and tables and lays them out simply.
export async function renderHwpx(buffer, container) {
  const zip = await JSZip.loadAsync(buffer);
  const sectionNames = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => sectionIndex(a) - sectionIndex(b));

  if (sectionNames.length === 0) {
    throw new Error('HWPX 본문(section)을 찾을 수 없습니다.');
  }

  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.textContent = 'HWPX 문서는 글자와 표 위주로 간략하게 표시돼요. 그림과 세부 서식은 보이지 않을 수 있어요.';
  container.appendChild(notice);

  const parser = new DOMParser();
  for (const name of sectionNames) {
    const xml = await zip.file(name).async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    const page = document.createElement('div');
    page.className = 'hwpx-page doc-page';
    renderChildren(doc.documentElement, page);
    container.appendChild(page);
  }
  return { pages: sectionNames.length, pageUnit: '구역' };
}

function sectionIndex(name) {
  return Number(name.match(/section(\d+)/i)[1]);
}

function renderChildren(node, out) {
  for (const child of node.children) {
    if (child.localName === 'p') out.appendChild(renderParagraph(child));
    else renderChildren(child, out);
  }
}

function renderParagraph(p) {
  const el = document.createElement('p');
  walkParagraph(p, el);
  return el;
}

function walkParagraph(node, el) {
  for (const child of node.children) {
    switch (child.localName) {
      case 't':
        el.appendChild(document.createTextNode(textOf(child)));
        break;
      case 'tbl':
        el.appendChild(renderTable(child));
        break;
      case 'lineBreak':
        el.appendChild(document.createElement('br'));
        break;
      case 'tab':
        el.appendChild(document.createTextNode('\t'));
        break;
      default:
        walkParagraph(child, el);
    }
  }
}

// <hp:t> can contain inline elements such as <hp:tab/> and <hp:lineBreak/> between text nodes.
function textOf(t) {
  let s = '';
  for (const n of t.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue;
    else if (n.localName === 'tab') s += '\t';
    else if (n.localName === 'lineBreak') s += '\n';
  }
  return s;
}

function renderTable(tbl) {
  const table = document.createElement('table');
  for (const tr of tbl.children) {
    if (tr.localName !== 'tr') continue;
    const row = table.insertRow();
    for (const tc of tr.children) {
      if (tc.localName !== 'tc') continue;
      const cell = row.insertCell();
      const span = [...tc.children].find((c) => c.localName === 'cellSpan');
      if (span) {
        cell.colSpan = Number(span.getAttribute('colSpan')) || 1;
        cell.rowSpan = Number(span.getAttribute('rowSpan')) || 1;
      }
      renderChildren(tc, cell);
    }
  }
  return table;
}
