const { setTimeout: sleep } = require('timers/promises');

describe('slow tests', () => {
  for (let i = 0; i < 5; i++) {
    test(`slow test #${i} (~500ms)`, async () => {
      await sleep(500);
      expect(true).toBe(true);
    });
  }
});
