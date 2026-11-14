import {
  HOURS_PER_DAY,
  canAttemptTribulation,
  doorPower,
  formationUpgradeCost,
  isInRetreat,
  otherSide,
  threadsOf,
  tribulationRequirement,
  type Heir,
  type Thread,
} from '../core';
import { Game, ME, SPEED_LABEL, type Speed } from './game';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const STAKES = [20, 50, 100, 200];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ''));

export function clock(hour: number): string {
  const day = Math.floor(hour / HOURS_PER_DAY);
  const h = hour % HOURS_PER_DAY;
  return `第 ${day + 1} 天 · ${WEEKDAYS[day % 7]} ${String(h).padStart(2, '0')}:00`;
}

/** 正在确认剪线 / 拉黑的那根线（两步确认，页面里不能用 confirm 弹窗） */
let confirming: { kind: 'cut' | 'block'; id: string } | null = null;

export function render(game: Game, root: HTMLElement): void {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const active = threadsOf(w, ME);
  const cutThreads = threadsOf(w, ME, false).filter((t) => t.state === 'cut' && t.cutAt !== null);
  const heirs = [...w.heirs.values()].filter((h) => h.parents.includes(ME));
  const proposal = [...w.snatchProposals.values()].find((p) => p.target === ME);
  const injured = me.members.filter((m) => m.injuredUntil > w.hour).length;
  const retreating = isInRetreat(w, me);
  const need = tribulationRequirement(w, me);
  const quota = w.config.retreat.daysPerWindow - me.retreatDaysUsed;

  const status: string[] = [];
  if (retreating) status.push(chip('闭关中', 'jade'));
  if (me.graceActionsLeft > 0) status.push(chip(`劫后余生 · 还剩 ${me.graceActionsLeft} 次行动`, 'gold'));
  if (me.guardianKnocks > 0) status.push(chip(`护宅怨灵 × ${me.guardianKnocks}`, 'jade'));
  if (me.formationDamage > 0) status.push(chip(`阵法受损 ${me.formationDamage}`, 'ember'));
  if (injured > 0) status.push(chip(`${injured} 位族人疗伤中`, 'ember'));
  if (me.grudge >= w.config.ghosts.omenGrudge) status.push(chip('怨气深重，怨灵将至', 'cinnabar'));

  root.innerHTML = `
  <header class="bar">
    <div class="brand"><span class="seal">守</span><div><h1>红线守宅</h1><p class="sub">融合玩法原型 · ${esc(clock(w.hour))}</p></div></div>
    <div class="speed" role="group" aria-label="时间流速">
      ${(['pause', 'real', 'fast', 'turbo'] as Speed[])
        .map((s) => `<button id="speed-${s}" data-act="speed" data-v="${s}" aria-pressed="${game.speed === s}">${SPEED_LABEL[s]}</button>`)
        .join('')}
    </div>
  </header>

  ${game.notice ? `<p class="notice tone-${game.notice.tone}" role="status">${esc(game.notice.text)}</p>` : ''}

  ${
    proposal
      ? `<section class="panel snatch">
      <h2>抢亲</h2>
      <p>${esc(w.houses.get(proposal.by)?.name ?? '有人')}来抢亲：答应的话，你和现在搭档的线按剪线处理，再和 TA 牵新线。</p>
      <div class="row"><button id="snatch-yes" data-act="snatch" data-id="${proposal.id}" data-v="1">答应</button>
      <button id="snatch-no" class="primary" data-act="snatch" data-id="${proposal.id}" data-v="0">回绝</button></div>
    </section>`
      : ''
  }

  <section class="stats" aria-label="家底">
    ${stat('灵石', fmt(me.stones), `打坐每时辰 ${w.config.economy.meditationPerHour}`)}
    ${stat('诡心', String(me.ghostHearts), '打野鬼掉落，炼丹用')}
    ${stat('怨丝', fmt(me.grudge), `今日已生 ${fmt(me.grudgeToday)} / ${w.config.grudge.dailyCap}`, me.grudge >= w.config.ghosts.omenGrudge ? 'warn' : '')}
    ${stat('护宅大阵', fmt(doorPower(w, me)), `符阵 ${me.formationLevel} 级`)}
    ${stat('境界', String(me.realm), `修为 ${fmt(me.cultivationProgress)} / ${fmt(need)}`)}
  </section>
  ${status.length ? `<div class="chips">${status.join('')}</div>` : ''}

  <div class="grid">
    <div class="col">
      <section class="panel">
        <h2>红线 <span class="count">${active.length}</span></h2>
        ${active.length ? active.map((t) => threadCard(game, t)).join('') : '<p class="empty">还没有红线。到下面“牵线”和散修牵一根，或等好友来。</p>'}
        ${cutThreads.map((t) => cutCard(game, t)).join('')}
        <form class="tie" data-form="tie">
          <label for="npc-name">牵线</label>
          <input id="npc-name" name="npc" placeholder="散修的名字，如“云游客”" maxlength="8" autocomplete="off">
          <button id="tie-npc" type="submit">和散修牵线</button>
        </form>
        <p class="hint">你的 OC 现在是“${me.openness === 'open' ? '开放' : '专一'}”。<button id="toggle-open" class="link" data-act="openness">改为${me.openness === 'open' ? '专一' : '开放'}</button>
        ${me.openness === 'devoted' ? '（专一时白露可能来抢亲）' : ''}</p>
      </section>

      <section class="panel">
        <h2>家族</h2>
        <p>族人 <b>${me.members.length}</b> 位${injured ? `，其中 ${injured} 位疗伤中` : ''}。族人由红线结成，修为越高，大阵越厚。</p>
        ${me.members.length ? `<ul class="members">${me.members.slice(-6).reverse().map((m) => `<li><span>${esc(parentNames(game, m.parents))} 所结</span><span class="num">修为 ${fmt(m.cultivation)}${m.injuredUntil > w.hour ? ' · 疗伤' : ''}</span></li>`).join('')}</ul>` : ''}
        ${heirs.map((h) => heirCard(game, h)).join('')}
      </section>
    </div>

    <div class="col">
      <section class="panel">
        <h2>行动</h2>
        <div class="actions">
          ${act('collect', '收灵石', '收打坐所得，修为一并增长')}
          ${act('upgrade', `升符阵（${formationUpgradeCost(w, me)} 灵石）`, '大阵更厚', me.formationDamage > 0 || me.stones < formationUpgradeCost(w, me))}
          ${act('repair', `修阵法（每处 ${w.config.economy.repairCostPerDamage}）`, '门被砸破后要修', me.formationDamage === 0)}
          ${act('heal', `炼疗伤丹（${w.config.economy.healingPillHearts} 诡心）`, '族人立刻痊愈', injured === 0 || me.ghostHearts < w.config.economy.healingPillHearts)}
          ${act('pill', `炼破境丹（${w.config.economy.breakthroughPillHearts} 诡心）`, `已有 ${me.breakthroughPills} 颗，渡劫时加胜算`, me.ghostHearts < w.config.economy.breakthroughPillHearts)}
          ${act('tribulation', '渡劫', canAttemptTribulation(w, ME).ok ? '打赢一只大鬼即突破，可叫一位搭档护法' : me.tribulationCooldownUntil > w.hour ? '上次失败，冷却中' : '修为还没攒满', !canAttemptTribulation(w, ME).ok, 'primary')}
          ${act('retreat1', '闭关 1 天', `本月额度还剩 ${quota} 天`, quota < 1 || retreating)}
          ${act('retreat3', '闭关 3 天', '闭关期间红线冻结、鬼不登门', quota < 3 || retreating)}
        </div>
      </section>

      <section class="panel log">
        <h2>戏文</h2>
        <ol>${game.log
          .slice(0, 40)
          .map((l) => `<li class="tone-${l.tone}"><time>${esc(clock(l.hour).replace(/^第 (\d+) 天 · \S+ /, '第$1天 '))}</time>${esc(l.text)}</li>`)
          .join('')}</ol>
      </section>
    </div>
  </div>

  <footer class="foot">
    <p>原型说明：阿青是一位机器人玩家，每天上线 3 次（9、13、21 点），会回应你、主动找你、和你一起守宅。白露在你设为“专一”时偶尔来抢亲。存档只存在这台设备的浏览器里，关掉页面后，按离开时的流速补算离线时间（最多 14 天）。</p>
    <button id="new-game" class="link" data-act="newgame">新开一局</button>
  </footer>`;
}

