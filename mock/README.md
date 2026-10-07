# Mock ProofHub for local testing

`python3 mock/server.py` starts a fake ProofHub v3 API on `http://127.0.0.1:8787`
(API key `testkey`, user `test@example.com`). It mimics the real API's quirks: errors as
HTTP 200 bodies, a `429` on the 5th write, the whole collection returned for a bad id.

Put real response samples in `mock/fixtures/` (`people.json`, `alltodo.json`, `alltime.json`,
`timesheets.json`, `todolists.json`) to test with realistic data; otherwise small built-in
fixtures are used. Fixtures may contain colleagues' emails — don't commit them.

Then run the app (`npm run dev`), sign in with address `127.0.0.1:8787`, key `testkey`.
