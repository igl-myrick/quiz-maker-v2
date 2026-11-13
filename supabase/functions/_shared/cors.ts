// CORS headers for the edge functions. The app and the functions are on different
// origins, so the browser sends a preflight OPTIONS request before each call.
// No cookies are involved (the session travels in the Authorization header), so "*" is safe.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
