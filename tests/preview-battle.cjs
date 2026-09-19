/* The preview adapter is pure with respect to storage/navigation; gameplay
   services are stubbed at their existing bound-state API boundary. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/preview-battle.js'), 'utf8');
let checks = 0;
function test(label, run) { run(); checks++; console.log('PASS ' + label); }
function fixture(options = {}) {
  const finalBoss = options.finalBoss !== false;
  const state = {
    userId: 'class-preview', mode: 'battle', hp: options.hp === undefined ? 100 : options.hp,
    points: 500, pointsLog: [], flags: { nightmareMinigameChoice: 'enter' },
    roomId: 'museum', currentNode: 'museum', playerX: 900, playerY: 750,
    returnRoom: 'hall', returnX: 400, returnY: 510,
    returnScene: finalBoss ? 'scene-28' : 'guard-after-battle',
    narrativeNode: finalBoss ? 'scene-28' : 'guard-after-battle',
    battleContext: finalBoss ? 'final-boss' : null,
    battleAttempt: { id: 'attempt-1', source: finalBoss ? 'pixel-dungeon' : 'battle', retryScene: finalBoss ? 'scene-27-boss' : 'scene-11', retryIndex: 4, returnScene: finalBoss ? 'scene-28' : 'guard-after-battle' },
    clues: [], unlockedRooms: ['museum'], minigamePlays: { forest: 0, dungeon: 0 },
    shopOwned: options.rollback ? { rollback: 1 } : {}, achievements: [],
    ending: 'ending-a', endingComplete: true
  };
  const calls = [];
  function zero() {
    if (state.hp > 0) return null;
    if (state.shopOwned.rollback) { state.shopOwned.rollback--; state.hp = 100; calls.push('rollback'); return 'rollback'; }
    calls.push('onZero'); return 'ending-d';
  }
  const window = {
    MuseumHumanityTuning: options.tuning || {},
    MuseumPoints: {
      add(amount, reason) { state.points += amount; state.pointsLog.push({ delta: amount, source: reason }); calls.push('income'); },
      penalize(amount, reason) { const paid = Math.min(state.points, amount); state.points -= paid; state.pointsLog.push({ delta: -paid, source: reason }); calls.push('penalty'); return paid; }
    },
    MuseumHumanity: {
      damage(amount) { state.hp = Math.max(0, state.hp - amount); calls.push('damage'); zero(); },
      value() { return state.hp; },
      settleZero: zero,
      settle() { calls.push('humanity-settle'); if (options.settleDrain) state.hp = Math.max(0, state.hp - options.settleDrain); zero(); }
    },
    MuseumMilestones: { settle(given) { assert.equal(given, state); calls.push('milestones'); } },
    MuseumAchievements: {
      setProgress(given, id) { assert.equal(given, state); calls.push(id); },
      unlock(given, id) { assert.equal(given, state); if (!state.achievements.includes(id)) state.achievements.push(id); calls.push('achievement'); }
    }
  };
  const context = vm.createContext({ window });
  vm.runInContext(source, context);
  const result = { status: options.status || 'win', userId: 'class-preview', source: state.battleAttempt.source, battleAttempt: 'attempt-1', hitsTaken: 2 };
  return { state, result, calls, settle: value => window.MuseumPreviewBattle.settle(state, value) };
}

test('boss preview victory applies damage, reward, completion and exit position', () => {
  const f = fixture();
  assert.equal(f.settle(f.result), 'scene-28');
  assert.equal(f.state.hp, 74);
  assert.equal(f.state.points, 570);
  assert.equal(f.state.flags.nightmareMinigameWon, true);
  assert.equal(f.state.flags.boss_defeated, true);
  assert.equal(f.state.minigamePlays.dungeon, 1);
  assert.deepEqual([f.state.roomId, f.state.currentNode, f.state.playerX, f.state.playerY, f.state.returnRoom, f.state.returnX, f.state.returnY], ['museum', 'museum', 610, 620, 'museum', 610, 620]);
  assert.ok(f.calls.includes('milestones') && f.calls.includes('humanity-settle'));
  assert.equal(f.state.lastBattleResultId, 'attempt-1');
  assert.equal(f.state.battleAttempt, null);
  assert.equal(f.state.battleContext, null);
  assert.equal(f.state.returnScene, null);
  assert.equal(f.state.ending, null);
  assert.equal(f.state.endingComplete, false);
});

test('director preview victory grants its clue, achievement and original return position', () => {
  const f = fixture({ finalBoss: false });
  assert.equal(f.settle(f.result), 'guard-after-battle');
  assert.equal(f.state.points, 550);
  assert.equal(f.state.flags.battleDemoCompleted, true);
  assert.equal(f.state.flags.waxDoorUnlocked, true);
  assert.ok(f.state.clues.includes('director-account'));
  assert.ok(f.state.unlockedRooms.includes('wax'));
  assert.ok(f.state.achievements.includes('first-battle'));
  assert.deepEqual([f.state.roomId, f.state.playerX, f.state.playerY], ['hall', 400, 510]);
});

test('loss charges points and preserves humanity and the fight decision', () => {
  const f = fixture({ status: 'lose' });
  assert.equal(f.settle(f.result), 'scene-27-boss');
  assert.equal(f.state.points, 200);
  assert.equal(f.state.hp, 100);
  assert.equal(f.state.narrativeIndex, 4);
  assert.equal(f.state.flags.nightmareMinigameChoice, 'enter');
  assert.equal(f.state.flags.nightmareMinigameWon, false);
  assert.equal(f.state.minigamePlays.dungeon, 0);
  assert.ok(!f.calls.includes('damage') && !f.calls.includes('income'));
});

test('fatal victory without rollback ends at D before rewards', () => {
  const f = fixture({ hp: 10 });
  assert.equal(f.settle(f.result), 'ending-d');
  assert.equal(f.state.hp, 0);
  assert.equal(f.state.points, 500);
  assert.equal(f.state.flags.endingCause, 'humanity');
  assert.equal(f.state.flags.nightmareMinigameWon, false);
  assert.equal(f.state.minigamePlays.dungeon, 0);
  assert.ok(!f.calls.includes('income') && !f.calls.includes('milestones'));
});

test('rollback is consumed before victory continues', () => {
  const f = fixture({ hp: 10, rollback: true });
  assert.equal(f.settle(f.result), 'scene-28');
  assert.equal(f.state.hp, 100);
  assert.equal(f.state.shopOwned.rollback, 0);
  assert.equal(f.state.points, 570);
  assert.equal(f.state.flags.nightmareMinigameWon, true);
  assert.equal(f.calls.filter(call => call === 'rollback').length, 1);
});

test('humanity reaching zero during milestone settlement cannot be overwritten by victory return', () => {
  const f = fixture({ settleDrain: 100 });
  assert.equal(f.settle(f.result), 'ending-d');
  assert.equal(f.state.flags.endingCause, 'humanity');
  assert.equal(f.state.narrativeNode, 'ending-d');
  assert.equal(f.state.flags.nightmareMinigameWon, false);
});

for (const [label, change] of [
  ['missing result', () => null],
  ['wrong attempt', result => ({ ...result, battleAttempt: 'old-attempt' })],
  ['missing attempt', result => ({ ...result, battleAttempt: undefined })],
  ['wrong source', result => ({ ...result, source: 'battle' })],
  ['wrong user', result => ({ ...result, userId: 'someone-else' })],
  ['invalid status', result => ({ ...result, status: 'finished' })]
]) {
  test(label + ' returns to retry without charging or awarding', () => {
    const f = fixture();
    assert.equal(f.settle(change(f.result)), 'scene-27-boss');
    assert.equal(f.state.hp, 100);
    assert.equal(f.state.points, 500);
    assert.equal(f.state.minigamePlays.dungeon, 0);
    assert.equal(f.state.lastBattleResultId, undefined);
    assert.ok(!f.calls.includes('damage') && !f.calls.includes('income') && !f.calls.includes('penalty'));
  });
}

test('a result cannot settle after the state has left battle', () => {
  const f = fixture();
  f.state.mode = 'novel';
  assert.equal(f.settle(f.result), 'scene-27-boss');
  assert.equal(f.state.points, 500);
});

test('replayed receipt cannot charge humanity or award twice', () => {
  const f = fixture();
  f.state.lastBattleResultId = 'attempt-1';
  assert.equal(f.settle(f.result), 'scene-27-boss');
  assert.equal(f.state.hp, 100);
  assert.equal(f.state.points, 500);
});

test('existing zero humanity is still resolved on a loss', () => {
  const f = fixture({ hp: 0, status: 'lose' });
  assert.equal(f.settle(f.result), 'ending-d');
  assert.equal(f.state.points, 200);
  assert.equal(f.state.flags.endingCause, 'humanity');
});

test('shared tuning controls preview damage and penalties', () => {
  const win = fixture({ tuning: { battleBaseDrain: 8, battleHitDrain: 3 } });
  win.settle(win.result);
  assert.equal(win.state.hp, 86);
  const lose = fixture({ status: 'lose', tuning: { battleFailPenalty: 125 } });
  lose.settle(lose.result);
  assert.equal(lose.state.points, 375);
});
console.log('\n' + checks + ' passed');
