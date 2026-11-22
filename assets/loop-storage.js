// 游戏进度和夜账共用一把跨标签锁。临时快照让同一次点击中的后续读取看到刚保存的进度。
const LoopStorage = (() => {
  const slot = 'wulin-loop';
  const pendingPrefix = slot + ':pending:';
  let queued = null, locked = false, database, tail = Promise.resolve();
  function readDisk() {
    try { return JSON.parse(localStorage.getItem(slot)); }
    catch (error) { if (error instanceof SyntaxError) return null; throw error; }
  }
  const read = () => (!locked && queued) || readDisk();
  const revision = () => Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  function mergeAccount(snapshot, disk, reset) {
    if (!disk?.account || reset) return;
    snapshot.account.guideSeen = [...new Set([...(disk.account.guideSeen || []), ...(snapshot.account.guideSeen || [])])];
    if (disk.account.lastGrantDate > snapshot.account.lastGrantDate)
      LoopCore.accrueDays(snapshot.account, disk.account.lastGrantDate);
    if (disk.account.lastActiveDate > (snapshot.account.lastActiveDate || ''))
      snapshot.account.lastActiveDate = disk.account.lastActiveDate;
  }

  function lockInDatabase(run) {
    database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('wulin-loop-lock', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('writer');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database.then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('writer', 'readwrite');
      let result, failure;
      tx.objectStore('writer').get('turn').onsuccess = () => {
        try { result = run(); } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error);
    }));
  }
  function exclusive(callback) {
    const run = () => {
      locked = true;
      try { return callback(); } finally { locked = false; }
    };
    const job = tail.then(() => navigator.locks
      ? navigator.locks.request(slot, run) : lockInDatabase(run));
    tail = job.catch(() => {});
    return job;
  }
  function write(archive, expected, onStale, reset = false) {
    const snapshot = structuredClone(archive);
    const commit = () => {
      const disk = readDisk();
      if (disk?.revision === snapshot.revision) return true;
      if ((disk?.revision ?? null) !== expected) { onStale(); return false; }
      mergeAccount(snapshot, disk, reset);
      localStorage.setItem(slot, JSON.stringify(snapshot));
      return true;
    };
    if (locked) return commit();
    // 点击刚获反馈就关闭/刷新时，浏览器可能撤销尚未取得的锁。先留下待提交记录。
    const key = pendingPrefix + snapshot.revision;
    localStorage.setItem(key, JSON.stringify({ expected, reset, snapshot }));
    queued = snapshot;
    return exclusive(() => {
      const result = commit();
      localStorage.removeItem(key);
      return result;
    }).finally(() => { if (queued === snapshot) queued = null; });
  }
  function updateAccount(change) {
    const apply = () => {
      const disk = readDisk();
      if (disk?.v === 4 && change(disk.account)) localStorage.setItem(slot, JSON.stringify(disk));
    };
    if (locked) { apply(); return Promise.resolve(); }
    return exclusive(apply);
  }
  // 只恢复能接在当前版本之后的操作；另一标签已推进的旧分支不能覆盖现有进度。
  const interrupted = Object.keys(localStorage).filter(k => k.startsWith(pendingPrefix));
  if (interrupted.length) {
    const records = interrupted.map(k => JSON.parse(localStorage.getItem(k))).filter(Boolean);
    function replay() {
      let disk = readDisk(), next;
      while ((next = records.find(r => r.expected === (disk?.revision ?? null)))) {
        const snapshot = structuredClone(next.snapshot);
        mergeAccount(snapshot, disk, next.reset);
        disk = snapshot;
      }
      return disk;
    }
    const recovered = queued = replay();
    exclusive(() => {
      const latest = replay();
      if (latest && latest.revision !== readDisk()?.revision) localStorage.setItem(slot, JSON.stringify(latest));
      for (const key of interrupted) localStorage.removeItem(key);
      if (queued === recovered) queued = null;
    });
  }
  return { read, revision, exclusive, write, updateAccount };
})();
