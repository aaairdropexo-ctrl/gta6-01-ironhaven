// IRONHAVEN — the HUD. One DOM overlay, one condensed bold family, one
// plate colour. The objective panel, the wanted stars, the broadcast bar, the
// health and ammo, the speed, the prompt, the subtitles: each one shows only
// when its state needs it, and each one updates from the game state, never
// from a guess. Text is sized to read at 1280x720 and at the jury's 768px.

import { COLORS } from './config.js';

function el(id) { return document.getElementById(id); }

export function createContextualHud() {
  const objectiveTitle = el('objective-title');
  const objectiveText = el('objective-text');
  const objectiveDetail = el('objective-detail');
  const objectiveBox = el('objective');
  const wantedBox = el('wanted');
  const wantedStars = el('wanted-stars');
  const broadcastBox = el('broadcast');
  const broadcastFill = el('broadcast-fill');
  const broadcastPct = el('broadcast-pct');
  const healthFill = el('health-fill');
  const healthNum = el('health-num');
  const ammoText = el('ammo-text');
  const speedBox = el('speed');
  const speedNum = el('speed-num');
  const integrityText = el('integrity-text');
  const promptBox = el('prompt');
  const subtitleBox = el('subtitle');
  const crosshair = el('crosshair');
  const chapterCard = el('chapter-card');
  const chapterKicker = el('chapter-kicker');
  const chapterTitle = el('chapter-title');
  const chapterObjective = el('chapter-objective');
  const titleScreen = el('title-screen');
  const pauseScreen = el('pause-screen');
  const failScreen = el('fail-screen');
  const failReason = el('fail-reason');
  const completeScreen = el('complete-screen');
  const completeList = el('complete-list');
  const dispatchBox = el('dispatch');
  const dispatchCount = el('dispatch-count');
  const dispatchList = el('dispatch-list');
  const radioBox = el('radio');
  const status = el('status');
  let subtitleTimer = null;
  let chapterTimer = null;

  function setObjective(title, objective, detail) {
    objectiveTitle.textContent = title;
    objectiveText.textContent = objective;
    objectiveDetail.textContent = detail;
  }
  function setWanted(n) {
    wantedBox.style.display = n > 0 ? 'block' : 'none';
    wantedStars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
  }
  function setHealth(h) {
    healthFill.style.width = `${Math.max(0, Math.min(100, h))}%`;
    healthNum.textContent = `${Math.max(0, Math.round(h))}`;
    healthFill.style.background = h < 30 ? COLORS.hudRed : h < 60 ? COLORS.hudAmber : COLORS.hudTeal;
  }
  function setAmmo(ammo, reserve) {
    ammoText.textContent = `PISTOL  ${ammo} / ${reserve}`;
  }
  function setSpeed(kmh, integrity) {
    speedBox.style.display = 'block';
    speedNum.textContent = `${Math.round(kmh)}`;
    integrityText.textContent = `HAULER ${Math.max(0, Math.round(integrity))}%`;
  }
  function hideSpeed() { speedBox.style.display = 'none'; }
  function setBroadcast(pct) {
    broadcastBox.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
    broadcastFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    broadcastPct.textContent = `${Math.floor(pct)}% LIVE`;
  }
  function hideBroadcast() { broadcastBox.style.display = 'none'; }
  function showPrompt(text) {
    promptBox.textContent = text;
    promptBox.style.display = 'block';
  }
  function hidePrompt() { promptBox.style.display = 'none'; }
  function showSubtitle(text, seconds) {
    subtitleBox.textContent = text;
    subtitleBox.style.display = 'block';
    if (subtitleTimer) clearTimeout(subtitleTimer);
    subtitleTimer = setTimeout(() => { subtitleBox.style.display = 'none'; }, (seconds || 4) * 1000);
  }
  function showChapterCard(kicker, title, objective) {
    chapterKicker.textContent = kicker;
    chapterTitle.textContent = title;
    chapterObjective.textContent = objective;
    chapterCard.style.display = 'block';
    chapterCard.classList.remove('fade');
    if (chapterTimer) clearTimeout(chapterTimer);
    chapterTimer = setTimeout(() => { chapterCard.classList.add('fade'); }, 3200);
  }
  function hideChapterCard() {
    if (chapterTimer) clearTimeout(chapterTimer);
    chapterCard.style.display = 'none';
  }
  function showCompletion(rewards) {
    completeList.innerHTML = rewards.map((r) => `<li>${r}</li>`).join('');
    objectiveBox.style.display = 'none';
    completeScreen.style.display = 'flex';
  }
  function hideCompletion() { completeScreen.style.display = 'none'; objectiveBox.style.display = 'block'; }
  function showFail(reason) {
    failReason.textContent = reason;
    failScreen.style.display = 'flex';
  }
  function hideFail() { failScreen.style.display = 'none'; }
  function showTitle() { titleScreen.style.display = 'flex'; }
  function hideTitle() { titleScreen.style.display = 'none'; }
  function showPause() { pauseScreen.style.display = 'flex'; }
  function hidePause() { pauseScreen.style.display = 'none'; }
  function setCrosshair(visible) { crosshair.style.display = visible ? 'block' : 'none'; }
  // the dispatch list: the live police response, unit by unit — the rivals'
  // frames all carry one, and ours was the only HUD corner left empty
  function setDispatch(rows) {
    if (!rows || rows.length === 0) { dispatchBox.style.display = 'none'; return; }
    dispatchBox.style.display = 'block';
    dispatchCount.textContent = `${rows.length}`;
    dispatchList.innerHTML = rows.map((r) => `<div class="dispatch-row"><span>${r.name}</span><span class="dispatch-role">${r.role}</span><span class="dispatch-dist">${r.dist} m</span></div>`).join('');
  }
  function setRadio(visible) { radioBox.style.display = visible ? 'block' : 'none'; }
  function announce(message) { if (status) status.textContent = message; }

  return {
    setObjective, setWanted, setHealth, setAmmo, setSpeed, hideSpeed,
    setBroadcast, hideBroadcast, showPrompt, hidePrompt, showSubtitle,
    showChapterCard, hideChapterCard, showCompletion, hideCompletion, showFail, hideFail,
    showTitle, hideTitle, showPause, hidePause, setCrosshair, setDispatch, setRadio, announce,
  };
}
