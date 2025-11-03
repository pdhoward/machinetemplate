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
  textIn:   0.000004,  // $4 / 1M input tokens (example: gpt-realtime)
  textOut:  0.000016,  // $16 / 1M output tokens
  audioIn:  0.000032,  // $32 / 1M audio input
  audioOut: 0.000064,  // $64 / 1M audio output
};
export function estimateRealtimeUSD(u: Usage) {
  return (
    u.textIn  * PRICES.textIn  +
    u.textOut * PRICES.textOut +
    u.audioIn * PRICES.audioIn +
    u.audioOut* PRICES.audioOut
  );
}
