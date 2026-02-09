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
      if (needsUpdate(sourceEvent, existingEvent, pair)) {
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

/**
 * 新しい予定を作成する
 */
function createEvent(destCalendar, sourceEvent, pair, syncTag, uniqueKey, commonConfig) {
  const title = pair.eventTitle || sourceEvent.getTitle();
  const description = buildDescription(sourceEvent, pair, syncTag, uniqueKey, commonConfig);

  let newEvent;

  if (sourceEvent.isAllDayEvent()) {
    const startDate = sourceEvent.getAllDayStartDate();
    const endDate = sourceEvent.getAllDayEndDate();

    if (endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
      newEvent = destCalendar.createAllDayEvent(title, startDate, adjustedEndDate);
    } else {
      newEvent = destCalendar.createAllDayEvent(title, startDate);
    }
  } else {
    newEvent = destCalendar.createEvent(
      title,
      sourceEvent.getStartTime(),
      sourceEvent.getEndTime()
    );
  }

  newEvent.setDescription(description);

  if (pair.eventColor) {
    newEvent.setColor(String(pair.eventColor));
  }

  return newEvent;
}

/**
 * 既存の予定を更新する
 */
function updateEvent(existingEvent, sourceEvent, pair, syncTag, uniqueKey, commonConfig) {
  const title = pair.eventTitle || sourceEvent.getTitle();

  existingEvent.setTitle(title);

  if (sourceEvent.isAllDayEvent()) {
    existingEvent.setAllDayDate(sourceEvent.getAllDayStartDate());
  } else {
    existingEvent.setTime(sourceEvent.getStartTime(), sourceEvent.getEndTime());
  }

  existingEvent.setDescription(buildDescription(sourceEvent, pair, syncTag, uniqueKey, commonConfig));

  if (pair.eventColor) {
    existingEvent.setColor(String(pair.eventColor));
  }
}

/**
 * 予定の更新が必要かチェックする
 */
function needsUpdate(sourceEvent, existingEvent, pair) {
  const expectedTitle = pair.eventTitle || sourceEvent.getTitle();

  if (existingEvent.getTitle() !== expectedTitle) {
    return true;
  }

  if (sourceEvent.isAllDayEvent()) {
    if (!existingEvent.isAllDayEvent()) {
      return true;
    }
    if (sourceEvent.getAllDayStartDate().getTime() !== existingEvent.getAllDayStartDate().getTime()) {
      return true;
    }
  } else {
    if (existingEvent.isAllDayEvent()) {
      return true;
    }
    if (sourceEvent.getStartTime().getTime() !== existingEvent.getStartTime().getTime()) {
      return true;
    }
    if (sourceEvent.getEndTime().getTime() !== existingEvent.getEndTime().getTime()) {
      return true;
    }
  }

  return false;
}

/**
 * 予定の説明文を作成する
 */
function buildDescription(sourceEvent, pair, syncTag, uniqueKey, commonConfig) {
  let description = syncTag + ' SourceID:' + uniqueKey;

  if (commonConfig.INCLUDE_ORIGINAL_LINK) {
    const eventUrl = 'https://calendar.google.com/calendar/event?eid=' +
      Utilities.base64Encode(sourceEvent.getId().split('@')[0] + ' ' + pair.sourceCalendarId);
    description += '\n\n元の予定: ' + eventUrl;
  }

  return description;
}

/**
 * 説明文からソースイベントIDを抽出する
 */
function extractSourceEventId(description, syncTag) {
  if (!description || !description.includes(syncTag)) {
    return null;
  }

  const match = description.match(/SourceID:([^\s\n]+)/);
  return match ? match[1] : null;
}

/**
 * 自動同期トリガーを設定する（15分ごと）
 */
function setupTrigger() {
  removeTriggers();

  ScriptApp.newTrigger('syncCalendars')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('トリガーを設定しました（15分ごとに実行）');
}

/**
 * 1時間ごとの同期トリガーを設定する
 */
function setupHourlyTrigger() {
  removeTriggers();

  ScriptApp.newTrigger('syncCalendars')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('トリガーを設定しました（1時間ごとに実行）');
}

/**
 * 既存のトリガーを削除する
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendars') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('既存のトリガーを削除しました');
}

/**
 * 同期済みの予定をすべて削除する（リセット用）
 */
function clearSyncedEvents() {
  const syncPairs = getSyncPairs();
  const commonConfig = getCommonConfig();

  syncPairs.forEach(pair => {
    const destCalendar = CalendarApp.getCalendarById(pair.destCalendarId);
    if (!destCalendar) {
      Logger.log('カレンダーが見つかりません: ' + pair.destCalendarId);
      return;
    }

    const syncTag = commonConfig.SYNC_TAG + '[' + pair.sourceCalendarId + ']';

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - commonConfig.DAYS_BEFORE);

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + commonConfig.DAYS_AFTER);

    const events = destCalendar.getEvents(startDate, endDate);
    let deletedCount = 0;

    events.forEach(event => {
      const desc = event.getDescription() || '';
      if (desc.includes(syncTag)) {
        event.deleteEvent();
        deletedCount++;
      }
    });

    Logger.log(pair.name + ': ' + deletedCount + '件削除');
  });
}

