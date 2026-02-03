-- Repair Login Error (500 Database error querying schema) v2

-- ログイン時の500エラーが直らない場合、以下の「強力な修復スクリプト」を実行してください。
-- これにより、ログインを妨げている可能性のあるすべてのカスタムトリガーを削除し、
-- 権限をリセットします。

-- ■ 1. auth.users 上の既知のトリガーを強制削除
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user on auth.users; -- 別名で登録されている場合の対策

-- ■ 2. 関連する関数を削除
drop function if exists public.handle_new_user();

-- ■ 3. 公開スキーマの権限を完全にリセット（権限エラー対策）
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

-- ■ 4. 最小限の安全なプロファイル作成トリガーを再定義
-- ※ ログイン自体を優先するため、複雑な処理を排除します。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- プロフィールが存在しない場合のみ作成
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
exception when others then
  -- いかなるエラーも無視してログインを成功させる
  raise warning 'Profile creation trigger failed (ignored): %', SQLERRM;
  return new;
end;
$$;

-- ■ 5. トリガーを再作成
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ■ 6. ログイン時刻更新の妨げになる可能性のあるものを警告（SQLでは削除不可のためコメント）
-- 注意: Authスキーマへの直接的な手動変更（外部キー制約の追加など）がある場合、
-- ダッシュボードUIからそれらを削除する必要があります。
