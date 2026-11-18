import { TOWERS } from './constants';
import { getTowerSpriteCanvas } from './sprites';
import { ParticleEntity, TowerEntity, TowerSellAnimation } from './types';

export class ParticleManager {
  private particles: ParticleEntity[] = [];
  private sellAnimations: TowerSellAnimation[] = [];
  private readonly maxParticles: number;

  constructor(maxParticles = 450) {
    this.maxParticles = maxParticles;
  }

  public clear(): void {
    this.particles = [];
    this.sellAnimations = [];
  }

  public getActiveCount(): number {
    return this.particles.length + this.sellAnimations.length;
  }

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    speedScale = 1
  ): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = (0.7 + Math.random() * 1.4) * speedScale;
      const life = 0.25 + Math.random() * 0.25;
      this.pushParticle({
        kind: 'dot',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life,
        maxLife: life,
        size: 0.04 + Math.random() * 0.05,
        color,
        drag: 0.94,
      });
    }
  }

  public spawnRing(
    x: number,
    y: number,
    radius: number,
    color: string,
    duration = 0.34,
    lineWidth = 2.5
  ): void {
    this.pushParticle({
      kind: 'ring',
      ring: true,
      x,
      y,
      vx: 0,
      vy: 0,
      life: duration,
      maxLife: duration,
      size: radius,
      color,
      lineWidth,
    });
  }

  /**
   * Plays a shrink-out dismantle animation + radial shard/spark explosion when selling a tower.
   */
  public spawnTowerSell(tower: TowerEntity): void {
    const cx = tower.c + 0.5;
    const cy = tower.r + 0.5;
    const def = TOWERS[tower.type];

    // 1. Tower shrink-out ghost animation
    this.sellAnimations.push({
      type: tower.type,
      c: tower.c,
      r: tower.r,
      level: tower.level,
      angle: tower.angle,
      life: 0.28,
      maxLife: 0.28,
    });

    // 2. Dual shockwave rings (accent + gold refund pulse)
    this.spawnRing(cx, cy, 0.95, def.accentColor, 0.3, 2.4);
    this.spawnRing(cx, cy, 0.68, '#FBBF24', 0.24, 1.8);

    // 3. Spinning metallic & tower-colored debris shards
    const shardCount = 10;
    for (let i = 0; i < shardCount; i++) {
      const a = (Math.PI * 2 * i) / shardCount + (Math.random() - 0.5) * 0.35;
      const spd = 1.25 + Math.random() * 1.45;
      const life = 0.28 + Math.random() * 0.18;
      this.pushParticle({
        kind: 'shard',
        x: cx,
        y: cy,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life,
        maxLife: life,
        size: 0.065 + Math.random() * 0.045,
        color: i % 2 === 0 ? def.accentColor : '#94A3B8',
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 14,
        drag: 0.91,
      });
    }

    // 4. Bright gold refund sparks
    this.spawnBurst(cx, cy, '#FBBF24', 10, 1.35);
  }

  public update(dt: number): void {
    for (let i = this.sellAnimations.length - 1; i >= 0; i--) {
      const anim = this.sellAnimations[i];
      anim.life -= dt;
      if (anim.life <= 0) {
        this.sellAnimations.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const isRing = pt.kind === 'ring' || pt.ring;
      if (!isRing) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        const drag = pt.drag ?? 0.94;
        const frameDrag = Math.pow(drag, dt * 60);
        pt.vx *= frameDrag;
        pt.vy *= frameDrag;
        if (pt.angularVelocity !== undefined && pt.angle !== undefined) {
          pt.angle += pt.angularVelocity * dt;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, tile: number): void {
    // 1. Render tower shrink-out dismantle animations
    for (const anim of this.sellAnimations) {
      this.renderSellAnimation(ctx, anim, tile);
    }

    // 2. Render rings, shards, and spark dots
    for (const pt of this.particles) {
      const t = 1 - pt.life / pt.maxLife;
      const alpha = Math.max(0, 1 - t);
      const isRing = pt.kind === 'ring' || pt.ring;

      if (isRing) {
        ctx.save();
        ctx.strokeStyle = pt.color;
        ctx.globalAlpha = alpha * 0.75;
        ctx.lineWidth = pt.lineWidth ?? 2.5;
        ctx.beginPath();
        ctx.arc(pt.x * tile, pt.y * tile, pt.size * tile * (0.25 + t * 0.75), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (pt.kind === 'shard') {
        const s = pt.size * tile * (1 - t * 0.35);
        ctx.save();
        ctx.translate(pt.x * tile, pt.y * tile);
        ctx.rotate(pt.angle ?? 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;
        ctx.fillRect(-s, -s * 0.55, s * 2, s * 1.1);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x * tile, pt.y * tile, pt.size * tile * (1 - t * 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private pushParticle(particle: ParticleEntity): void {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push(particle);
  }

  private renderSellAnimation(
    ctx: CanvasRenderingContext2D,
    anim: TowerSellAnimation,
    tile: number
  ): void {
    const t = Math.min(1, Math.max(0, 1 - anim.life / anim.maxLife));
    // Slight pop at start then smooth shrink to zero
    const scale = t < 0.15 ? 1 + (t / 0.15) * 0.08 : Math.max(0, 1.08 * (1 - (t - 0.15) / 0.85));
    const alpha = Math.max(0, 1 - t * t);
    const cx = (anim.c + 0.5) * tile;
    const cy = (anim.r + 0.5) * tile;
    const def = TOWERS[anim.type];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.45);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Shrinking base pad
    const half = tile * 0.4;
    const rad = tile * 0.14;
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = t < 0.35 ? '#FBBF24' : def.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-half + rad, -half);
    ctx.lineTo(half - rad, -half);
    ctx.quadraticCurveTo(half, -half, half, -half + rad);
    ctx.lineTo(half, half - rad);
    ctx.quadraticCurveTo(half, half, half - rad, half);
    ctx.lineTo(-half + rad, half);
    ctx.quadraticCurveTo(-half, half, -half, half - rad);
    ctx.lineTo(-half, -half + rad);
    ctx.quadraticCurveTo(-half, -half, -half + rad, -half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shrinking turret sprite (or geometric fallback)
    ctx.rotate(anim.angle);
    const sprite = getTowerSpriteCanvas(anim.type);
    if (sprite) {
      const spriteSize = tile * 0.86;
      ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    } else if (anim.type === 'gatling') {
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(0, -tile * 0.05, tile * 0.34, tile * 0.1);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, tile * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (anim.type === 'cryo') {
      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * tile * 0.23;
        const py = Math.sin(a) * tile * 0.23;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (anim.type === 'mortar') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(-tile * 0.08, -tile * 0.1, tile * 0.38, tile * 0.2);
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(-tile * 0.04, 0, tile * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#A78BFA';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, tile * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#DDD6FE';
      ctx.beginPath();
      ctx.arc(0, 0, tile * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
