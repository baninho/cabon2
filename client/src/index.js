import React from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';
import './index.css';

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
      {props.label}
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
    let nullCard = new CardData(0,0,0);

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
      socket.send({
        url: window.location.href,
      });
    });

    socket.on('game_event', (data) => {
      console.log('received game event');
      console.log(data);
      const playerCards = this.state.playerCards.slice();
      const stackCards = this.state.stackCards.slice();

      if (data.i < 4) {
        playerCards[0][data.i].label = data.label;
      } else if (data.i < 8) {
        playerCards[1][data.i-4].label = data.label;
      } else if (data.i === 8) {
        stackCards[0][0].label = data.label;
      } else if (data.i === 9) {
        stackCards[1][0].label = data.label;
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

    socket.on('debug', (data) => {
      console.log(data);
    });

    for (let i=0;i<4;i++) {
      playerCards[0][i] = new CardData('x' + i, 52, 'C');
      playerCards[1][i] = new CardData('x' + (4+i), 53, 'C');
    }

    for (let i=0;i<52;i++) {
      stackCards[0][i] = new CardData('y' + i, i, 'C');
      stackCards[1][i] = new CardData('z' + i, i+4, 'C');
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
          <div>{GameState.name[this.state.gameState]}</div>
          <div>Punkte:</div>
          <div>Du: {this.state.score.yours} Gegner: {this.state.score.theirs}</div>
          <button onClick={this.startButton}>Next Round</button>
          <button onClick={this.caboButton}>Cabo</button>
          <button onClick={this.newGameButton}>New Game</button>
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
