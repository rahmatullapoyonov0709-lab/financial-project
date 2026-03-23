const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/middleware/rateLimit');

const createRes = () => {
  const headers = {};
  return {
    statusCode: 200,
    payload: null,
    setHeader: (k, v) => { headers[k] = v; },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
};

test('rate limiter blocks after max attempts', async () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 2,
    keyPrefix: 'test-limit',
  });

  const req = { ip: '127.0.0.1' };
  let nextCalls = 0;

  limiter(req, createRes(), () => { nextCalls += 1; });
  limiter(req, createRes(), () => { nextCalls += 1; });

  const blockedRes = createRes();
  limiter(req, blockedRes, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.payload.success, false);
});
