/* Builds the printable dossier PDF (no library). Unchanged from the Claude version. */
/* ---------- PDF: a print-friendly overview of one dossier ---------- */
// Built by hand (no library): plain A4, black on white, standard Helvetica. The file is handed to
// the device through the downloads capability; printing happens from there (share sheet / browser).
const PDF_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278, 556,556,556,556,556,556,556,556,556,556, 278,278,584,584,584,556, 1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611, 278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500, 334,260,334,584];   // Helvetica widths for characters 32..126
const PDF_SPECIAL_W = {'€':556,'—':1000,'–':556,'‘':222,'’':222,'“':333,'”':333,'…':1000,'°':400,'·':278,'×':584,'©':737,'ß':611,'æ':889,'Æ':1000,'œ':944,'Œ':1000,'ø':611,'Ø':778,'•':350};
const WIN1252 = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,
  0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};

function pdfCharW(ch){
  const c = ch.charCodeAt(0);
  if(c >= 32 && c <= 126) return PDF_W[c - 32];
  if(PDF_SPECIAL_W[ch]) return PDF_SPECIAL_W[ch];
  const b = ch.normalize('NFD').charCodeAt(0);                  // é is as wide as e in Helvetica
  return (b >= 32 && b <= 126) ? PDF_W[b - 32] : 556;
}
function pdfTextW(str, size){ let w = 0; for(const ch of str) w += pdfCharW(ch); return w * size / 1000; }
// text -> bytes of the WinAnsi code page (one char = one byte), with () and \ escaped; unknown symbols become "?"
function pdfEnc(str){
  let out = '';
  for(const ch of String(str)){
    const c = ch.codePointAt(0);
    if(c === 9) out += ' ';
    else if(c < 32) continue;
    else if(c <= 0x7E || (c >= 0xA0 && c <= 0xFF)) out += String.fromCharCode(c);
    else if(WIN1252[c]) out += String.fromCharCode(WIN1252[c]);
    else out += '?';
  }
  return out.replace(/([\\()])/g, '\\$1');
}
function pdfWrap(text, size, maxW){
  const lines = [];
  String(text).split(/\r?\n/).forEach(par=>{
    if(par.trim() === ''){ lines.push(''); return; }
    let cur = '';
    par.split(' ').forEach(word=>{
      while(pdfTextW(word, size) > maxW){                         // a very long word (a link): break it by characters
        let cut = 1; while(cut < word.length && pdfTextW(word.slice(0, cut + 1), size) <= maxW) cut++;
        if(cur){ lines.push(cur); cur = ''; }
        lines.push(word.slice(0, cut)); word = word.slice(cut);
      }
      const trial = cur ? cur + ' ' + word : word;
      if(pdfTextW(trial, size) <= maxW) cur = trial; else { lines.push(cur); cur = word; }
    });
    lines.push(cur);
  });
  return lines;
}

