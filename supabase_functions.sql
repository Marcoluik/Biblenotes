-- Function to get a user by email
CREATE OR REPLACE FUNCTION get_user_by_email(email_address TEXT)
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  WHERE au.email = email_address;
END;
$$;

-- Function to get users by IDs
CREATE OR REPLACE FUNCTION get_users_by_ids(user_ids UUID[])
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_by_ids(UUID[]) TO authenticated; 