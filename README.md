# Google Calendar 同期スクリプト (GAS)

同じGoogleアカウント内の別カレンダー（共有カレンダーなど）から予定をコピーして同期するGoogle Apps Scriptです。

## 機能

- 共有カレンダーの予定を自分のカレンダーにコピー
- 予定のタイトルを「予定あり」に変換（プライバシー保護）
- 自動同期（15分/1時間ごと）
- 予定の追加・変更・削除を自動追従
- 終日イベントにも対応

## セットアップ

### 1. Google Apps Script プロジェクトの作成

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 「新しいプロジェクト」を作成
3. `Code.gs` と `Config.gs` の内容をコピー

### 2. カレンダーIDの確認

カレンダーIDを確認するには:

1. [Google カレンダー](https://calendar.google.com/) を開く
2. 左サイドバーのカレンダー名にカーソルを合わせ、3点メニュー → 「設定と共有」
3. 「カレンダーの統合」セクションの「カレンダーID」をコピー

または、スクリプトで `listCalendars()` を実行すると、利用可能なカレンダー一覧が表示されます。

### 3. 設定

`Config.gs` を開いて以下を設定:

```javascript
// コピー元カレンダーのID（共有カレンダーなど）
SOURCE_CALENDAR_ID: 'example@group.calendar.google.com',

// コピー先カレンダーのID（'primary' でメインカレンダー）
DESTINATION_CALENDAR_ID: 'primary',
```

### 4. 実行とテスト

1. `syncCalendars` 関数を選択して実行
2. 初回は権限の承認が必要です
3. ログで結果を確認

### 5. 自動同期の設定

定期的に自動同期するには:

- `setupTrigger()` を実行 → 15分ごとに同期
- `setupHourlyTrigger()` を実行 → 1時間ごとに同期

## 設定オプション

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `COPIED_EVENT_TITLE` | コピーした予定のタイトル | `'予定あり'` |
| `DAYS_BEFORE` | 過去何日分を同期 | `7` |
| `DAYS_AFTER` | 未来何日分を同期 | `30` |
| `EVENT_COLOR` | 予定の色（1-11） | `8`（グレー） |
| `COPY_ALL_DAY_EVENTS` | 終日イベントもコピー | `true` |
| `SHOW_AS_BUSY` | 「予定あり」として表示 | `true` |

## 便利な関数

| 関数名 | 説明 |
|-------|------|
| `syncCalendars()` | 手動で同期を実行 |
| `listCalendars()` | 利用可能なカレンダー一覧を表示 |
| `setupTrigger()` | 15分ごとの自動同期を設定 |
| `setupHourlyTrigger()` | 1時間ごとの自動同期を設定 |
| `removeTriggers()` | 自動同期を停止 |
| `clearSyncedEvents()` | 同期した予定をすべて削除 |

## 注意事項

- コピー元カレンダーへのアクセス権限が必要です
- Google Apps Script の実行時間制限（6分/回）があります
- 大量の予定がある場合は `DAYS_BEFORE` / `DAYS_AFTER` を小さくしてください

## ライセンス

MIT License