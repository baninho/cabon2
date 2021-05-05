import React from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';
import './index.css';
import C from './img/C.png';
import C0 from './img/C0.png';
import C1 from './img/C1.png';
import C2 from './img/C2.png';
import C3 from './img/C3.png';
import C4 from './img/C4.png';
import C5 from './img/C5.png';
import C6 from './img/C6.png';
import C7 from './img/C7.png';
import C8 from './img/C8.png';
import C9 from './img/C9.png';
import C10 from './img/C10.png';
import C11 from './img/C11.png';
import C12 from './img/C12.png';
import C13 from './img/C13.png';
import Cx from './img/Cx.png'

const DRAW_IND = 24;
const DISCARD_IND = 25;
const CARD_SLOTS = 6;

const GameState = Object.freeze({
  STATE_NOT_RECEIVED: 255,
  NOT_STARTED: 0,
  STARTED: 1,
  CABO: 2,
  FINAL_ROUND: 3,
  FINISHED: 4,
  name: {
    255: '',
    0: 'Take a look at your cards',
    1: '',
    2: 'Cabo!',
    3: 'Cabo!',
    4: "Round's over - click NEXT to play the next",
  },
});

function Card (props) {
  return (
    <button 
      className="square" 
      onClick={props.onClick}
    >
      <img src={props.label} alt=""></img>
    </button>
    );
}

class CardData {
  constructor(label) {
    this.label = label;
  }
}

class Stack extends React.Component {
  renderCard(i, iClick) {
    return (
      <Card 
        label={this.props.cards[i].label}
        onClick ={ () => this.props.onClick(iClick) }
      />
    );
  }
  render() {
  return (
    <div>
     {this.renderCard(0, DRAW_IND)}
     {this.renderCard(1, DISCARD_IND)}
    </div>
  );
  }
}

class PlayerArea extends React.Component {
  renderCard(i) {
    return (
      <Card 
        label={this.props.cards[i].label}
        onClick ={ () => this.props.onClick(i+this.props.playerNumber*CARD_SLOTS) }
      />
    )
  }

  render() {
    return (
      <div>
        <div>
         {this.renderCard(0)}
         {this.renderCard(1)}
         {this.renderCard(2)}
         {this.renderCard(3)}
         {this.renderCard(4)}
         {this.renderCard(5)}
        </div>
      </div>
    );
  }
}

class Board extends React.Component {

