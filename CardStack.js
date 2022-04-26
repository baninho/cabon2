module.exports = class CardStack {
  constructor() {
    this.cards = []
  }

  populateMain() {
    this.cards = Array(52).fill(1).map((v, i) => {return new Card(Math.floor(i/4 + 0.5))}).shuffle()
  }

  draw() {
    return this.cards.pop()
  }
  
  discard()

}