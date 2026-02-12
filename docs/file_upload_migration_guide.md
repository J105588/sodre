# ファイルアップロード移行手順書

## 概要

Supabase Storage から X-server ディスクストレージ（`data.sodre.jp`）へのファイルアップロード移行手順です。

---

## 1. サーバー準備

### 1.1 サブドメイン設定

1. X-server サーバーパネルにログイン
2. 「サブドメイン設定」を開く
3. `data.sodre.jp` をサブドメインとして追加
4. ドキュメントルート: `/home/ユーザー名/data.sodre.jp/public_html`
5. SSL設定（無料SSL）を有効化

### 1.2 ディレクトリ作成

サブドメインのドキュメントルート内に以下を作成：

```
data.sodre.jp/public_html/
├── api/
│   ├── upload.php
│   ├── cleanup.php
│   └── .env.php
└── uploads/
```

```bash
mkdir -p /home/ユーザー名/data.sodre.jp/public_html/api
mkdir -p /home/ユーザー名/data.sodre.jp/public_html/uploads
chmod 755 /home/ユーザー名/data.sodre.jp/public_html/uploads
```

### 1.3 uploads ディレクトリの保護（**必須**）

`uploads/.htaccess` を作成して、PHPプログラムの実行とディレクトリ一覧表示を禁止します。
リポジトリ内の `api/.htaccess_uploads` ファイルを、サーバー上の `uploads/.htaccess` として保存してください。

**`.htaccess` の内容:**
```apache
# ディレクトリリスティングの禁止
Options -Indexes

# PHPなどのスクリプト実行を禁止
<FilesMatch "\.(php|php5|php7|bg|pl|py|cgi|sh)$">
    Order Deny,Allow
    Deny from all
</FilesMatch>

# .htaccess などの隠しファイルへのアクセス禁止
<FilesMatch "^\.">
    Order Allow,Deny
    Deny from all
</FilesMatch>
```

---

## 2. API キー設定

### 2.1 安全なAPIキーの生成

以下のコマンドまたはオンラインツールでランダム文字列を生成：

```bash
openssl rand -hex 32
```

例: `a1b2c3d4e5f6...`

### 2.2 サーバー側設定

`api/.env.php` を編集し、`UPLOAD_API_KEY` を生成した値に変更：

```php
define('UPLOAD_API_KEY', 'ここに生成したキーを入力');
```

### 2.3 フロントエンド設定

`config.js` の `UPLOAD_API_KEY` を同じ値に変更：

```javascript
const UPLOAD_API_KEY = 'ここに同じキーを入力';
```

> ⚠️ **注意**: サーバーとフロントエンドのキーは**完全に一致**させてください。

---

## 3. ファイルデプロイ

### 3.1 サーバーにアップロードするファイル

| ファイル | 説明 |
|---------|------|
| `api/upload.php` | アップロードAPI |
| `api/delete.php` | ファイル削除API（投稿削除時に物理削除） |
| `api/cleanup.php` | 自動整理スクリプト |
| `api/.htaccess_uploads` | uploadsディレクトリ保護用（サーバー上で `uploads/.htaccess` にリネーム） |
| `api/.env.php` | 環境設定（APIキー設定済み） |
| `config.js` | フロントエンド設定（APIキー設定済み） |
| `members-area.html` | メンバーズエリアHTML |
| `members-area.js` | メンバーズエリアJS |
| `admin.js` | 管理画面JS |

### 3.2 デプロイ方法

FTP / ファイルマネージャーで上記ファイルをサーバーにアップロード。

---

## 4. Cronジョブ設定（自動ディスク整理）

### 4.1 X-serverコントロールパネルでの設定

1. X-server サーバーパネルにログイン
2. 「Cron設定」を開く
3. 以下を追加：

| 項目 | 値 |
|------|-----|
| 分 | 0 |
| 時 | 3 |
| 日 | 1 |
| 月 | * |
| 曜日 | * |
| コマンド | `/usr/bin/php /home/ユーザー名/data.sodre.jp/public_html/api/cleanup.php >> /home/ユーザー名/logs/cleanup.log 2>&1` |

→ **毎月1日 午前3時** に実行

### 4.2 クリーンアップの詳細設定

`cleanup.php` 内の設定：

```php
$RETENTION_DAYS = 180;  // 保持日数（デフォルト: 6ヶ月）
```

### 4.3 DB参照チェック用（任意）

`api/.env.php` に以下を追加すると、DBで参照中のファイルを保護：

```php
define('SUPABASE_URL', 'https://xxxxx.supabase.co');
define('SUPABASE_SERVICE_KEY', 'サービスキー');
```

### 4.4 テスト実行

ドライランモード（削除せずレポートのみ）：

```bash
php /home/ユーザー名/data.sodre.jp/public_html/api/cleanup.php --dry-run
```

---

## 5. テスト手順

### 5.1 アップロードテスト

1. **Members Area** で新規投稿
   - ✅ 画像ファイルをアップロード → プレビュー表示・投稿表示確認
   - ✅ PDFファイルをアップロード → ファイルアイコン表示・ダウンロードリンク確認
   - ✅ 複数ファイル同時アップロード

2. **Admin** で新規投稿
   - ✅ 画像をアップロードして投稿作成
   - ✅ 既存投稿を編集して画像追加

### 5.2 確認ポイント

- `uploads/YYYY/MM/` にファイルが保存されているか（`data.sodre.jp` ドメイン内）
- 投稿内の画像が正しく表示されるか
- 非画像ファイルのダウンロードリンクが機能するか
- Lightbox（画像拡大表示）が正常に動作するか

---

## 6. トラブルシューティング

| 症状 | 原因と対策 |
|------|-----------|
| 「認証エラー」 | APIキーの不一致 → `config.js` と `api/.env.php` のキーを確認 |
| 「許可されていないファイル形式」 | `api/upload.php` の `$allowedTypes` に拡張子を追加 |
| 「ファイルの保存に失敗」 | `uploads/` ディレクトリの権限を確認（755） |
| CORS エラー | `api/upload.php` の `$allowedOrigins` にドメインを追加 |
| ファイルサイズエラー | `MAX_FILE_SIZE`（デフォルト10MB）を変更、X-server の `php.ini` も確認 |

---

## 7. 対応ファイル形式一覧

| カテゴリ | 拡張子 |
|---------|--------|
| 画像 | jpg, jpeg, png, gif, webp, svg |
| ドキュメント | pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv |
| 圧縮 | zip, rar |
| 音声 | mp3, wav, ogg |
| 動画 | mp4, mov, avi, webm |
