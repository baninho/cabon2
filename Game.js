const GameState = require('./GameState');
const Card = require('./Card');

module.exports = class Game {
  constructor(id) {
    this.id = id;
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

    for (let p of this.players) {
      for (let i=0;i<4;i++) {
        p.socket.emit('game_event', {i: i, label: p.cards[i].label});
        p.socket.to(this.id).emit('game_event', {i: i+4, label: p.cards[i].label});
      }
      p.socket.emit('game_event', {i: 8, label: 'C'});
      p.socket.emit('game_event', {
        i: 9, 
        label: this.stackCards.discard[this.stackCards.discard.length-1].label,
      });
    }
  }

  newGame() {
    this.resetScores();
    this.restart();
    this.sendScores();
  }

  setState(state) {
    this.gameState = state;
    
    for (let p of this.players) p.socket.emit('game_state', {'state': this.gameState});
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
        for (let p of this.players) p.socket.emit('game_event', {'i': i, 'label': 'C'});
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
    let c = this.stackCards.main.pop();
    this.discardCard(c);
    if (c.value == 9 || c.value == 10) this.spy = true;
    if (c.value == 11 || c.value == 12) this.swap = true;
  }

  discardCard(c) {
    this.stackCards.discard.push(c);
    for (let p of this.players) p.socket.emit('game_event', {i: 9, label: c.label});
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
    this.revealAllCards();
  }

  calculateScores() {
    let cabo;
    let min = 65535;
    let caboLost = false;

    for (let p of this.players) {
      for (let c of p.cards) {
        if (c !== null)  p.score += c.value;
      }

      if (this.caboCaller === this.players.indexOf(p)) cabo = p.score;
      if (min > p.score) min = p.score;
    }

    if (cabo > min) {
      this.scores[this.caboCaller] += 5 + cabo;
      caboLost = true;
    }

    this.players[this.caboCaller].score = 0;

    for (let p of this.players) {
      if (min === p.score && caboLost) p.score = 0;
      this.scores[this.players.indexOf(p)] += p.score;
      p.score = 0;
    }
  }

  sendScores() {
    // TODO: Adapt for more than two players
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
    if (undefined === this.selectedCardInds[0]) return true;

    let val = this.players[this.activePlayer].cards[this.selectedCardInds[0]].value;
    
    for (let i of this.selectedCardInds) {
      if (val != this.players[this.activePlayer].cards[i].value) return false;
    }

    return true;
  }

  revealAllCards() {
    for (let p of this.players) {
      for (let c of p.cards) {
        if (c !== null && !c.isFaceUp()) c.flip();
      }

      for (let i=0;i<4;i++) {
        if(p.cards[i] !== null) {
          p.socket.emit('game_event', {i: i, label: p.cards[i].label});
          p.socket.to(this.id).emit('game_event', {i: i+4, label: p.cards[i].label});
        }
      }
    }
  }

  // all clicks on cards go through here
  // TODO: Check if things can be separated out into other functions
  // TODO: Handle sending data in here instead of returning data
  handleClick(i, socket) {
    if (this.players.length < 2) return [{}];

    let current_player;
    let other_player;
    let isActivePlayer;
    let data = [{}];
    let card;

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
          data = [{i: i, label: c.label}];
        }
      } else if (this.isStackFlipped || this.isDiscardStackTapped) {
        // The game started, now we select cards to swap for the draw
        // TODO: If the drawn card is a Peek card, flip the first selected card
        // TODO: If a Swap was discarded, this will select the card to swap with
        // an opponents card
        if (this.areCardsEqual() && !this.selectedCardInds.includes(i)) {
          this.selectedCardInds.push(i);
          if (!current_player.cards[i].isFaceUp()) current_player.cards[i].flip();
          current_player.socket.emit('game_event', {i: i, label: current_player.cards[i].label});
        } else if (this.selectedCardInds.length === 1 && this.peek) {
          this.peek = false;
          if (current_player.cards[i].isFaceUp()) current_player.cards[i].flip();
          current_player.socket.emit('game_event', {i: i, label: current_player.cards[i].label});
          this.selectedCardInds.pop();
          this.discardDraw();
          current_player.socket.emit('game_event', {
            i: 8, label: this.stackCards.main[this.stackCards.main.length-1].label
          });
          this.endTurn();
        }
      }
    } else if (i===8 && !this.isStackFlipped && !this.isDiscardStackTapped && isActivePlayer) {
      // This is the stack
      this.startGame();
      this.isStackFlipped = true;
      card = this.stackCards.main[this.stackCards.main.length -1].flip();

      if (card.value == 7 || card.value == 8) this.peek = true;

      data = [{i: 8, label: this.stackCards.main[this.stackCards.main.length -1].label}];

    } else if (i===9 && isActivePlayer) {
      if (!this.isStackFlipped && !this.isDiscardStackTapped) {
        this.startGame();
        this.isDiscardStackTapped = true;

        return data;
      }

      if (this.selectedCardInds[0] !== undefined && this.areCardsEqual()) {
        for (let i of this.selectedCardInds) if (current_player.cards[i].isFaceUp()) current_player.cards[i].flip();

        if (this.isStackFlipped) this.swapCardWithDraw(current_player);
        else this.swapCardWithDiscard(current_player);
      } else this.discardDraw();

      for (let i=0;i<4;i++) {
        current_player.socket.emit('game_event', {i: i, label: current_player.cards[i] === null ? '' : 'C'})
        other_player.socket.emit('game_event', {i: i+4, label: current_player.cards[i] === null ? '' : 'C'})
      }

      this.endTurn();
      this.selectedCardInds = [];
      
      data = [{i: 8, label: this.stackCards.main[this.stackCards.main.length -1].label}];
      for (let p of this.players) {
        p.socket.emit('game_event', {i: 9, label: this.stackCards.discard[this.stackCards.discard.length -1].label});
      }
    }
    
    return data;
  }
}