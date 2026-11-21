import { describe, expect, it } from 'vitest';
import { demonstrate, routes, trapsOnly } from '../../scripts/loop-night-bot.js';

describe('不同打法都能在完整五波中守住', () => {
  for (const route of routes) {
    it(route.name, () => {
      const games = Array.from({ length: 40 }, (_, trial) => demonstrate(route, trial));
      const demonstrated = games.filter(g => g.demonstrated);
      // 每个种子都开普通五波，清掉同特点鬼而且真的守住才算；没拿到指定本事也计入 40 局。
      expect(demonstrated.length).toBeGreaterThan(1);
      expect(demonstrated.every(g => g.won && g.qualifiedKills > 0)).toBe(true);
      if (route.passive) expect(games.every(g => g.taps === 0)).toBe(true);
      else expect(demonstrated.every(g => g.taps > 0)).toBe(true);
    });
  }
});

it('只装弩且零输入会卡在隐身鬼，装一串灯的同局号能守住', () => {
  const trial = { day: 1, door: 4, bows: 4, trial: 0 };
  const dark = trapsOnly(trial), lit = trapsOnly({ ...trial, lamp: 1 });
  expect(dark.result.won).toBe(false);
  expect(dark.wave).toBe(4);
  expect(dark.result.kills).toBeGreaterThan(0);
  expect(lit.result.won).toBe(true);
  expect(lit.wave).toBe(5);
  expect(lit.result.coins).toBe(0);
});
