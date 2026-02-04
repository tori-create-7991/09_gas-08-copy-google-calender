# Google Calendar 同期スクリプト (GAS)

同じGoogleアカウント内の複数カレンダー（共有カレンダーなど）から予定をコピーして同期するGoogle Apps Scriptです。

## 機能

- **複数カレンダー対応**: 複数の共有カレンダーを一括で同期
- 予定のタイトルを「予定あり」に変換（プライバシー保護）
- カレンダーごとに異なる色・タイトルを設定可能
- 自動同期（15分/1時間ごと）
- 予定の追加・変更・削除を自動追従
- 終日イベントにも対応

## ファイル構成

```
├── src/
│   ├── Code.gs          # メインスクリプト
│   ├── Config.gs        # 設定ファイル
│   └── appsscript.json  # GAS設定
├── .github/workflows/
│   └── deploy.yml       # 自動デプロイ設定
├── package.json
└── README.md
```

## セットアップ

### 方法1: 手動コピー

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 「新しいプロジェクト」を作成
3. `src/Code.gs` と `src/Config.gs` の内容をコピー

### 方法2: clasp を使用（推奨）

#### ローカル環境でのセットアップ

```bash
# claspをインストール
npm install -g @google/clasp

# Googleアカウントでログイン
clasp login

# 新しいGASプロジェクトを作成
clasp create --title "Calendar Sync" --rootDir src

# または既存のプロジェクトに接続
# .clasp.json を作成:
# {
#   "scriptId": "YOUR_SCRIPT_ID",
#   "rootDir": "src"
# }

# コードをプッシュ
clasp push
```

#### GitHub Actions 自動デプロイの設定

1. **GASプロジェクトのスクリプトIDを取得**
   - GASエディタ → プロジェクトの設定 → スクリプトID

2. **clasp認証情報を取得**
   ```bash
   clasp login
   cat ~/.clasprc.json
   ```

3. **GitHubリポジトリのSecretsを設定**
   - `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
   - `SCRIPT_ID`: GASのスクリプトID
   - `CLASPRC_JSON`: `~/.clasprc.json` の内容をそのまま貼り付け

4. **mainブランチにpushすると自動デプロイ**

### 2. カレンダーIDの確認

カレンダーIDを確認するには:

1. [Google カレンダー](https://calendar.google.com/) を開く
2. 左サイドバーのカレンダー名にカーソルを合わせ、3点メニュー → 「設定と共有」
3. 「カレンダーの統合」セクションの「カレンダーID」をコピー

または、スクリプトで `listCalendars()` を実行すると、利用可能なカレンダー一覧が表示されます。

### 3. 設定

`src/Config.gs` の `getSyncPairs()` を編集して、同期するカレンダーペアを設定:

```javascript
function getSyncPairs() {
  return [
    // 同期ペア 1
    {
      name: '仕事カレンダー',           // 識別用の名前
      sourceCalendarId: 'work@group.calendar.google.com',
      destCalendarId: 'primary',       // メインカレンダーにコピー
      eventTitle: '予定あり',           // コピー後のタイトル
      eventColor: 8,                   // グレー
    },
    // 同期ペア 2
    {
      name: 'チームカレンダー',
      sourceCalendarId: 'team@group.calendar.google.com',
      destCalendarId: 'primary',
      eventTitle: '予定あり',
      eventColor: 7,                   // 青緑
    },
    // 必要に応じて追加...
  ];
}
```

### 4. 実行とテスト

1. `syncCalendars` 関数を選択して実行
2. 初回は権限の承認が必要です
3. ログで結果を確認

### 5. 自動同期の設定

定期的に自動同期するには:

- `setupTrigger()` を実行 → 15分ごとに同期
- `setupHourlyTrigger()` を実行 → 1時間ごとに同期

## 同期ペアの設定項目

| 項目 | 説明 | 例 |
|------|------|-----|
| `name` | 識別用の名前（ログ表示用） | `'仕事カレンダー'` |
| `sourceCalendarId` | コピー元カレンダーID | `'xxx@group.calendar.google.com'` |
| `destCalendarId` | コピー先カレンダーID | `'primary'` |
| `eventTitle` | コピー後のタイトル（空文字で元タイトル） | `'予定あり'` |
| `eventColor` | 予定の色（1-11） | `8` |

## イベントカラー一覧

| 番号 | 色 |
|------|-----|
| 1 | ラベンダー |
| 2 | セージ |
| 3 | ブドウ |
| 4 | フラミンゴ |
| 5 | バナナ |
| 6 | ミカン |
| 7 | ピーコック |
| 8 | グラファイト |
| 9 | ブルーベリー |
| 10 | バジル |
| 11 | トマト |

## 共通設定 (getCommonConfig)

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `DAYS_BEFORE` | 過去何日分を同期 | `7` |
| `DAYS_AFTER` | 未来何日分を同期 | `30` |
| `COPY_ALL_DAY_EVENTS` | 終日イベントもコピー | `true` |
| `DEBUG_MODE` | デバッグログを出力 | `false` |

## 便利な関数

| 関数名 | 説明 |
|-------|------|
| `syncCalendars()` | 手動で同期を実行 |
| `listCalendars()` | 利用可能なカレンダー一覧を表示 |
| `setupTrigger()` | 15分ごとの自動同期を設定 |
| `setupHourlyTrigger()` | 1時間ごとの自動同期を設定 |
| `removeTriggers()` | 自動同期を停止 |
| `clearSyncedEvents()` | 全ペアの同期予定を削除 |
| `clearSyncedEventsForPair(index)` | 特定ペアの同期予定を削除 |

## 注意事項

- コピー元カレンダーへのアクセス権限が必要です
- Google Apps Script の実行時間制限（6分/回）があります
- 大量の予定がある場合は `DAYS_BEFORE` / `DAYS_AFTER` を小さくしてください

## ライセンス

MIT License
