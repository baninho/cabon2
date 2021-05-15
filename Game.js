const GameState = require('./GameState');
const Card = require('./Card');

const DRAW_IND = 24;
const DISCARD_IND = 25;
const CARD_SLOTS = 6;
const STARTING_CARDS = 4;
const MAX_PLAYERS = 4;

exports.Game = class Game {
  otherPl;
  otherPlInd;

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

    this.viewsUpdateAll();
    this.setState(GameState.NOT_STARTED);
    this.isStackFlipped = false;
    this.isDiscardStackTapped = false;
    this.activePlayer = 0;
    this.caboCaller = 0;
    this.peek = false;
    this.spy = 0;
    this.swap = false;
    this.xCards = [];
  }

  viewsUpdateAll() {
    for (let p of this.players) p.view.updateAll(this.players, this.stacks);
  }

  addNewPlayer(p) {
    let cards = [];
    
    for (let i=0;i<STARTING_CARDS;i++) cards.push(this.stacks.main.pop());
    cards.push(null, null);
    p.cards = cards;

    this.players.push(p);
    this.scores.push(0);

    this.viewsUpdateAll();
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
    }

    this.viewsUpdateAll();

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

    for (let p of this.players) p.view.updateStacks(this.stacks);
  }

  discardCard(c) {
    if (!c.isFaceUp()) c.flip();
    this.stacks.discard.push(c);
    for (let p of this.players) p.view.updateStacks(this.stacks);
  }

  penaltyDraw(p) {
    for (let i=0;i<CARD_SLOTS;i++) {
      if (p.cards[i] === null) {
        p.cards[i] = this.stacks.main.pop().flip();
        break;
      }
    }
  }

  penaltyDiscard(p) {
    for (let i=0;i<CARD_SLOTS;i++) {
      if (p.cards[i] === null) {
        p.cards[i] = this.stacks.discard.pop().flip();
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

    for (let p of this.players) {
      p.view.updateStacks(this.stacks);
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
    }

    for (let p of this.players) p.view.updatePlayers(this.players);
  }

  getOtherPlayer(currentPl, i) {
    let playersCp = this.players.slice();
    let curPlSplice = playersCp.splice(playersCp.indexOf(currentPl), 1);

    playersCp = curPlSplice.concat(playersCp);

    return playersCp[Math.floor(i/CARD_SLOTS)];
  }

  // all clicks on cards go through here
  // TODO: Check if things can be separated out into other functions
  // TODO: Handle sending data in here instead of returning data
  handleClick(i, socket) {
    if (this.players.length < 2) return;

    let currentPl;
    let isActivePlayer;
    let card;

    for (let p of this.players) {
      if (p.id === socket.id) currentPl = p;
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
        if (currentPl.cards[i] === null) return;
        // If a Swap was discarded, this will select the card to swap with
        // an opponents card; if an opponents card was already selected swaps them now
        if (this.xCards[0] === undefined){
          this.xCards[0] = currentPl.cards[i];

          if (this.xCards[1] !== undefined) {
            this.swapCards(currentPl, this.otherPl);
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

          currentPl.view.updatePlayer(currentPl, 0);
        }
      } else if (this.isStackFlipped || this.isDiscardStackTapped) {
        // The game started, now we select cards to swap for the draw
        if (this.areCardsEqual() && !this.selectedCardInds.includes(i)) {
          this.selectedCardInds.push(i);

          if (!currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();

          currentPl.view.updatePlayer(currentPl, 0);

        } else if (this.selectedCardInds.length === 1 && this.peek) {
          // If the drawn card is a Peek card, flip the first selected card
          if (currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();

          currentPl.view.updatePlayer(currentPl, 0);

          this.selectedCardInds.pop();
          this.discardDraw();

          currentPl.view.updateStacks(this.stacks);

          this.endTurn();
        }
      }
    } else if (i===DRAW_IND && !this.isStackFlipped && !this.isDiscardStackTapped && isActivePlayer) {
      // This is the stack
      if (!this.startGame()) return;

      this.isStackFlipped = true;
      card = this.stacks.main[this.stacks.main.length -1].flip();

      if (card.value == 7 || card.value == 8) this.peek = true;

      currentPl.view.updateStacks(this.stacks);

    } else if (i===DISCARD_IND && isActivePlayer) {
      // Discard stack was already tapped but no player card has been selected, do nothing
      // This will actually also catch this.spy
      if (this.isDiscardStackTapped && this.selectedCardInds[0] === undefined) return;

      // If this.swap is set, it was set when the card was discarded
      // this is the second click here, indicating that they don't want to swap
      if (this.swap || this.spy) {
        this.swap = false;
        if (this.spyCard && this.otherPl.cards[this.spyCard-CARD_SLOTS].isFaceUp()) {
          this.otherPl.cards[this.spyCard-CARD_SLOTS].flip();
          currentPl.view.updatePlayers(this.players);
        }
        this.spyCard = null;
        this.spy = 0;
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

      for (let i=0;i<CARD_SLOTS;i++) {
        if (currentPl.cards[i] !== null && currentPl.cards[i].isFaceUp()) currentPl.cards[i].flip();
      }

      this.viewsUpdateAll();

      // Now this.swap has been set by discardDraw()
      if (this.swap || this.spy) return;

      this.endTurn();
      this.selectedCardInds = [];

    } else if (i<DRAW_IND) {
      this.otherPl = this.getOtherPlayer(currentPl, i);
      this.otherPlInd = this.players.indexOf(this.otherPl);

      if (this.swap && this.xCards[1] === undefined) {
        if (this.otherPl.cards[i%CARD_SLOTS] === null) return;

        this.xCards[1] = this.otherPl.cards[i%CARD_SLOTS];

        if (this.xCards[0] !== undefined) {
          this.swapCards(currentPl, this.otherPl);
          this.endTurn();
        }

      } else if (this.spy === 1) {
        if (this.otherPl.cards[i%CARD_SLOTS] === null) return;
        this.spy = 2;
        this.spyCard = i;
        this.otherPl.cards[i%CARD_SLOTS].flip();

        currentPl.view.updatePlayers(this.players);

      } else if (this.spy === 2) {
        if (this.spyCard !== i) return;
        this.spy = 0;
        this.otherPl.cards[i%CARD_SLOTS].flip();

        currentPl.view.updatePlayers(this.players);

        this.endTurn();
      }
    }
    
    return;
  }

  swapCards(p0, p1) {
    let i0 = p0.cards.indexOf(this.xCards[0]);
    let i1 = p1.cards.indexOf(this.xCards[1]);
    
    p1.cards[i1] = this.xCards[0].touch();
    p0.cards[i0] = this.xCards[1].touch();

    this.viewsUpdateAll();

    this.swap = false;
    this.xCards = [];
  }
}

exports.DRAW_IND = DRAW_IND;
exports.DISCARD_IND = DISCARD_IND;
exports.CARD_SLOTS = CARD_SLOTS;
exports.STARTING_CARDS = STARTING_CARDS;
exports.MAX_PLAYERS = MAX_PLAYERS;