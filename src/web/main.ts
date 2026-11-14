import { Game } from './game';
import { bind, render } from './ui';

const root = document.getElementById('app')!;
const game = new Game();

/** 输入框正在打字时不整页重画，免得把字吞掉 */
function rerender(): void {
  const focused = document.activeElement as HTMLInputElement | null;
  const typing = focused?.id === 'npc-name';
  const draft = typing ? focused!.value : (document.getElementById('npc-name') as HTMLInputElement | null)?.value ?? '';
  render(game, root);
  const input = document.getElementById('npc-name') as HTMLInputElement | null;
  if (input) {
    input.value = draft;
    if (typing) {
      input.focus();
      input.setSelectionRange(draft.length, draft.length);
    }
  }
}

bind(game, root, rerender);
rerender();

/** 手指或鼠标按住时不重画：极速下每 100 毫秒重画一次，按下和松开之间按钮被换掉，点击就丢了 */
let pressing = false;
let dirty = false;
root.addEventListener('pointerdown', () => (pressing = true));
const release = () => {
  pressing = false;
  if (dirty) {
    dirty = false;
    // 等这次点击先处理完再重画
    setTimeout(rerender, 0);
  }
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

setInterval(() => {
  if (!game.tick()) return;
  if (pressing) dirty = true;
  else rerender();
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
