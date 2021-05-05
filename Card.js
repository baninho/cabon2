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

  touch() {
    if (!this.isFaceUp()) this.label = this.label === 'C' ? 'Cx' : 'C';
    return this;
  }

  getLabel() {
    return this.label;
  }
}