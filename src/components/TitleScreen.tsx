import React from 'react';
import { DIFFICULTIES, ENEMIES, GRID_COLS, GRID_ROWS, MAPS, TOWER_LIST } from '../game/constants';
import { Difficulty, MapConfig, MapId } from '../game/types';

interface TitleScreenProps {
  selectedMap: MapId;
  selectedDifficulty: Difficulty;
  bestScore: number;
  unlockedAchievementCount: number;
  totalAchievementCount: number;
  onSelectMap: (id: MapId) => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartGame: () => void;
  onOpenManual: () => void;
}

function MapPreviewSvg({ map, active }: { map: MapConfig; active: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
      className="w-full h-24 rounded-md bg-[#0B1120] border border-slate-800/80"
      aria-hidden="true"
    >
      {map.blockedTiles.map((b, i) => (
        <rect
          key={i}
          x={b.c + 0.18}
          y={b.r + 0.18}
          width={0.64}
          height={0.64}
          rx={0.12}
          fill="#334155"
        />
      ))}
      {map.paths.map((path, idx) => {
        const d = path
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.c + 0.5} ${p.r + 0.5}`)
          .join(' ');
        return (
          <g key={idx}>
            <path
              d={d}
              fill="none"
              stroke={active ? '#3B82F6' : '#475569'}
              strokeWidth={0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.45}
            />
            <path
              d={d}
              fill="none"
              stroke={active ? '#93C5FD' : '#94A3B8'}
              strokeWidth={0.14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={path[0].c + 0.5} cy={path[0].r + 0.5} r={0.28} fill="#F59E0B" />
          </g>
        );
      })}
      <circle
        cx={map.paths[0][map.paths[0].length - 1].c + 0.5}
        cy={map.paths[0][map.paths[0].length - 1].r + 0.5}
        r={0.34}
        fill="#10B981"
      />
    </svg>
  );
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMap,
  selectedDifficulty,
  bestScore,
  unlockedAchievementCount,
  totalAchievementCount,
  onSelectMap,
  onSelectDifficulty,
  onStartGame,
  onOpenManual,
}) => {
  const enemyList = Object.values(ENEMIES);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-center px-6 py-8">
      <div className="max-w-5xl w-full mx-auto space-y-8">
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-sm font-medium text-amber-400">
              网格战术塔防 · 炮塔协同与波次拦截
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white text-balance">
              堡垒防线
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              在关键通道高地部署机枪、寒冰、重炮与电弧炮塔，针对敌人护盾与移动速度灵活调整集火目标，守卫能源核心。
            </p>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400">成就徽章</div>
              <div className="text-2xl font-bold font-mono-num text-slate-200">
                {unlockedAchievementCount}/{totalAchievementCount}
              </div>
            </div>
            {bestScore > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-400">历史最高得分</div>
                <div className="text-2xl font-bold font-mono-num text-amber-400">
                  {bestScore.toLocaleString()}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onOpenManual}
              className="px-4 py-3.5 bg-[#151F34] hover:bg-[#1B2843] border border-slate-700 text-slate-200 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              指挥官手册
            </button>
            <button
              onClick={onStartGame}
              className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-base rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              开始游戏
            </button>
          </div>
        </div>

        {/* Map & Difficulty Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-200">选择防线地图</h2>
              <span className="text-xs text-slate-400">3 套独立地形与路径结构</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {MAPS.map((map) => {
                const isSelected = map.id === selectedMap;
                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => onSelectMap(map.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-[#17233B] border-amber-500/80'
                        : 'bg-[#11192C] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <MapPreviewSvg map={map} active={isSelected} />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{map.name}</span>
                        <span className="text-xs text-slate-400">{map.difficultyLabel}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {map.description}
                      </p>
                      <div className="pt-1 text-xs text-slate-500 font-mono-num">
                        初始金币 {map.startingGold} · 核心 {map.startingLives}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-200">选择挑战模式</h2>
            <div className="space-y-2.5">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((diffKey) => {
                const diff = DIFFICULTIES[diffKey];
                const isSelected = diff.id === selectedDifficulty;
                return (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => onSelectDifficulty(diff.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#17233B] border-amber-500/80'
                        : 'bg-[#11192C] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{diff.name}</span>
                      <span className="text-xs text-slate-400 font-mono-num">
                        {diff.totalWaves > 0 ? `${diff.totalWaves} 波` : '无限波次'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {diff.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Concise Tower & Enemy Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800/80">
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-300">防御炮塔图鉴</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {TOWER_LIST.map((t) => (
                <div key={t.type} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100" style={{ color: t.accentColor }}>
                      {t.name}
                    </span>
                    <span className="font-mono-num text-slate-400">{t.cost} 金币</span>
                  </div>
                  <p className="text-slate-400">{t.shortDesc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-300">敌军情报与操作快捷键</h3>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-300">
                {enemyList.map((e, idx) => (
                  <span key={e.type}>
                    <span style={{ color: e.color }}>{e.name}</span>
                    {idx < enemyList.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </div>
              <p className="leading-relaxed">
                快捷键：1-4 选择炮塔 · 空格 暂停/继续 · N 提前出波 · U 升级选中炮塔 · Delete 出售炮塔
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
