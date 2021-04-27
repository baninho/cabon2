module.exports = class Player {
  constructor(id, name, cards, socket) {
    this.id = id;
    this.name = name;
    this.cardsViewed = [];
    this.cards = cards;
    this.score = 0;
    this.socket = socket;
  }
}