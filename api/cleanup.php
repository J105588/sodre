<?php
/**
 * api/cleanup.php - ディスク自動整理スクリプト
 * 
 * X-server の Cron ジョブで定期実行する。
 * uploads/ ディレクトリ内の古いファイルを整理する。
 * 
 * 使用方法:
 *   php api/cleanup.php               → 実行（削除実行）
 *   php api/cleanup.php --dry-run      → ドライラン（削除せずレポートのみ）
 * 
 * Cron設定例（毎月1日 午前3時に実行）:
 *   0 3 1 * * /usr/bin/php /home/ユーザー名/sodre.jp/public_html/api/cleanup.php >> /home/ユーザー名/logs/cleanup.log 2>&1
 */

// 環境設定読み込み
require_once __DIR__ . '/.env.php';

// --- 設定 ---
$RETENTION_DAYS = 180;          // 保持日数（6ヶ月）
$LOG_FILE = __DIR__ . '/cleanup.log';

// Supabase接続情報（DBからファイル参照チェック用）
// .env.phpに追加することを推奨
$SUPABASE_URL = defined('SUPABASE_URL') ? SUPABASE_URL : '';
$SUPABASE_KEY = defined('SUPABASE_SERVICE_KEY') ? SUPABASE_SERVICE_KEY : '';

// ドライランモード判定
$isDryRun = in_array('--dry-run', $argv ?? []);

// --- ログ関数 ---
function logMessage($message, $logFile) {
    $timestamp = date('Y-m-d H:i:s');
    $line = "[{$timestamp}] {$message}\n";
    echo $line;
    file_put_contents($logFile, $line, FILE_APPEND);
}

// --- メイン処理 ---
logMessage("=== クリーンアップ開始 " . ($isDryRun ? "(ドライラン)" : "(実行モード)") . " ===", $LOG_FILE);
logMessage("保持期間: {$RETENTION_DAYS}日", $LOG_FILE);

$uploadDir = UPLOAD_DIR;

if (!is_dir($uploadDir)) {
    logMessage("エラー: アップロードディレクトリが見つかりません: {$uploadDir}", $LOG_FILE);
    exit(1);
}

// --- ステップ1: 使用中のファイルURLをDBから取得 ---
$usedUrls = [];

if ($SUPABASE_URL && $SUPABASE_KEY) {
    logMessage("DBから使用中ファイルを取得中...", $LOG_FILE);
    
    // board_posts テーブルから images カラムを取得
    $tables = ['board_posts', 'posts'];
    
    foreach ($tables as $table) {
        $url = "{$SUPABASE_URL}/rest/v1/{$table}?select=images";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "apikey: {$SUPABASE_KEY}",
                "Authorization: Bearer {$SUPABASE_KEY}",
                "Content-Type: application/json"
            ],
            CURLOPT_TIMEOUT => 30
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200 && $response) {
            $rows = json_decode($response, true);
            if (is_array($rows)) {
                foreach ($rows as $row) {
                    if (!empty($row['images']) && is_array($row['images'])) {
                        foreach ($row['images'] as $imageUrl) {
                            $usedUrls[$imageUrl] = true;
                        }
                    }
                }
            }
            logMessage("  {$table}: " . count($rows) . " 件のレコードをチェック", $LOG_FILE);
        } else {
            logMessage("  警告: {$table} からデータ取得に失敗 (HTTP {$httpCode})", $LOG_FILE);
        }
    }
    
    logMessage("使用中ファイル数: " . count($usedUrls), $LOG_FILE);
} else {
    logMessage("警告: Supabase接続情報が未設定のため、DBチェックをスキップします", $LOG_FILE);
    logMessage("  ※ 古いファイルのみを対象に削除します（参照チェックなし）", $LOG_FILE);
}

// --- ステップ2: ファイルスキャン ---
$cutoffTime = time() - ($RETENTION_DAYS * 24 * 60 * 60);
$totalFiles = 0;
$deletedFiles = 0;
$skippedFiles = 0;
$freedBytes = 0;

$dirIterator = new RecursiveDirectoryIterator($uploadDir, RecursiveDirectoryIterator::SKIP_DOTS);
$iterator = new RecursiveIteratorIterator($dirIterator);

foreach ($iterator as $file) {
    if (!$file->isFile()) continue;
    
    $totalFiles++;
    $filePath = $file->getPathname();
    $fileTime = $file->getMTime();
    $fileSize = $file->getSize();
    
    // .htaccess等のシステムファイルはスキップ
    $basename = $file->getBasename();
    if (strpos($basename, '.') === 0) continue;
    
    // 保持期間内のファイルはスキップ
    if ($fileTime > $cutoffTime) continue;
    
    // DBで使用中のファイルはスキップ
    // ファイルパスからURLを構築してチェック
    $relativePath = str_replace('\\', '/', str_replace(realpath(UPLOAD_DIR), '', realpath($filePath)));
    $relativePath = ltrim($relativePath, '/');
    $fileUrl = SITE_URL . '/uploads/' . $relativePath;
    
    if (isset($usedUrls[$fileUrl])) {
        $skippedFiles++;
        logMessage("  保持 (DB参照あり): {$relativePath}", $LOG_FILE);
        continue;
    }
    
    // 削除実行
    if ($isDryRun) {
        $age = round((time() - $fileTime) / 86400);
        $sizeKB = round($fileSize / 1024, 1);
        logMessage("  [ドライラン] 削除対象: {$relativePath} ({$sizeKB}KB, {$age}日前)", $LOG_FILE);
    } else {
        if (unlink($filePath)) {
            logMessage("  削除: {$relativePath}", $LOG_FILE);
        } else {
            logMessage("  エラー: 削除失敗 {$relativePath}", $LOG_FILE);
            continue;
        }
    }
    
    $deletedFiles++;
    $freedBytes += $fileSize;
}

// --- ステップ3: 空ディレクトリの削除 ---
if (!$isDryRun) {
    $dirs = [];
    $dirIterator2 = new RecursiveDirectoryIterator($uploadDir, RecursiveDirectoryIterator::SKIP_DOTS);
    $iterator2 = new RecursiveIteratorIterator($dirIterator2, RecursiveIteratorIterator::CHILD_FIRST);
    
    foreach ($iterator2 as $item) {
        if ($item->isDir()) {
            $dirPath = $item->getPathname();
            // ディレクトリが空なら削除
            if (count(scandir($dirPath)) === 2) { // . と .. のみ
                rmdir($dirPath);
                logMessage("  空ディレクトリ削除: {$dirPath}", $LOG_FILE);
            }
        }
    }
}

// --- サマリー ---
$freedMB = round($freedBytes / (1024 * 1024), 2);
logMessage("", $LOG_FILE);
logMessage("=== サマリー ===", $LOG_FILE);
logMessage("総ファイル数: {$totalFiles}", $LOG_FILE);
logMessage("削除" . ($isDryRun ? "対象" : "済み") . ": {$deletedFiles} ファイル ({$freedMB}MB)", $LOG_FILE);
logMessage("保持 (DB参照): {$skippedFiles} ファイル", $LOG_FILE);
logMessage("=== クリーンアップ完了 ===", $LOG_FILE);
logMessage("", $LOG_FILE);
