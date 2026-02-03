-- Check Triggers on auth.users
-- このスクリプトを実行して、結果（Output）をすべてコピーして教えてください。
-- これにより、ログインを妨害している「犯人」のトリガーを特定します。

select 
    trigger_name, 
    action_statement 
from information_schema.triggers 
where event_object_schema = 'auth' 
and event_object_table = 'users';
