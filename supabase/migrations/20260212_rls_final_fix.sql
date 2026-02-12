-- ===================================
-- メンテナンスモード RLS 最終修正
-- ===================================
-- 問題: 元のポリシーは管理者のみ SELECT を許可していた。
-- 匿名ユーザー（未ログイン）は maintenance_mode を読めないため、
-- メンテナンスチェックが機能しなかった。
-- このスクリプトで全てのポリシーを整理し直します。

BEGIN;

-- 1. 既存のSELECTポリシーを全て削除（重複・競合を防ぐ）
DROP POLICY IF EXISTS "Admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public read maintenance_mode" ON public.system_settings;
DROP POLICY IF EXISTS "Public Read Maintenance" ON public.system_settings;

-- 2. 既存のwrite系ポリシーも削除して作り直す
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admin Full Access" ON public.system_settings;
DROP POLICY IF EXISTS "Allow admins all" ON public.system_settings;

-- 3. ヘルパー関数（管理者チェック用）
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 4. 新ポリシー: 誰でも maintenance_mode キーだけ読める
CREATE POLICY "Anyone can read maintenance_mode"
ON public.system_settings
FOR SELECT
TO public
USING (key = 'maintenance_mode');

-- 5. 新ポリシー: 管理者は全てのキーを読み書きできる
CREATE POLICY "Admins full access"
ON public.system_settings
FOR ALL
TO authenticated
USING ( public.check_is_admin() )
WITH CHECK ( public.check_is_admin() );

-- 6. テーブルレベルの権限付与（RLSとは別に必要）
GRANT SELECT ON TABLE public.system_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;

COMMIT;
