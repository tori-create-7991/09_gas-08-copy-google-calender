/**
 * 通常同期の一部として、主催者などの条件でコピー先カレンダーを切り替える
 * （Calendar API の Events.get + InviteRuleMatching）
 */

function getOrganizerRoutingDestinationIds(pair) {
  var ids = {};
  if (pair && pair.destCalendarId) {
    ids[pair.destCalendarId] = true;
  }
  var rules = pair && pair.organizerDestinations;
  if (!Array.isArray(rules)) return ids;
  rules.forEach(function(r) {
    if (r && r.destCalendarId) ids[r.destCalendarId] = true;
  });
  return ids;
}

function fetchCalendarApiEventForRouting(pair, sourceEvent, cache) {
  var rawId = sourceEvent.getId();
  if (cache[rawId] !== undefined) {
    return cache[rawId];
  }
  var eventId = rawId.indexOf('@') !== -1 ? rawId.split('@')[0] : rawId;
  try {
    var ev = Calendar.Events.get(pair.sourceCalendarId, eventId);
    cache[rawId] = ev;
    return ev;
  } catch (e1) {
    try {
      var ev2 = Calendar.Events.get(pair.sourceCalendarId, rawId);
      cache[rawId] = ev2;
      return ev2;
    } catch (e2) {
      cache[rawId] = null;
      return null;
    }
  }
}

/**
 * @returns {{ destCalendarId: string, overrides: Object|null }}
 */
function resolveOrganizerDestination(pair, sourceEvent, apiCache) {
  var rules = pair.organizerDestinations;
  if (!Array.isArray(rules) || rules.length === 0) {
    return { destCalendarId: pair.destCalendarId, overrides: null };
  }
  var ev = fetchCalendarApiEventForRouting(pair, sourceEvent, apiCache);
  if (!ev) {
    return { destCalendarId: pair.destCalendarId, overrides: null };
  }
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i] || {};
    if (!ruleHasInviteConditionFields(rule)) continue;
    if (!matchesInviteEventRuleApi(ev, rule)) continue;
    return {
      destCalendarId: rule.destCalendarId != null ? rule.destCalendarId : pair.destCalendarId,
      overrides: {
        eventTitle: rule.eventTitle,
        eventColor: rule.eventColor,
        showAsBusy: rule.showAsBusy,
        includeOriginalLink: rule.includeOriginalLink,
      },
    };
  }
  return { destCalendarId: pair.destCalendarId, overrides: null };
}

function mergePairOverrides(pair, overrides) {
  if (!overrides) return pair;
  var o = overrides;
  var has = o.eventTitle != null || o.eventColor != null || o.showAsBusy != null || o.includeOriginalLink != null;
  if (!has) return pair;
  var next = Object.assign({}, pair);
  if (o.eventTitle != null) next.eventTitle = o.eventTitle;
  if (o.eventColor != null) next.eventColor = o.eventColor;
  if (o.showAsBusy != null) next.showAsBusy = o.showAsBusy;
  if (o.includeOriginalLink != null) next.includeOriginalLink = o.includeOriginalLink;
  return next;
}
