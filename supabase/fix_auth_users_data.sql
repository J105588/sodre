-- Fix Corrupt Auth Users & Trigger
-- 症状: ログイン時に "Database error querying schema" (500)
-- 原因: 管理画面から作成したユーザーの `auth.users` テーブルの必須カラム（confirmation_token等）が
-- NULLになっており、Supabase Authが更新時にエラーを起こしている。

-- 1. 既存の「壊れた」ユーザーデータを修復
-- NULLになっているカラムを空文字('')に更新する
update auth.users
set 
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token = coalesce(recovery_token, '')
where 
  confirmation_token is null 
  or email_change is null 
  or email_change_token_new is null 
  or recovery_token is null;

-- 2. トリガー関数 `process_new_user` を修正
-- 今後作成されるユーザーが正しいデータを持つようにする
create or replace function public.process_new_user()
returns trigger as $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
begin
  if new.status = 'pending' then
    begin
      -- パスワードハッシュ化
      v_encrypted_pw := crypt(new.initial_password, gen_salt('bf'));
      
      -- auth.users に挿入（必須カラムを明示的に空文字で埋める）
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        -- 追加: 必須カラム
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        uuid_generate_v4(),
        'authenticated',
        'authenticated',
        new.email,
        v_encrypted_pw,
        now(),
        null,
        null,
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', new.display_name),
        now(),
        now(),
        -- 追加: 空文字を設定
        '',
        '',
        '',
        ''
      ) returning id into v_user_id;

      -- user_management テーブルの状態更新
      update public.user_management
      set status = 'created',
          error_message = null,
          initial_password = '***'
      where id = new.id;
      
    exception when others then
      update public.user_management
      set status = 'error',
          error_message = SQLERRM
      where id = new.id;
    end;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- 3. プロフィール作成トリガーの再適用（念のため）
-- 先どのステップで削除していた場合は復活させる
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
