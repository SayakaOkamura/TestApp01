/**
 * 共通UI: サイドバー最小化 + カード折りたたみ
 */

// ===== サイドバー最小化 =====
const SIDEBAR_MINI_KEY = 'sakura_sidebar_mini';

(function initSidebar() {
  const btn = document.getElementById('sidebar-mini-toggle');
  if (!btn) return;

  const apply = (mini) => {
    document.body.classList.toggle('sidebar-mini', mini);
    btn.querySelector('.mini-icon').textContent  = mini ? '▷' : '◁';
    btn.querySelector('.mini-label').textContent = mini ? ''  : '折りたたむ';
    localStorage.setItem(SIDEBAR_MINI_KEY, mini ? '1' : '0');
  };

  // ページ読み込み時に前回の状態を復元（初回アニメーション抑制）
  const stored = localStorage.getItem(SIDEBAR_MINI_KEY) === '1';
  document.body.classList.add('no-transition');
  apply(stored);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove('no-transition');
  }));

  btn.addEventListener('click', () => {
    apply(!document.body.classList.contains('sidebar-mini'));
  });
})();

// ナビ項目にホバーツールチップを付与（ミニモード時に便利）
document.querySelectorAll('.sidebar-nav li a').forEach(a => {
  const text = a.querySelector('.nav-text');
  if (text) a.title = text.textContent;
});

// ===== カード折りたたみ =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.card').forEach(card => {
    const header = card.querySelector('.card-header');
    const body   = card.querySelector('.card-body');
    if (!header || !body) return;

    // テーブルを含むカード（.no-pad）は折りたたみ対象外
    if (body.classList.contains('no-pad')) return;

    const btn = document.createElement('button');
    btn.className = 'card-collapse-btn';
    btn.textContent = '▲';
    btn.title = '折りたたむ / 展開する';
    btn.setAttribute('aria-label', '折りたたむ / 展開する');
    btn.setAttribute('aria-expanded', 'true');
    header.appendChild(btn);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const collapsed = card.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      if (!collapsed) {
        // Chart.js ResizeObserver を再トリガー
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      }
    });
  });
});
