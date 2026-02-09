/**
 * デバッグ用関数
 */

/**
 * 特定のカレンダーペアのみ同期する（デバッグ用）
 * @param {number} pairIndex - 同期するペアのインデックス（0から開始）
 */
function syncSinglePairByIndex(pairIndex) {
  const syncPairs = getSyncPairs();
  const commonConfig = getCommonConfig();

  if (pairIndex < 0 || pairIndex >= syncPairs.length) {
    Logger.log('無効なインデックスです: ' + pairIndex + ' (0〜' + (syncPairs.length - 1) + 'を指定)');
    return;
  }

  const pair = syncPairs[pairIndex];
  Logger.log('===== デバッグ同期: ' + pair.name + ' =====');

  try {
    const result = syncSinglePair(pair, commonConfig);
    Logger.log('完了 - 作成:' + result.created + ' 更新:' + result.updated + ' 削除:' + result.deleted);
  } catch (error) {
    Logger.log('エラー: ' + error.message);
  }
}

// デバッグ用ショートカット関数
function debugSync0() { syncSinglePairByIndex(0); }
function debugSync1() { syncSinglePairByIndex(1); }
function debugSync2() { syncSinglePairByIndex(2); }
function debugSync3() { syncSinglePairByIndex(3); }
