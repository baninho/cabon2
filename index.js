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

const GameState = require('./GameState');
const Player = require('./Player');
const Game = require('./Game');

const games = [];

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

  let game;
  let gameIds = games.map((game) => game.id);

  socket.on('url', (data) => {
    
    let gameId = path.basename(data.url);
    console.log(gameId);
    if (!gameIds.includes(gameId)) {
      console.log('pushing game id ' + gameId);
      games.push(new Game(gameId));
      gameIds = games.map((game) => {return game.id});
    }
  
    game = games[gameIds.indexOf(gameId)];
    socket.join(game.id);
  
    let cards = []
    
    for (let i=0;i<4;i++) cards.push(game.stackCards.main.pop());
    
    game.players.push(new Player(socket.id, socket.id, cards, socket));
    game.scores.push(0);
    
    socket.emit('game_event', {
      i: 9, 
      label: game.stackCards.discard[game.stackCards.discard.length-1].label,
    });
    
    socket.emit('game_state', {'state': game.gameState});
  });
  
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

    if (game.players.length === 0) games.splice(games.indexOf(game), 1);
  });
});

// TODO: handle reconnects


const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

