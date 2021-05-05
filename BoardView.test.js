const BoardView = require('./BoardView');
const { Game } = require('./Game');
const Client = require("socket.io-client");
const Player = require('./Player');
const { expect, it } = require('@jest/globals');
const Card = require('./Card');

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

  it("BoardView.getLabels() are equal to the ones of the player's cards passed in through updatePlayer()", () => {
    const game = new Game('test_id');
    const view = new BoardView();
    const cards = [(new Card(13)).flip(), new Card(10).flip(), new Card(11).flip(), new Card(12).flip()];
    const socket = new Client('http://localhost:5000');
    const p = new Player('test_id', 'test_name', cards, socket);

    view.updatePlayer(p, 0);
    expect(view.getLabels().slice(0, 6)).toStrictEqual([13, 10, 11, 12, '', '']);
  });
});

