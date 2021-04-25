const express = require('express');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

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
    this.id = '';
    this.value = value;
    this.label = 'C';
  }

  flip() {
    this.label = (this.label === this.value) ? 'C' : this.value;
    return this;
  }

  isFaceUp() {
    return this.label == this.value;
  }
}

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
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('listening on :' + port);
});

