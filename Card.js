module.exports = class Card {
  constructor(value) {
    this.value = value;
    this.label = 'C';
  }

  flip() {
    this.label = (this.label == this.value) ? 'C' : this.value;
    return this;
  }

  isFaceUp() {
    return this.label == this.value;
  }
}