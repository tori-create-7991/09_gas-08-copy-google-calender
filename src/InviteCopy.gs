/**
 * 招待イベントのコピー（Calendar API で判定 → Calendar API で作成）
 *
 * NOTE:
 * - 外部主催の招待（attendee copy）は Calendar API の Events.move が禁止されるケースがあるため、
 *   コピー方式で「予定あり」イベントを作成する。
 * - コピー方式はイベントIDが変わるため、主催者の更新追従は保証できない。
 *
 * 前提:
 * - 「高度な Google サービス」で Calendar API を有効化
 * - GCP 側の「Google Calendar API」も有効化
 */

function copyInvitesByRules() {
  var cfg = getInviteCopyConfig();
  if (!cfg || !cfg.enabled) {
    Logger.log('Invite copy is disabled.');
    return;
  }
  copyInvitesByRulesWithConfig(cfg);
}

function copyInvitesByRulesWithConfig(cfg) {
  var sourceCalendarId = cfg.sourceCalendarId || 'primary';
  var destCalendarId = cfg.defaultDestCalendarId;
  if (!destCalendarId) throw new Error('defaultDestCalendarId is required in invite copy config');

  var now = new Date();
  var start = new Date(now);
  start.setDate(start.getDate() - (cfg.daysBefore || 0));
  var end = new Date(now);
  end.setDate(end.getDate() + (cfg.daysAfter || 14));

  var timeMin = start.toISOString();
  var timeMax = end.toISOString();

  var maxCreates = (cfg.maxCreatesPerRun != null) ? cfg.maxCreatesPerRun : 50;
  var sleepMs = (cfg.sleepMsBetweenCreates != null) ? cfg.sleepMsBetweenCreates : 150;

  var created = 0;
  var skipped = 0;
  var failed = 0;

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
    for (var i = 0; i < items.length; i++) {
      if (created >= maxCreates) break;
      var ev = items[i];
      if (!ev || !ev.id) continue;

      var match = findInviteCopyRuleMatchApi(ev, cfg);
      if (!match) {
        skipped++;
        continue;
      }

      var effectiveDestCalendarId = match.destCalendarId || destCalendarId;
      var tag = buildInviteCopyTag(cfg, match.ruleName, ev, sourceCalendarId, effectiveDestCalendarId);
      if (hasInviteCopyAlready(effectiveDestCalendarId, tag, timeMin, timeMax)) {
        skipped++;
        continue;
      }

      try {
        Calendar.Events.insert(buildInviteCopyEventResource(cfg, match, ev, tag), effectiveDestCalendarId);
        created++;
        Utilities.sleep(sleepMs);
      } catch (e) {
        failed++;
        Logger.log('invite copy insert failed: ' + ev.id + ' : ' + e);
      }
    }

    pageToken = resp.nextPageToken;
  } while (pageToken && created < maxCreates);

  Logger.log('Invite copy done. created=' + created + ' skipped=' + skipped + ' failed=' + failed);
}

function findInviteCopyRuleMatchApi(ev, cfg) {
  var rules = Array.isArray(cfg.rules) ? cfg.rules : [];
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i] || {};
    if (!rule.organizerEmailEndsWith && !rule.titleContains) continue;
    if (!matchesInviteCopyRuleApi(ev, rule)) continue;
    return {
      ruleName: rule.name || ('rule' + (i + 1)),
      destCalendarId: rule.destCalendarId,
      eventTitle: rule.eventTitle,
      eventColor: rule.eventColor,
      showAsBusy: rule.showAsBusy,
      includeOriginalLink: rule.includeOriginalLink,
    };
  }
  return null;
}

function matchesInviteCopyRuleApi(ev, rule) {
  if (rule.organizerEmailEndsWith) {
    var orgEmail = (ev.organizer && ev.organizer.email) ? String(ev.organizer.email) : '';
    var suf = String(rule.organizerEmailEndsWith);
    if (!orgEmail || !suf || orgEmail.slice(-suf.length) !== suf) return false;
  }
  if (rule.titleContains) {
    var summary = ev.summary ? String(ev.summary) : '';
    if (summary.indexOf(String(rule.titleContains)) === -1) return false;
  }
  return true;
}

function buildInviteCopyTag(cfg, ruleName, ev, sourceCalendarId, destCalendarId) {
  var startIso = (ev.start && (ev.start.dateTime || ev.start.date)) ? String(ev.start.dateTime || ev.start.date) : '';
  return '[InviteCopy]' +
    ' Rule:' + String(ruleName || '') +
    ' Source:' + sourceCalendarId +
    ' Dest:' + destCalendarId +
    ' SourceID:' + ev.id +
    (startIso ? (' Start:' + startIso) : '');
}

function hasInviteCopyAlready(destCalendarId, tag, timeMin, timeMax) {
  // reduce cost: query only by privateExtendedProperty
  try {
    var resp = Calendar.Events.list(destCalendarId, {
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      maxResults: 10,
      privateExtendedProperty: 'inviteCopyTag=' + tag,
      showDeleted: false,
    });
    return !!(resp && resp.items && resp.items.length > 0);
  } catch (e) {
    // fallback: if query not allowed, just return false and let duplicates happen rarely
    return false;
  }
}

function buildInviteCopyEventResource(cfg, match, sourceEv, tag) {
  var summary = (match && match.eventTitle != null) ? String(match.eventTitle) : ((cfg.eventTitle != null) ? String(cfg.eventTitle) : '');
  if (summary === '') {
    summary = sourceEv.summary ? String(sourceEv.summary) : '予定あり';
  }

  var resource = {
    summary: summary,
    start: sourceEv.start,
    end: sourceEv.end,
    description: tag,
    extendedProperties: { private: { inviteCopyTag: tag } },
  };

  var color = (match && match.eventColor != null) ? match.eventColor : cfg.eventColor;
  if (color != null) {
    resource.colorId = String(color);
  }

  var showAsBusy = (match && match.showAsBusy != null) ? match.showAsBusy : cfg.showAsBusy;
  if (showAsBusy != null) {
    resource.transparency = showAsBusy ? 'opaque' : 'transparent';
  }

  var includeOriginalLink = (match && match.includeOriginalLink != null) ? match.includeOriginalLink : cfg.includeOriginalLink;
  if (includeOriginalLink) {
    var htmlLink = sourceEv.htmlLink ? String(sourceEv.htmlLink) : '';
    if (htmlLink) {
      resource.description = tag + '\n\n元の予定: ' + htmlLink;
    }
  }

  return resource;
}

