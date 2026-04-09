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

   **通常の環境（ブラウザあり）:**
   ```bash
   clasp login
   cat ~/.clasprc.json
   ```

   **Docker/SSH等のヘッドレス環境:**
   ```bash
   # --no-localhost オプションでURLが表示される
   clasp login --no-localhost

   # 表示されたURLをブラウザがある別のPCで開く
   # Googleアカウントで認証後、表示される認証コードをコピー
   # CLIに貼り付けてEnter

   # 認証情報を確認
   cat ~/.clasprc.json
   ```

3. **GitHubリポジトリのSecretsを設定**
   - `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
   - `SCRIPT_ID`: GASのスクリプトID
   - `CLASPRC_JSON`: `~/.clasprc.json` の内容をそのまま貼り付け
   - `SYNC_PAIRS_JSON`: 同期ペア設定のJSON（下記参照）

4. **`SYNC_PAIRS_JSON` の設定**

   カレンダーIDなどの機密情報はGitHubリポジトリに含めず、Secretsから注入します。
   以下のJSON形式で設定してください:

   ```json
   [
     {
       "name": "仕事カレンダー",
       "sourceCalendarId": "work@group.calendar.google.com",
       "destCalendarIds": ["primary", "shared@group.calendar.google.com"],
       "eventTitle": "予定あり",
       "eventColor": 8
     },
     {
       "name": "チームカレンダー",
       "sourceCalendarId": "team@group.calendar.google.com",
       "destCalendarIds": ["primary"],
       "eventTitle": "",
       "eventColor": 7
     }
   ]
   ```

   | フィールド | 必須 | 説明 |
   |-----------|------|------|
   | `name` | ○ | 識別用の名前（ログ表示用） |
   | `sourceCalendarId` | ○ | コピー元カレンダーID（メールアドレス形式） |
   | `destCalendarIds` | ○ | コピー先カレンダーIDの**配列**（複数指定可） |
   | `destCalendarId` | | 後方互換用（単数指定、`destCalendarIds` 優先） |
   | `eventTitle` | | コピー後のタイトル（空文字 `""` で元のタイトルを使用） |
   | `eventColor` | | 予定の色 1-11（省略でデフォルト色） |

   > **Note**: `SYNC_PAIRS_JSON` が未設定の場合、`src/Config.gs` のデフォルト値がそのまま使われます。

5. **mainブランチにpushすると自動デプロイ**

### 2. カレンダーIDの確認

カレンダーIDを確認するには:

1. [Google カレンダー](https://calendar.google.com/) を開く
2. 左サイドバーのカレンダー名にカーソルを合わせ、3点メニュー → 「設定と共有」
3. 「カレンダーの統合」セクションの「カレンダーID」をコピー

または、スクリプトで `listCalendars()` を実行すると、利用可能なカレンダー一覧が表示されます。

### 3. 設定

`src/Config.gs` の `getSyncPairsRaw()` を編集して、同期するカレンダーペアを設定:

```javascript
function getSyncPairsRaw() {
  return [
    // 同期ペア 1（複数のコピー先に対応）
    {
      name: '仕事カレンダー',
      sourceCalendarId: 'work@group.calendar.google.com',
      destCalendarIds: ['primary', 'shared@group.calendar.google.com'],
      eventTitle: '予定あり',
      eventColor: 8,
    },
    // 同期ペア 2
    {
      name: 'チームカレンダー',
      sourceCalendarId: 'team@group.calendar.google.com',
      destCalendarIds: ['primary'],
      eventTitle: '',     // 空文字で元のタイトルを使用
      eventColor: 7,
    },
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
| `destCalendarIds` | コピー先カレンダーIDの配列（複数指定可） | `['primary', 'shared@group.calendar.google.com']` |
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
