-- セキュリティ修正: admin_email / admin_password を system_settings から削除
-- これらの認証情報は Supabase Auth に既に存在するため、テーブルに保存する必要はありません。

BEGIN;

-- 1. トリガーを削除（admin_email/admin_password 変更時に auth.users を更新するトリガー）
DROP TRIGGER IF EXISTS on_system_settings_change ON public.system_settings;

-- 2. トリガー関数を削除
DROP FUNCTION IF EXISTS public.sync_admin_user();

-- 3. 認証情報のレコードを削除
DELETE FROM public.system_settings WHERE key IN ('admin_email', 'admin_password');

COMMIT;
