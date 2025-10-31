// cost model - check rates against openai
/*
Wire your /api/auth/usage increments to pass { tokens, dollars } using 
that estimator from the Realtime response.done usage payloads. 
When auth.usage.dollars crosses USER_MAX_DOLLARS_DAILY, 
your existing quota cut-off stops the session.

Notes: OpenAI occasionally updates pricing; rely on their 
page for the numbers and adjust constants accordingly. 
Audio tokens usually dominate voice calls.

*/
type Usage = { textIn: number; textOut: number; audioIn: number; audioOut: number }; // tokens
const PRICES = {
  // update from pricing page as needed
  textIn:   0.000005,   // $5 / 1M  (example historical)
  textOut:  0.00002,    // $20 / 1M (example historical)
  audioIn:  0.000032,   // $32 / 1M
  audioOut: 0.000064,   // $64 / 1M
};
export function estimateRealtimeUSD(u: Usage) {
  return (
    u.textIn  * PRICES.textIn  +
    u.textOut * PRICES.textOut +
    u.audioIn * PRICES.audioIn +
    u.audioOut* PRICES.audioOut
  );
}
