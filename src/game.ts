import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { PodKind, Screen } from "./constants";

export const BACKGROUND = "#050813";
type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  parked: boolean;
  born: number;
};
type Pod = { kind: PodKind; r: number; angle: number };
type Target = { slot: number; hp: number };
type Ring = { angle: number; speed: number; targets: Target[] };
type Assets = {
  planet: ImageBitmap;
  pods: Record<PodKind, ImageBitmap>;
  balls: ImageBitmap[];
  particles: unknown[];
};
type Flash = {
  kind: "burst" | "spark" | "burnup";
  x: number;
  y: number;
  ticks: number;
};
export interface KesslerState {
  screen: Screen;
  ticks: number;
  accumulator: number;
  wave: number;
  score: number;
  lives: number;
  interstitialTicks: number;
  waveAdvance: boolean;
  podSpawn: boolean;
  nextPod: PodKind | "none" | null;
  paddleAngle: number;
  balls: Ball[];
  rings: Ring[];
  pods: Pod[];
  widenTicks: number;
  narrowTicks: number;
  pierceTicks: number;
  shieldActive: boolean;
  menuIndex: number;
  pointerDownItem: number | null;
  flashes: Flash[];
  assets: Assets;
}
export interface Snapshot {
  screen: Screen;
  ticks: number;
  wave: number;
  score: number;
  lives: number;
  interstitialTicks: number;
  waveAdvance: boolean;
  podSpawn: boolean;
  nextPod: PodKind | "none" | null;
  paddle: { angleDeg: number; spanDeg: number };
  balls: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    parked: boolean;
    piercing: boolean;
  }[];
  rings: { angleDeg: number; speedDegPerSec: number; targets: Target[] }[];
  pods: { kind: PodKind; x: number; y: number }[];
  effects: {
    widenTicks: number;
    narrowTicks: number;
    pierceTicks: number;
    shieldActive: boolean;
  };
  menu: { index: number };
}
type S = DeepReadonly<KesslerState>;
type Rect = { x: number; y: number; width: number; height: number };
export interface KesslerDebugApi {
  reset(s: S): KesslerState;
  reconcile(s: S): KesslerState;
  snapshot(s: S): Snapshot;
  menuItemRect(s: S, index: number): Rect | null;
  setScreen(s: S, name: Screen): KesslerState;
  setScore(s: S, n: number): KesslerState;
  setLives(s: S, n: number): KesslerState;
  setMenuIndex(s: S, n: number): KesslerState;
  setInterstitialTicks(s: S, n: number): KesslerState;
  setWave(s: S, n: number): KesslerState;
  setPaddleAngle(s: S, deg: number): KesslerState;
  launchBall(s: S): KesslerState;
  clearBalls(s: S): KesslerState;
  spawnBall(s: S, x: number, y: number, vx: number, vy: number): KesslerState;
  parkBall(s: S): KesslerState;
  clearTargets(s: S): KesslerState;
  spawnTarget(s: S, ring: number, slot: number, hp: number): KesslerState;
  setRingAngle(s: S, ring: number, deg: number): KesslerState;
  setRingSpeed(s: S, ring: number, speed: number): KesslerState;
  clearPods(s: S): KesslerState;
  spawnPod(s: S, kind: PodKind, x: number, y: number): KesslerState;
  setNextPod(s: S, kind: PodKind | "none"): KesslerState;
  drawPod(s: S): PodKind | null;
  setEffectTicks(
    s: S,
    kind: "widen" | "narrow" | "pierce",
    ticks: number,
  ): KesslerState;
  setShield(s: S, active: boolean): KesslerState;
  setWaveAdvance(s: S, on: boolean): KesslerState;
  setPodSpawn(s: S, on: boolean): KesslerState;
}
const norm = (a: number) => ((a % 360) + 360) % 360,
  rad = (a: number) => (a * Math.PI) / 180;
const diff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const polar = (r: number, a: number) => ({
  x: C.STAGE_CX + r * Math.cos(rad(a)),
  y: C.STAGE_CY + r * Math.sin(rad(a)),
});
const polarOf = (x: number, y: number) => ({
  r: Math.hypot(x - C.STAGE_CX, y - C.STAGE_CY),
  a: norm((Math.atan2(y - C.STAGE_CY, x - C.STAGE_CX) * 180) / Math.PI),
});
const span = (s: S) =>
  s.widenTicks
    ? C.WIDEN_SPAN_DEG
    : s.narrowTicks
      ? C.NARROW_SPAN_DEG
      : C.DEFLECTOR_BASE_SPAN_DEG;
