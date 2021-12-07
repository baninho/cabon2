import React from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';
import path from 'path';

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
const MAX_PLAYERS = 4;

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
    4: "Round's over - click NEXT!",
  },
});

function Card (props) {
  let labels
  let img
  let classString = 'square'

  if (props.label) {
    console.log(props.label)
    labels = props.label.toString().split(' ')
    img = imgFromLabel(labels[0])
  
    if (labels.length > 1) {
      classString += ' glow'
    }  
  } else img = null
  
  return (
    <button 
      className={classString}
      onClick={props.onClick}
    >
      <img src={img} alt=""></img>
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
    let opponents = [];

    for (let i=1;i<this.props.playerCards.length;i++) {
      opponents.push(
        <div key={'player' + i} className="board-area">{this.props.names[i]}
        <PlayerArea 
          cards = {this.props.playerCards[i]}
          onClick = {this.props.onClick}
          playerNumber = {i}
        /></div>
      );
    }

    return (
      <div>
        {opponents}
        <div className="board-area">Stack
        <Stack 
          cards = {this.props.stackCards}
          onClick = {this.props.onClick}
        /></div>
        <div className="board-area">{this.props.names[0]}
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
        Array(6).fill(nullCard),
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
      playerCount: 2,
      names: ['Player', 'Opponent'],
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
      let playerName = 'Player';

      if (document.cookie.split(';').some((item) => item.trim().startsWith('name='))) {
        playerName = document.cookie
          .split('; ')
          .find(row => row.startsWith('name='))
          .split('=')[1];
      }

      this.setState({names: [playerName]});

      socket.emit('url', {
        url: window.location.href,
        name: playerName,
      });
    });

    socket.on('game_event', (data) => {
      console.log('received game event');
      console.log(data);
      const playerCards = this.state.playerCards.slice();
      const stackCards = this.state.stackCards.slice();

      if (data.i < CARD_SLOTS) {
        playerCards[0][data.i].label = data.label;
      } else if (data.i < DRAW_IND) {
        playerCards[1][data.i-CARD_SLOTS].label = data.label;
      } else if (data.i === DRAW_IND) {
        stackCards[0].label = data.label;
      } else if (data.i === DISCARD_IND) {
        stackCards[1].label = data.label;
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
      console.log('received scores');
      console.log(data);

      let theirs = [];
      let names = data.names.slice();

      for (let i=0;i<data.theirs.length;i++) {
        theirs[i] = ('' + data.theirs[i]);
      }

      names.unshift(this.state.names[0]);

      this.setState({
        score: {
          yours: data.yours,
          theirs: theirs,
        },
        names: names,
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
      console.log('received boardView')
      console.log(data);
      let pInd;

      for (let i=0;i<data.playerCount*CARD_SLOTS;i++) {
        pInd = Math.floor(i/CARD_SLOTS);
        playerCards[pInd][i-pInd*CARD_SLOTS].label = data.labels[i];
      }

      stackCards[0].label = data.labels[DRAW_IND];
      stackCards[1].label = data.labels[DISCARD_IND];

      this.setState({
        playerCards: playerCards,
        stackCards: stackCards,
        playerCount: data.playerCount,
      });
    });

    for (let j=0;j<MAX_PLAYERS;j++) {
      for (let i=0;i<CARD_SLOTS;i++) {
        playerCards[j][i] = new CardData(i<4 ? C : null);
      }
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
    let scoreRows = [[<th>{this.state.names[0]}</th>], [<td>{this.state.score.yours}</td>]];
    for (let i=0;i<this.state.score.theirs.length;i++) {
      scoreRows[0].push(<th>{this.state.names[i+1]}</th>);
      scoreRows[1].push(<th>{this.state.score.theirs[i]}</th>)
    }
    let scoresTable = <div><table><thead><tr>{scoreRows[0]}</tr></thead><tbody><tr>{scoreRows[1]}</tr></tbody></table></div>;

    return (
      <div className="game">
        <div className="game-info">
          <div>
            <table className="tab-buttons">
            <tr>
            <th className="tab-buttons">
            <button 
              className={this.state.turn === '' ? this.state.caboButtonClass + ' btn-inactive' : this.state.caboButtonClass} 
              onClick={this.caboButton}>
              CABO
            </button>
            </th>
            <th className="tab-buttons">
            <button 
              className={this.state.gameState === GameState.FINISHED ? 'control' : 'control btn-inactive'} 
              onClick={this.startButton}>
              NEXT
            </button>
            </th>
            <th className="tab-buttons">
            <button className="control" onClick={this.newGameButton}>NEW</button>
            </th>
            </tr>
            </table>
          </div>
          <div>{GameState.name[this.state.gameState]} - {this.state.turn}</div>{scoresTable}
          <div className="game-id">{'Game ID: ' + path.basename(window.location.href)}</div>
        </div>
        <div className="game-board">
          <Board 
            playerCards = {this.state.playerCards.slice(0, this.state.playerCount)}
            stackCards = {this.state.stackCards}
            onClick = {(i) => this.handleClick(i)}
            names = {this.state.names}
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
    case ('0'): return C0;
    case ('1'): return C1;
    case ('2'): return C2;
    case ('3'): return C3;
    case ('4'): return C4;
    case ('5'): return C5;
    case ('6'): return C6;
    case ('7'): return C7;
    case ('8'): return C8;
    case ('9'): return C9;
    case ('10'): return C10;
    case ('11'): return C11;
    case ('12'): return C12;
    case ('13'): return C13;
    default: return null;
  }
}

// ========================================
const e = React.createElement;
const socket = io();
const domContainer = document.querySelector('#root');

ReactDOM.render(e(Game), domContainer);
