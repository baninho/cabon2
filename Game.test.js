const { it, expect } = require('@jest/globals');
const Game = require('./Game');

Object.defineProperty(Array.prototype, 'shuffle', {
  value: function() {
      for (let i = this.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this[i], this[j]] = [this[j], this[i]];
      }
      return this;
  }
});

Object.defineProperty(Array.prototype, 'sum', {
  value: function() {
    let sum = 0;
    for (let v of this) {
      sum += v;
    }
    return sum;
  }
});

it('new Game has a main stack of 51 cards and a discard stack of one card', () => {
  let gid = 'someGameid!';

  expect(new Game(gid).stacks.main.length).toBe(51);
  expect(new Game(gid).stacks.discard.length).toBe(1);
});