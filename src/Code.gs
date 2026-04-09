/**
 * Google Calendar 同期スクリプト
 *
 * 同じアカウントの複数カレンダー（共有カレンダーなど）から
 * 指定したカレンダーに予定をコピーして同期します。
 *
 * 使い方:
 * 1. Config.gs でカレンダーIDと設定を行う
 * 2. syncCalendars() を実行してテスト
 * 3. setupTrigger() を実行して自動同期を設定
 */

/**
 * メイン同期関数
 * 設定されたすべてのカレンダーペアを同期する
 */
function syncCalendars() {
  const syncPairs = getSyncPairs();
  const commonConfig = getCommonConfig();

  log('===== カレンダー同期開始 =====');
  log('同期ペア数: ' + syncPairs.length);

  // 招待イベントの振り分け（必要なら同期開始時に1回だけ実行）
  try {
    const routingConfig = getInviteRoutingConfig();
    if (routingConfig && routingConfig.enabled) {
      routeInvites();
    }
  } catch (e) {
    // 振り分け失敗で同期全体を止めない
    log('招待振り分けでエラー: ' + e.message);
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;

  syncPairs.forEach((pair, index) => {
    log('');
    log('----- [' + (index + 1) + '/' + syncPairs.length + '] ' + pair.name + ' -----');

    try {
      const result = syncSinglePair(pair, commonConfig);
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalDeleted += result.deleted;
      totalSkipped += result.skipped;
    } catch (error) {
      log('エラー: ' + error.message);
    }
  });

  log('');
  log('===== 全体の同期結果 =====');
  log('作成: ' + totalCreated + '件');
  log('更新: ' + totalUpdated + '件');
  log('削除: ' + totalDeleted + '件');
  log('スキップ: ' + totalSkipped + '件');
}

/**
 * 単一のカレンダーペアを同期する
 */
function syncSinglePair(pair, commonConfig) {
  const result = { created: 0, updated: 0, deleted: 0, skipped: 0 };

  // カレンダーを取得
  const sourceCalendar = CalendarApp.getCalendarById(pair.sourceCalendarId);
  const destCalendar = CalendarApp.getCalendarById(pair.destCalendarId);

  if (!sourceCalendar) {
    throw new Error('ソースカレンダーが見つかりません: ' + pair.sourceCalendarId);
  }
  if (!destCalendar) {
    throw new Error('コピー先カレンダーが見つかりません: ' + pair.destCalendarId);
  }

  log('ソース: ' + sourceCalendar.getName());
  log('コピー先: ' + destCalendar.getName());

  // 同期期間を設定
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - commonConfig.DAYS_BEFORE);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + commonConfig.DAYS_AFTER);
  endDate.setHours(23, 59, 59, 999);

  // このペア用のsyncTagを生成（ソースカレンダーIDを含める）
  const syncTag = commonConfig.SYNC_TAG + '[' + pair.sourceCalendarId + ']';

  // ソースカレンダーの予定を取得
  const sourceEvents = sourceCalendar.getEvents(startDate, endDate);
  debugLog('ソースの予定数: ' + sourceEvents.length, commonConfig);

  // コピー先カレンダーの同期済み予定を取得
  const destEvents = destCalendar.getEvents(startDate, endDate);
  const syncedEvents = destEvents.filter(event => {
    const desc = event.getDescription() || '';
    return desc.includes(syncTag);
  });
  debugLog('同期済み予定数: ' + syncedEvents.length, commonConfig);

  // 同期済み予定をマップ化（ユニークキーで管理）
  const syncedEventMap = new Map();
  syncedEvents.forEach(event => {
    const uniqueKey = extractSourceEventId(event.getDescription(), syncTag);
    if (uniqueKey) {
      syncedEventMap.set(uniqueKey, event);
    }
  });

  // ソースイベントのユニークキーセット（繰り返しイベント対応）
  const sourceEventKeys = new Set();

  // 各ソースイベントを処理
  sourceEvents.forEach(sourceEvent => {
    // 繰り返しイベント対応: ID + 開始日時でユニークキーを生成
    const startTime = sourceEvent.isAllDayEvent()
      ? sourceEvent.getAllDayStartDate().getTime()
      : sourceEvent.getStartTime().getTime();
    const uniqueKey = sourceEvent.getId() + '_' + startTime;
    sourceEventKeys.add(uniqueKey);

    // 終日イベントのスキップチェック
    if (sourceEvent.isAllDayEvent() && !commonConfig.COPY_ALL_DAY_EVENTS) {
      result.skipped++;
      return;
    }

    const existingEvent = syncedEventMap.get(uniqueKey);

    if (existingEvent) {
      if (needsUpdate(sourceEvent, existingEvent, pair, commonConfig, syncTag, uniqueKey)) {
        updateEvent(existingEvent, sourceEvent, pair, syncTag, uniqueKey, commonConfig);
        result.updated++;
        debugLog('更新: ' + sourceEvent.getTitle(), commonConfig);
      }
    } else {
      createEvent(destCalendar, sourceEvent, pair, syncTag, uniqueKey, commonConfig);
      result.created++;
      debugLog('作成: ' + sourceEvent.getTitle(), commonConfig);
    }
  });

  // 削除された予定を検出
  syncedEvents.forEach(syncedEvent => {
    const sourceKey = extractSourceEventId(syncedEvent.getDescription(), syncTag);
    if (sourceKey && !sourceEventKeys.has(sourceKey)) {
      syncedEvent.deleteEvent();
      result.deleted++;
      debugLog('削除: ' + syncedEvent.getTitle(), commonConfig);
    }
  });

  log('結果 - 作成:' + result.created + ' 更新:' + result.updated + ' 削除:' + result.deleted);

  return result;
}
