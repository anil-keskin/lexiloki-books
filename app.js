'use strict';
// Lists the books from books.json. PDFs are GitHub release assets (free hosting, no size limit per repo).
const DL = 'https://github.com/anil-keskin/lexiloki-books/releases/download/books/';
fetch('books.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
  const box = document.getElementById('books');
  document.getElementById('count').textContent = list.length
    ? list.length + ' of 100 books ready. New adventures are added every day.'
    : 'The first adventures are being drawn right now. Come back soon!';
  for (const b of list) {
    const a = document.createElement('a');
    a.className = 'book'; a.href = DL + encodeURIComponent(b.file); a.rel = 'noopener';
    const img = document.createElement('img');
    img.src = 'covers/' + String(b.n).padStart(3, '0') + '.jpg'; img.alt = 'Cover: ' + b.title; if (b.n > 8) img.loading = 'lazy';
    const t = document.createElement('h2'); t.textContent = b.n + '. ' + b.title;   // textContent: no HTML injection
    const r = document.createElement('p'); r.textContent = b.blurb || '';
    const dl = document.createElement('span'); dl.className = 'dl'; dl.textContent = 'Download PDF';
    a.append(img, t, r, dl); box.append(a);
  }
}).catch(() => { document.getElementById('count').textContent = 'Could not load the book list. Please refresh.'; });
