// 院子的回访入口。日期、种子、浏览器写锁和画面在这里接入，收支均由规则核心记账。
function watchSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }

async function delegateNight() {
  const request = { houseId: G.houseId, lifeId: G.lifeId, day: G.day, nightId: G.nightId + 1 };
  const shownChance = LoopCore.defenseChance(G.day, G.door, G.traps);
  const shownLoss = LoopCore.autoLossLimit(G.chest, G.lifeNo);
  await withGameLock(() => {
    const latest = adoptStoredGame();
    if (!latest || G.houseId !== request.houseId || G.lifeId !== request.lifeId || G.day !== request.day) {
      location.reload(); return;
    }
    if (G.nightReceipt) { render(); showNightReceipt(G.nightReceipt); return; }
    if (G.phase !== 'home' || G.nightId + 1 !== request.nightId) { location.reload(); return; }
    if (shownChance !== LoopCore.defenseChance(G.day, G.door, G.traps) || shownLoss !== LoopCore.autoLossLimit(G.chest, G.lifeNo)) {
      render(); chooseNightWatch(); return;
    }
    const receipt = LoopCore.settleAutoNight(G, {
      ...request, mode: 'delegated', seed: watchSeed(), allowLoss: true, progress: true, realDate: localDateKey(),
    });
    if (!receipt) return;
    G.time = CFG.dusk;
    if (save()) { closeSheet(); render(); showNightReceipt(receipt); }
  }).catch(saveError);
}

function showHouseReports(page = 0) {
  const reports = Object.values(G.receipts).sort((a, b) => b.nightId - a.nightId);
  const start = page * 5;
  const buttons = reports.slice(start, start + 5).map(r => {
    const who = r.mode === 'offline' ? '离家时' : r.mode === 'delegated' ? '交给机关' : r.guardian ? '护家神' : '亲手守';
    return [`第 ${r.nightId} 夜 · ${who} · ${r.won ? '守住了' : '门破了'}`, () => {
      sheet({ title: '这晚的战报', buttons: [['返回战报', () => showHouseReports(page)]],
        bind: el => {
          for (const line of r.paragraphs) {
            const p = document.createElement('p'); p.textContent = line; el.querySelector('.sh-body').append(p);
          }
        } });
    }];
  });
  if (start) buttons.push(['上一页', () => showHouseReports(page - 1)]);
  if (reports.length > start + 5) buttons.push(['更早的战报', () => showHouseReports(page + 1)]);
  sheet({ title: '家里的战报', body: reports.length ? '' : '<p>家里还没有守夜战报。</p>', buttons: [...buttons, ['回院子', null]] });
}

function openReturnSummary(unread = false) {
  const summary = LoopCore.getAbsenceSummary(G, unread ? 'unread' : 'latest');
  if (!summary) {
    if (!unread) sheet({ title: '回家看看', body: '<p>还没有离家期间的来袭记录。</p>', buttons: [['知道了', null]] });
    return false;
  }
  const { days, raids, won, broken, chestLost, lastNightId } = summary;
  const facts = [won && `守住 ${won} 次`, broken && `门破 ${broken} 次`].filter(Boolean).join('，');
  const loss = chestLost ? `钱箱少了 ${chestLost} 文。` : '';
  const houseId = G.houseId;
  sheet({ title: '你不在的这段日子', focusTitle: true,
    body: `<p>离开 ${days} 天，鬼来砸了 ${raids} 次门。${facts}。${loss}</p><p>攒着的天：${G.bankedDays} / ${BANK_CAP}</p>`,
    buttons: [['知道了', async () => {
      await withGameLock(() => {
        const latest = storedGame();
        if (!latest || latest.houseId !== houseId) { location.reload(); return; }
        if (LoopCore.markAbsenceRead(latest, lastNightId)) {
          adoptStoredGame();
          LoopCore.markAbsenceRead(G, lastNightId);
          if (!save()) return;
        }
        if (unread && G.phase === 'haunt' && !H) startHaunt();
        else if (unread && G.nightReceipt) showNightReceipt(G.nightReceipt);
      }).catch(saveError);
    }, 'main']],
  });
  $('sheet').dataset.returnSummary = String(lastNightId);
  return true;
}

let visitPending = false, lastVisibleTick = Date.now();
function resumeScene() {
  if (G.phase === 'night' || G.phase === 'guard') return startNight(G.phase === 'guard');
  if (G.phase === 'haunt') { if (!openReturnSummary(true)) startHaunt(); return; }
  render();
  if (!openReturnSummary(true) && G.nightReceipt) showNightReceipt(G.nightReceipt);
}

// 连续在线跨午夜只领攒天；隐藏页的时钟不能替玩家签到。后台被系统挂起后按日期补记。
function visitCalendar(tick = false, initial = false) {
  if (document.hidden || visitPending) return;
  const now = Date.now(), today = localDateKey();
  const continuous = tick && now - lastVisibleTick >= 0 && now - lastVisibleTick < 150000;
  lastVisibleTick = now;
  if (G.lastActiveDate && today <= G.lastActiveDate) { updateCalendar(); if (initial) resumeScene(); return; }
  visitPending = true;
  return withGameLock(() => {
    const latest = storedGame();
    if (!latest) return;
    if (latest.lastActiveDate && today <= latest.lastActiveDate) {
      G.lastActiveDate = latest.lastActiveDate;
      if (latest.lifeId !== G.lifeId || latest.phase !== G.phase || latest.nightId !== G.nightId ||
          LoopCore.getAbsenceSummary(latest, 'unread')) {
        adoptStoredGame(); cancelAnimationFrame(raf); closeSheet(); resumeScene();
      } else if (initial) { adoptStoredGame(); resumeScene(); }
      else updateCalendar();
      return;
    }
    if (continuous) {
      LoopCore.markActiveDate(G, today);
      LoopStorage.updateAccount(account => {
        const bank = LoopCore.accrueDays(account, today);
        return LoopCore.markActiveDate(account, today) || bank;
      }).catch(saveError);
      updateCalendar();
      return;
    }
    adoptStoredGame();
    const changes = LoopCore.reconcileAbsence(G, today, watchSeed);
    if (changes.count && !G.nightPlan) delete G.battleResume;
    if (changes.count && G.phase === 'reborn') {
      G.reborn.rows = karmaRows();
      G.reborn.total = G.reborn.rows.reduce((sum, row) => sum + row[2], 0);
    }
    accrueDays();
    if (changes.changed && !save()) return;
    if (changes.count || initial) {
      cancelAnimationFrame(raf); N = null; H = null;
      if (avatarDialog.open) { avatarDialog.close(); avatarDialog.replaceChildren(); }
      closeSheet(); resumeScene();
    }
  }).catch(saveError).finally(() => { visitPending = false; });
}
