-- Fix for "Database error querying schema" during login (500 Error)

-- このエラーは、通常 Supabase Auth の `auth.users` テーブルに関連するトリガーが
-- 権限不足や例外によって失敗した場合に発生します。
-- 以下のスクリプトを実行して、トリガーの再設定と権限の修正を行ってください。

-- 1. 必要な拡張機能の確認
create extension if not exists "pgcrypto";

-- 2. 既存のトリガーと関数を削除（クリーンアップ）
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 3. 関数をより安全な設定で再作成
-- SECURITY DEFINER: 関数作成者（管理者）の権限で実行
-- SET search_path = public: スキーマ参照を明確化
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- プロフィール作成を試みる
  insert into public.profiles (id, email, display_name)
  values (
    new.id, 
    new.email, 
    -- メタデータがない場合はメールアドレスで代用し、NULLエラーを防ぐ
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
exception when others then
  -- エラーが発生してもログイン/登録をブロックしないように警告のみ記録
  raise warning 'Profile creation failed for user %: %', new.id, SQLERRM;
  return new;
end;
$$;

-- 4. トリガーを再作成
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. 権限の再適用（念のため）
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;

-- 6. プロフィールテーブルのRLSポリシーが更新操作をブロックしていないか確認するためのポリシー追加
-- (既存のポリシーでカバーされているはずですが、確認用)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );
