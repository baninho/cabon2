const express = require('express');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { is } = require('type-is');
const io = new Server(server);
const cookieParser = require('cookie-parser');

const { Game, MAX_PLAYERS } = require('./Game');
const Player = require('./Player');

const games = new Map();

// Serve static files from the React app
app.use('/static', express.static(path.join(__dirname, 'client/build/static')));

// And static files of the express part
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());

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


app.get('/game/', (req, res) => {
  let options = {
    httpOnly: false,
  };

  res.cookie('name', req.query.player_name ? req.query.player_name : '', options);

  console.log('routing through /game/ id: ' + req.query.game_id);
  if (req.query.game_id) res.redirect('/game/' + req.query.game_id);
  else res.redirect('/');
});

app.get('/game/new/', (req, res) => {
  let options = {
    httpOnly: false,
  };

  res.cookie('name', req.query.player_name ? req.query.player_name : '', options);

  console.log('routing through /game/new');
  res.redirect('/game/' + Math.random());
});

app.get('/game/:id', (req, res) => {
  console.log('routing through game/id ' + req.params.id);

  if (games.has(req.params.id) && games.get(req.params.id).players.length >= MAX_PLAYERS) {
    res.send('Game is full');
  } else {
    res.sendFile(path.join(__dirname+'/client/build/index.html'));
  }
});

app.get('/', (req, res) => {
  console.log('routing through /');
  res.render('index', { title: 'Cabon', game_id: '', player_name: req.cookies['name'] ? req.cookies['name'] : ''});
});

// add player to game when they connect
io.on('connection', (socket) => {
  console.log('a user connected with sid ' + socket.id);

  let game;

  socket.on('url', (data) => {
    
    let gameId = path.basename(data.url);
    let p;

    console.log(data);

    if (!games.has(gameId)) {
      console.log('pushing game id ' + gameId);
      games.set(gameId, new Game(gameId));
    }
  
    game = games.get(gameId);
    p = new Player(socket.id, data.name, [], socket);
    game.addNewPlayer(p);
    socket.join(game.id);
    socket.emit('game_state', {'state': game.gameState});

    for (let pl of game.players) {
      if (pl.view.wasUpdated()) {
        pl.socket.emit('boardView', {playerCount: game.players.length, labels: pl.view.getLabels()});
      }
      pl.socket.emit('turn', {yours: game.activePlayer === game.players.indexOf(pl) ? 1 : 0});
    }
  });
  
  // handle new game, cabo, next round buttons
  socket.on('message', (data) =>{
    socket.emit('debug', {received: 'message'});
    console.log('message received');
    console.log(data);
    if (data.button) {
      if (data.button === 'newgame') {
        game.newGame();
        for (p of game.players) {
          p.socket.emit('boardView', {playerCount: game.players.length, labels: p.view.getLabels()});
        }
      }
      if (data.button === 'start') {
        game.nextRound();
        for (p of game.players) {
          p.socket.emit('boardView', {playerCount: game.players.length, labels: p.view.getLabels()});
        }
      }
      if (data.button === 'cabo' && socket === game.players[game.activePlayer].socket) game.cabo(); 
    }
  });

  // handle click on card
  socket.on('click', (data) => {
    console.log('clicked: ' + data.i);
    console.log('player sid: ' + socket.id);

    game.handleClick(data.i, socket);
    
    for (p of game.players) {
      if (p.view.wasUpdated()) {
        p.socket.emit('boardView', {playerCount: game.players.length, labels: p.view.getLabels()});
      } 
    }
  });

  // remove player from game when they disconnect
  socket.on('disconnect', () => {
    for (let p of game.players) {
      if (p.id === socket.id) {
        p.cards = p.cards.filter((c) => {return c !== null});
        Array.prototype.push.apply(game.stacks.main, p.cards);
        game.scores.splice(game.players.indexOf(p), 1);
        game.players.splice(game.players.indexOf(p), 1);
        break;
      }
    }

    if (game.players.length === 0) games.delete(game.id);
  });
});

// TODO: handle reconnects


const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

