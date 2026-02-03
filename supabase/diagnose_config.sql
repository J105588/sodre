-- Diagnose Login Error (500)
-- サーバー上で実際に動いているトリガーや権限を確認するための診断スクリプトです。
-- これを実行して、結果（Output）を確認してください。

-- 1. auth.users テーブルに設定されている全トリガーのリストアップ
select 
    trigger_schema, 
    trigger_name, 
    event_manipulation, 
    action_statement 
from information_schema.triggers 
where event_object_schema = 'auth' 
and event_object_table = 'users';

-- 2. public.profiles テーブルの権限確認
select grantee, privilege_type 
from information_schema.role_table_grants 
where table_schema = 'public' 
and table_name = 'profiles';

-- 3. 不正な外部キー制約がないか確認（authスキーマへの参照）
select 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema as foreign_table_schema,
    ccu.table_name as foreign_table_name
from 
    information_schema.table_constraints as tc 
    join information_schema.key_column_usage as kcu on tc.constraint_name = kcu.constraint_name 
    join information_schema.constraint_column_usage as ccu on ccu.constraint_name = tc.constraint_name
where ccu.table_schema = 'auth';

-- 4. publicスキーマのオーナー確認
select schema_name, schema_owner from information_schema.schemata where schema_name = 'public';
