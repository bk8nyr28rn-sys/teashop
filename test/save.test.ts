import { describe, expect, it } from 'vitest';
import {
  addHouse,
  advanceHour,
  createWorld,
  describeEvent,
  deserializeWorld,
  serializeWorld,
  tieThread,
  addStrands,
  interact,
  type GameEvent,
  type World,
} from '../src/core';

function busyWorld(): World {
  const w = createWorld({ seed: 11 });
  addHouse(w, { id: 'me', name: '你', stones: 200 });
  addHouse(w, { id: 'qing', name: '阿青' });
  const t = tieThread(w, 'me', { kind: 'friend', house: 'qing' });
  const n = tieThread(w, 'me', { kind: 'npc', name: '散修' });
  if (!t.ok || !n.ok) throw new Error();
  addStrands(w, t.value, 70);
  addStrands(w, n.value, 35);
  w.houses.get('me')!.grudge = 25;
  return w;
}

describe('存档', () => {
  it('读档后继续玩，结果和不存档完全一样（包括随机数）', () => {
    const a = busyWorld();
    for (let i = 0; i < 200; i++) advanceHour(a);
    const b = deserializeWorld(serializeWorld(a));
    for (let i = 0; i < 500; i++) {
      advanceHour(a);
      advanceHour(b);
    }
    expect(serializeWorld(b)).toBe(serializeWorld(a));
  });

  it('读档后规则照常运作', () => {
    const w = deserializeWorld(serializeWorld(busyWorld()));
    const t = [...w.threads.values()].find((x) => x.b === 'qing')!;
    interact(w, 'me', t.id);
    expect(t.pendingRequest?.from).toBe('me');
  });

  it('版本不对时拒绝读档', () => {
    const data = JSON.parse(serializeWorld(busyWorld()));
    data.version = 999;
    expect(() => deserializeWorld(JSON.stringify(data))).toThrow();
  });
});

describe('事件提示', () => {
  it('搭档传话、回话、递台阶时，戏文里有提示；自己的不提示', () => {
    const w = busyWorld();
    const seen: GameEvent[] = [];
    w.listener = (e) => seen.push(e);
    const t = [...w.threads.values()].find((x) => x.b === 'qing')!;
    interact(w, 'qing', t.id);
    interact(w, 'me', t.id);
    const request = seen.find((e) => e.type === 'interaction' && e.kind === 'request');
    const reply = seen.find((e) => e.type === 'interaction' && e.kind === 'reply');
    expect(describeEvent(w, request!, 'me')?.text).toContain('阿青');
    expect(describeEvent(w, reply!, 'me')).toBeNull();
  });

  it('和我有关的事件都有一句话，和我无关的返回 null', () => {
    const w = busyWorld();
    const seen: GameEvent[] = [];
    w.listener = (e) => seen.push(e);
    for (let i = 0; i < 24 * 30; i++) advanceHour(w);
    expect(seen.length).toBeGreaterThan(0);
    for (const e of seen) {
      const m = describeEvent(w, e, 'me');
      if (m) expect(m.text.length).toBeGreaterThan(4);
    }
    const breach = seen.find((e) => e.type === 'breach' && e.house === 'qing');
    if (breach) expect(describeEvent(w, breach, 'me')).toBeNull();
  });
});
