-- board_postsテーブルに is_pinned カラムを追加
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 管理者のみがピン留めを変更できる関数 (RPC)
CREATE OR REPLACE FUNCTION toggle_post_pin(post_id UUID, pin_state BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- 実行ユーザーが管理者かチェック
  SELECT (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  )) INTO is_admin_user;

  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Only admins can pin posts';
  END IF;

  -- ピン留め状態を更新
  UPDATE board_posts
  SET is_pinned = pin_state
  WHERE id = post_id;
END;
$$;
