import System from '../System.js';
import HungerComponent from '../components/HungerComponent.js';

export default class HungerSystem extends System {
  constructor(io, config = {}) {
    super(30); // run after health
    this.io = io;
    this.decayRate = config.decayRate ?? 0.5;
  }

  update(dt, entityManager, context) {
    const entities = entityManager.query([HungerComponent]);

    for (const entity of entities) {
      const hunger = entity.getComponent(HungerComponent);

      // Apply hunger decay over time
      hunger.currentHunger -= hunger.decayRate * dt;
      if (hunger.currentHunger < 0) {
        hunger.currentHunger = 0;
      }

      // Log starvation state (future: apply damage or death)
      if (hunger.isStarving()) {
        console.log(`[HungerSystem] Entity ${entity.id} is starving`);
      }
    }
  }
}
