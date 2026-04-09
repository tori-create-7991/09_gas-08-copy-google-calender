/**
 * イベント操作関数
 */

/**
 * 新しい予定を作成する
 */
function createEvent(destCalendar, sourceEvent, pair, syncTag, uniqueKey, commonConfig) {
  const title = pair.eventTitle || sourceEvent.getTitle();
  const effectiveConfig = buildEffectiveConfig(commonConfig, pair);
  const description = buildDescription(sourceEvent, pair, syncTag, uniqueKey, effectiveConfig);

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

  applyVisibilityConfig(newEvent, effectiveConfig);

  return newEvent;
}

/**
 * 既存の予定を更新する
 */
function updateEvent(existingEvent, sourceEvent, pair, syncTag, uniqueKey, commonConfig) {
  const title = pair.eventTitle || sourceEvent.getTitle();
  const effectiveConfig = buildEffectiveConfig(commonConfig, pair);

  existingEvent.setTitle(title);

  if (sourceEvent.isAllDayEvent()) {
    existingEvent.setAllDayDate(sourceEvent.getAllDayStartDate());
  } else {
    existingEvent.setTime(sourceEvent.getStartTime(), sourceEvent.getEndTime());
  }

  existingEvent.setDescription(buildDescription(sourceEvent, pair, syncTag, uniqueKey, effectiveConfig));

  if (pair.eventColor) {
    existingEvent.setColor(String(pair.eventColor));
  }

  applyVisibilityConfig(existingEvent, effectiveConfig);
}

/**
 * 予定の更新が必要かチェックする
 */
function needsUpdate(sourceEvent, existingEvent, pair, commonConfig, syncTag, uniqueKey) {
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

  // description (includeOriginalLink 差分など) の差分を検出
  const effectiveConfig = buildEffectiveConfig(commonConfig, pair);
  const expectedDesc = buildDescription(sourceEvent, pair, syncTag, uniqueKey, effectiveConfig);
  if ((existingEvent.getDescription() || '') !== expectedDesc) {
    return true;
  }

  // busy/free の差分を検出
  if (effectiveConfig.SHOW_AS_BUSY != null) {
    try {
      const expectedTransparency = effectiveConfig.SHOW_AS_BUSY
        ? CalendarApp.EventTransparency.OPAQUE
        : CalendarApp.EventTransparency.TRANSPARENT;
      if (existingEvent.getTransparency && existingEvent.getTransparency() !== expectedTransparency) {
        return true;
      }
    } catch (e) {
      // ignore (API unavailable)
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
 * 共通設定 + コピー先設定をマージした設定を作る
 */
function buildEffectiveConfig(commonConfig, pair) {
  return Object.assign({}, commonConfig, {
    SHOW_AS_BUSY: pair.showAsBusy != null ? pair.showAsBusy : commonConfig.SHOW_AS_BUSY,
    INCLUDE_ORIGINAL_LINK: pair.includeOriginalLink != null ? pair.includeOriginalLink : commonConfig.INCLUDE_ORIGINAL_LINK,
  });
}

/**
 * 予定の「予定あり/空き」を反映する
 */
function applyVisibilityConfig(event, config) {
  try {
    if (config.SHOW_AS_BUSY == null) {
      return;
    }
    event.setTransparency(
      config.SHOW_AS_BUSY ? CalendarApp.EventTransparency.OPAQUE : CalendarApp.EventTransparency.TRANSPARENT
    );
  } catch (e) {
    // ignore
  }
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
