const BoardView = require('./BoardView');
const { Game } = require('./Game');
const { expect } = require('@jest/globals');

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

describe('BoardView', () => {
  it('BoardView.getLabels() returns a list of 26 labels after it had been updated with updateAll()', () =>
  {
    const game = new Game('test_id');
    const view = new BoardView();

    view.updateAll(game.players, game.stacks);

    expect(view.getLabels().length).toBe(26);
  });
});