const speed = (w: number) =>
  Math.min(
    C.BALL_SPEED_BASE + C.BALL_SPEED_PER_WAVE * (w - 1),
    C.BALL_SPEED_CAP,
  );
const rspeed = (i: number, w: number) => {
  const r = C.RINGS[i];
  return (
    r.orbitSign *
    Math.min(
      r.orbitBaseDegPerSec + r.orbitPerWaveDegPerSec * (w - 1),
      r.orbitCapDegPerSec,
    )
  );
};
const rings = (w: number): Ring[] =>
  C.RINGS.map((r, i) => ({
    angle: 0,
    speed: rspeed(i, w),
    targets: Array.from({ length: r.slots }, (_, slot) => ({
      slot,
      hp: r.hitPoints,
    })),
  }));
const clone = (s: S): KesslerState => ({
  ...s,
  balls: s.balls.map((b) => ({ ...b })),
  rings: s.rings.map((r) => ({
    ...r,
    targets: r.targets.map((t) => ({ ...t })),
  })),
  pods: s.pods.map((p) => ({ ...p })),
  flashes: s.flashes.map((f) => ({ ...f })),
  assets: s.assets as Assets,
});
const initial = (a: Assets): KesslerState => ({
  screen: "title",
  ticks: 0,
  accumulator: 0,
  wave: 1,
  score: 0,
  lives: C.START_LIVES,
  interstitialTicks: 0,
  waveAdvance: true,
  podSpawn: true,
  nextPod: null,
  paddleAngle: C.DEFLECTOR_START_ANGLE_DEG,
  balls: [],
  rings: rings(1),
  pods: [],
  widenTicks: 0,
  narrowTicks: 0,
  pierceTicks: 0,
  shieldActive: false,
  menuIndex: 0,
  pointerDownItem: null,
  flashes: [],
  assets: a,
});
const parked = (s: KesslerState): Ball => ({
  ...polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle),
  vx: 0,
  vy: 0,
  parked: true,
  born: s.ticks,
});
const whole = (n: number, min: number, name: string) => {
  if (!Number.isInteger(n) || n < min) throw Error(`${name}: invalid value`);
};
const mrect = (s: S, i: number): Rect | null =>
  (s.screen === "title" || s.screen === "paused") && i >= 0 && i < 2
    ? { x: 330, y: 640 + i * 76, width: 340, height: 58 }
    : null;
