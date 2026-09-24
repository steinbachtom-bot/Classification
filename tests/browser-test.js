// Browser-Test (optional, braucht Playwright): node tests/browser-test.js
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1000,height:1000},acceptDownloads:true});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});
  p.on('dialog', d=>d.accept());
  const url='file://' + require('path').join(__dirname, '..', 'dist', 'Fall-Klassifizierung_DE.html');
  await p.goto(url);
  const mail = "Guten Tag\nIch habe am 2. September ein Fotobuch bestellt. Laut Ihrer Mail hätte es letzte Woche ankommen sollen, bis heute ist aber nichts da.\nFreundliche Grüsse\nSandra Keller\n079 123 45 67\n\nVon: ifolor Kundenservice <service@ifolor.ch>\nBetreff: Ihre Bestellung 12345678 wurde versendet\nIhr Paket wurde heute an die Post übergeben.";
  await p.fill('#q', mail); await p.waitForTimeout(300);
  console.log('cleanInfo:', await p.$eval('#cleanInfo',e=>e.innerText));
  console.log('codes:', await p.$$eval('.res .code',r=>r.map(x=>x.textContent).join(',')));
  
  await p.fill('#q','Kd. hat FB n. erh.'); await p.waitForTimeout(300);
  console.log('abk info:', await p.$eval('#cleanInfo',e=>e.innerText), '| codes:', await p.$$eval('.res .code',r=>r.map(x=>x.textContent).join(',')));
  // Lernen: Fall, den die Stichwörter nicht kennen
  const t1='Kunde braucht Lieferschein für den Zoll in Deutschland';
  await p.fill('#q',t1); await p.waitForTimeout(300);
  console.log('before learn:', await p.$$eval('.res .code',r=>r.map(x=>x.textContent).join(',')));
  await p.fill('#pick','50507'); await p.waitForTimeout(100);
  await p.click('#pickList .row'); await p.waitForTimeout(300);
  console.log('toast:', await p.$eval('#toast',e=>e.innerText.replace(/\n/g,' ')));
  console.log('badge:', await p.$eval('#badge',e=>e.textContent));
  await p.fill('#q','Kundin benötigt einen Lieferschein wegen Zoll'); await p.waitForTimeout(300);
  console.log('after learn:', await p.$$eval('.res',r=>r.map(x=>x.querySelector('.code').textContent+(x.querySelector('.tag-learned')?' [Gelernt]':'')).join(',')));
  
  // Undo-Test
  await p.fill('#q','Test Paket Zoll Lieferschein nochmal anders formuliert'); await p.waitForTimeout(200);
  await p.fill('#pick','Versandkosten'); await p.waitForTimeout(100);
  await p.click('#pickList .row'); await p.waitForTimeout(200);
  console.log('badge before undo:', await p.$eval('#badge',e=>e.textContent));
  await p.click('#toast button'); await p.waitForTimeout(200);
  console.log('badge after undo:', await p.$eval('#badge',e=>e.textContent));
  // Reload -> persistent?
  await p.reload(); await p.waitForTimeout(300);
  console.log('after reload:', await p.$eval('#badge',e=>e.textContent));
  // Export
  await p.click('#learnedBox summary');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnExport')]);
  const fp = require('path').join(require('os').tmpdir(), 'export_test.json'); await dl.saveAs(fp);
  console.log('export:', require('fs').readFileSync(fp,'utf8').slice(0,200).replace(/\n/g,' '));
  // Clear + Import
  await p.click('#btnClear'); await p.waitForTimeout(200);
  console.log('after clear:', await p.$eval('#badge',e=>e.textContent));
  await p.setInputFiles('#importFile', fp); await p.waitForTimeout(400);
  console.log('after import:', await p.$eval('#badge',e=>e.textContent), '| toast:', await p.$eval('#toast',e=>e.innerText));
  
  console.log('errors:',errs);
  await b.close();
})();
