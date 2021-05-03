const express = require('express');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { is } = require('type-is');
const io = new Server(server);

const Game = require('./Game');

const DISCARD_IND = 25;

const games = [];

// Serve static files from the React app
app.use('/static', express.static(path.join(__dirname, 'client/build/static')));

// And static files of the express part
app.use(express.static(path.join(__dirname, 'public')));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

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


app.get('/game/:id', (req, res) => {
  console.log('routing through game/id ' + req.params.id);

  let gameIds = games.map((game) => game.id);

  if (gameIds.includes(req.params.id) && games[gameIds.indexOf(req.params.id)].players.length === 2) {
    res.send('Game is full');
  } else {
    res.sendFile(path.join(__dirname+'/client/build/index.html'));
  }
});

app.get('/game/', (req, res) => {
  console.log('routing through /game/');
  res.redirect('/game/' + Math.random());
});

app.get('/', (req, res) => {
  console.log('routing through /');
  res.render('index', { title: 'Cabon' });
});

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
    game.addNewPlayer(socket);
    socket.join(game.id);
  });
  
  // handle new game, cabo, next round buttons
  socket.on('message', (data) =>{
    socket.emit('debug', {received: 'message'});
    console.log('message received');
    console.log(data);
    if (data.button) {
      if (data.button === 'newgame') game.newGame();
      if (data.button === 'start') game.nextRound();
      if (data.button === 'cabo' && socket === game.players[game.activePlayer].socket) game.cabo(); 
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
        p.cards = p.cards.filter((c) => {return c !== null});
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

