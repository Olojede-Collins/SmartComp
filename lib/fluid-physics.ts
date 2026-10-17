export const RUBBERBAND_CONSTANT = 0.55;
export const DECELERATION_RATE = 0.998;

export interface SpringConfig {
  damping: number;
  response: number;
  initialVelocity?: number;
}

export const SPRING_PRESETS: Record<string, SpringConfig> = {
  default: { damping: 1.0, response: 0.35 },
  momentum: { damping: 0.8, response: 0.3 },
  sheet: { damping: 0.8, response: 0.32 },
  press: { damping: 1.0, response: 0.15 },
};

export function rubberband(
  overshoot: number,
  dimension: number,
  constant: number = RUBBERBAND_CONSTANT,
): number {
  if (dimension <= 0) return 0;
  const absOvershoot = Math.abs(overshoot);
  const visualDisplacement =
    (absOvershoot * dimension * constant) /
    (dimension + constant * absOvershoot);
  return overshoot < 0 ? -visualDisplacement : visualDisplacement;
}

export function project(
  initialVelocity: number,
  decelerationRate: number = DECELERATION_RATE,
): number {
  if (decelerationRate >= 1 || decelerationRate <= 0) {
    throw new Error('decelerationRate must be strictly between 0 and 1');
  }
  return initialVelocity / (1 - decelerationRate);
}

export function calculateRelativeVelocity(
  gestureVelocity: number,
  target: number,
  current: number,
): number {
  const distance = target - current;
  if (Math.abs(distance) < 0.001) return 0;
  return gestureVelocity / distance;
}

export function getPresentationTransform(element: HTMLElement): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
} {
  const style = window.getComputedStyle(element);
  const transform =
    style.transform ||
    (style as unknown as Record<string, string>)['webkitTransform'];

  if (!transform || transform === 'none') {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  }

  try {
    if (typeof DOMMatrixReadOnly !== 'undefined') {
      const matrix = new DOMMatrixReadOnly(transform);
      return {
        x: matrix.m41,
        y: matrix.m42,
        scaleX: Math.hypot(matrix.m11, matrix.m12),
        scaleY: Math.hypot(matrix.m21, matrix.m22),
      };
    }
  } catch {}

  const matrixMatch = transform.match(/^matrix\((.+)\)$/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()));
    if (values.length === 6) {
      return {
        x: values[4],
        y: values[5],
        scaleX: Math.hypot(values[0], values[1]),
        scaleY: Math.hypot(values[2], values[3]),
      };
    }
  }

  const matrix3dMatch = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((v) => parseFloat(v.trim()));
    if (values.length === 16) {
      return {
        x: values[12],
        y: values[13],
        scaleX: Math.hypot(values[0], values[1], values[2]),
        scaleY: Math.hypot(values[4], values[5], values[6]),
      };
    }
  }

  return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
}

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export class PointerVelocityTracker {
  private samples: PointerSample[] = [];
  private readonly maxAgeMs: number;

  constructor(maxAgeMs: number = 100) {
    this.maxAgeMs = maxAgeMs;
  }

  public addPoint(
    x: number,
    y: number,
    time: number = performance.now(),
  ): void {
    this.samples.push({ x, y, time });
    this.prune(time);
  }

  private prune(currentTime: number): void {
    const cutoff = currentTime - this.maxAgeMs;
    while (this.samples.length > 0 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  public getVelocity(currentTime: number = performance.now()): {
    vx: number;
    vy: number;
  } {
    this.prune(currentTime);
    if (this.samples.length < 2) {
      return { vx: 0, vy: 0 };
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.time - first.time) / 1000;

    if (dt <= 0.001) {
      return { vx: 0, vy: 0 };
    }

    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt,
    };
  }

  public reset(): void {
    this.samples = [];
  }
}

export interface SpringSolverOptions {
  from: number;
  to: number;
  initialVelocity?: number;
  damping: number;
  response: number;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: () => void;
  restThreshold?: number;
  velocityThreshold?: number;
}

export function createSpringSolver(options: SpringSolverOptions): {
  stop: () => void;
  updateTarget: (newTo: number) => void;
} {
  const {
    from,
    to,
    initialVelocity = 0,
    damping,
    response,
    onUpdate,
    onComplete,
    restThreshold = 0.5,
    velocityThreshold = 10,
  } = options;

  let currentTo = to;
  let currentFrom = from;
  let currentVelocity = initialVelocity;
  let startTime = performance.now();
  let rafId: number | null = null;
  let isStopped = false;

  const omega0 = (2 * Math.PI) / Math.max(0.01, response);
  const zeta = damping;

  function step(now: number) {
    if (isStopped) return;

    const t = (now - startTime) / 1000;
    const x0 = currentFrom - currentTo;

    let positionOffset = 0;
    let velocity = 0;

    if (Math.abs(zeta - 1.0) < 0.001) {
      const c1 = x0;
      const c2 = currentVelocity + omega0 * x0;
      const expTerm = Math.exp(-omega0 * t);
      positionOffset = (c1 + c2 * t) * expTerm;
      velocity = (c2 - omega0 * (c1 + c2 * t)) * expTerm;
    } else if (zeta < 1.0) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const c1 = x0;
      const c2 = (currentVelocity + zeta * omega0 * x0) / omegaD;
      const expTerm = Math.exp(-zeta * omega0 * t);
      const cosTerm = Math.cos(omegaD * t);
      const sinTerm = Math.sin(omegaD * t);
      positionOffset = expTerm * (c1 * cosTerm + c2 * sinTerm);
      velocity =
        -zeta * omega0 * positionOffset +
        expTerm * (-c1 * omegaD * sinTerm + c2 * omegaD * cosTerm);
    } else {
      const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
      const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
      const c2 = (currentVelocity - r1 * x0) / (r2 - r1);
      const c1 = x0 - c2;
      positionOffset = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
      velocity = c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t);
    }

    const currentPosition = currentTo + positionOffset;
    onUpdate(currentPosition, velocity);

    if (
      Math.abs(positionOffset) <= restThreshold &&
      Math.abs(velocity) <= velocityThreshold
    ) {
      onUpdate(currentTo, 0);
      onComplete?.();
      return;
    }

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  return {
    stop: () => {
      isStopped = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    updateTarget: (newTo: number) => {
      const now = performance.now();
      const t = (now - startTime) / 1000;
      const x0 = currentFrom - currentTo;
      let pos = currentTo;
      let vel = currentVelocity;

      if (Math.abs(zeta - 1.0) < 0.001) {
        const c1 = x0;
        const c2 = currentVelocity + omega0 * x0;
        const expTerm = Math.exp(-omega0 * t);
        pos = currentTo + (c1 + c2 * t) * expTerm;
        vel = (c2 - omega0 * (c1 + c2 * t)) * expTerm;
      }

      currentFrom = pos;
      currentVelocity = vel;
      currentTo = newTo;
      startTime = now;
    },
  };
}
