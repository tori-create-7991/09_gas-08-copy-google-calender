/**
 * Calendar API（高度なサービス）に共通する小さなユーティリティ
 */

function calendarTimeRangeIso(cfg) {
  var now = new Date();
  var start = new Date(now);
  start.setDate(start.getDate() - (cfg.daysBefore || 0));
  var end = new Date(now);
  end.setDate(end.getDate() + (cfg.daysAfter || 7));
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function listCalendarEventsPaged(sourceCalendarId, timeMin, timeMax, onItemBatch) {
  var pageToken;
  do {
    var opts = {
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      maxResults: 2500,
      showDeleted: false,
      pageToken: pageToken,
    };
    var resp = Calendar.Events.list(sourceCalendarId, opts);
    var items = (resp && resp.items) ? resp.items : [];
    onItemBatch(items);
    pageToken = resp.nextPageToken;
  } while (pageToken);
}
