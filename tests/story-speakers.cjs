/*
 * 说话人与舞台指示的回归护栏。
 *
 * 剧本的运行方式是"人物提示行 + 台词行"（"赵灵（迷离）" / "师父，我们以前是不是见过？"）。
 * 抽取时两行都留成了旁白，于是玩家看到旁白念"赵灵（迷离）"、再念赵灵说的话，赵灵本人
 * 始终没有名字——实测 13 处，包含 ending-c（完美结局）里的"赵灵（轻声）"。
 * novel-presentation.js 现在把提示行收进 productionNotes 并把它认出的说话人贴到下一行，
 * 这个脚本防止它退回去。
 *
 * 同时检查：舞台指示（△/☆）不得泄漏给玩家、相邻重复的指示要去掉。
 */
process.chdir(require('path').resolve(__dirname, '..'));
const fs = require('fs'), vm = require('vm');
const c = { window: { MuseumItems: {} }, Image: function () {}, console };
vm.createContext(c);
for (const n of ['state', 'map-data', 'map-art', 'chapter-maps', 'novel-data', 'novel-overrides',
  'novel-presentation', 'novel-prologue', 'chapter-story', 'chapter-finalize']) {
  vm.runInContext(fs.readFileSync('js/' + n + '.js', 'utf8'), c);
}
const S = c.window.MuseumStory.scenes;

// A "character name in parentheses" line: 赵灵（急促拍门）/ 主角（独白）/ MOSS（画外音）…
const NAME_PAREN = /^([\u4e00-\u9fa5A-Za-z]{2,8})（[^）]{1,14}）\s*$/;
// Stage directions that should never reach the player.
const DIRECTION = /^[△☆]|^（?画面|^镜头|^字幕/;

const problems = [];
for (const id of Object.keys(S)) {
  const sc = S[id];
  (sc.lines || []).forEach((l, i) => {
    const text = String(l.text == null ? '' : l.text);
    const speaker = l.speaker || '旁白';
    if (speaker === '旁白' && NAME_PAREN.test(text.trim())) {
      const next = (sc.lines[i + 1] || {});
      problems.push({ id, i, kind: '说话人丢在了旁白里', text: text.trim(), nextSpeaker: next.speaker || '旁白', nextText: String(next.text == null ? '' : next.text).slice(0, 40) });
    }
    if (DIRECTION.test(text.trim())) {
      problems.push({ id, i, kind: '舞台指示泄漏给玩家', text: text.trim().slice(0, 60) });
    }
  });
  // duplicate consecutive stage directions
  const texts = (sc.lines || []).map(l => String(l.text == null ? '' : l.text).trim());
  for (let i = 0; i + 1 < texts.length; i += 1) {
    if (texts[i] && texts[i] === texts[i + 1] && /^[△☆]/.test(texts[i])) {
      problems.push({ id, i, kind: '舞台指示重复', text: texts[i].slice(0, 60) });
    }
  }
}

console.log('=== 说话人/舞台指示问题（共 ' + problems.length + ' 处）===');
let last = null;
for (const p of problems) {
  if (p.id !== last) { console.log('\n' + p.id); last = p.id; }
  console.log('   [' + p.kind + '] ' + JSON.stringify(p.text));
  if (p.nextText) console.log('        下一行说话人：' + p.nextSpeaker + '  ' + JSON.stringify(p.nextText));
}
if (problems.length) {
  console.log('\n问题类型：' + [...new Set(problems.map(p => p.kind))].join(' / '));
  console.log('修复位置：js/novel-presentation.js 的 SPEAKER_CUE 处理。');
}
console.log(problems.length ? '\n' + problems.length + ' FAILED' : '\nOK');
process.exitCode = problems.length ? 1 : 0;
