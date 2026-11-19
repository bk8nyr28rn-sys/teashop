// 捏人台和游戏共用的输入校验。DEFAULT、OPT、DRAW_LAYERS 来自页面的共享画人代码。
function validatedLook(raw) {
  function requireValid(condition) {
    if (!condition) throw new Error('形象数据格式不正确');
  }
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  requireValid(record(raw) && Object.keys(DEFAULT).some(key => Object.hasOwn(raw, key)));
  const look = { ...DEFAULT };
  for (const [key, fallback] of Object.entries(DEFAULT)) {
    if (!Object.hasOwn(raw, key)) continue; // 旧捏人码缺少的新部件使用默认值
    const value = raw[key];
    if (Object.hasOwn(OPT, key)) requireValid(OPT[key].some(([id]) => id === value));
    else if (typeof fallback === 'string') requireValid(color(value));
    else if (typeof fallback === 'boolean') requireValid(typeof value === 'boolean');
    else {
      const min = ['eyeRot', 'browTilt', 'moleX', 'moleY'].includes(key) ? -1 : 0;
      const personality = /^p[A-Z]/.test(key);
      requireValid(Number.isFinite(value) && value >= min && value <= (personality ? 7 : 1));
      if (personality) requireValid(Number.isInteger(value));
    }
    look[key] = value;
  }
  look.draw = validatedDraw(raw.draw);
  return look;
}

// 限额只计算随人物保存的有效数据，编辑器在一笔结束时也使用同一规则。
const DRAW_MAX_BYTES = 192 * 1024;
function checkDrawBudget(draw) {
  let points = 0, strokes = 0;
  for (const [key] of DRAW_LAYERS) {
    const layer = draw[key];
    if (layer == null) continue;
    if (!Array.isArray(layer)) throw new Error('画层格式不正确');
    strokes += layer.length;
    if (strokes > 1800) throw new Error('这个人物的手绘最多 1800 笔');
    for (const stroke of layer) {
      if (!Array.isArray(stroke?.p)) throw new Error('笔画格式不正确');
      if (stroke.p.length > 4096) throw new Error('一笔最多 4096 个点');
      points += stroke.p.length;
      if (points > 20000) throw new Error('这个人物的手绘最多 20000 个点');
    }
  }
  // 规范化后的字段、颜色、坐标和绑定名均为 ASCII。
  if (JSON.stringify(draw).length > DRAW_MAX_BYTES) throw new Error('这个人物的手绘最多 192 KiB');
}
function validatedDraw(raw) {
  const out = emptyDraw();
  if (raw == null) return out;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function requireDraw(ok) { if (!ok) throw new Error('手绘数据格式不正确'); }
  requireDraw(record(raw) && (raw.v == null || raw.v === 1 || raw.v === 2));
  checkDrawBudget(raw);
  for (const flag of ['hide', 'customOnly', 'baseExpr', 'bindings', 'omitExpr']) {
    if (raw[flag] != null) requireDraw(record(raw[flag]));
  }
  for (const [key,, bone] of DRAW_LAYERS) {
    if (Object.hasOwn(raw.bindings || {}, key)) requireDraw(raw.bindings[key] === bone);
    if (Object.hasOwn(raw.customOnly || {}, key)) {
      requireDraw(typeof raw.customOnly[key] === 'boolean');
      out.customOnly[key] = raw.customOnly[key];
    }
    if (raw[key] == null) continue;
    // 旧脸层以头部中心为原点、半高为单位；原画板宽高均为 2.9 个单位。
    const legacyFace = raw.v !== 2 && (key === 'face' || /^h[1-4]$/.test(key));
    const round = value => Math.round(value * 1000000) / 1000000;
    out[key] = raw[key].map(stroke => {
      requireDraw(record(stroke) && color(stroke.c) && Number.isFinite(stroke.w) && stroke.w >= 0 && stroke.w <= 1);
      requireDraw(stroke.fill == null || color(stroke.fill));
      requireDraw(stroke.w > 0 || Boolean(stroke.fill));
      const points = stroke.p.map(point => {
        requireDraw(Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
        return legacyFace ? [round((point[0] + 1.45) / 2.9), round((point[1] + 1.5) / 2.9)] : [point[0], point[1]];
      });
      return { c: stroke.c, w: legacyFace ? stroke.w / 2.9 : stroke.w, p: points, ...(stroke.fill ? { fill: stroke.fill } : {}) };
    });
  }
  for (const key of HAND_SLOTS) {
    if (Object.hasOwn(raw.hide || {}, key)) {
      requireDraw(typeof raw.hide[key] === 'boolean');
      out.hide[key] = raw.hide[key];
    }
    if (raw.baseExpr?.[key] != null) {
      requireDraw(EXPRESSIONS.some(([id]) => id === raw.baseExpr[key]));
      out.baseExpr[key] = raw.baseExpr[key];
      if (!Object.hasOwn(raw.hide || {}, key)) out.hide[key] = false;
    }
    if (raw.omitExpr?.[key] != null) {
      const parts = raw.omitExpr[key];
      requireDraw(Array.isArray(parts) && parts.every(part => ['eyes','brows','mouth','fx'].includes(part)));
      out.omitExpr[key] = [...new Set(parts)];
    }
  }
  checkDrawBudget(out);
  return out;
}

function isAvatarPeer(event, peer) {
  if (!peer || event.source !== peer || event.data?.channel !== 'wulin-avatar') return false;
  if (location.protocol === 'file:') return event.origin === 'null' || event.origin === 'file://';
  return event.origin === location.origin;
}
function sendAvatar(peer, type, fields = {}) {
  // file: 页面的来源不可指定为 targetOrigin。接收方仍逐次核对绑定的窗口。
  peer.postMessage({ channel: 'wulin-avatar', type, ...fields }, location.protocol === 'file:' ? '*' : location.origin);
}
