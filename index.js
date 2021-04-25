const express = require('express');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

Object.defineProperty(Array.prototype, 'shuffle', {
  value: function() {
      for (let i = this.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this[i], this[j]] = [this[j], this[i]];
      }
      return this;
  }
});

const GameState = Object.freeze({
	NOT_STARTED: 0,
	STARTED: 1,
	CABO: 2,
	FINAL_ROUND: 3,
	FINISHED: 4,
	name: {
		0: 'NOT_STARTED',
		1: 'STARTED',
		2: 'CABO',
		3: 'FINAL_ROUND',
		4: 'FINISHED',
	},
});

class Card {
  constructor(value) {
    this.value = value;
    this.label = 'C';
  }

  flip() {
    this.label = (this.label == this.value) ? 'C' : this.value;
    return this;
  }

  isFaceUp() {
    return this.label == this.value;
  }
}

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.cardsViewed = [];
    this.cards = [];
    this.score = 0;
  }
}

class Game {
  constructor() {
    this.id = '';
    this.gameState = GameState.NOT_STARTED;
    this.players = [];
    this.stackCards = {};
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.activePlayer = 0;
    this.caboCaller = 0;
    this.peek = false;
    this.spy = false;
    this.swap = false;
    this.scores = [];
    this.selectedCards = [];

    this.restart();
  }

  restart() {
    this.stackCards = {
      main: Array(52).fill(1).map((v, i) => {return new Card(Math.floor(i/4 + 0.5))}),
      discard: [],
    };
    this.stackCards.discard.push(this.stackCards.main.pop().flip());
    for (const p of this.players) {
      p.cardsViewed = [];
      for (let j = 0; j < 4; j++) {
        p.cards.push(this.stackCards.main.pop());
      }
    }
    this.setState(GameState.NOT_STARTED);
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.activePlayer = 0;
    this.caboCaller = 0;
    this.peek = false;
    this.spy = false;
    this.swap = false;
    this.selectedCards = [];
  }

  setState(state) {
    this.gameState = state;
    io.emit('game_state', {'state': this.gameState});
  }
}

game = new Game();

app.get('/test', (req, res) => {
  const count = 5;

  const data = Array(count).fill('test')

  // Return them as json
  res.json(data);

  console.log('Sent response');
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname+'/client/build/index.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected with sid ' + socket.id);
  socket.emit('game_state', {'state': game.gameState});
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