function chip(text: string, tone: string): string {
  return `<span class="chip chip-${tone}">${esc(text)}</span>`;
}

function stat(label: string, value: string, note: string, cls = ''): string {
  return `<div class="stat ${cls}"><span class="label">${label}</span><span class="value num">${value}</span><span class="note">${esc(note)}</span></div>`;
}

function act(id: string, label: string, note: string, disabled = false, cls = ''): string {
  return `<button id="act-${id}" class="action ${cls}" data-act="${id}" ${disabled ? 'disabled' : ''}><span>${esc(label)}</span><small>${esc(note)}</small></button>`;
}

function partnerName(game: Game, t: Thread): string {
  const other = otherSide(t, ME);
  return other ? game.world.houses.get(other)?.name ?? other : t.npcName ?? '散修';
}

function parentNames(game: Game, parents: [string, string]): string {
  return parents.map((p) => game.world.houses.get(p)?.name ?? p).join(' 与 ');
}

/** 红线条：按浓度 0–200 画，刻度落在每一级的下限上 */
function threadBar(game: Game, t: Thread): string {
  const cfg = game.world.config;
  const max = cfg.thread.goldenThreshold;
  const pct = Math.min(100, (t.strands / max) * 100);
  const ticks = cfg.tiers.mins
    .slice(1)
    .map((m, i) => `<span class="tick" style="left:${(m / max) * 100}%" title="${cfg.tiers.names[i + 1]}"></span>`)
    .join('');
  return `<div class="bar-track${t.golden ? ' golden' : ''}" role="img" aria-label="红线浓度 ${fmt(t.strands)} / ${max}"><span class="fill" style="width:${pct}%"></span>${ticks}</div>`;
}

