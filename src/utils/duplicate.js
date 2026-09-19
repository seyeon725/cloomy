/**
 * Helper to identify duplicate or overlapping candidate items.
 */
export function findDuplicateCandidate(newItem, existingItems) {
  if (!newItem?.name || !existingItems?.length) return null;

  const clean = (s) => (s || '').replace(/[\s\-_.,/()]/g, '').toLowerCase();
  const cNew = clean(newItem.name);
  if (!cNew || cNew.length < 2) return null;

  // 1. 정확한 이름 일치 (공백/특수문자 제외)
  for (const ex of existingItems) {
    const cEx = clean(ex.name);
    if (cNew === cEx) {
      return { existing: ex, matchType: 'exact', reason: '이름이 완전히 일치해요' };
    }
  }

  // 2. 부분 일치 (최소 4글자 이상이거나 동일 카테고리인 경우)
  for (const ex of existingItems) {
    const cEx = clean(ex.name);
    if (!cEx || cEx.length < 2) continue;

    const minLen = Math.min(cNew.length, cEx.length);
    const sameCat = newItem.category && ex.category && newItem.category === ex.category;

    if (minLen >= 4 || (minLen >= 3 && sameCat)) {
      if (cNew.includes(cEx) || cEx.includes(cNew)) {
        return { existing: ex, matchType: 'substring', reason: '이름이 포함되어 있어요' };
      }
    }
  }

  // 3. 주요 단어(토큰) 일치 (예: "케라시스 데미지 케어 샴푸"와 "케라시스 샴푸")
  const splitTokens = (s) => (s || '').toLowerCase().split(/[\s\-_.,/()]+/).filter((t) => t.length >= 2);
  const newTokens = splitTokens(newItem.name);

  if (newTokens.length >= 2) {
    for (const ex of existingItems) {
      const exTokens = splitTokens(ex.name);
      if (exTokens.length >= 2) {
        const common = newTokens.filter((t) => exTokens.includes(t));
        if (common.length >= 2 && common.length >= Math.min(newTokens.length, exTokens.length) * 0.6) {
          return { existing: ex, matchType: 'token', reason: '주요 단어가 일치해요' };
        }
      }
    }
  }

  return null;
}
