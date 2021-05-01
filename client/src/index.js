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

const GameState = Object.freeze({
  STATE_NOT_RECEIVED: 255,
  NOT_STARTED: 0,
  STARTED: 1,
  CABO: 2,
  FINAL_ROUND: 3,
  FINISHED: 4,
  name: {
    255: 'STATE_NOT_RECEIVED',
    0: 'NOT_STARTED',
    1: 'STARTED',
    2: 'CABO',
    3: 'FINAL_ROUND',
    4: 'FINISHED',
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
  constructor(id, value, label) {
    this.id = id;
    this.value = value;
    this.label = label;
  }

  flip() {
    this.label = (this.label === this.value) ? 'C' : this.value;
    return this;
  }
}

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.cardsViewed = [];
  }
}

class Stack extends React.Component {
  renderCard(i) {
    return (
      <Card 
        label={this.props.cards[i][0].label}
        onClick ={ () => this.props.onClick(i+8) }
      />
    );
  }
  render() {
  return (
    <div>
     {this.renderCard(0)}
     {this.renderCard(1)}
    </div>
  );
  }
}

class PlayerArea extends React.Component {
  renderCard(i) {
    return (
      <Card 
        label={this.props.cards[i].label}
        onClick ={ () => this.props.onClick(i+this.props.playerNumber*4) }
      />
    )
  }

  render() {
    return (
      <div>
        <div>
         {this.renderCard(0)}
         {this.renderCard(1)}
        </div>
        <div>
         {this.renderCard(2)}
         {this.renderCard(3)}
        </div>
      </div>
    );
  }
}

class Board extends React.Component {

  render() {

    return (
      <div>
        Gegenspieler
        <PlayerArea 
          cards = {this.props.playerCards[1]}
          onClick = {this.props.onClick}
          playerNumber = {1}
        />
        Stack
        <Stack 
          cards = {this.props.stackCards}
          onClick = {this.props.onClick}
        />
        Deine Karten
        <PlayerArea 
          cards = {this.props.playerCards[0]}
          onClick = {this.props.onClick}
          playerNumber = {0}
        />
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    let nullCard = new CardData(0,0,C);

    super(props);
    this.state = {
      playerCards: [
        Array(4).fill(nullCard),
        Array(4).fill(nullCard),
      ],
      stackCards: [
        Array(52).fill(nullCard),
        Array(52).fill(nullCard),
      ],
      players: [],
      isStackFlipped: false,
      isGameStarted: false,
      isDiscardStackTapped: false,
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

    // populate Card arrays
    // TODO: move to server and fetch only for authorized viewing of cards
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
      let img;

      switch (data.label) {
        case ('C'): img = C; break;
        case ('Cx'): img = Cx; break;
        case (0): img = C0; break;
        case (1): img = C1; break;
        case (2): img = C2; break;
        case (3): img = C3; break;
        case (4): img = C4; break;
        case (5): img = C5; break;
        case (6): img = C6; break;
        case (7): img = C7; break;
        case (8): img = C8; break;
        case (9): img = C9; break;
        case (10): img = C10; break;
        case (11): img = C11; break;
        case (12): img = C12; break;
        case (13): img = C13; break;
        default: break;
      }

      if (data.i < 4) {
        playerCards[0][data.i].label = img;
      } else if (data.i < 8) {
        playerCards[1][data.i-4].label = img;
      } else if (data.i === 8) {
        stackCards[0][0].label = img;
      } else if (data.i === 9) {
        stackCards[1][0].label = img;
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

      this.setState({
        score: {
          yours: data.yours,
          theirs: data.theirs,
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

    for (let i=0;i<4;i++) {
      playerCards[0][i] = new CardData('x' + i, 52, C);
      playerCards[1][i] = new CardData('x' + (4+i), 53, C);
    }

    for (let i=0;i<52;i++) {
      stackCards[0][i] = new CardData('y' + i, i, C);
      stackCards[1][i] = new CardData('z' + i, i+4, C);
    }

    this.setState({
      playerCards: playerCards,
      stackCards: stackCards,
      players: [new Player()],
    });
  }

  render() {

    return (
      <div className="game">
        <div className="game-board">
          <Board 
            playerCards = {this.state.playerCards}
            stackCards = {this.state.stackCards}
            onClick = {(i) => this.handleClick(i)}
          />
        </div>
        <div className="game-info">
          <div><button className={this.state.caboButtonClass} onClick={this.caboButton}>CABO</button></div>
          <div><button className="control" onClick={this.startButton}>NEXT</button></div>
          <div><button className="control" onClick={this.newGameButton}>NEW</button></div>
          <div>{GameState.name[this.state.gameState]}</div>
          <div>{this.state.turn}</div>
          <div>Punkte:</div>
          <div>Du: {this.state.score.yours} Gegner: {this.state.score.theirs}</div>
        </div>
      </div>
    );
  }
}


// ========================================
const e = React.createElement;
const socket = io();
const domContainer = document.querySelector('#root');

ReactDOM.render(e(Game), domContainer);
