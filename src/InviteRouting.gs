/**
 * 招待イベントの自動振り分け（Calendar API: Events.move）
 *
 * 前提:
 * - 「高度な Google サービス」で Calendar API を有効化
 * - GCP 側の「Google Calendar API」も有効化
 */

/**
 * 招待イベントを条件に応じて別カレンダーへ移動する
 *
 * 典型用途: 招待が自動で primary に入るのを、用途別カレンダーへ振り分ける
 */
function routeInvites() {
  var config = getInviteRoutingConfig();
  if (!config || !config.enabled) {
    Logger.log('Invite routing is disabled.');
    return;
  }

  var sourceCalendarId = config.sourceCalendarId || 'primary';
  var range = calendarTimeRangeIso(config);

  var moved = 0;
  var skipped = 0;

  listCalendarEventsPaged(sourceCalendarId, range.timeMin, range.timeMax, function(items) {
    items.forEach(function(ev) {
      if (!ev || !ev.id) return;

      var match = findInviteRouteMatch(ev, config);
      if (!match) {
        skipped++;
        return;
      }

      if (match.destCalendarId === sourceCalendarId) {
        skipped++;
        return;
      }

      try {
        Calendar.Events.move(sourceCalendarId, ev.id, match.destCalendarId);
        moved++;
      } catch (e) {
        Logger.log('move failed: ' + ev.id + ' -> ' + match.destCalendarId + ' : ' + e);
      }
    });
  });

  Logger.log('Invite routing done. moved=' + moved + ' skipped=' + skipped);
}

/**
 * ルールに一致する振り分け先を返す（先勝ち）
 * @returns { {destCalendarId:string} | null }
 */
function findInviteRouteMatch(ev, config) {
  var rules = config.rules || [];
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i] || {};
    if (!rule.destCalendarId) continue;
    if (matchesInviteEventRuleApi(ev, rule)) {
      return { destCalendarId: rule.destCalendarId };
    }
  }
  return null;
}

/**
 * 招待イベント振り分けの定期実行トリガーを設定（15分ごと）
 */
function setupInviteRoutingTrigger() {
  removeInviteRoutingTriggers();
  ScriptApp.newTrigger('routeInvites')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Invite routing trigger set (every 15 minutes).');
}

/**
 * 招待イベント振り分けのトリガーを削除
 */
function removeInviteRoutingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'routeInvites') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('Invite routing triggers removed.');
}

