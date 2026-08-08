-- SECURITY DEFINER functions are privileged by design; the runtime role is
-- the only caller that needs them. PUBLIC has EXECUTE on functions by
-- default, so revoke it explicitly. The two functions added in the SaaS
-- migrations already revoke PUBLIC in their own migrations; this hardens the
-- pre-existing demo-reset function the same way.
REVOKE EXECUTE ON FUNCTION stockpilot_reset_demo_data(UUID) FROM PUBLIC;
