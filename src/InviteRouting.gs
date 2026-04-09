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
  var now = new Date();
  var start = new Date(now);
  start.setDate(start.getDate() - (config.daysBefore || 0));
  var end = new Date(now);
  end.setDate(end.getDate() + (config.daysAfter || 7));

  var timeMin = start.toISOString();
  var timeMax = end.toISOString();

  var moved = 0;
  var skipped = 0;
  var pageToken;

  do {
    var resp = Calendar.Events.list(sourceCalendarId, {
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      maxResults: 2500,
      pageToken: pageToken,
      showDeleted: false,
    });

    var items = (resp && resp.items) ? resp.items : [];
    items.forEach(function(ev) {
      if (!ev || !ev.id) return;

      var match = findInviteRouteMatch(ev, config);
      if (!match) {
        skipped++;
        return;
      }

      // すでに目的のカレンダーにある場合は何もしない
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

    pageToken = resp.nextPageToken;
  } while (pageToken);

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
    if (matchesInviteRule(ev, rule)) {
      return { destCalendarId: rule.destCalendarId };
    }
  }
  return null;
}

/**
 * 招待イベントを条件判定する
 *
 * サポート:
 * - organizerIsSelf: boolean
 * - organizerEmailContains: string
 * - organizerEmailEndsWith: string
 * - attendeeIsSelf: boolean
 * - attendeeEmailEquals: string
 * - attendeeEmailContains: string
 * - attendeeEmailEndsWith: string
 * - summaryContains: string
 */
function matchesInviteRule(ev, rule) {
  // organizerIsSelf
  if (rule.organizerIsSelf != null) {
    var isSelf = !!(ev.organizer && ev.organizer.self);
    if (isSelf !== !!rule.organizerIsSelf) return false;
  }

  var organizerEmail = (ev.organizer && ev.organizer.email) ? String(ev.organizer.email) : '';
  if (rule.organizerEmailContains) {
    if (organizerEmail.indexOf(String(rule.organizerEmailContains)) === -1) return false;
  }
  if (rule.organizerEmailEndsWith) {
    var suffix = String(rule.organizerEmailEndsWith);
    if (!organizerEmail || organizerEmail.slice(-suffix.length) !== suffix) return false;
  }

  // attendees
  var attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
  if (rule.attendeeIsSelf != null) {
    var hasSelf = attendees.some(function(a) { return !!(a && a.self); });
    if (hasSelf !== !!rule.attendeeIsSelf) return false;
  }
  if (rule.attendeeEmailEquals || rule.attendeeEmailContains || rule.attendeeEmailEndsWith) {
    var attendeeEmails = attendees
      .map(function(a) { return (a && a.email) ? String(a.email) : ''; })
      .filter(function(s) { return !!s; });

    if (rule.attendeeEmailEquals) {
      var target = String(rule.attendeeEmailEquals);
      var okEq = attendeeEmails.some(function(e) { return e === target; });
      if (!okEq) return false;
    }
    if (rule.attendeeEmailContains) {
      var sub = String(rule.attendeeEmailContains);
      var okContains = attendeeEmails.some(function(e) { return e.indexOf(sub) !== -1; });
      if (!okContains) return false;
    }
    if (rule.attendeeEmailEndsWith) {
      var suf = String(rule.attendeeEmailEndsWith);
      var okEnds = attendeeEmails.some(function(e) { return e.slice(-suf.length) === suf; });
      if (!okEnds) return false;
    }
  }

  var summary = ev.summary ? String(ev.summary) : '';
  if (rule.summaryContains) {
    if (summary.indexOf(String(rule.summaryContains)) === -1) return false;
  }

  return true;
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

