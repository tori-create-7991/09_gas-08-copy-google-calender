/**
 * Google Calendar 同期スクリプト
 *
 * 同じアカウントの別カレンダー（共有カレンダーなど）から
 * 指定したカレンダーに予定をコピーして同期します。
 *
 * 使い方:
 * 1. Config.gs でカレンダーIDと設定を行う
 * 2. syncCalendars() を実行してテスト
 * 3. setupTrigger() を実行して自動同期を設定
 */

/**
 * メイン同期関数
 * ソースカレンダーからコピー先カレンダーに予定をコピー・同期する
 */
function syncCalendars() {
  const config = getConfig();

  try {
    log('===== カレンダー同期開始 =====');

    // カレンダーを取得
    const sourceCalendar = CalendarApp.getCalendarById(config.SOURCE_CALENDAR_ID);
    const destCalendar = CalendarApp.getCalendarById(config.DESTINATION_CALENDAR_ID);

    if (!sourceCalendar) {
      throw new Error('ソースカレンダーが見つかりません。カレンダーIDを確認してください: ' + config.SOURCE_CALENDAR_ID);
    }
    if (!destCalendar) {
      throw new Error('コピー先カレンダーが見つかりません。カレンダーIDを確認してください: ' + config.DESTINATION_CALENDAR_ID);
    }

    log('ソースカレンダー: ' + sourceCalendar.getName());
    log('コピー先カレンダー: ' + destCalendar.getName());

    // 同期期間を設定
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - config.DAYS_BEFORE);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + config.DAYS_AFTER);
    endDate.setHours(23, 59, 59, 999);

    log('同期期間: ' + formatDate(startDate) + ' 〜 ' + formatDate(endDate));

    // ソースカレンダーの予定を取得
    const sourceEvents = sourceCalendar.getEvents(startDate, endDate);
    log('ソースカレンダーの予定数: ' + sourceEvents.length);

    // コピー先カレンダーの同期済み予定を取得
    const destEvents = destCalendar.getEvents(startDate, endDate);
    const syncedEvents = destEvents.filter(event => {
      const desc = event.getDescription() || '';
      return desc.includes(config.SYNC_TAG);
    });
    log('コピー先の同期済み予定数: ' + syncedEvents.length);

    // 同期済み予定をマップ化（ソースイベントIDをキーに）
    const syncedEventMap = new Map();
    syncedEvents.forEach(event => {
      const sourceId = extractSourceEventId(event.getDescription(), config.SYNC_TAG);
      if (sourceId) {
        syncedEventMap.set(sourceId, event);
      }
    });

    // 処理カウンター
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    // ソースイベントのIDセット（削除検出用）
    const sourceEventIds = new Set();

    // 各ソースイベントを処理
    sourceEvents.forEach(sourceEvent => {
      const sourceEventId = sourceEvent.getId();
      sourceEventIds.add(sourceEventId);

      // 終日イベントのスキップチェック
      if (sourceEvent.isAllDayEvent() && !config.COPY_ALL_DAY_EVENTS) {
        debug('終日イベントをスキップ: ' + sourceEvent.getTitle());
        skipped++;
        return;
      }

      // 既存の同期済み予定を確認
      const existingEvent = syncedEventMap.get(sourceEventId);

      if (existingEvent) {
        // 更新が必要かチェック
        if (needsUpdate(sourceEvent, existingEvent, config)) {
          updateEvent(existingEvent, sourceEvent, config);
          updated++;
          debug('予定を更新: ' + sourceEvent.getTitle());
        } else {
          debug('変更なし: ' + sourceEvent.getTitle());
        }
      } else {
        // 新規作成
        createEvent(destCalendar, sourceEvent, config);
        created++;
        debug('予定を作成: ' + sourceEvent.getTitle());
      }
    });

    // 削除された予定を検出して削除
    syncedEvents.forEach(syncedEvent => {
      const sourceId = extractSourceEventId(syncedEvent.getDescription(), config.SYNC_TAG);
      if (sourceId && !sourceEventIds.has(sourceId)) {
        syncedEvent.deleteEvent();
        deleted++;
        debug('予定を削除: ' + syncedEvent.getTitle());
      }
    });

    // 結果をログ出力
    log('===== 同期完了 =====');
    log('作成: ' + created + '件');
    log('更新: ' + updated + '件');
    log('削除: ' + deleted + '件');
    log('スキップ: ' + skipped + '件');

  } catch (error) {
    Logger.log('エラー: ' + error.message);
    throw error;
  }
}

