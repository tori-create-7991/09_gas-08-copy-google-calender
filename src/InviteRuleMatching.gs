/**
 * Calendar API の events リソースに対するルール判定
 * organizerDestinations（主催者でコピー先切替）で利用
 */

function matchesInviteEventRuleApi(ev, rule) {
  if (!rule) return true;

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
  if (rule.titleContains) {
    if (summary.indexOf(String(rule.titleContains)) === -1) return false;
  }

  return true;
}

/** 招待コピー等で「条件なしルール」を誤マッチさせないためのガード */
function ruleHasInviteConditionFields(rule) {
  if (!rule) return false;
  return rule.organizerIsSelf != null ||
    !!rule.organizerEmailContains ||
    !!rule.organizerEmailEndsWith ||
    rule.attendeeIsSelf != null ||
    !!rule.attendeeEmailEquals ||
    !!rule.attendeeEmailContains ||
    !!rule.attendeeEmailEndsWith ||
    !!rule.summaryContains ||
    !!rule.titleContains;
}
