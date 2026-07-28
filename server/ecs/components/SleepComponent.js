import Component from '../Component.js';

export default class SleepComponent extends Component {
  constructor(config = {}) {
    super();
    this.fatigueLevel = 0; // 0-100, 100 = fully rested
    this.restRequired = config.restRequired ?? 300; // seconds per rest cycle
    this.tiredThreshold = config.tiredDebuff ?? 20; // fatigue level at which debuff applies
    this.isSleeping = false;
    this.lastSleepTime = Date.now();
  }

  rest(amount) {
    const actual = Math.min(100 - this.fatigueLevel, amount);
    this.fatigueLevel -= actual;
    this.lastSleepTime = Date.now();
    return actual;
  }

  isTired() {
    return this.fatigueLevel >= this.tiredThreshold;
  }

  getFatiguePercentage() {
    return this.fatigueLevel / 100;
  }
}