/**
 * 特定のカレンダーペアの同期済み予定を削除する
 * @param {number} pairIndex - 削除するペアのインデックス（0から開始）
 */
function clearSyncedEventsForPair(pairIndex) {
  const syncPairs = getSyncPairs();
  const commonConfig = getCommonConfig();

  if (pairIndex < 0 || pairIndex >= syncPairs.length) {
    Logger.log('無効なインデックスです: ' + pairIndex);
    return;
  }

  const pair = syncPairs[pairIndex];
  const destCalendar = CalendarApp.getCalendarById(pair.destCalendarId);

  if (!destCalendar) {
    Logger.log('カレンダーが見つかりません: ' + pair.destCalendarId);
    return;
  }

  const syncTag = commonConfig.SYNC_TAG + '[' + pair.sourceCalendarId + ']';

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - commonConfig.DAYS_BEFORE);

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + commonConfig.DAYS_AFTER);

  const events = destCalendar.getEvents(startDate, endDate);
  let deletedCount = 0;

  events.forEach(event => {
    const desc = event.getDescription() || '';
    if (desc.includes(syncTag)) {
      event.deleteEvent();
      deletedCount++;
    }
  });

  Logger.log(pair.name + ': ' + deletedCount + '件削除');
}

/**
 * 利用可能なカレンダー一覧を表示する
 */
function listCalendars() {
  const calendars = CalendarApp.getAllCalendars();

  Logger.log('===== 利用可能なカレンダー一覧 =====');
  calendars.forEach((calendar, index) => {
    Logger.log((index + 1) + '. ' + calendar.getName());
    Logger.log('   ID: ' + calendar.getId());
    Logger.log('   ---');
  });
  Logger.log('合計: ' + calendars.length + '件');
}

/**
 * ログ出力
 */
function log(message) {
  Logger.log(message);
}

/**
 * デバッグログ出力
 */
function debugLog(message, config) {
  if (config && config.DEBUG_MODE) {
    Logger.log('[DEBUG] ' + message);
  }
}

/**
 * 特定のカレンダーペアのみ同期する（デバッグ用）
 * @param {number} pairIndex - 同期するペアのインデックス（0から開始）
 */
function syncSinglePairByIndex(pairIndex) {
  const syncPairs = getSyncPairs();
  const commonConfig = getCommonConfig();

  if (pairIndex < 0 || pairIndex >= syncPairs.length) {
    Logger.log('無効なインデックスです: ' + pairIndex + ' (0〜' + (syncPairs.length - 1) + 'を指定)');
    return;
  }

  const pair = syncPairs[pairIndex];
  Logger.log('===== デバッグ同期: ' + pair.name + ' =====');

  try {
    const result = syncSinglePair(pair, commonConfig);
    Logger.log('完了 - 作成:' + result.created + ' 更新:' + result.updated + ' 削除:' + result.deleted);
  } catch (error) {
    Logger.log('エラー: ' + error.message);
  }
}

// デバッグ用ショートカット関数
function debugSync0() { syncSinglePairByIndex(0); }
function debugSync1() { syncSinglePairByIndex(1); }
function debugSync2() { syncSinglePairByIndex(2); }
function debugSync3() { syncSinglePairByIndex(3); }
