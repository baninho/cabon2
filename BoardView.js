const { CARD_SLOTS, DRAW_IND, DISCARD_IND } = require('./Game');

module.exports = class BoardView {
  #labels;
  #wasUpdated;
  #parent

  constructor(parent) {
    this.#labels = Array(26).fill('');
    this.#wasUpdated = true;
    this.#parent = parent;
  }

  updateLabel(i, label) {
    labels[i] = label;
    this.#wasUpdated = true;
  }

  updatePlayer(player, playerInd) {
    player.cards.forEach((c, i) => {
      this.#labels[i + playerInd*CARD_SLOTS] = c === null ? '' : c.label;
    });

    this.#wasUpdated = true;
  }

  updatePlayers(players) {
    let ps = players.slice();
    let p = ps.splice(ps.indexOf(this.#parent), 1);

    ps = p.concat(ps);
    
    ps.forEach((p, i) => {
      this.updatePlayer(p, i);
    });

    this.#wasUpdated = true;
  }

  updateAll(players, stacks) {
    this.updatePlayers(players);

    this.#labels[DRAW_IND] = stacks.main[stacks.main.length - 1].label;
    this.#labels[DISCARD_IND] = stacks.discard[stacks.discard.length - 1].label;

    this.#wasUpdated = true;
  }

  getLabels() {
    this.#wasUpdated = false;
    return this.#labels;
  }

  wasUpdated() {
    return this.#wasUpdated;
  }
}