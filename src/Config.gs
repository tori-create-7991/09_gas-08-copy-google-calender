/**
 * カレンダー同期スクリプト - 設定ファイル
 *
 * このファイルで同期の設定を行います。
 */

/**
 * 同期するカレンダーの設定を取得する
 *
 * destinations 配列でコピー先ごとに calendarId / eventTitle / eventColor を個別指定可能。
 * eventTitle / eventColor を省略するとソース側のデフォルト値が使われる。
 * showAsBusy / includeOriginalLink もコピー先ごとに指定可能（省略で共通設定にフォールバック）。
 *
 * 後方互換: destCalendarId（単数）/ destCalendarIds（配列）も引き続き使用可能。
 *
 * CI デプロイ時は GitHub Secret SYNC_PAIRS_JSON の値で自動置換されます。
 * ローカル開発時はこのファイルを直接編集してください。
 *
 * @returns {Array} 同期設定の配列（展開済み）
 */
// --- SYNC_PAIRS_START ---
function getSyncPairsRaw() {
  return [
    {
      name: '共有カレンダー1',
      sourceCalendarId: 'ここにコピー元カレンダーID1を入力',
      eventTitle: '予定あり',
      eventColor: 8,
      destinations: [
        { calendarId: 'primary' },
        { calendarId: 'shared@group.calendar.google.com', eventTitle: '外出', eventColor: 6, showAsBusy: true, includeOriginalLink: false },
      ],
    },
    {
      name: '共有カレンダー2',
      sourceCalendarId: 'ここにコピー元カレンダーID2を入力',
      eventTitle: '予定あり',
      eventColor: 7,
      destinations: [
        { calendarId: 'primary' },
      ],
    },
  ];
}
// --- SYNC_PAIRS_END ---

/**
 * destinations を個別の destCalendarId ペアに展開する
 * destinations / destCalendarIds / destCalendarId の後方互換あり
 */
function getSyncPairs() {
  var raw = getSyncPairsRaw();
  var expanded = [];
  raw.forEach(function(pair) {
    var dests;
    if (pair.destinations && pair.destinations.length > 0) {
      dests = pair.destinations.map(function(d) {
        return {
          calendarId: d.calendarId,
          eventTitle: d.eventTitle != null ? d.eventTitle : pair.eventTitle,
          eventColor: d.eventColor != null ? d.eventColor : pair.eventColor,
          showAsBusy: d.showAsBusy,
          includeOriginalLink: d.includeOriginalLink,
        };
      });
    } else {
      var ids = pair.destCalendarIds || (pair.destCalendarId ? [pair.destCalendarId] : []);
      dests = ids.map(function(id) {
        return { calendarId: id, eventTitle: pair.eventTitle, eventColor: pair.eventColor };
      });
    }
    dests.forEach(function(dest) {
      expanded.push({
        name: pair.name + (dests.length > 1 ? ' → ' + dest.calendarId.substring(0, 8) : ''),
        sourceCalendarId: pair.sourceCalendarId,
        destCalendarId: dest.calendarId,
        eventTitle: dest.eventTitle,
        eventColor: dest.eventColor,
        showAsBusy: dest.showAsBusy,
        includeOriginalLink: dest.includeOriginalLink,
      });
    });
  });
  return expanded;
}

/**
 * 共通設定を取得する
 * @returns {Object} 共通設定オブジェクト
 */
function getCommonConfig() {
  return {
    // 同期する期間（今日から何日前〜何日後までを同期するか）
    DAYS_BEFORE: 7,   // 過去7日分
    DAYS_AFTER: 30,   // 未来30日分

    // コピーした予定の説明文に追加するプレフィックス
    // 同期元を識別するために使用
    SYNC_TAG: '[CalendarSync]',

    // 終日イベントもコピーするか
    COPY_ALL_DAY_EVENTS: false,

    // コピー先の予定を「予定あり」として表示するか
    SHOW_AS_BUSY: true,

    // 元の予定へのリンクを説明文に含めるか
    INCLUDE_ORIGINAL_LINK: false,

    // デバッグモード（ログを詳細に出力）
    DEBUG_MODE: false
  };
}

/**
 * イベントカラーの一覧
 * 1:ラベンダー, 2:セージ, 3:ブドウ, 4:フラミンゴ, 5:バナナ
 * 6:ミカン, 7:ピーコック, 8:グラファイト, 9:ブルーベリー, 10:バジル, 11:トマト
 */