const inside = (p: { x: number; y: number }, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const snap = (s: S): Snapshot => ({
  screen: s.screen,
  ticks: s.ticks,
  wave: s.wave,
  score: s.score,
  lives: s.lives,
  interstitialTicks: s.interstitialTicks,
  waveAdvance: s.waveAdvance,
  podSpawn: s.podSpawn,
  nextPod: s.nextPod,
  paddle: { angleDeg: norm(s.paddleAngle), spanDeg: span(s) },
  balls: s.balls.map((b) => ({
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    parked: b.parked,
    piercing: s.pierceTicks > 0,
  })),
  rings: s.rings.map((r) => ({
    angleDeg: norm(r.angle),
    speedDegPerSec: r.speed,
    targets: r.targets.map((t) => ({ ...t })),
  })),
  pods: s.pods.map((p) => ({ kind: p.kind, ...polar(p.r, p.angle) })),
  effects: {
    widenTicks: s.widenTicks,
    narrowTicks: s.narrowTicks,
    pierceTicks: s.pierceTicks,
    shieldActive: s.shieldActive,
  },
  menu: {
    index: s.screen === "title" || s.screen === "paused" ? s.menuIndex : 0,
  },
});
function launch(s: KesslerState) {
  const i = s.balls.findIndex((b) => b.parked);
  if (i < 0) throw Error("launchBall: no parked ball");
  const b = s.balls[i],
    a = polarOf(b.x, b.y).a,
    v = speed(s.wave);
  s.balls[i] = {
    ...b,
    parked: false,
    vx: v * Math.cos(rad(a)),
    vy: v * Math.sin(rad(a)),
  };
  return s;
}
function drawPod(): PodKind | null {
  if (Math.random() >= C.POD_DROP_CHANCE) return null;
  let n = Math.random();
  for (const r of C.POD_KIND_TABLE) {
    n -= r.probability;
    if (n < 0) return r.kind;
  }
  return "narrow";
}
function addFlash(s: KesslerState, kind: Flash["kind"], x: number, y: number) {
  s.flashes.push({ kind, x, y, ticks: kind === "spark" ? 24 : 50 });
}
function reflect(b: Ball, edge = false, ring?: Ring) {
  const p = polarOf(b.x, b.y),
    nx = Math.cos(rad(p.a)),
    ny = Math.sin(rad(p.a)),
    tx = -ny,
    ty = nx,
    x = edge ? tx : nx,
    y = edge ? ty : ny,
    d = b.vx * x + b.vy * y,
    old = Math.hypot(b.vx, b.vy);
  let vx = b.vx - 2 * d * x,
    vy = b.vy - 2 * d * y;
  if (ring) {
    const u = rad(ring.speed) * p.r * C.RING_KICK_FACTOR;
    vx += u * tx;
    vy += u * ty;
    const m = Math.hypot(vx, vy) || 1;
    vx = (vx / m) * old;
    vy = (vy / m) * old;
  }
  const inward = vx * nx + vy * ny < 0,
    base = p.a + (inward ? 180 : 0),
    off = diff((Math.atan2(vy, vx) * 180) / Math.PI, base),
    a =
      base + Math.sign(off) * Math.max(0, Math.abs(off) - C.ORBITAL_DECAY_DEG);
  return { ...b, vx: old * Math.cos(rad(a)), vy: old * Math.sin(rad(a)) };
}
function wipe(s: KesslerState) {
  s.pods = [];
  s.widenTicks = 0;
  s.narrowTicks = 0;
  s.pierceTicks = 0;
  s.shieldActive = false;
}
function targetAt(r: Ring, i: number, a: number) {
  const c = C.RINGS[i];
  return r.targets.find(
    (t) =>
      Math.abs(
        diff(
          a,
          r.angle +
            t.slot * c.slotWidthDeg +
            C.STRUCTURAL_GAP_DEG +
            c.targetArcDeg / 2,
        ),
      ) <=
      c.targetArcDeg / 2,
  );
}
function drop(s: KesslerState, ri: number, a: number) {
  let k: PodKind | null;
  if (s.nextPod !== null) {
    k = s.nextPod === "none" ? null : s.nextPod;
    s.nextPod = null;
  } else k = drawPod();
  if (k && s.podSpawn)
    s.pods.push({ kind: k, r: C.RINGS[ri].midRadius, angle: norm(a) });
}
function hit(
  s: KesslerState,
  ri: number,
  t: Target,
  b: Ball,
  api: UpdateApi,
  edge: boolean,
) {
  const r = s.rings[ri],
    dead = s.pierceTicks > 0 || t.hp <= 1;
  if (!dead) {
    t.hp--;
    s.score += C.HIT_SCORE;
    api.audio.play(C.CUES.targetHit);
    return edge ? reflect(b, true, r) : reflect(b, false, r);
  }
  r.targets = r.targets.filter((q) => q.slot !== t.slot);
  s.score += C.RINGS[ri].destroyScore;
  api.audio.play(C.CUES.targetBreak);
  const a =
      r.angle +
      t.slot * C.RINGS[ri].slotWidthDeg +
      C.STRUCTURAL_GAP_DEG +
      C.RINGS[ri].targetArcDeg / 2,
    p = polar(C.RINGS[ri].midRadius, a);
  addFlash(s, "burst", p.x, p.y);
  drop(s, ri, a);
  if (s.rings.every((q) => q.targets.length === 0) && s.waveAdvance) {
    s.score += C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave;
    s.screen = "waveclear";
    s.interstitialTicks = C.WAVECLEAR_TICKS;
    s.balls = [];
    wipe(s);
    api.audio.play(C.CUES.waveClear);
  }
  return b;
}
function applyPod(s: KesslerState, p: Pod, api: UpdateApi) {
  s.score += C.POD_CATCH_SCORE;
  api.audio.play(p.kind === "narrow" ? C.CUES.podCatchNarrow : C.CUES.podCatch);
  if (p.kind === "widen") {
    s.widenTicks = C.WIDEN_DURATION_TICKS;
    s.narrowTicks = 0;
  } else if (p.kind === "narrow") {
    s.narrowTicks = C.NARROW_DURATION_TICKS;
    s.widenTicks = 0;
  } else if (p.kind === "pierce") s.pierceTicks = C.PIERCE_DURATION_TICKS;
  else if (p.kind === "shield") s.shieldActive = true;
  else
    for (const off of [C.MULTIBALL_OFFSET_DEG, -C.MULTIBALL_OFFSET_DEG]) {
      if (s.balls.length >= C.BALL_CAP) break;
      const q = polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle),
        v = speed(s.wave),
        a = s.paddleAngle + off;
      s.balls.push({
        ...q,
        vx: v * Math.cos(rad(a)),
        vy: v * Math.sin(rad(a)),
        parked: false,
        born: s.ticks,
      });
    }
}
function tick(s: KesslerState, api: UpdateApi) {
  s.ticks++;
  if (s.screen === "waveclear") {
    s.interstitialTicks = Math.max(0, s.interstitialTicks - 1);
    if (!s.interstitialTicks) {
      s.wave++;
      s.screen = "playing";
      s.rings = rings(s.wave);
      s.balls = [parked(s)];
    }
    return;
  }
  if (s.screen !== "playing") return;
  const d = api.input.value("right") - api.input.value("left");
  s.paddleAngle = norm(
    s.paddleAngle + d * C.DEFLECTOR_TURN_DEG_PER_SEC * C.TICK_DT,
  );
  s.balls.forEach((b) => {
    if (b.parked)
      Object.assign(b, polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle));
  });
  s.rings.forEach((r) => (r.angle = norm(r.angle + r.speed * C.TICK_DT)));
  s.widenTicks = Math.max(0, s.widenTicks - 1);
  s.narrowTicks = Math.max(0, s.narrowTicks - 1);
  s.pierceTicks = Math.max(0, s.pierceTicks - 1);
  s.flashes = s.flashes
    .map((f) => ({ ...f, ticks: f.ticks - 1 }))
    .filter((f) => f.ticks > 0);
  const pods: Pod[] = [];
  for (const p of s.pods) {
    const n = { ...p, r: p.r - C.POD_FALL_SPEED * C.TICK_DT };
    if (
      p.r > C.DEFLECTOR_POD_CATCH_RADIUS &&
      n.r <= C.DEFLECTOR_POD_CATCH_RADIUS &&
      Math.abs(diff(p.angle, s.paddleAngle)) <= span(s) / 2
    )
      applyPod(s, p, api);
    else if (n.r <= C.BURNUP_RADIUS) {
      const q = polar(n.r, n.angle);
      addFlash(s, "burnup", q.x, q.y);
      api.audio.play(C.CUES.podBurn);
    } else pods.push(n);
  }
  s.pods = pods;
  const live: Ball[] = [];
  for (let b of s.balls) {
    if (b.parked) {
      live.push(b);
      continue;
    }
    const op = polarOf(b.x, b.y),
      n = { ...b, x: b.x + b.vx * C.TICK_DT, y: b.y + b.vy * C.TICK_DT },
      np = polarOf(n.x, n.y);
    let done = false;
    for (let i = 0; i < 3 && !done; i++) {
      const c = C.RINGS[i],
        r = s.rings[i],
        face =
          (op.r > c.outerContactRadius && np.r <= c.outerContactRadius) ||
          (op.r < c.innerContactRadius && np.r >= c.innerContactRadius),
        t = targetAt(r, i, np.a);
      if (face && t) {
        b = hit(s, i, t, n, api, false);
        done = true;
      } else if (np.r >= c.innerContactRadius && np.r <= c.outerContactRadius) {
        const before = targetAt(r, i, op.a - r.speed * C.TICK_DT);
        if (t && !before) {
          b = hit(s, i, t, n, api, true);
          done = true;
        }
      }
    }
    if ((s.screen as Screen) === "waveclear") break;
    if (done) {
      live.push(b);
      continue;
    }
    if (op.r < C.FIELD_CONTACT_RADIUS && np.r >= C.FIELD_CONTACT_RADIUS) {
      b = reflect(n);
      api.audio.play(C.CUES.fieldBounce);
      addFlash(s, "spark", n.x, n.y);
    } else if (
      s.shieldActive &&
      op.r > C.SHIELD_CONTACT_RADIUS &&
      np.r <= C.SHIELD_CONTACT_RADIUS
    ) {
      b = reflect(n);
      s.shieldActive = false;
      api.audio.play(C.CUES.shieldReflect);
      addFlash(s, "spark", n.x, n.y);
    } else if (
      op.r > C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      np.r <= C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      b.vx * Math.cos(rad(np.a)) + b.vy * Math.sin(rad(np.a)) < 0 &&
      Math.abs(diff(np.a, s.paddleAngle)) <= span(s) / 2
    ) {
      const nx = Math.cos(rad(np.a)),
        ny = Math.sin(rad(np.a)),
        dot = b.vx * nx + b.vy * ny;
      let a =
        (Math.atan2(b.vy - 2 * dot * ny, b.vx - 2 * dot * nx) * 180) / Math.PI +
        C.ENGLISH_DEG_PER_OFFSET_DEG * diff(np.a, s.paddleAngle);
      a =
        np.a +
        Math.max(
          -C.BOUNCE_CLAMP_DEG,
          Math.min(C.BOUNCE_CLAMP_DEG, diff(a, np.a)),
        );
      const v = speed(s.wave);
      b = { ...n, vx: v * Math.cos(rad(a)), vy: v * Math.sin(rad(a)) };
      api.audio.play(C.CUES.paddleBounce);
      addFlash(s, "spark", n.x, n.y);
    } else b = n;
    if (polarOf(b.x, b.y).r <= C.BURNUP_RADIUS) {
      addFlash(s, "burnup", b.x, b.y);
      api.audio.play(C.CUES.ballLost);
    } else live.push(b);
  }
  s.balls = (s.screen as Screen) === "waveclear" ? [] : live;
  if (s.screen === "playing" && !s.balls.length) {
    s.lives--;
    wipe(s);
    if (!s.lives) {
      s.screen = "gameover";
      api.audio.play(C.CUES.gameOver);
    } else s.balls = [parked(s)];
  }
}
function chooseMenu(s: KesslerState, api: UpdateApi) {
  const items = s.screen === "title" ? C.TITLE_ITEMS : C.PAUSE_ITEMS,
    move = (d: number) => {
      s.menuIndex = (s.menuIndex + d + 2) % 2;
      api.audio.play(C.CUES.menuMove);
    };
  if (api.input.pressed("up")) move(-1);
  if (api.input.pressed("down")) move(1);
  const p = api.input.pointer();
  items.forEach((_, i) => {
    const r = mrect(s, i);
    if (r && inside(p, r) && i !== s.menuIndex) {
      s.menuIndex = i;
      api.audio.play(C.CUES.menuMove);
    }
  });
  if (api.input.pointerPressed())
    s.pointerDownItem = items.findIndex((_, i) => {
      const r = mrect(s, i);
      return !!r && inside(p, r);
    });
  let yes = api.input.pressed("confirm");
  if (api.input.pointerReleased()) {
    const r = s.pointerDownItem === null ? null : mrect(s, s.pointerDownItem);
    yes = !!r && inside(p, r);
    s.pointerDownItem = null;
  }
  if (!yes) return;
  api.audio.play(C.CUES.menuSelect);
  if (s.screen === "title") {
    if (s.menuIndex) {
      s.screen = "howto";
    } else {
      Object.assign(s, initial(s.assets), { screen: "playing" });
      s.balls = [parked(s)];
    }
  } else if (s.menuIndex) s.screen = "title";
  else s.screen = "playing";
}
function music(s: S, api: UpdateApi) {
  const t = s.screen === "title" || s.screen === "howto",
    p =
      s.screen === "playing" ||
      s.screen === "waveclear" ||
      s.screen === "paused";
  if (t && !api.audio.looping("music-title")) api.audio.loop("music-title");
  if (!t) api.audio.stop("music-title");
  if (p && !api.audio.looping("music-play")) api.audio.loop("music-play");
  if (!p) api.audio.stop("music-play");
}
function debug(assets: Assets): KesslerDebugApi {
  const next = (s: S) => clone(s),
    ri = (n: number) => {
      whole(n, 1, "ring");
      if (n > 3) throw Error("ring: invalid value");
      return n - 1;
    };
  return {
    reset: () => initial(assets),
    reconcile: next,
    snapshot: snap,
    menuItemRect: mrect,
    setScreen: (s, n) => ({ ...next(s), screen: n }),
    setScore: (s, n) => {
      whole(n, 0, "score");
      return { ...next(s), score: n };
    },
    setLives: (s, n) => {
      whole(n, 0, "lives");
      return { ...next(s), lives: n };
    },
    setMenuIndex: (s, n) => {
      const q = next(s);
      if (!mrect(s, n)) throw Error("setMenuIndex: unavailable");
      q.menuIndex = n;
      return q;
    },
    setInterstitialTicks: (s, n) => {
      whole(n, 0, "ticks");
      return { ...next(s), interstitialTicks: n };
    },
    setWave: (s, n) => {
      whole(n, 1, "wave");
      const q = next(s);
      q.wave = n;
      q.rings.forEach((r, i) => (r.speed = rspeed(i, n)));
      return q;
    },
    setPaddleAngle: (s, n) => {
      const q = next(s);
      q.paddleAngle = norm(n);
      q.balls.forEach((b) => {
        if (b.parked)
          Object.assign(
            b,
            polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, q.paddleAngle),
          );
      });
      return q;
    },
    launchBall: (s) => launch(next(s)),
    clearBalls: (s) => ({ ...next(s), balls: [] }),
    spawnBall: (s, x, y, vx, vy) => {
      const q = next(s);
      if (q.balls.length >= C.BALL_CAP) throw Error("spawnBall: ball cap");
      q.balls.push({ x, y, vx, vy, parked: false, born: q.ticks });
      return q;
    },
    parkBall: (s) => {
      const q = next(s);
      if (q.balls.length >= C.BALL_CAP || q.balls.some((b) => b.parked))
        throw Error("parkBall: unavailable");
      q.balls.push(parked(q));
      return q;
    },
    clearTargets: (s) => {
      const q = next(s);
      q.rings.forEach((r) => (r.targets = []));
      return q;
    },
    spawnTarget: (s, r, slot, hp) => {
      const q = next(s),
        i = ri(r);
      whole(slot, 0, "slot");
      whole(hp, 1, "hp");
      if (slot >= C.RINGS[i].slots) throw Error("slot: invalid");
      q.rings[i].targets = q.rings[i].targets.filter((t) => t.slot !== slot);
      q.rings[i].targets.push({ slot, hp });
      q.rings[i].targets.sort((a, b) => a.slot - b.slot);
      return q;
    },
    setRingAngle: (s, r, n) => {
      const q = next(s);
      q.rings[ri(r)].angle = norm(n);
      return q;
    },
    setRingSpeed: (s, r, n) => {
      const q = next(s);
      q.rings[ri(r)].speed = n;
      return q;
    },
    clearPods: (s) => ({ ...next(s), pods: [] }),
    spawnPod: (s, k, x, y) => {
      const q = next(s),
        p = polarOf(x, y);
      q.pods.push({ kind: k, r: p.r, angle: p.a });
      return q;
    },
    setNextPod: (s, k) => ({ ...next(s), nextPod: k }),
    drawPod: () => drawPod(),
    setEffectTicks: (s, k, n) => {
      whole(n, 0, "ticks");
      const q = next(s);
      if (k === "widen") {
        q.widenTicks = n;
        if (n) q.narrowTicks = 0;
      } else if (k === "narrow") {
        q.narrowTicks = n;
        if (n) q.widenTicks = 0;
      } else q.pierceTicks = n;
      return q;
    },
    setShield: (s, n) => ({ ...next(s), shieldActive: n }),
    setWaveAdvance: (s, n) => ({ ...next(s), waveAdvance: n }),
    setPodSpawn: (s, n) => ({ ...next(s), podSpawn: n }),
  };
}
export const game: Game<KesslerState, KesslerDebugApi> = {
  async initialize(api: InitApi<KesslerState>) {
    C.ACTIONS.forEach((a) =>
      api.input.register(a, { keys: [...C.BINDINGS[a]] }),
    );
    await Promise.all(
      Object.entries(C.CUE_PATHS).map(([n, p]) => api.audio.load(n, p)),
    );
    await Promise.all([
      api.audio.load("music-title", C.BED_PATHS.title),
      api.audio.load("music-play", C.BED_PATHS.play),
    ]);
    const imgs = await Promise.all([
      api.assets.loadImage(C.SPRITE_PATHS.planet),
      ...C.POD_KINDS.map((k) => api.assets.loadImage(C.SPRITE_PATHS.pods[k])),
      ...C.SPRITE_PATHS.ball.map((p) => api.assets.loadImage(p)),
    ]);
    const blobs = await Promise.all(
        Object.values(C.PARTICLE_PATHS).map((p) => api.assets.load(p)),
      ),
      particles = await Promise.all(
        blobs.map(async (b) => JSON.parse(await b.text()) as unknown),
      );
    const assets: Assets = {
      planet: imgs[0],
      pods: Object.fromEntries(
        C.POD_KINDS.map((k, i) => [k, imgs[i + 1]]),
      ) as Record<PodKind, ImageBitmap>,
      balls: imgs.slice(6),
      particles,
    };
    const ds: [string, (s: S) => string | number | boolean][] = [
      ["screen", (s) => s.screen],
      ["score", (s) => s.score],
      ["lives", (s) => s.lives],
      ["wave", (s) => s.wave],
      ["paddle", (s) => `${s.paddleAngle.toFixed(1)} / ${span(s)}`],
      ["balls", (s) => s.balls.length],
      ["targets", (s) => s.rings.reduce((n, r) => n + r.targets.length, 0)],
      ["pods", (s) => s.pods.length],
      ["widen", (s) => s.widenTicks],
      ["narrow", (s) => s.narrowTicks],
      ["pierce", (s) => s.pierceTicks],
      ["shield", (s) => s.shieldActive],
    ];
    ds.forEach(([n, f]) => api.diagnostics.register(n, f));
    return [initial(assets), debug(assets)];
  },
  update(state, api, dt) {
    const s = clone(state),
      was = s.screen;
    if (was === "title" || was === "paused") chooseMenu(s, api);
    else if (
      was === "howto" &&
      (api.input.pressed("confirm") || api.input.pressed("back"))
    ) {
      s.screen = "title";
      s.menuIndex = 1;
    } else if (was === "gameover" && api.input.pressed("confirm"))
      Object.assign(s, initial(s.assets));
    else if (was === "playing") {
      if (api.input.pressed("back") || api.input.pressed("pause")) {
        s.screen = "paused";
        s.menuIndex = 0;
      } else if (api.input.pressed("launch") && s.balls.some((b) => b.parked))
        launch(s);
    }
    music(s, api);
    s.accumulator += Math.max(0, Math.min(dt, 0.25));
    while (s.accumulator + 1e-12 >= C.TICK_DT) {
      s.accumulator -= C.TICK_DT;
      tick(s, api);
    }
    return s;
  },
  render(s, api) {
    renderGame(s, api);
  },
};
const txt = (
  x: CanvasRenderingContext2D,
  v: string,
  a: number,
  b: number,
  z = 26,
  align: CanvasTextAlign = "center",
  color = "#d9f7ff",
) => {
  x.font = `600 ${z}px system-ui,sans-serif`;
  x.textAlign = align;
  x.fillStyle = color;
  x.fillText(v, a, b);
};
function field(s: S, x: CanvasRenderingContext2D) {
  for (let i = 0; i < 150; i++) {
    x.fillStyle = `rgba(180,220,255,${0.18 + (i % 7) / 18})`;
    x.fillRect(
      (i * 137.2) % 1000,
      (i * i * 29.7) % 1000,
      i % 11 ? 1 : 2,
      i % 11 ? 1 : 2,
    );
  }
  x.strokeStyle = "#33769888";
  x.setLineDash([5, 10]);
  x.beginPath();
  x.arc(500, 500, C.FIELD_RADIUS, 0, Math.PI * 2);
  x.stroke();
  x.setLineDash([]);
  x.drawImage(
    s.assets.planet,
    420,
    420,
    C.PLANET_SPRITE_SIZE,
    C.PLANET_SPRITE_SIZE,
  );
  s.rings.forEach((r, i) => {
    const c = C.RINGS[i];
    for (const t of r.targets) {
      x.strokeStyle = "#d6f7ff";
      x.fillStyle =
        i === 0
          ? "#8bc8d8"
          : i === 1
            ? t.hp < c.hitPoints
              ? "#ff9e64"
              : "#62a7c0"
            : "#9673b7";
      x.lineWidth = 12;
      x.beginPath();
      x.arc(
        500,
        500,
        c.midRadius,
        rad(r.angle + t.slot * c.slotWidthDeg + C.STRUCTURAL_GAP_DEG),
        rad(
          r.angle +
            t.slot * c.slotWidthDeg +
            C.STRUCTURAL_GAP_DEG +
            c.targetArcDeg,
        ),
      );
      x.stroke();
      x.lineWidth = 8;
      x.strokeStyle = x.fillStyle as string;
      x.stroke();
    }
  });
  x.strokeStyle = "#eaffff";
  x.shadowColor = "#54e6ff";
  x.shadowBlur = 12;
  x.lineWidth = 10;
  x.beginPath();
  x.arc(
    500,
    500,
    (C.DEFLECTOR_TRACK_INNER + C.DEFLECTOR_TRACK_OUTER) / 2,
    rad(s.paddleAngle - span(s) / 2),
    rad(s.paddleAngle + span(s) / 2),
  );
  x.stroke();
  x.shadowBlur = 0;
  if (s.shieldActive) {
    x.strokeStyle = "#67d5ff";
    x.lineWidth = 4;
    x.beginPath();
    x.arc(500, 500, C.SHIELD_RADIUS, 0, Math.PI * 2);
    x.stroke();
  }
  s.pods.forEach((p) => {
    const q = polar(p.r, p.angle);
    x.drawImage(s.assets.pods[p.kind], q.x - 12, q.y - 12);
  });
  s.balls.forEach((b) => {
    const i = Math.floor((s.ticks - b.born) / C.BALL_FRAME_TICKS) % 6;
    x.drawImage(s.assets.balls[i], b.x - 12, b.y - 12);
  });
  s.flashes.forEach((f) => {
    const r = 50 - f.ticks + 8,
      g = x.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, f.kind === "burnup" ? "#ff623cbb" : "#48dcffbb");
    g.addColorStop(1, "#0000");
    x.fillStyle = g;
    x.beginPath();
    x.arc(f.x, f.y, r, 0, Math.PI * 2);
    x.fill();
  });
}
function menu(s: S, x: CanvasRenderingContext2D, items: readonly string[]) {
  items.forEach((v, i) => {
    const r = mrect(s, i)!;
    x.fillStyle = i === s.menuIndex ? "#5ce1e633" : "#06101ecc";
    x.strokeStyle = i === s.menuIndex ? "#72efff" : "#29465d";
    x.lineWidth = i === s.menuIndex ? 3 : 1;
    x.fillRect(r.x, r.y, r.width, r.height);
    x.strokeRect(r.x, r.y, r.width, r.height);
    txt(x, v, 500, r.y + 38, 22);
  });
}
function renderGame(s: S, api: RenderApi) {
  const x = api.ctx;
  field(s, x);
  if (["playing", "paused", "waveclear"].includes(s.screen)) {
    x.fillStyle = "#07101ddd";
    x.fillRect(18, 18, 964, 54);
    txt(x, `SCORE  ${String(s.score).padStart(6, "0")}`, 42, 54, 22, "left");
    txt(x, `WAVE  ${s.wave}`, 500, 54, 22);
    txt(x, `LIVES  ${s.lives}`, 958, 54, 22, "right");
  }
  if (s.screen === "title") {
    x.fillStyle = "#02050bdf";
    x.fillRect(0, 0, 1000, 1000);
    x.shadowColor = "#5eeaff";
    x.shadowBlur = 25;
    txt(x, C.TITLE_TEXT, 500, 350, 104);
    x.shadowBlur = 0;
    txt(x, "ORBITAL DEMOLITION", 500, 405, 22, "center", "#79d9ed");
    menu(s, x, C.TITLE_ITEMS);
  } else if (s.screen === "howto") {
    x.fillStyle = "#030814ef";
    x.fillRect(100, 90, 800, 820);
    txt(x, "HOW TO PLAY", 500, 180, 48);
    [
      "Circle the planet with A / D or the arrow keys.",
      "Press SPACE to launch; steer the return with the deflector.",
      "A missed ball burns up. Losing the last ball costs a life.",
      "Break every derelict to clear the wave and score.",
      "Catch salvage for widen, multiball, shield, pierce—or narrow.",
      "P or ESC pauses. ENTER / SPACE confirms.",
    ].forEach((v, i) => txt(x, v, 500, 290 + i * 70, 22));
    txt(x, "PRESS ENTER OR ESC", 500, 810, 18, "center", "#69dbea");
  } else if (s.screen === "paused") {
    x.fillStyle = "#02050bd0";
    x.fillRect(0, 0, 1000, 1000);
    txt(x, "ORBIT SUSPENDED", 500, 430, 46);
    menu(s, x, C.PAUSE_ITEMS);
  } else if (s.screen === "waveclear") {
    x.fillStyle = "#07111bdf";
    x.fillRect(215, 420, 570, 140);
    txt(x, `WAVE ${s.wave} CLEARED`, 500, 490, 44);
    txt(
      x,
      `SALVAGE BONUS +${C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave}`,
      500,
      530,
      19,
    );
  } else if (s.screen === "gameover") {
    x.fillStyle = "#07030be8";
    x.fillRect(0, 0, 1000, 1000);
    txt(x, C.GAMEOVER_TEXT, 500, 400, 72, "center", "#ff7597");
    txt(x, `FINAL SCORE  ${s.score}`, 500, 500, 30);
    txt(x, `WAVE REACHED  ${s.wave}`, 500, 548, 22);
    txt(x, "PRESS ENTER", 500, 650, 18);
  }
}
