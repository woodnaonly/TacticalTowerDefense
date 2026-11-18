import React from 'react';
import { getWaveBossCount, isBossWave } from '../game/constants';
import { HudSnapshot } from '../game/types';

interface WaveProgressBarProps {
  hud: HudSnapshot;
}

export const WaveProgressBar: React.FC<WaveProgressBarProps> = ({ hud }) => {
  const isEndless = hud.totalWaves === 0;
  const windowSize = isEndless ? 12 : hud.totalWaves;
  const startWave = isEndless ? Math.max(1, hud.wave - 2) : 1;
  const waves = Array.from({ length: windowSize }, (_, i) => startWave + i);

  // Determine intra-wave kill progress (0..1)
  const waveProgress =
    hud.waveActive && hud.waveTotalEnemies > 0
      ? Math.min(1, Math.max(0, (hud.waveTotalEnemies - hud.enemiesRemaining) / hud.waveTotalEnemies))
      : 0;

  // Find active/next boss wave
  const activeBossCount = hud.waveActive ? getWaveBossCount(hud.wave) : 0;
  const searchLimit = isEndless ? Math.max(1, hud.wave) + 12 : hud.totalWaves;
  let nextBossWave: number | null = null;
  let nextBossCount = 0;

  for (let w = Math.max(1, hud.waveActive ? hud.wave + 1 : hud.wave + 1); w <= searchLimit; w++) {
    const count = getWaveBossCount(w);
    if (count > 0) {
      nextBossWave = w;
      nextBossCount = count;
      break;
    }
  }

  // SVG geometry
  const svgW = 720;
  const svgH = 34;
  const padX = 24;
  const trackY = 13;
  const usableW = svgW - padX * 2;
  const getNodeX = (idx: number) =>
    waves.length <= 1 ? svgW / 2 : padX + (usableW * idx) / (waves.length - 1);

  // Compute progress line endpoint in SVG X coordinates
  let progressX = padX;
  if (hud.wave > 0) {
    const currentIdx = waves.indexOf(hud.wave);
    if (currentIdx !== -1) {
      const baseX = getNodeX(currentIdx);
      if (hud.waveActive && currentIdx < waves.length - 1) {
        const nextX = getNodeX(currentIdx + 1);
        progressX = baseX + (nextX - baseX) * waveProgress * 0.7;
      } else {
        progressX = baseX;
      }
    } else if (hud.wave > waves[waves.length - 1]) {
      progressX = svgW - padX;
    }
  }

  return (
    <section
      aria-label="波次进度条"
      className="bg-[#0E1628] border-b border-slate-800/90 px-4 py-1.5 shrink-0"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Current Wave & Remaining Enemies */}
        <div className="flex items-center gap-3 text-xs shrink-0 whitespace-nowrap">
          <span className="font-semibold text-slate-200 font-mono-num">
            {hud.wave === 0
              ? '准备阶段'
              : isEndless
                ? `第 ${hud.wave} 波`
                : `第 ${hud.wave}/${hud.totalWaves} 波`}
          </span>

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>

          {hud.waveActive ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">剩余敌军</span>
              <span className="font-mono-num font-semibold text-amber-400">
                {hud.enemiesRemaining}
                <span className="text-slate-500">/{hud.waveTotalEnemies}</span>
              </span>
            </div>
          ) : hud.wave > 0 && (isEndless || hud.wave < hud.totalWaves) ? (
            <span className="text-slate-400 font-mono-num">
              下波倒计时 <span className="text-emerald-400 font-semibold">{Math.ceil(hud.waveCountdown)}s</span>
            </span>
          ) : (
            <span className="text-slate-400">点击「开始首波」开战</span>
          )}
        </div>

        {/* Center: SVG Wave Timeline */}
        <div className="flex-1 min-w-0 max-w-2xl hidden sm:block">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-8 overflow-visible"
            role="img"
            aria-label="波次节点与强敌波次进度图"
          >
            {/* Base track */}
            <line
              x1={padX}
              y1={trackY}
              x2={svgW - padX}
              y2={trackY}
              stroke="#1E293B"
              strokeWidth={3}
              strokeLinecap="round"
            />

            {/* Cleared / active progress track */}
            {hud.wave > 0 && (
              <line
                x1={padX}
                y1={trackY}
                x2={progressX}
                y2={trackY}
                stroke={hud.waveActive ? '#F59E0B' : '#10B981'}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}

            {/* Wave Nodes */}
            {waves.map((w, idx) => {
              const cx = getNodeX(idx);
              const bossCount = getWaveBossCount(w);
              const boss = bossCount > 0;
              const isCleared = hud.wave > w || (hud.wave === w && !hud.waveActive);
              const isCurrent = hud.wave === w && hud.waveActive;
              const isNextUpcoming =
                (!hud.waveActive && hud.wave + 1 === w) || (hud.wave === 0 && w === 1);

              const showLabel =
                idx === 0 ||
                idx === waves.length - 1 ||
                boss ||
                isCurrent ||
                isNextUpcoming;

              return (
                <g key={w}>
                  <title>
                    {boss
                      ? `第 ${w} 波 · 强敌波（攻城巨兽 ×${bossCount}）`
                      : `第 ${w} 波`}
                  </title>

                  {isCurrent && (
                    <circle
                      cx={cx}
                      cy={trackY}
                      r={boss ? 10 : 8.5}
                      fill="none"
                      stroke={boss ? 'rgba(244, 63, 94, 0.5)' : 'rgba(245, 158, 11, 0.45)'}
                      strokeWidth={1.5}
                    />
                  )}

                  {boss ? (
                    <polygon
                      points={`${cx},${trackY - 6.5} ${cx + 6.5},${trackY} ${cx},${trackY + 6.5} ${cx - 6.5},${trackY}`}
                      fill={
                        isCleared
                          ? '#10B981'
                          : isCurrent
                            ? '#EF4444'
                            : '#9F1239'
                      }
                      stroke={
                        isCleared
                          ? '#6EE7B7'
                          : isCurrent
                            ? '#FECDD3'
                            : '#FB7185'
                      }
                      strokeWidth={1.5}
                    />
                  ) : (
                    <circle
                      cx={cx}
                      cy={trackY}
                      r={isCurrent ? 5.2 : 4}
                      fill={
                        isCleared
                          ? '#10B981'
                          : isCurrent
                            ? '#F59E0B'
                            : isNextUpcoming
                              ? '#38BDF8'
                              : '#1E293B'
                      }
                      stroke={
                        isCleared
                          ? '#34D399'
                          : isCurrent
                            ? '#FDE68A'
                            : isNextUpcoming
                              ? '#7DD3FC'
                              : '#475569'
                      }
                      strokeWidth={1.5}
                    />
                  )}

                  {showLabel && (
                    <text
                      x={cx}
                      y={30}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily='"JetBrains Mono", monospace'
                      fontWeight={isCurrent || boss ? 700 : 500}
                      fill={
                        isCurrent
                          ? boss
                            ? '#FDA4AF'
                            : '#FCD34D'
                          : boss
                            ? isCleared
                              ? '#6EE7B7'
                              : '#FB7185'
                            : isCleared
                              ? '#94A3B8'
                              : '#64748B'
                      }
                    >
                      {boss ? `B${w}` : w}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: Upcoming Boss Wave Alert */}
        <div className="flex items-center gap-2 text-xs shrink-0 whitespace-nowrap">
          {activeBossCount > 0 ? (
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <polygon points="5,0 10,5 5,10 0,5" fill="#EF4444" stroke="#FECDD3" strokeWidth="1" />
              </svg>
              <span className="font-mono-num">强敌交战 · 巨兽 ×{activeBossCount}</span>
            </div>
          ) : nextBossWave !== null ? (
            <div className="flex items-center gap-1.5 text-slate-300">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <polygon points="5,0 10,5 5,10 0,5" fill="#9F1239" stroke="#FB7185" strokeWidth="1" />
              </svg>
              <span>
                强敌波{' '}
                <span className="font-mono-num font-semibold text-rose-400">
                  第 {nextBossWave} 波
                </span>
                <span className="text-slate-500 font-mono-num ml-1">(×{nextBossCount})</span>
              </span>
            </div>
          ) : (
            <span className="text-emerald-400 font-medium">
              {isBossWave(hud.wave) ? '强敌波次已清除' : '已过所有强敌波'}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
