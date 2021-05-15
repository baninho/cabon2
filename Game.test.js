const { it, expect } = require('@jest/globals');
const { Game, DISCARD_IND } = require('./Game');
const Card = require('./Card');
const Player = require('./Player');
const Client = require("socket.io-client");

const socket = new Client('http://localhost:5000');

let game;
let gid = 'someGameid!';

beforeEach(() => {
  game = new Game(gid);
  game.addNewPlayer(new Player())
  const cards = [(new Card(13)).flip(), new Card(10).flip(), new Card(11).flip(), new Card(12).flip()];
  const p = new Player('test_id', 'test_name', cards, socket);
  game.addNewPlayer(p);
});

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
  expect(new Game(gid).stacks.main.length).toBe(51);
  expect(new Game(gid).stacks.discard.length).toBe(1);
});

it('Game.discardCard() will cause the corresponding change in all players views', () => {
  let c = new Card(6);
  game.discardCard(c);
  expect(game.players[0].view.getLabels()[DISCARD_IND]).toBe(c.value);
});

it(`calculateScore for "Kamikaze": If a player has the cards 12, 12, 13, 13 they will receive 0 points 
while everyone else receives 50 points`, () => {
  let cards = [new Card(12), new Card(12), new Card(13), new Card(13)];
  let kp = new Player('_', '_', cards, socket);
  game.addNewPlayer(kp);
  kp.cards = cards;
  let kpIndex = game.players.indexOf(kp);
  let scores = game.scores.map(s => s+50);
  scores[kpIndex] -= 50;
  game.calculateScores();
  
  expect(game.scores).toEqual(scores);

});