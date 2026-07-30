export function renderStats({ accuracy, studied, combo, longestCombo, mastered, needsReview, position, rank }) {
  const panel = document.getElementById('stats-panel');
  if (!panel) return;

  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '오늘의 통계';
  panel.appendChild(header);

  const rows = [
    ['정확도', `${accuracy}%`],
    ['학습한 단어', studied],
    ['현재 콤보', combo],
    ['최고 콤보', longestCombo],
    ['마스터한 단어', mastered],
    ['복습 필요', needsReview],
    ['카운팅', position]
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    panel.appendChild(row);
  });

  const rankBadge = document.createElement('div');
  rankBadge.className = 'rank-badge';
  rankBadge.textContent = rank.title;
  panel.appendChild(rankBadge);

  const rankScore = document.createElement('div');
  rankScore.className = 'rank-score';
  rankScore.textContent = `승진 점수: ${rank.masteredWeight} / ${rank.totalWeight}`;
  panel.appendChild(rankScore);

  if (rank.nextTitle) {
    const rankNext = document.createElement('div');
    rankNext.className = 'rank-next';
    rankNext.textContent = `다음 직급: ${rank.nextTitle} · ${rank.nextThresholdWeight}점 필요 (${Math.round(rank.progressToNext * 100)}%)`;
    panel.appendChild(rankNext);
  }

  const rankHint = document.createElement('div');
  rankHint.className = 'rank-hint';
  rankHint.textContent = '어려운 단어일수록 점수가 더 높습니다.';
  panel.appendChild(rankHint);
}
