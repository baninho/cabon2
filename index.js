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

Object.defineProperty(Array.prototype, 'sum', {
  value: function() {
    let sum = 0;
    for (v of this) {
      sum += v;
    }
    return sum;
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
  constructor(id, name, cards) {
    this.id = id;
    this.name = name;
    this.cardsViewed = [];
    this.cards = cards;
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
      main: Array(52).fill(1).map((v, i) => {return new Card(Math.floor(i/4 + 0.5))}).shuffle(),
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

  startGame() {
    if (this.gameState == GameState.NOT_STARTED) {
      this.setState(GameState.STARTED);
      for (p of this.players) {
        for (c of p.cards) {
          if (c.isFaceUp()) c.flip();
        }
      }
      for (let i=0;i<4;i++) {
        // TODO: this should be returned to caller and appended to messages that
        // are sent to the room by the event handlers instead of broadcasting to 
        // all clients
        io.emit('game_event', {'i': i, 'label': 'C'});
      }
    }
  }

  swapCardWithDraw(player, ilist) {
    for (i of ilist) {
      this.stackCards.discard.push(player.cards[i].flip());
      player.cards[i] = null;
    }
    player.cards[ilist[0]] = this.stackCards.main.pop().flip();
    this.isStackFlipped = false;
  }

  swapCardWithDiscard(player, ilist) {
    card = self.stackCards.discard.pop().flip();
    for (i of ilist) {
      self.stackCards.discard.push(player.cards[i].flip());
      player.cards[i] = null;
    }
    player.cards[ilist[0]] = card;
    this.isDiscardStackTapped = false;
  }

  discardDraw() {
    this.stackCards.discard.push(this.stackCards.main.pop());
  }

  endTurn() {
    if (this.gameState === GameState.CABO) {
      this.caboCaller = self.activePlayer;
      this.setState(GameState.FINAL_ROUND);
    }

    this.activePlayer = (this.activePlayer+1) % this.players.length;

    if (this.gameState === GameState.FINAL_ROUND && this.activePlayer === this.caboCaller) self.endGame();
  }

  endGame() {
    this.setState(GameState.FINISHED);
    this.calculateScores();
    // scores are sent through handleClick()
  }

  calculateScores() {
    for (p of this.players) {
      for (c of p.cards) {
        this.scores[this.players.indexOf(p)] += c.value;
      }
    }
  }

  areCardsEqual() {
    val = this.players[this.activePlayer].cards[this.selectedCards[0]].value;
    for (i of this.selectedCards) {
      if (val != this.players[this.activePlayer].cards[i].value) return false;
    }

    return true;
  }

  // TODO: getScoreMessage
  getScoreMessage() {
    return {
      yours: this.scores[0],
      theirs: this.scores[1],
    }
  }
  // TODO: handleClick
  handleClick(i) {
    console.log('clicked: ' + i);
  }

}


game = new Game();

app.get('/test', (req, res) => {
  const count = 5;

  const data = Array(count).fill('test')

  res.json(data);

  console.log('Sent response');
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname+'/client/build/index.html'));
});

// TODO: handle routing to specified game
// TODO: handle create new game, actually creating new game and assigning an id

// add player to game when they connect
io.on('connection', (socket) => {
  console.log('a user connected with sid ' + socket.id);
  let cards = []
  
  for (let i=0;i<4;i++) cards.push(game.stackCards.main.pop())
  
  game.players.push(new Player(socket.id, socket.id, cards));
  game.scores.push(0);
  
  socket.emit('game_event', {
    i: 9, 
    label: game.stackCards.discard[game.stackCards.discard.length-1].label,
  });
  
  socket.emit('game_state', {'state': game.gameState});
  
  socket.on('message', (data) =>{
    socket.emit('debug', {received: 'message'});
    console.log('message received');
    console.log(data);
  });

  // TODO: handle click on card
  socket.on('click', (data) => {
    game.handleClick(data.i);
  });

  // TODO: handle new game button
  // TODO: handle cabo button
});


// TOOD: remove player from game when they disconnect
// TODO: handle reconnects



const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

