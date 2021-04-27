const express = require('express');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { is } = require('type-is');
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
    for (let v of this) {
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
  constructor(id, name, cards, socket) {
    this.id = id;
    this.name = name;
    this.cardsViewed = [];
    this.cards = cards;
    this.score = 0;
    this.socket = socket;
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
    this.selectedCardInds = [];

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
      p.cards = [];
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

    io.emit('game_event', {i: 8, label: 'C',});
    io.emit('game_event', {
      i: 9, 
      label: this.stackCards.discard[this.stackCards.discard.length-1].label,
    });
  }

  newGame() {
    this.resetScores();
    this.restart();
    this.sendScores();
  }

  setState(state) {
    this.gameState = state;
    io.emit('game_state', {'state': this.gameState});
  }

  startGame() {
    if (this.gameState == GameState.NOT_STARTED) {
      this.setState(GameState.STARTED);
      for (let p of this.players) {
        for (let c of p.cards) {
          if (c.isFaceUp()) c.flip();
        }
      }
      for (let i=0;i<4;i++) {
        // TODO: this should be returned to caller and appended to messages that
        // are sent to the room by the event handlers instead of broadcasting to 
        // all clients -- revise the message handling in general
        io.emit('game_event', {'i': i, 'label': 'C'});
      }
    }
  }

  swapCardWithDraw(player) {
    for (let i of this.selectedCardInds) {
      this.stackCards.discard.push(player.cards[i].flip());
      player.cards[i] = null;
    }
    player.cards[this.selectedCardInds[0]] = this.stackCards.main.pop().flip();
  }

  swapCardWithDiscard(player) {
    let card = this.stackCards.discard.pop().flip();
    for (let i of this.selectedCardInds) {
      this.stackCards.discard.push(player.cards[i].flip());
      player.cards[i] = null;
    }
    player.cards[this.selectedCardInds[0]] = card;
  }

  discardDraw() {
    this.discardCard(this.stackCards.main.pop());
  }

  discardCard(c) {
    this.stackCards.discard.push(c);
    io.emit('game_event', {i: 9, label: c.label});
  }

  endTurn() {
    if (this.gameState == GameState.CABO) {
      this.caboCaller = this.activePlayer;
      this.setState(GameState.FINAL_ROUND);
    }

    this.activePlayer = (this.activePlayer+1) % this.players.length;
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;

    if (this.gameState == GameState.FINAL_ROUND && this.activePlayer === this.caboCaller) this.endGame();
  }

  endGame() {
    this.setState(GameState.FINISHED);
    this.calculateScores();
    this.sendScores();
  }

  calculateScores() {
    for (let p of this.players) {
      for (let c of p.cards) {
        this.scores[this.players.indexOf(p)] += c.value;
      }

      if (this.scores[this.players.indexOf(p)] === 100) this.scores[this.players.indexOf(p)] = 50;
    }
  }

  sendScores() {
    for (let p of this.players) {
      let theirs = [];

      for (let q of this.players) {
        if (p!==q) theirs.push(this.scores[this.players.indexOf(q)]);
      }

      let data = {
        yours: this.scores[this.players.indexOf(p)],
        theirs: theirs,
      };

      p.socket.emit('scores', data);
    }
  }

  resetScores() {
    for (let i=0;i<this.scores.length;i++) this.scores[i] = 0;
  }

  areCardsEqual() {
    if (undefined === this.selectedCardInds[0]) return false;

    let val = this.players[this.activePlayer].cards[this.selectedCardInds[0]].value;
    
    for (let i of this.selectedCardInds) {
      if (val != this.players[this.activePlayer].cards[i].value) return false;
    }

    return true;
  }

  getScoreMessage() {
    return {
      yours: this.scores[0],
      theirs: this.scores[1],
    }
  }
  // all clicks on cards go through here
  // TODO: Check if things can be separated out into other functions
  handleClick(i, socket) {
    let current_player;
    let other_player;
    let isActivePlayer;
    let data = [{}];

    for (let p of this.players) {
      if (p.id === socket.id) current_player = p;
      else other_player = p; // TODO: adapt this for more than one player
    }

    isActivePlayer = this.players.indexOf(current_player) === this.activePlayer;

    if (!isActivePlayer && this.gameState != GameState.NOT_STARTED) return data;

    if (i<4) {
      // The player clicked one of their cards

      // Check if he still has a card in that spot
      if (current_player.cards[i] === null) return data;

      // If they have a card and it is before the start of the game, flip it
      // only allow two cards to be flipped using cardsViewed
      if (this.gameState == GameState.NOT_STARTED) {
        let c = current_player.cards[i];
        if (current_player.cardsViewed.length < 2 || current_player.cardsViewed.includes(c)) {
          c.flip();
          if (!current_player.cardsViewed.includes(c)) current_player.cardsViewed.push(c);
          data = [{
            i: i,
            label: c.label,
          }];
        }
      } else if (this.isStackFlipped || this.isDiscardStackTapped) {
        // The game started, now we select cards to swap for the draw
        // TODO: If the drawn card is a Peek card, flip the first selected card
        // TODO: If a Swap was discarded, this will select the card to swap with
        // an opponents card
        this.selectedCardInds.push(i);
      }
    } else if (i===8 && !this.isStackFlipped && !this.isDiscardStackTapped && isActivePlayer) {
      // This is the stack
      this.startGame();
      this.isStackFlipped = true;
      this.stackCards.main[this.stackCards.main.length -1].flip();

      data = [{i: 8, label: this.stackCards.main[this.stackCards.main.length -1].label}];

    } else if (i===9 && isActivePlayer) {
      if (!this.isStackFlipped && !this.isDiscardStackTapped) {
        this.startGame();
        this.isDiscardStackTapped = true;

        return data;
      }

      if (this.selectedCardInds && this.areCardsEqual()) {
        if (this.isStackFlipped) this.swapCardWithDraw(current_player);
        else this.swapCardWithDiscard(current_player);

        for (let i=0;i<4;i++) {
          current_player.socket.emit('game_event', {i: i, label: current_player.cards[i] === null ? '' : 'C'})
          other_player.socket.emit('game_event', {i: i+4, label: current_player.cards[i] === null ? '' : 'C'})
        }
      } else this.discardDraw();

      this.endTurn();
      this.selectedCardInds = [];
      
      data = [{i: 8, label: this.stackCards.main[this.stackCards.main.length -1].label}];
      io.emit('game_event', {i: 9, label: this.stackCards.discard[this.stackCards.discard.length -1].label})
    }
    
    return data;
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
  
  game.players.push(new Player(socket.id, socket.id, cards, socket));
  game.scores.push(0);
  
  socket.emit('game_event', {
    i: 9, 
    label: game.stackCards.discard[game.stackCards.discard.length-1].label,
  });
  
  socket.emit('game_state', {'state': game.gameState});
  
  // handle new game, cabo, next round buttons
  socket.on('message', (data) =>{
    socket.emit('debug', {received: 'message'});
    console.log('message received');
    console.log(data);
    if (data.button) {
      if (data.button === 'newgame') game.newGame();
      if (data.button === 'start') game.restart();
      if (data.button === 'cabo' && socket === game.players[game.activePlayer].socket) game.setState(GameState.CABO);
    }
  });

  // handle click on card
  socket.on('click', (data) => {
    console.log('clicked: ' + data.i);
    console.log('player sid: ' + socket.id);

    responseData = game.handleClick(data.i, socket);
    for (d of responseData) socket.emit('game_event', d);
  });



  // remove player from game when they disconnect
  socket.on('disconnect', () => {
    for (let p of game.players) {
      if (p.id === socket.id) {
        Array.prototype.push.apply(game.stackCards.main, p.cards);
        game.scores.splice(game.players.indexOf(p), 1);
        game.players.splice(game.players.indexOf(p), 1);
        break;
      }
    }
  });
});

// TODO: handle reconnects


const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

