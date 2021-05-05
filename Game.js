const GameState = require('./GameState');
const Card = require('./Card');
const Player = require('./Player');

const DRAW_IND = 24;
const DISCARD_IND = 25;
const CARD_SLOTS = 6;
const STARTING_CARDS = 4;

exports.Game = class Game {
  constructor(id) {
    this.id = id;
    this.gameState = GameState.NOT_STARTED;
    this.players = [];
    this.stacks = {};
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.activePlayer = 0;
    this.pFirstTurn = 0;
    this.caboCaller = 0;
    this.peek = false;
    this.spy = 0;
    this.swap = false;
    this.scores = [];
    this.selectedCardInds = [];
    this.xCards = [];

    this.restart();
  }

  restart() {
    this.stacks = {
      main: Array(52).fill(1).map((v, i) => {return new Card(Math.floor(i/4 + 0.5))}).shuffle(),
      discard: [],
    };
    this.stacks.discard.push(this.stacks.main.pop().flip());
    for (const p of this.players) {
      p.cardsViewed = [];
      p.cards = Array(CARD_SLOTS).fill(null);
      for (let i=0;i<STARTING_CARDS;i++) {
        p.cards[i] = this.stacks.main.pop();
      }
    }
    this.setState(GameState.NOT_STARTED);
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.activePlayer = 0;
    this.caboCaller = 0;
    this.peek = false;
    this.spy = 0;
    this.swap = false;
    this.xCards = [];

    for (let p of this.players) {
      console.log(p.cards);
      for (let i=0;i<CARD_SLOTS;i++) {
        p.socket.emit('game_event', {i: i, label: p.cards[i] !== null ? p.cards[i].label : null});
        p.socket.to(this.id).emit('game_event', {i: i+CARD_SLOTS, label: p.cards[i] !== null ? p.cards[i].label : null});
      }
      p.socket.emit('game_event', {i: DRAW_IND, label: 'C'});
      p.socket.emit('game_event', {
        i: DISCARD_IND, 
        label: this.stacks.discard[this.stacks.discard.length-1].label,
      });
    }
  }

  addNewPlayer(socket) {
    let cards = [];
    let p;
    
    for (let i=0;i<STARTING_CARDS;i++) cards.push(this.stacks.main.pop());
    cards.push(null, null);
    p = new Player(socket.id, socket.id, cards, socket);

    this.players.push(p);
    this.scores.push(0);

    socket.emit('game_event', {
      i: DISCARD_IND, 
      label: this.stacks.discard[this.stacks.discard.length-1].label,
    });
    
    socket.emit('game_state', {'state': this.gameState});
    socket.emit('turn', {yours: this.activePlayer === this.players.indexOf(p) ? 1 : 0});
  }

  newGame() {
    this.resetScores();
    this.restart();
    this.sendScores();
    this.sendTurn();
  }

  nextRound() {
    if (this.gameState !== GameState.FINISHED) return;
    this.restart();
    this.activePlayer = (++this.pFirstTurn) % this.players.length;
    this.sendTurn();
  }

  cabo() {
    if (this.gameState < GameState.CABO) this.setState(GameState.CABO);
  }

  setState(state) {
    this.gameState = state;
    
    for (let p of this.players) p.socket.emit('game_state', {'state': this.gameState});
  }

  startGame() {
    for (let p of this.players) if (p.cardsViewed.length < 2) return false;

    if (this.gameState == GameState.NOT_STARTED) {
      this.setState(GameState.STARTED);
      for (let p of this.players) {
        for (let c of p.cards) {
          if (c !== null && c.isFaceUp()) c.flip();
        }
      }
      // TODO: refactor to just go through cards and send their labels
      for (let i=0;i<STARTING_CARDS;i++) {
        for (let p of this.players) p.socket.emit('game_event', {'i': i, 'label': 'C'});
      }
    }

    return true;
  }

  swapCardWithDraw(player) {
    for (let i of this.selectedCardInds) {
      this.discardCard(player.cards[i].flip());
      player.cards[i] = null;
    }
    player.cards[this.selectedCardInds[0]] = this.stacks.main.pop().flip();
  }

  swapCardWithDiscard(player) {
    let card = this.stacks.discard.pop().flip();
    for (let i of this.selectedCardInds) {
      this.discardCard(player.cards[i].flip());
      player.cards[i] = null;
    }
    card.label = 'Cx';
    player.cards[this.selectedCardInds[0]] = card;
  }

  discardDraw() {
    let c = this.stacks.main.pop();
    
    this.discardCard(c);

    if (this.selectedCardInds[0] === undefined) {
      if (c.value == 9 || c.value == 10) this.spy = 1;
      if (c.value == 11 || c.value == 12) this.swap = true;
    }

    for (let p of this.players) p.socket.emit('game_event', {
      i: DRAW_IND, label: this.stacks.main[this.stacks.main.length-1].label
    });
  }

  discardCard(c) {
    this.stacks.discard.push(c);
    for (let p of this.players) p.socket.emit('game_event', {i: DISCARD_IND, label: c.label});
  }

  penaltyDraw(p) {
    for (let i=0;i<CARD_SLOTS;i++) {
      if (p.cards[i] === null) {
        p.cards[i] = this.stacks.main.pop().flip();
        p.socket.emit('game_event', {i: i, label: p.cards[i].label});
        break;
      }
    }
  }

  penaltyDiscard(p) {
    for (let i=0;i<CARD_SLOTS;i++) {
      if (p.cards[i] === null) {
        p.cards[i] = this.stacks.discard.pop().flip();
        p.socket.emit('game_event', {i: i, label: p.cards[i].label});
        break;
      }
    }
  }

  endTurn() {
    if (this.gameState == GameState.CABO) {
      this.caboCaller = this.activePlayer;
      this.setState(GameState.FINAL_ROUND);
    }
    this.nextPlayer();
    
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.peek = false;

    let drawLabel = this.stacks.main[this.stacks.main.length-1].label;
    let discardLabel = this.stacks.discard[0] === undefined ? '' : this.stacks.discard[this.stacks.discard.length-1].label;

    for (let p of this.players) {
      p.socket.emit('game_event', {i: DRAW_IND, label: drawLabel});
      p.socket.emit('game_event', {i: DISCARD_IND, label: discardLabel});
    }

    if (this.gameState == GameState.FINAL_ROUND && this.activePlayer === this.caboCaller) this.endGame();
  }

  nextPlayer() {
    this.activePlayer = (this.activePlayer+1) % this.players.length;
    this.sendTurn();
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

  sendTurn() {
    for (let p of this.players) {
      p.socket.emit('turn', {yours: this.activePlayer === this.players.indexOf(p) ? 1 : 0});
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

      for (let i=0;i<CARD_SLOTS;i++) {
        if(p.cards[i] !== null) {
          p.socket.emit('game_event', {i: i, label: p.cards[i].label});
          p.socket.to(this.id).emit('game_event', {i: i+CARD_SLOTS, label: p.cards[i].label});
        }
      }
    }
  }

  // all clicks on cards go through here
  // TODO: Check if things can be separated out into other functions
  // TODO: Handle sending data in here instead of returning data
  handleClick(i, socket) {
    if (this.players.length < 2) return;

    let currentPl;
    let otherPl;
    let isActivePlayer;
    let card;

    for (let p of this.players) {
      if (p.id === socket.id) currentPl = p;
      else otherPl = p; // TODO: adapt this for more than one player
    }

    isActivePlayer = this.players.indexOf(currentPl) === this.activePlayer;

    if (!isActivePlayer && this.gameState != GameState.NOT_STARTED) return;

    if (i<CARD_SLOTS) {
      console.log(currentPl.cards);
      // The player clicked one of their cards

      // If they are spying they can't perform any action on their cards
      if (this.spy) return;

      // Check if he still has a card in that spot
      if (currentPl.cards[i] === null) return;

      if (this.swap) {
        // If a Swap was discarded, this will select the card to swap with
        // an opponents card; if an opponents card was already selected swaps them now
        if (this.xCards[0] === undefined){
          this.xCards[0] = currentPl.cards[i];

          if (this.xCards[1] !== undefined) {
            this.swapCards(currentPl, otherPl);
            this.endTurn(); 
          }
        }

        return;
      }

      // If they have a card and it is before the start of the game, flip it
      // only allow two cards to be flipped using cardsViewed
      if (this.gameState == GameState.NOT_STARTED) {
        let c = currentPl.cards[i];

        if (currentPl.cardsViewed.length < 2 || currentPl.cardsViewed.includes(c)) {
          c.flip();

          if (!currentPl.cardsViewed.includes(c)) currentPl.cardsViewed.push(c);

          currentPl.socket.emit('game_event', {i: i, label: c.label});
        }
      } else if (this.isStackFlipped || this.isDiscardStackTapped) {
        // The game started, now we select cards to swap for the draw
        if (this.areCardsEqual() && !this.selectedCardInds.includes(i)) {
          this.selectedCardInds.push(i);

          if (!currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();

          currentPl.socket.emit('game_event', {i: i, label: currentPl.cards[i].label});

        } else if (this.selectedCardInds.length === 1 && this.peek) {
          // If the drawn card is a Peek card, flip the first selected card
          if (currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();

          currentPl.socket.emit('game_event', {i: i, label: currentPl.cards[i].label});

          this.selectedCardInds.pop();
          this.discardDraw();

          currentPl.socket.emit('game_event', {
            i: DRAW_IND, label: this.stacks.main[this.stacks.main.length-1].label
          });

          this.endTurn();
        }
      }
    } else if (i===DRAW_IND && !this.isStackFlipped && !this.isDiscardStackTapped && isActivePlayer) {
      // This is the stack
      if (!this.startGame()) return;

      this.isStackFlipped = true;
      card = this.stacks.main[this.stacks.main.length -1].flip();

      if (card.value == 7 || card.value == 8) this.peek = true;

      currentPl.socket.emit('game_event', {i: DRAW_IND, label: this.stacks.main[this.stacks.main.length -1].label});

    } else if (i===DISCARD_IND && isActivePlayer) {
      // Discard stack was already tapped but no player card has been selected, do nothing
      // This will actually also catch this.spy
      if (this.isDiscardStackTapped && this.selectedCardInds[0] === undefined) return;

      // If this.swap is set, it was set when the card was discarded
      // this is the second click here, indicating that they don't want to swap
      if (this.swap) {
        this.swap = false;
        this.xCards = [];
        this.endTurn();

        return;
      }

      // They selected the discard stack to draw from it
      if (!this.isStackFlipped && !this.isDiscardStackTapped) {
        if (!this.startGame() || this.stacks.discard[0] === undefined) return;

        this.isDiscardStackTapped = true;

        return;
      }

      if (this.areCardsEqual()){
        if (this.selectedCardInds[0] !== undefined) {
          // Player has seleted at least one of their cards and they have equal value
          // --> discard them and replace one with the drawn card
          for (let i of this.selectedCardInds) if (currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();
  
          // Handle if card came from stack or discard
          if (this.isStackFlipped) this.swapCardWithDraw(currentPl);
          else this.swapCardWithDiscard(currentPl);
  
          // No player card was selected, card is directly discarded from stack
        } else if (this.isStackFlipped) this.discardDraw();
      } else {
        // Selected cards were not equal, they must draw an extra card
        if (this.isStackFlipped) this.penaltyDraw(currentPl);
        if (this.isDiscardStackTapped) this.penaltyDiscard(currentPl);
      }

      currentPl.socket.emit('game_event', {i: DRAW_IND, label: this.stacks.main[this.stacks.main.length -1].label});

      for (let i=0;i<CARD_SLOTS;i++) {
        if (currentPl.cards[i] !== null && currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();

        let msg0 = {i: i, label: currentPl.cards[i] === null ? '' : currentPl.cards[i].label};
        let msg1 = {i: i+CARD_SLOTS, label: currentPl.cards[i] === null ? '' : currentPl.cards[i].label};
        
        currentPl.socket.emit('game_event', msg0);
        otherPl.socket.emit('game_event', msg1);
      }

      // Now this.swap has been set by discardDraw()
      if (this.swap || this.spy) return;

      this.endTurn();
      this.selectedCardInds = [];

    } else if (i<DRAW_IND) {
      if (this.swap && this.xCards[1] === undefined) {
        this.xCards[1] = otherPl.cards[i-CARD_SLOTS];

        if (this.xCards[0] !== undefined) {
          this.swapCards(currentPl, otherPl);
          this.endTurn();
        }

      } else if (this.spy === 1) {
        this.spy = 2;
        otherPl.cards[i-CARD_SLOTS].flip();

        currentPl.socket.emit('game_event', {i: i, label: otherPl.cards[i-CARD_SLOTS].label});

      } else if (this.spy === 2) {
        this.spy = 0;
        otherPl.cards[i-CARD_SLOTS].flip();

        currentPl.socket.emit('game_event', {i: i, label: otherPl.cards[i-CARD_SLOTS].label});

        this.endTurn();
      }
    }
    
    return;
  }

  swapCards(p0, p1) {
    let i0 = p0.cards.indexOf(this.xCards[0]);
    let i1 = p1.cards.indexOf(this.xCards[1]);
    
    p1.cards[i1] = this.xCards[0];
    p0.cards[i0] = this.xCards[1];

    p1.socket.emit('game_event', {i: i1, label: 'Cx'});
    p1.socket.emit('game_event', {i: i0+CARD_SLOTS, label: 'Cx'});
    p0.socket.emit('game_event', {i: i0, label: 'Cx'});
    p0.socket.emit('game_event', {i: i1+CARD_SLOTS, label: 'Cx'});

    this.swap = false;
    this.xCards = [];
  }
}

exports.DRAW_IND = DRAW_IND;
exports.DISCARD_IND = DISCARD_IND;
exports.CARD_SLOTS = CARD_SLOTS;
exports.STARTING_CARDS = STARTING_CARDS;