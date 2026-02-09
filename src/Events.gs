/**
 * イベント操作関数
 */

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
