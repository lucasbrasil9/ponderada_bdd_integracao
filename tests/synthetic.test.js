const { add, mul } = require('../src/math');

describe('synthetic arithmetic', () => {
  for (let i = 0; i < 10; i++) {
    test(`add ${i} + ${i} = ${i * 2}`, () => {
      expect(add(i, i)).toBe(i * 2);
    });
    test(`mul ${i} * 2 = ${i * 2}`, () => {
      expect(mul(i, 2)).toBe(i * 2);
    });
  }
});
