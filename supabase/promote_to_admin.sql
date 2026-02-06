-- 複数のメールアドレスを指定して管理者権限を付与する
-- SupabaseのSQLエディタで実行してください

-- リスト内のメールアドレスを実際のものに書き換えてください（カンマ区切りで複数指定可能）
update public.profiles
set is_admin = true
where email in (
  'user1@example.com',
  'user2@example.com'
);

-- 更新結果を確認する
select * from public.profiles where is_admin = true;