function buildDossierPdf(form){
  const dj = form.dj || {}, cl = form.client || {};
  const PW = 595.28, PH = 841.89, M = 48, TOP = PH - 54, BOTTOM = 62;
  const VAL_X = M + 150, VAL_W = PW - M - VAL_X;
  const pages = []; let page = null, y = 0;
  const newPage = ()=>{ page = []; pages.push(page); y = TOP; };
  const T = (x, yy, str, size, bold, gray)=>{ page.push(`BT /F${bold ? 2 : 1} ${size} Tf ${gray} g ${x.toFixed(2)} ${yy.toFixed(2)} Td (${pdfEnc(str)}) Tj ET`); };
  const R = (yy, w, gray)=>{ page.push(`${gray} G ${w} w ${M} ${yy.toFixed(2)} m ${(PW - M).toFixed(2)} ${yy.toFixed(2)} l S`); };
  const money = (v)=> /^\d[\d.\s]*([.,]\d{1,2})?$/.test(String(v || '').trim()) ? '€ ' + String(v).trim() : String(v || '');   // 800, 1.250,50, 75.5 -> € ...
  const when = (iso)=> iso ? new Date(iso).toLocaleDateString('nl-BE', {day:'numeric', month:'long', year:'numeric'}) : '';
  const day = (k)=> /^\d{4}-\d{2}-\d{2}$/.test(k || '') ? longDate(k) : '';
  const name = (form.clientName || '').trim() || 'Klant';

  newPage();
  T(M, y, 'MK SOUNDSYSTEM', 9, true, 0.45); y -= 24;
  pdfWrap(name, 20 * 1.08, PW - 2 * M).forEach(ln=>{ T(M, y, ln, 20, true, 0); y -= 25; });
  const sub = [day(dj.eventDate), dj.eventType].filter(Boolean).join('  ·  ');
  if(sub){ T(M, y, sub, 11, false, 0.25); y -= 16; }
  T(M, y, form.status === 'submitted' ? 'Bevestigd door de klant' + (form.submittedAt ? ' op ' + when(form.submittedAt) : '') : 'Concept: nog niet bevestigd door de klant', 10, false, 0.4);
  y -= 12; R(y, 1.2, 0.2); y -= 8;

  const section = (title, rows)=>{
    if(y - 60 < BOTTOM) newPage();
    y -= 10; T(M, y, title.toUpperCase(), 9.5, true, 0.2); y -= 5; R(y, 0.6, 0.65); y -= 13;
    rows.forEach(([label, value])=>{
      const empty = !String(value || '').trim();
      const lines = empty ? ['—'] : pdfWrap(value, 10.5, VAL_W);
      if(y - (Math.min(lines.length, 3) - 1) * 13 < BOTTOM) newPage();
      let ly = y;
      T(M, ly, label, 9, true, 0.35);
      lines.forEach((ln, i)=>{
        if(i > 0){ ly -= 13; if(ly < BOTTOM){ newPage(); ly = y; } }
        T(VAL_X, ly, ln, 10.5, false, empty ? 0.6 : 0);
      });
      y = ly - 16.5;
    });
  };

  section('Het feest', [
    ['Type feest', dj.eventType], ['Datum', day(dj.eventDate)], ['Locatie', dj.venue],
    ['Opstelling', [day(dj.setupDate), dj.setupTime ? 'om ' + dj.setupTime : ''].filter(Boolean).join(' ')],
    ['Dj aanwezig om', dj.djArrival], ['Startuur dj', dj.startTime], ['Einduur dj', dj.endTime]]);
  section('Klant', [
    ['Naam', name], ['E-mailadres', dj.clientEmail], ['Telefoon', dj.clientPhone], ['Extra contactpersoon', cl.onSiteContactAlt]]);
  section('Prijs en materiaal', [
    ['Prijs (excl. btw)', money(dj.priceExVat)], ['Voorschot', money(dj.advanceAmount)],
    ['Tarief overuur', dj.overtimeRate ? money(dj.overtimeRate) + (/^\d/.test(dj.overtimeRate) ? ' per uur' : '') : ''], ['Te voorziene materialen', dj.materials]]);
  section('Muziek en verloop', [
    ['Muzieksuggesties', cl.musicSuggestions], ['Niet spelen', cl.doNotPlay], ['Openingsdans', cl.firstDance], ['Ouder-kind dans', cl.parentDance],
    ['Speciale momenten en timing', cl.specialMoments], ['Gewenste muziekstijlen', cl.genres], ['Gewenste sfeer', cl.vibe],
    ['Aankondigingen voor de dj', cl.announcements], ['Overige opmerkingen', cl.extraNotes]]);
  if((dj.internalNotes || '').trim()) section('Interne notities (niet voor de klant)', [['Notities', dj.internalNotes]]);

  // footer on every page, now that the page count is known
  const printed = new Date().toLocaleString('nl-BE', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'});
  pages.forEach((pg, i)=>{
    page = pg;
    R(46, 0.5, 0.75);
    const right = `Pagina ${i + 1} van ${pages.length}`;
    const leftMax = PW - 2 * M - pdfTextW(right, 8) - 18;
    let left = `MK Soundsystem  ·  ${name}  ·  afgedrukt op ${printed}`;
    if(pdfTextW(left, 8) > leftMax){ while(left.length > 1 && pdfTextW(left + '…', 8) > leftMax) left = left.slice(0, -1); left += '…'; }
    T(M, 32, left, 8, false, 0.5);
    T(PW - M - pdfTextW(right, 8), 32, right, 8, false, 0.5);
  });

  // ---- assemble the PDF file (every character below is one byte)
  const objs = []; const add = (body)=>{ objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');                               // 1
  add('PAGES');                                                            // 2 (filled in below)
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');        // 3
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');   // 4
  const kids = [];
  pages.forEach(pg=>{
    const content = pg.join('\n');
    const cid = objs.length + 2;
    const pid = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`);
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(pid + ' 0 R');
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  const title = ('Dossier ' + name).replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1');
  const infoId = add(`<< /Title (${title}) /Producer (MK Soundsystem dj-intake) >>`);

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [];
  objs.forEach((body, i)=>{ offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for(let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

