<?php
/**
 * api/delete.php - ファイル削除API
 * 
 * 投稿削除時に呼び出され、物理ファイルを削除する。
 * 
 * リクエスト:
 *   POST /api/delete.php
 *   Headers: X-API-KEY: <API_KEY>
 *   Body: JSON { "urls": ["https://...", ...] }
 * 
 * レスポンス:
 *   { "success": true, "deleted": [...], "errors": [...] }
 */

// エラー表示OFF
ini_set('display_errors', 0);
error_reporting(E_ALL);

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
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: X-API-KEY, Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// 認証
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey !== UPLOAD_API_KEY) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => '認証エラー']);
    exit;
}

// データ取得
$input = json_decode(file_get_contents('php://input'), true);
$urls = $input['urls'] ?? [];

if (empty($urls)) {
    echo json_encode(['success' => true, 'deleted' => []]);
    exit;
}

$deleted = [];
$errors = [];

foreach ($urls as $url) {
    // 自サイトのURLかチェック
    if (strpos($url, SITE_URL) !== 0) {
        // 外部URLや古いSupabaseのURLは無視
        continue;
    }

    // パス解析: https://data.sodre.jp/uploads/2026/02/xxx.jpg -> uploads/2026/02/xxx.jpg
    $relativePath = str_replace(SITE_URL . '/', '', $url);
    
    // ディレクトリトラバーサル対策
    if (strpos($relativePath, '..') !== false) {
        $errors[] = "$url: 不正なパスです";
        continue;
    }

    // UPLOAD_DIR は .../public_html/uploads を指している
    // relativePath は uploads/2026/02/xxx.jpg
    // 結合時は public_html/uploads/uploads/... にならないよう注意
    // .env.php の設定: 
    // define('UPLOAD_DIR', __DIR__ . '/../uploads');
    // define('SITE_URL', 'https://data.sodre.jp');
    
    // URL構造: https://data.sodre.jp/uploads/2026/02/file.png
    // relativePath: uploads/2026/02/file.png
    
    // 物理パス変換
    // UPLOAD_DIR は .../public_html/uploads
    // なので、uploads/ を取り除いて結合するか、親へ遡る
    
    $pathParts = explode('/', $relativePath);
    // $pathParts[0] は 'uploads' になっているはず
    if ($pathParts[0] !== 'uploads') {
        $errors[] = "$url: uploadsディレクトリ外です";
        continue;
    }
    
    // uploads/ を除去してファイル名部分を取得
    array_shift($pathParts);
    $subPath = implode('/', $pathParts); // 2026/02/file.png
    
    $fullPath = UPLOAD_DIR . '/' . $subPath;
    
    if (file_exists($fullPath)) {
        if (unlink($fullPath)) {
            $deleted[] = $url;
        } else {
            $errors[] = "$url: 削除に失敗しました";
        }
    } else {
        // ファイルがない場合は削除済みとみなす
        $deleted[] = $url;
    }
}

echo json_encode([
    'success' => true,
    'deleted' => $deleted,
    'errors' => $errors
]);