  render() {

    return (
      <div>
        <div className="board-area">Opponent
        <PlayerArea 
          cards = {this.props.playerCards[1]}
          onClick = {this.props.onClick}
          playerNumber = {1}
        /></div>
        <div className="board-area">Stack
        <Stack 
          cards = {this.props.stackCards}
          onClick = {this.props.onClick}
        /></div>
        <div className="board-area">Your Cards
        <PlayerArea 
          cards = {this.props.playerCards[0]}
          onClick = {this.props.onClick}
          playerNumber = {0}
        /></div>
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    let nullCard = new CardData(null);

    super(props);
    this.state = {
      playerCards: [
        Array(6).fill(nullCard),
        Array(6).fill(nullCard),
      ],
      stackCards: [
        nullCard,
        nullCard,
        nullCard,
      ],
      gameState: GameState.STATE_NOT_RECEIVED,
      score: {
        yours: 0,
        theirs: 0,
      },
      turn: '',
      caboButtonClass: 'control',
    };
  }

  handleClick(i) {
    socket.emit('click', {i: i});
  }

  startButton() {
    socket.send({button: 'start'})
  }

  caboButton() {
    socket.send({button: 'cabo'})
  }

  newGameButton() {
    socket.send({button: 'newgame'})
  }

  componentDidMount() {
    document.title = 'Cabon'

    const playerCards = this.state.playerCards.slice();
    const stackCards = this.state.stackCards.slice();

    socket.on('connect', () => {
      socket.emit('url', {
        url: window.location.href,
      });
    });

    socket.on('game_event', (data) => {
      console.log('received game event');
      console.log(data);
      const playerCards = this.state.playerCards.slice();
      const stackCards = this.state.stackCards.slice();
      let img = imgFromLabel(data.label);

      if (data.i < CARD_SLOTS) {
        playerCards[0][data.i].label = img;
      } else if (data.i < DRAW_IND) {
        playerCards[1][data.i-CARD_SLOTS].label = img;
      } else if (data.i === DRAW_IND) {
        stackCards[0].label = img;
      } else if (data.i === DISCARD_IND) {
        stackCards[1].label = img;
      }

      this.setState({
        playerCards: playerCards,
        stackCards: stackCards,
      });
    });

    socket.on('game_state', (data) => {
      console.log('received game state');
      console.log(data);

      this.setState({
        gameState: data.state,
        caboButtonClass: data.state >= GameState.CABO ? 'control cabo' : 'control',
      });
    });

    socket.on('scores', (data) => {
      console.log('received game state');
      console.log(data);

      let theirs = [];

      for (let i=0;i<data.theirs.length;i++) {
        theirs[i] = ('' + data.theirs[i]).padStart(5, '\u00a0');
      }

      this.setState({
        score: {
          yours: data.yours,
          theirs: theirs,
        },
      });
    });

    socket.on('turn', (data) => {
      this.setState({
        turn: data.yours ? 'Your turn' : '',
      });
    });

    socket.on('debug', (data) => {
      console.log(data);
    });

    socket.on('boardView', (data) => {
      let pInd;

      for (let i=0;i<data.playerCount*CARD_SLOTS;i++) {
        pInd = Math.floor(i/CARD_SLOTS);
        playerCards[pInd][i-pInd*CARD_SLOTS].label = imgFromLabel(data.labels[i]);
      }

      stackCards[0].label = imgFromLabel(data.labels[DRAW_IND]);
      stackCards[1].label = imgFromLabel(data.labels[DISCARD_IND]);

      this.setState({
        playerCards: playerCards,
        stackCards: stackCards,
      });
    });

    for (let i=0;i<CARD_SLOTS;i++) {
      playerCards[0][i] = new CardData(i<4 ? C : null);
      playerCards[1][i] = new CardData(i<4 ? C : null);
    }

    stackCards[0] = new CardData(C);
    stackCards[1] = new CardData(C);
    stackCards[2] = new CardData(null);

    this.setState({
      playerCards: playerCards,
      stackCards: stackCards,
    });
  }

  render() {

    return (
      <div className="game">
        <div className="game-info">
          <div><button className={this.state.turn === '' ? this.state.caboButtonClass + ' btn-inactive' : this.state.caboButtonClass} 
            onClick={this.caboButton}>
            CABO
          </button>
          <button 
            className={this.state.gameState === GameState.FINISHED ? 'control' : 'control btn-inactive'} 
            onClick={this.startButton}>
            NEXT
          </button>
          <button className="control" onClick={this.newGameButton}>NEW</button></div>
          <div>{GameState.name[this.state.gameState]} - {this.state.turn}</div><div>Scores:
          Yours: {this.state.score.yours} - Opponent's: {this.state.score.theirs[0]} - 
          {this.state.score.theirs[1]} - {this.state.score.theirs[2]}</div>
        </div>
        <div className="game-board">
          <Board 
            playerCards = {this.state.playerCards}
            stackCards = {this.state.stackCards}
            onClick = {(i) => this.handleClick(i)}
          />
        </div>
      </div>
    );
  }
}

function imgFromLabel(label) {
  switch (label) {
    case ('C'): return C;
    case ('Cx'): return Cx;
    case (0): return C0;
    case (1): return C1;
    case (2): return C2;
    case (3): return C3;
    case (4): return C4;
    case (5): return C5;
    case (6): return C6;
    case (7): return C7;
    case (8): return C8;
    case (9): return C9;
    case (10): return C10;
    case (11): return C11;
    case (12): return C12;
    case (13): return C13;
    default: return null;
  }
}

// ========================================
const e = React.createElement;
const socket = io();
const domContainer = document.querySelector('#root');

ReactDOM.render(e(Game), domContainer);
