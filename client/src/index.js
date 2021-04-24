import React from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';
import './index.css';

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
      gameState: 'STATE_NOT_RECEIVED',
      score: {
        yours: 0,
        theirs: 0,
      },
    };
  }

  handleClick(i) {
    socket.emit('click', {i: i});
    /*
    if (this.state.isStackFlipped) {
      if (i < 4) {
        this.swapCardWithDraw(i);
      } else {
        this.discardDraw()
      }
    } else {
      this.flipCard(i);
    }
    console.log('clicked ' + i);
    */
  }
/*
  discardDraw() {
    const stackCards = this.state.stackCards.slice();

    stackCards[1].unshift(stackCards[0].shift());

    this.setState({
      stackCards: stackCards,
      isStackFlipped: false,
    });
  }
*/
/*
  swapCardWithDraw(i) {
    const playerCards = this.state.playerCards.slice();
    const stackCards = this.state.stackCards.slice();
    
    if (this.state.isDiscardStackTapped) {
      let card = stackCards[1].shift().flip();
      stackCards[1].unshift(playerCards[0][i].flip());
      playerCards[0][i] = card;
    } else {
      stackCards[1].unshift(playerCards[0][i].flip());
      playerCards[0][i] = stackCards[0].shift().flip();      
    }

    this.setState({
      stackCards: stackCards,
      playerCards: playerCards,
      isStackFlipped: false,
      isDiscardStackTapped: false,
    });
    console.log(this.state.stackCards)
  }
*/
/*
  flipCard(i) {
    const playerCards = this.state.playerCards.slice();
    const stackCards = this.state.stackCards.slice();
    const players = this.state.players.slice();

    if (i < 4) {
      if (this.state.isGameStarted) return;

      let cardsViewed = players[0].cardsViewed;
      let card = playerCards[0][i];

      if (cardsViewed.includes(card)) {
        // try out socket
        //socket.emit('json', {flip: 0})
        //card.flip();
      } else if (cardsViewed.length < 2) {
        card.flip();
        cardsViewed = cardsViewed.concat([card])
      }

      console.log(cardsViewed)
      players[0].cardsViewed = cardsViewed;

      this.setState({
        playerCards: playerCards,
        players: players,
      });

    } else if (i < 8) {

      playerCards[1][i-4].flip();
      this.setState({
        playerCards: playerCards,
      });

    } else if (i === 8 && !this.state.isStackFlipped) {

      stackCards[0][0].flip();
      playerCards[0].forEach(card => {
        if (card.value === card.label) card.flip();
      });
      this.setState({
        stackCards: stackCards,
        isStackFlipped: true,
        isGameStarted: true,
      });

    } else {

      playerCards[0].forEach(card => {
        if (card.value === card.label) card.flip();
      });
      this.setState({
        stackCards: stackCards,
        isStackFlipped: true,
        isGameStarted: true,
        isDiscardStackTapped: true,
      });
    }
  }
*/
  startButton() {
    socket.send({button: 'start'})
  }

  caboButton() {
    socket.send({button: 'cabo'})
  }

  componentDidMount() {
    document.title = 'Cabon'

    // populate Card arrays
    // TODO: move to server and fetch only for authorized viewing of cards
    //fetch('/cabon/test').then(result => result.json()).then(data => this.setState({text: data.text}));
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
          <div>{this.state.gameState}</div>
          <div>Punkte:</div>
          <div>Du: {this.state.score.yours} Gegner: {this.state.score.theirs}</div>
          <button onClick={this.startButton}>New Game</button>
          <button onClick={this.caboButton}>Cabo</button>
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
