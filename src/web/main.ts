import { Game } from './game';
import { syncRaid } from './raidview';
import { REGIONS, bind, render, type Region } from './ui';

const app = document.getElementById('app')!;
const game = new Game();
const last: Partial<Record<Region, string>> = {};

/**
 * 只重画内容变了的区域。重画时保住输入框里正在打的字、焦点和滚动位置，
 * 并把循环动画对齐到同一个时间起点，免得每次重画都从头跳一下。
 */
function patch(id: Region, html: string): void {
  if (last[id] === html) return;
  const el = document.getElementById(id);
  if (!el) return;
  const active = document.activeElement;
  const inputs = [...el.querySelectorAll<HTMLInputElement>('input[id]')].map((i) => ({
    id: i.id,
    value: i.value,
    focused: i === active,
    start: i.selectionStart,
    end: i.selectionEnd,
  }));
  const scrolls = [...el.querySelectorAll<HTMLElement>('[data-keep-scroll][id]')].map((n) => ({ id: n.id, top: n.scrollTop }));

  el.innerHTML = html;
  el.style.setProperty('--sync', `-${Math.round(performance.now())}ms`);

  for (const s of inputs) {
    const i = document.getElementById(s.id) as HTMLInputElement | null;
    if (!i) continue;
    i.value = s.value;
    if (s.focused) {
      i.focus();
      try {
        i.setSelectionRange(s.start, s.end);
      } catch {
        // 有的输入框类型不支持选区，忽略
      }
    }
  }
  for (const s of scrolls) {
    const n = document.getElementById(s.id);
    if (n) n.scrollTop = s.top;
  }
  last[id] = html;
}

function rerender(): void {
  const frame = render(game);
  for (const id of REGIONS) patch(id, frame[id]);
}

bind(game, app, rerender);
rerender();

/** 手指或鼠标按住时不重画：按下和松开之间如果按钮被换掉，这次点击就丢了 */
let pressing = false;
app.addEventListener('pointerdown', () => (pressing = true));
const release = () => {
  pressing = false;
  // 等这次点击先处理完再重画
  setTimeout(rerender, 0);
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

setInterval(() => {
  game.tick();
  // 守夜局有自己的逐帧画面；打的时候底下的页面不用重画
  syncRaid(game, app, rerender);
  if (!pressing && !game.raid) rerender();
}, 100);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    game.sessionCheckIn();
    rerender();
  } else {
    game.save();
  }
});
window.addEventListener('pagehide', () => game.save());