function threadCard(game: Game, t: Thread): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const name = partnerName(game, t);
  const tier = w.config.tiers.names[t.tier] ?? '';
  const pending = t.pendingRequest;
  const theyAsked = pending && pending.from !== ME;
  const iAsked = pending && pending.from === ME;
  const q = t.quarrel;
  const iMadeUp = q?.reconciled.includes(ME);
  const isReal = t.b !== null;
  const canSign = isReal && !t.heirId && t.strands >= w.config.heir.strandThreshold && !t.heirSignatures.includes(ME);
  const confirmCut = confirming?.kind === 'cut' && confirming.id === t.id;
  const other = otherSide(t, ME);
  const confirmBlock = other && confirming?.kind === 'block' && confirming.id === other;

  const badges: string[] = [];
  if (theyAsked) badges.push(chip('等你回话', 'cinnabar'));
  if (iAsked) badges.push(chip(isReal ? '已传话，待 TA 回' : '散修稍后回话', 'muted'));
  if (q) badges.push(chip(iMadeUp ? '你已递台阶' : '争执中 · 变脸', 'ember'));
  if (t.heirSignatures.length && !t.heirId) badges.push(chip(`嫡传签署 ${t.heirSignatures.length}/2`, 'gold'));
  if (t.golden) badges.push(chip('金缕', 'gold'));

  return `<article class="thread${q ? ' quarrel' : ''}">
    <div class="thread-head">
      <div><b>${esc(name)}</b> <span class="tier tier-${t.tier}">${esc(tier)}</span> <span class="kind">${isReal ? '好友' : 'NPC'}</span></div>
      <span class="num strands">${fmt(t.strands)}<small> / ${w.config.thread.goldenThreshold}</small></span>
    </div>
    ${threadBar(game, t)}
    ${badges.length ? `<div class="chips">${badges.join('')}</div>` : ''}
    <div class="row">
      <button id="talk-${t.id}" data-act="talk" data-id="${t.id}">${theyAsked ? '回话' : '传话'}</button>
      <button id="risky-${t.id}" data-act="risky" data-id="${t.id}" title="增长翻倍，但可能说岔">${theyAsked ? '回句玩笑' : '开个玩笑'}</button>
      ${q && !iMadeUp ? `<button id="makeup-${t.id}" class="primary" data-act="makeup" data-id="${t.id}">和好</button>` : ''}
      ${canSign ? `<button id="sign-${t.id}" class="gold" data-act="sign" data-id="${t.id}">签署结嫡传</button>` : ''}
    </div>
    <div class="row stakes" aria-label="大互动押注">
      <span class="label">大互动押</span>
      ${STAKES.map((s) => `<button id="big-${t.id}-${s}" data-act="big" data-id="${t.id}" data-v="${s}" ${me.stones < s ? 'disabled' : ''}>${s}</button>`).join('')}
      <span class="hint">成功率 ${Math.round(w.config.big.baseSuccess * 100)}%${isReal ? `，${name}在场 +${Math.round(w.config.big.coPresenceBonus * 100)}%` : ''}</span>
    </div>
    <div class="row danger">
      ${confirmCut ? `<button id="cut-yes-${t.id}" class="warn" data-act="cut-yes" data-id="${t.id}">确认剪线</button><button id="cut-no-${t.id}" data-act="cancel">算了</button>` : `<button id="cut-${t.id}" class="link" data-act="cut" data-id="${t.id}">剪线</button>`}
      ${other ? (confirmBlock ? `<button id="block-yes-${other}" class="warn" data-act="block-yes" data-id="${other}">确认拉黑（不可撤回）</button><button id="block-no-${other}" data-act="cancel">算了</button>` : `<button id="block-${other}" class="link" data-act="block" data-id="${other}">拉黑</button>`) : ''}
    </div>
  </article>`;
}

