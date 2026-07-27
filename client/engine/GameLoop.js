export default class GameLoop {
  constructor(game, options = {}) {
    this.game = game;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedStep = 1 / 60;
    this.frameId = null;
    this.maxFPS = options.maxFPS || 60;
    this.frameInterval = this.maxFPS > 0 ? 1000 / this.maxFPS : 0;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  loop(currentTime) {
    if (!this.running) return;

    if (this.frameInterval > 0 && (currentTime - this.lastTime) < this.frameInterval) {
      this.frameId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = currentTime;

    this.accumulator += dt;
    while (this.accumulator >= this.fixedStep) {
      this.game.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    this.game.render(this.accumulator / this.fixedStep);
    this.frameId = requestAnimationFrame((t) => this.loop(t));
  }
}
