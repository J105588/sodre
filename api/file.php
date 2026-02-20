<?php
/**
 * api/file.php - セキュアファイル配信スクリプト
 *
 * .htaccess でのリライト経由、または直接呼び出される。
 * Supabaseの認証トークンを検証し、有効な場合のみファイルを出力する。
 *
 * パラメータ:
 *   path: ファイルパス (uploads/ 以降) - .htaccessにより自動設定される想定
 *   token: Supabase Access Token (GET param)
 */

ini_set('display_errors', 0);
require_once __DIR__ . '/.env.php';

// セキュリティヘッダー
header('X-Content-Type-Options: nosniff');

// ----------------------------------------------------
// 1. 認証トークン検証 (最優先)
// ----------------------------------------------------
$token = $_GET['token'] ?? '';
$isValid = false;

if ($token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, SUPABASE_URL . '/auth/v1/user');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . $token
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $isValid = true;
    }
}

if (!$isValid) {
    // 認証失敗時は 403 Forbidden を返す
    http_response_code(403);
    echo "Access Denied.<br>";
    echo "Debug Info:<br>";
    echo "HTTP Code: " . $httpCode . "<br>";
    echo "Response: " . htmlspecialchars($response) . "<br>";
    echo "Token provided: " . (strlen($token) > 0 ? "Yes (" . strlen($token) . " chars)" : "No") . "<br>";
    echo "Curl Error: " . curl_error($ch); 
    exit;
}

// ----------------------------------------------------
// 2. パス解析とファイル特定
// ----------------------------------------------------
$requestUri = $_SERVER['REQUEST_URI'];
// /uploads/xxxxx... の部分を取得
$path = parse_url($requestUri, PHP_URL_PATH);

// "uploads/" を除去して相対パス化 (apiディレクトリから見た uploads/.. へのマッピングのため)
// 実ファイルパスの構築: api/../uploads/path
$relPath = __DIR__ . '/..' . $path;

// トラバーサル対策
$realBase = realpath(__DIR__ . '/../uploads');
// ファイルが存在しない場合 realpath は false を返す
$realTarget = realpath($relPath);

// ----------------------------------------------------
// 3. ファイル存在確認とアクセス制御
// ----------------------------------------------------
if ($realTarget === false || strpos($realTarget, $realBase) !== 0 || !is_file($realTarget)) {
    // 認証済みだがファイルが見つからない場合は 404
    http_response_code(404);
    echo "File Not Found.";
    exit;
}

// ----------------------------------------------------
// 4. ファイル出力
// ----------------------------------------------------
$mimeType = mime_content_type($realTarget);
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($realTarget));

// キャッシュ制御 (認証付きなので、ブラウザキャッシュは少し慎重に、でもパフォーマンスのため許可)
// Privateキャッシュにする
header('Cache-Control: private, max-age=3600'); 

readfile($realTarget);
