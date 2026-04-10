/**
 * 15分トリガーから呼ばれる同期のオーケストレーション
 */

function runPreSyncCalendarTasks(syncPairs) {
  try {
    var routingConfig = getInviteRoutingConfig();
    if (routingConfig && routingConfig.enabled) {
      routeInvites();
    }
  } catch (e) {
    log('招待振り分けでエラー: ' + e.message);
  }

  try {
    var perDest = getInviteCopyConfigsFromSyncPairs(syncPairs);
    perDest.forEach(function(cfg) {
      if (cfg && cfg.enabled) copyInvitesByRules(cfg);
    });
  } catch (e2) {
    log('招待コピーでエラー: ' + e2.message);
  }
}
