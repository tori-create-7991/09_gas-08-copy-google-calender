/**
 * カレンダー同期スクリプト - 設定ファイル
 *
 * このファイルで同期の設定を行います。
 */

/**
 * 同期するカレンダーの設定を取得する
 * 複数のカレンダーペアを設定できます
 *
 * CI デプロイ時は GitHub Secret SYNC_PAIRS_JSON の値で自動置換されます。
 * ローカル開発時はこのファイルを直接編集してください。
 *
 * @returns {Array} 同期設定の配列
 */
// --- SYNC_PAIRS_START ---
function getSyncPairs() {
  return [
    {
      name: '共有カレンダー1',
      sourceCalendarId: 'ここにコピー元カレンダーID1を入力',
      destCalendarId: 'primary',
      eventTitle: '予定あり',
      eventColor: 8,
    },
    {
      name: '共有カレンダー2',
      sourceCalendarId: 'ここにコピー元カレンダーID2を入力',
      destCalendarId: 'primary',
      eventTitle: '予定あり',
      eventColor: 7,
    },
  ];
}
// --- SYNC_PAIRS_END ---

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
    COPY_ALL_DAY_EVENTS: true,

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
