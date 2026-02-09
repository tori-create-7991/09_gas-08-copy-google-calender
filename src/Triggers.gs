/**
 * トリガー関連関数
 */

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
