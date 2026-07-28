import Component from '../Component.js';

export default class HungerComponent extends Component {
  constructor(config = {}) {
    super();
    this.currentHunger = config.maxHunger ?? 100;
    this.maxHunger = config.maxHunger ?? 100;
    this.decayRate = config.decayRate ?? 0.5; // hunger units per second
    this.lastEatTime = Date.now();
  }

  eat(amount) {
    const actual = Math.min(this.maxHunger - this.currentHunger, amount);
    this.currentHunger += actual;
    this.lastEatTime = Date.now();
    return actual;
  }

  isStarving() {
    return this.currentHunger <= 0;
  }

  getHungerPercentage() {
    return this.currentHunger / this.maxHunger;
  }
}
