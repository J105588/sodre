<?php
/**
 * api/upload.php - ファイルアップロードAPI
 * 
 * Supabase Storage の代わりに X-server ディスクへファイルを保存する。
 * フロントエンドから fetch() で呼び出される。
 * 
 * リクエスト:
 *   POST /api/upload.php
 *   Headers: X-API-KEY: <API_KEY>
 *   Body: multipart/form-data (files[] = ファイル)
 * 
 * レスポンス:
 *   成功: { "success": true, "urls": ["https://sodre.jp/uploads/2026/02/xxxxx.jpg", ...] }
 *   失敗: { "success": false, "error": "エラーメッセージ" }
 */

// エラー表示OFF（本番環境）
ini_set('display_errors', 0);
error_reporting(E_ALL);

// 環境設定読み込み
require_once __DIR__ . '/.env.php';

// CORS設定
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// ローカル開発用ドメイン
$localOrigins = [
    'http://localhost',
    'http://localhost:5500',
    'http://127.0.0.1',
    'http://127.0.0.1:5500'
];

// .sodre.jp のサブドメインを含むすべての sodre.jp ドメインを許可
$isAllowed = false;
if (in_array($origin, $localOrigins)) {
    $isAllowed = true;
} elseif (preg_match('/^https?:\/\/([a-zA-Z0-9-]+\.)*sodre\.jp$/', $origin)) {
    $isAllowed = true;
}

if ($isAllowed) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // デフォルトフォールバック（または拒否）
    header("Access-Control-Allow-Origin: https://sodre.jp");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: X-API-KEY, Content-Type");
header("Content-Type: application/json; charset=utf-8");

// OPTIONSプリフライトリクエスト処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// POSTのみ許可
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// API認証キー検証
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey !== UPLOAD_API_KEY) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => '認証エラー']);
    exit;
}

// 許可されるファイル拡張子とMIMEタイプ
$allowedTypes = [
    // 画像
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
    'gif'  => ['image/gif'],
    'webp' => ['image/webp'],
    'svg'  => ['image/svg+xml'],
    // ドキュメント
    'pdf'  => ['application/pdf'],
    'doc'  => ['application/msword'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'xls'  => ['application/vnd.ms-excel'],
    'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'ppt'  => ['application/vnd.ms-powerpoint'],
    'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    'txt'  => ['text/plain'],
    'csv'  => ['text/csv', 'text/plain'],
    // 圧縮
    'zip'  => ['application/zip', 'application/x-zip-compressed'],
    'rar'  => ['application/x-rar-compressed', 'application/vnd.rar'],
    // 音声
    'mp3'  => ['audio/mpeg'],
    'wav'  => ['audio/wav', 'audio/x-wav'],
    'ogg'  => ['audio/ogg'],
    // 動画
    'mp4'  => ['video/mp4'],
    'mov'  => ['video/quicktime'],
    'avi'  => ['video/x-msvideo'],
    'webm' => ['video/webm'],
];

// ファイルの存在チェック
if (empty($_FILES['files'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ファイルが選択されていません']);
    exit;
}

// アップロードディレクトリ作成
$yearMonth = date('Y/m');
$uploadDir = UPLOAD_DIR . '/' . $yearMonth;
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$uploadedUrls = [];
$errors = [];
$files = $_FILES['files'];

// 複数ファイル対応のため配列に正規化
$fileCount = is_array($files['name']) ? count($files['name']) : 1;

for ($i = 0; $i < $fileCount; $i++) {
    $name     = is_array($files['name'])     ? $files['name'][$i]     : $files['name'];
    $tmpName  = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
    $error    = is_array($files['error'])    ? $files['error'][$i]    : $files['error'];
    $size     = is_array($files['size'])     ? $files['size'][$i]     : $files['size'];
    $mimeType = is_array($files['type'])     ? $files['type'][$i]     : $files['type'];

    // アップロードエラーチェック
    if ($error !== UPLOAD_ERR_OK) {
        $errors[] = "{$name}: アップロードエラー (code: {$error})";
        continue;
    }

    // ファイルサイズチェック
    if ($size > MAX_FILE_SIZE) {
        $maxMB = MAX_FILE_SIZE / (1024 * 1024);
        $errors[] = "{$name}: ファイルサイズが{$maxMB}MBを超えています";
        continue;
    }

    // 拡張子チェック
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!isset($allowedTypes[$ext])) {
        $errors[] = "{$name}: 許可されていないファイル形式です ({$ext})";
        continue;
    }

    // MIMEタイプ検証（finfo使用）
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detectedMime = $finfo->file($tmpName);

    // 一部のファイルはMIMEタイプの検出が不正確な場合がある
    // 拡張子との整合性をチェック（厳密すぎない）
    $validMimes = $allowedTypes[$ext];
    // application/octet-stream は多くのファイル形式で返される可能性があるため許容
    if (!in_array($detectedMime, $validMimes) && $detectedMime !== 'application/octet-stream') {
        $errors[] = "{$name}: ファイル形式が不正です (detected: {$detectedMime})";
        continue;
    }

    // ユニークファイル名生成
    $uniqueName = time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $destPath = $uploadDir . '/' . $uniqueName;

    // ファイル保存
    if (move_uploaded_file($tmpName, $destPath)) {
        // 公開URL生成（クエリパラメータに元のファイル名を付与）
        // これにより、フロントエンドで元のファイル名を表示・取得できるようにする
        $publicUrl = SITE_URL . '/uploads/' . $yearMonth . '/' . $uniqueName . '?name=' . urlencode($originalName);
        $uploadedUrls[] = $publicUrl;
    } else {
        $errors[] = "{$name}: ファイルの保存に失敗しました";
    }
}

// レスポンス
if (count($uploadedUrls) > 0) {
    $response = ['success' => true, 'urls' => $uploadedUrls];
    if (count($errors) > 0) {
        $response['warnings'] = $errors;
    }
    echo json_encode($response);
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => implode('; ', $errors)]);
}
