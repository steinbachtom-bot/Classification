// Zeigt, was das Tool mit einem Text macht: node tests/debug.js "Text"
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
const q = process.argv.slice(2).join(' ');
const p = E.prepare(q);
console.log('BEREINIGT :', p.text);
console.log('ENTFERNT  :', p.removed.join(', ') || '-', '| ABKÜRZUNGEN:', p.abbreviations.join(', ') || '-');
console.log('VORSCHLÄGE:', E.classify(q).map(r => r.c.code).join(', ') || '-');
console.log('\nKandidaten mit Treffern (Regel -> Gewicht):');
E.classify(q, { max: 10, rel: 0.01, minAbs: 0.1, debug: true }).forEach(r => {
  console.log(r.c.code.padEnd(6), r.c.label.slice(0, 45).padEnd(45), r.score.toFixed(1), r.learned ? '[gelernt ' + r.learned.sim.toFixed(2) + ']' : '');
  (r.hits || []).forEach(h => console.log('        ', h.w.toFixed(2), String(h.src).slice(0, 100)));
});
