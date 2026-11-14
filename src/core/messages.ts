import type { GameEvent, HouseId, Thread, World } from './types';

export type Tone = 'good' | 'bad' | 'drama' | 'info';

export interface Message {
  text: string;
  tone: Tone;
}

/**
 * 把事件写成玩家看得懂的一句话（戏文腔，原创，不引现成唱词）。
 * me 是“我”的家族 id：和我无关的事件返回 null。
 */
export function describeEvent(world: World, e: GameEvent, me: HouseId): Message | null {
  const name = (id: HouseId | null | undefined) => (id ? world.houses.get(id)?.name ?? id : '散修');
  const thread = (id: string): Thread | undefined => world.threads.get(id);
  const partnerOf = (t: Thread | undefined) => (t ? (t.a === me ? (t.b ? name(t.b) : t.npcName ?? '散修') : name(t.a)) : 'TA');
  const mine = (t: Thread | undefined) => !!t && (t.a === me || t.b === me);
  const tierName = (i: number) => world.config.tiers.names[i] ?? '';

  switch (e.type) {
    case 'knock':
      if (e.house !== me) return null;
      if (e.kind === 'spirit') {
        return { text: e.omen ? '门外传来指甲刮门声，一声紧过一声，怨灵来了。' : '一缕怨气凝成怨灵，撞上门来。', tone: 'drama' };
      }
      return { text: '野鬼夜行，正撞在你家门上。', tone: 'drama' };
    case 'defended':
      if (e.house !== me) return null;
      if (e.kind === 'wild') return { text: '符阵一亮，野鬼溃散，拾得一颗诡心。', tone: 'good' };
      return { text: `打散怨灵，${e.strandsReturned.toFixed(1)} 缕情丝回到线上。`, tone: 'good' };
    case 'purified':
      if (e.house !== me) return null;
      return { text: `你与${partnerOf(thread(e.helper))}并肩，不打而化，怨灵反来护宅。`, tone: 'good' };
    case 'guarded':
      if (e.house !== me) return null;
      return { text: '被感化的怨灵挡在门前，替你守住了这一回。', tone: 'good' };
    case 'breach':
      if (e.house !== me) return null;
      return {
        text: `护宅大阵被破${e.online ? '' : '（你不在时）'}，失了 ${e.stonesLost} 灵石，阵法受损${(world.houses.get(me)?.members.length ?? 0) > 0 ? '，族人受伤' : ''}。劫后余生，暂得安宁。`,
        tone: 'bad',
      };
    case 'grudgeAdded':
      if (e.house !== me || e.dissipated <= 0) return null;
      return { text: `今日怨气已满，多出的 ${e.dissipated.toFixed(1)} 缕随风散了。`, tone: 'info' };
    case 'neglect': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return e.neglecter === me
        ? { text: `${partnerOf(t)}等你回话已久，红线淡了几分。`, tone: 'bad' }
        : { text: `${partnerOf(t)}迟迟没有回音，红线淡了几分。`, tone: 'bad' };
    }
    case 'cut': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return { text: `与${partnerOf(t)}的红线剪断了，散作怨丝。期限内若双方回心，仍可复合。`, tone: 'bad' };
    }
    case 'reconciled': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return { text: `与${partnerOf(t)}重牵红线，破镜重圆。`, tone: 'good' };
    }
    case 'severed':
      if (e.by !== me && e.other !== me) return null;
      return { text: '一刀两断，此后不相往来。', tone: 'info' };
    case 'memberBorn':
      if (e.house !== me) return null;
      return { text: `与${partnerOf(thread(e.thread))}的情丝结出一位族人，家中又添人丁。`, tone: 'good' };
    case 'heirBorn': {
      const heir = world.heirs.get(e.heir);
      if (!heir || !heir.parents.includes(me)) return null;
      return { text: `锣鼓齐鸣，《小送子》开台：你与${partnerOf(thread(e.thread))}的嫡传降生了。`, tone: 'good' };
    }
    case 'heirHomeSet': {
      const heir = world.heirs.get(e.heir);
      if (!heir || !heir.parents.includes(me)) return null;
      return { text: `嫡传记入${e.home === me ? '你家' : name(e.home) + '家'}族谱。`, tone: 'info' };
    }
    case 'golden': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return { text: `金缕！你与${partnerOf(t)}的红线化作金丝，全服大封相。`, tone: 'good' };
    }
    case 'tierChanged': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return e.to > e.from
        ? { text: `与${partnerOf(t)}的关系进了一层：${tierName(e.to)}。`, tone: 'good' }
        : { text: `与${partnerOf(t)}的关系退了一层：${tierName(e.to)}。`, tone: 'bad' };
    }
    case 'interaction': {
      const t = thread(e.thread);
      if (!mine(t) || e.by === me) return null;
      const who = partnerOf(t);
      if (e.kind === 'request') return { text: `${who}捎来一句话，等你回音。`, tone: 'info' };
      if (e.kind === 'reply') return { text: `${who}回了你的话，红线添了几分。`, tone: 'good' };
      return { text: `${who}先递了台阶，就等你一句和好。`, tone: 'drama' };
    }
    case 'bigInteraction': {
      const t = thread(e.thread);
      if (e.by !== me) {
        if (!mine(t)) return null;
        const who = partnerOf(t);
        return e.success
          ? { text: `${who}为你们押上 ${e.stake} 灵石，唱了一出好戏，情丝 +${e.strandsGained.toFixed(1)}。`, tone: 'good' }
          : { text: `${who}为你们押上 ${e.stake} 灵石，可惜演砸了。`, tone: 'info' };
      }
      return e.success
        ? { text: `押上 ${e.stake} 灵石，一出好戏：情丝 +${e.strandsGained.toFixed(1)}${e.coPresent ? '（搭档在场）' : ''}。`, tone: 'good' }
        : { text: `押上 ${e.stake} 灵石，演砸了，失了 ${e.stonesLost} 灵石。`, tone: 'bad' };
    }
    case 'quarrel': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      return {
        text: `${e.cause === 'risky' ? '一句玩笑说岔了，' : '一场误会，'}你与${partnerOf(t)}翻了脸，红线散开几缕。`,
        tone: 'drama',
      };
    }
    case 'quarrelEnded': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      if (!e.reconciled) return { text: `与${partnerOf(t)}的别扭没能解开，散了的就散了。`, tone: 'bad' };
      return { text: `与${partnerOf(t)}和好如初${e.reunion ? '，破镜重圆' : ''}，聚回 ${e.restored.toFixed(1)} 缕。`, tone: 'good' };
    }
    case 'rival': {
      const t = thread(e.thread);
      if (!mine(t)) return null;
      const who = e.house === me ? '你' : partnerOf(t);
      if (e.outcome === 'purified') return { text: `有散修想抢${who}，你们情深，三言两语化了这段怨。`, tone: 'good' };
      if (e.outcome === 'defeated') return { text: `情敌上门要抢${who}，被打了回去，红线更稳了。`, tone: 'good' };
      return { text: `情敌上门要抢${who}，没能拦住，红线淡了。`, tone: 'bad' };
    }
    case 'snatchProposed':
      if (e.target !== me) return null;
      return { text: `${name(e.by)}来抢亲，要你剪了旧线随 TA 去。答不答应，由你。`, tone: 'drama' };
    case 'snatchResolved':
      return null;
    case 'tribulation':
      if (e.house !== me) return null;
      return e.success
        ? { text: `渡劫功成，《加官》贺喜：境界升至 ${e.realm}。`, tone: 'good' }
        : { text: '天劫未过，大阵受损，修为仍在，三日后可再试。', tone: 'bad' };
  }
}