function cutCard(game: Game, t: Thread): string {
  const w = game.world;
  const left = w.config.cut.reconcileWindowDays * HOURS_PER_DAY - (w.hour - (t.cutAt ?? w.hour));
  if (left <= 0) return '';
  return `<article class="thread cut">
    <div class="thread-head"><div><b>${esc(partnerName(game, t))}</b> <span class="kind">已剪线</span></div><span class="hint">还剩 ${Math.ceil(left / HOURS_PER_DAY)} 天可复合</span></div>
    <div class="row"><button id="reunite-${t.id}" class="primary" data-act="reunite" data-id="${t.id}">复合</button></div>
  </article>`;
}

function heirCard(game: Game, h: Heir): string {
  const w = game.world;
  const names = parentNames(game, h.parents);
  const home = h.home ? (h.home === ME ? '你家' : `${w.houses.get(h.home)?.name ?? h.home}家`) : null;
  return `<div class="heir">
    <p><b>嫡传</b>（${esc(names)}）· 灵根 ${fmt(h.spiritualRoot)} · 特质 ${esc(h.traitKinds.join('、') || '无')}</p>
    ${home ? `<p class="hint">记在${esc(home)}族谱。</p>` : `<div class="row"><span class="label">两人商量记在哪家：</span>${h.parents.map((p) => `<button id="home-${h.id}-${p}" data-act="home" data-id="${h.id}" data-v="${p}">${p === ME ? '你家' : esc(w.houses.get(p)?.name ?? p) + '家'}</button>`).join('')}</div>`}
  </div>`;
}

export function bind(game: Game, root: HTMLElement, rerender: () => void): void {
  root.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const id = el.dataset.id ?? '';
    const v = el.dataset.v ?? '';
    const a = el.dataset.act;
    if (a !== 'cut' && a !== 'block') confirming = null;
    switch (a) {
      case 'speed': game.setSpeed(v as Speed); break;
      case 'collect': game.collect(); break;
      case 'upgrade': game.upgrade(); break;
      case 'repair': game.repair(); break;
      case 'heal': game.healPill(); break;
      case 'pill': game.breakPill(); break;
      case 'tribulation': game.tribulation(); break;
      case 'retreat1': game.retreat(1); break;
      case 'retreat3': game.retreat(3); break;
      case 'openness': game.toggleOpenness(); break;
      case 'talk': game.talk(id, false); break;
      case 'risky': game.talk(id, true); break;
      case 'big': game.big(id, Number(v)); break;
      case 'makeup': game.makeUp(id); break;
      case 'sign': game.sign(id); break;
      case 'home': game.setHome(id, v); break;
      case 'reunite': game.reunite(id); break;
      case 'snatch': game.answerSnatch(id, v === '1'); break;
      case 'cut': confirming = { kind: 'cut', id }; break;
      case 'cut-yes': game.cut(id); break;
      case 'block': confirming = { kind: 'block', id }; break;
      case 'block-yes': game.block(id); break;
      case 'cancel': break;
      case 'newgame': game.newGame(); break;
    }
    rerender();
  });
  root.addEventListener('submit', (ev) => {
    const form = ev.target as HTMLFormElement;
    if (form.dataset.form !== 'tie') return;
    ev.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#npc-name');
    game.tieNpc(input?.value ?? '');
    rerender();
  });
}
