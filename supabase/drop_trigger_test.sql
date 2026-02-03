-- Drop Trigger Test
-- 原因切り分けのため、一時的にすべてのカスタムトリガーを削除します。
-- これを実行した後、再度「ログイン」を試してください。

-- 1. トリガー削除
drop trigger if exists on_auth_user_created on auth.users;

-- 2. 関数削除
drop function if exists public.handle_new_user();

-- これでログインできるようになった場合、「トリガーが原因」と確定します。
-- まだエラーが出る場合、Supabaseのプロジェクト設定やデータベース自体（列不足など）に問題があります。
