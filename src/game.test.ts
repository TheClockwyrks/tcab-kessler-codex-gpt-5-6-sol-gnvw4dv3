import { describe, expect, it } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { game, type KesslerState } from "./game";

function initApi(): InitApi<KesslerState> {
  return {
    input: { register() {}, layout: () => null },
    audio: { define() {}, load: async () => {} },
    assets: {
      loadImage: async () => ({}) as ImageBitmap,
      loadAudio: async () => ({}) as AudioBuffer,
      load: async () => new Blob(["{}"]),
      resolve: (path) => path,
    },
    diagnostics: { register() {} },
    events: { on: () => () => {} },
    viewport: () => ({}) as ReturnType<InitApi<KesslerState>["viewport"]>,
  };
}

function updateApi(): UpdateApi {
  const loops = new Set<string>();
  return {
    input: {
      value: () => 0,
      pressed: () => false,
      pointer: () => ({
        x: 0,
        y: 0,
        down: false,
        device: "mouse",
        buttons: [],
      }),
      pointerPressed: () => false,
      pointerReleased: () => false,
      pointerSamples: () => [],
      pointerContacts: () => [],
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play() {},
      loop: (cue) => void loops.add(cue),
      stop: (cue) => void loops.delete(cue),
      looping: (cue) => loops.has(cue),
      setMuted() {},
      muted: () => false,
    },
    frame: () => ({ count: 0, timeMs: 0, deltaMs: 0, lastDeltaMs: 0 }),
    viewport: () => ({}) as ReturnType<UpdateApi["viewport"]>,
  };
}

describe("Kessler simulation", () => {
  it("boots with the complete instrumented field", async () => {
    const [state, debug] = await game.initialize(initApi());
    const shot = debug.snapshot(state);
    expect(shot.screen).toBe("title");
    expect(shot.rings.map((ring) => ring.targets.length)).toEqual([12, 16, 20]);
    expect(shot.lives).toBe(3);
  });

  it("serves at wave speed and consumes fixed ticks", async () => {
    const [boot, debug] = await game.initialize(initApi());
    let state = debug.setScreen(debug.parkBall(boot), "playing");
    state = debug.launchBall(state);
    state = game.update(state, updateApi(), 1 / 30);
    const shot = debug.snapshot(state);
    expect(shot.ticks).toBe(2);
    expect(Math.hypot(shot.balls[0].vx, shot.balls[0].vy)).toBeCloseTo(240);
  });

  it("normalizes poses and enforces the ball cap", async () => {
    const [boot, debug] = await game.initialize(initApi());
    let state = debug.setPaddleAngle(boot, -90);
    expect(debug.snapshot(state).paddle.angleDeg).toBe(270);
    for (let i = 0; i < 6; i++) state = debug.spawnBall(state, 500, 200, 0, 1);
    expect(() => debug.spawnBall(state, 0, 0, 0, 0)).toThrow(/cap/);
  });

  it("applies mutually exclusive span effects", async () => {
    const [boot, debug] = await game.initialize(initApi());
    let state = debug.setEffectTicks(boot, "widen", 20);
    expect(debug.snapshot(state).paddle.spanDeg).toBe(72);
    state = debug.setEffectTicks(state, "narrow", 10);
    const shot = debug.snapshot(state);
    expect(shot.effects.widenTicks).toBe(0);
    expect(shot.paddle.spanDeg).toBe(30);
  });
});