/**
 * 新しい予定を作成する
 */
function createEvent(destCalendar, sourceEvent, config) {
  const title = config.COPIED_EVENT_TITLE || sourceEvent.getTitle();
  const description = buildDescription(sourceEvent, config);

  let newEvent;

  if (sourceEvent.isAllDayEvent()) {
    // 終日イベント
    const startDate = sourceEvent.getAllDayStartDate();
    const endDate = sourceEvent.getAllDayEndDate();

    // 複数日にまたがる場合
    if (endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
      newEvent = destCalendar.createAllDayEvent(title, startDate, adjustedEndDate);
    } else {
      newEvent = destCalendar.createAllDayEvent(title, startDate);
    }
  } else {
    // 時間指定イベント
    newEvent = destCalendar.createEvent(
      title,
      sourceEvent.getStartTime(),
      sourceEvent.getEndTime()
    );
  }

  // 説明を設定
  newEvent.setDescription(description);

  // 色を設定
  if (config.EVENT_COLOR) {
    newEvent.setColor(String(config.EVENT_COLOR));
  }

  // 表示設定（予定あり/空き時間）
  if (config.SHOW_AS_BUSY) {
    // デフォルトで「予定あり」として表示される
  }

  return newEvent;
}

/**
 * 既存の予定を更新する
 */
function updateEvent(existingEvent, sourceEvent, config) {
  const title = config.COPIED_EVENT_TITLE || sourceEvent.getTitle();

  // タイトルを更新
  existingEvent.setTitle(title);

  // 時間を更新
  if (sourceEvent.isAllDayEvent()) {
    existingEvent.setAllDayDate(sourceEvent.getAllDayStartDate());
  } else {
    existingEvent.setTime(sourceEvent.getStartTime(), sourceEvent.getEndTime());
  }

  // 説明を更新
  existingEvent.setDescription(buildDescription(sourceEvent, config));

  // 色を更新
  if (config.EVENT_COLOR) {
    existingEvent.setColor(String(config.EVENT_COLOR));
  }
}

/**
 * 予定の更新が必要かチェックする
 */
function needsUpdate(sourceEvent, existingEvent, config) {
  const expectedTitle = config.COPIED_EVENT_TITLE || sourceEvent.getTitle();

  // タイトルをチェック
  if (existingEvent.getTitle() !== expectedTitle) {
    return true;
  }

  // 時間をチェック
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
function buildDescription(sourceEvent, config) {
  let description = config.SYNC_TAG + ' SourceID:' + sourceEvent.getId();

  if (config.INCLUDE_ORIGINAL_LINK) {
    const eventUrl = 'https://calendar.google.com/calendar/event?eid=' +
      Utilities.base64Encode(sourceEvent.getId().split('@')[0] + ' ' + config.SOURCE_CALENDAR_ID);
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
 * 自動同期トリガーを設定する
 */
function setupTrigger() {
  // 既存のトリガーを削除
  removeTriggers();

  // 15分ごとに実行するトリガーを作成
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
  const config = getConfig();

  const destCalendar = CalendarApp.getCalendarById(config.DESTINATION_CALENDAR_ID);
  if (!destCalendar) {
    throw new Error('コピー先カレンダーが見つかりません');
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - config.DAYS_BEFORE);

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + config.DAYS_AFTER);

  const events = destCalendar.getEvents(startDate, endDate);
  let deletedCount = 0;

  events.forEach(event => {
    const desc = event.getDescription() || '';
    if (desc.includes(config.SYNC_TAG)) {
      event.deleteEvent();
      deletedCount++;
    }
  });

  Logger.log('同期済み予定を削除しました: ' + deletedCount + '件');
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
 * 日付をフォーマットする
 */
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
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
function debug(message) {
  const config = getConfig();
  if (config.DEBUG_MODE) {
    Logger.log('[DEBUG] ' + message);
  }
}
