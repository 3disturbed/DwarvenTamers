import System from '../System.js';
import SleepComponent from '../components/SleepComponent.js';

export default class SleepSystem extends System {
  constructor(io, config = {}) {
    super(31); // run after hunger
    this.io = io;
    this.restRequired = config.restRequired ?? 300;
  }

  update(dt, entityManager, context) {
    const entities = entityManager.query([SleepComponent]);

    for (const entity of entities) {
      const sleep = entity.getComponent(SleepComponent);

      // Apply fatigue accumulation over time (when not sleeping)
      if (!sleep.isSleeping) {
        sleep.fatigueLevel += (dt / this.restRequired) * 100;
        if (sleep.fatigueLevel > 100) {
          sleep.fatigueLevel = 100;
        }
      }

      // Log tired state (future: apply movement/action debuff)
      if (sleep.isTired()) {
        console.log(`[SleepSystem] Entity ${entity.id} is tired (fatigue: ${sleep.fatigueLevel})`);
      }
    }
  }
}
