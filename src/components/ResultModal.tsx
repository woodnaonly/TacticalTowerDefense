import React from 'react';
import {
  ArrowUpCircle,
  Coins,
  Crosshair,
  Crown,
  Flame,
  HeartPulse,
  Layers,
  ShieldCheck,
  Skull,
  Snowflake,
  Timer,
  Zap,
} from 'lucide-react';
import {
  AchievementIconKey,
  AchievementTone,
  EarnedAchievement,
  GameState,
  HudSnapshot,
} from '../game/types';

interface ResultModalProps {
  gameState: GameState;
  hud: HudSnapshot;
  mapName: string;
  earnedAchievements: EarnedAchievement[];
  totalUnlockedAchievements: number;
  totalAchievementCount: number;
  onResume: () => void;
  onRestart: () => void;
  onExitToMenu: () => void;
}

const TONE_STYLES: Record<AchievementTone, string> = {
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

function renderAchievementIcon(icon: AchievementIconKey) {
  const cls = 'w-4 h-4';
  switch (icon) {
    case 'shield':
      return <ShieldCheck className={cls} />;
    case 'coins':
      return <Coins className={cls} />;
    case 'gatling':
      return <Crosshair className={cls} />;
    case 'cryo':
      return <Snowflake className={cls} />;
    case 'mortar':
      return <Flame className={cls} />;
    case 'tesla':
      return <Zap className={cls} />;
    case 'layers':
      return <Layers className={cls} />;
    case 'upgrade':
      return <ArrowUpCircle className={cls} />;
    case 'boss':
      return <Skull className={cls} />;
    case 'crown':
      return <Crown className={cls} />;
    case 'timer':
      return <Timer className={cls} />;
    case 'heart':
      return <HeartPulse className={cls} />;
  }
}

export const ResultModal: React.FC<ResultModalProps> = ({
  gameState,
  hud,
  mapName,
  earnedAchievements,
  totalUnlockedAchievements,
  totalAchievementCount,
  onResume,
  onRestart,
  onExitToMenu,
}) => {
  if (gameState !== 'PAUSED' && gameState !== 'VICTORY' && gameState !== 'GAME_OVER') {
    return null;
  }

  const isPaused = gameState === 'PAUSED';
  const isVictory = gameState === 'VICTORY';

  const title = isPaused ? '游戏已暂停' : isVictory ? '防线守卫成功' : '能源核心失守';
  const subtitle = isPaused
    ? `${mapName} · 当前波次 ${hud.wave}`
    : isVictory
      ? `成功抵御全部 ${hud.totalWaves} 波进攻，${mapName}防线稳固。`
      : `敌军突破了防线，核心在第 ${hud.wave} 波耗尽。`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${
          isPaused ? 'max-w-md' : 'max-w-xl'
        } bg-[#11192C] border border-slate-800 rounded-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto`}
      >
        <div className="space-y-1.5">
          <p
            className={`text-xs font-semibold ${
              isVictory ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {isPaused ? '战术休整' : isVictory ? '战役胜利' : '防线溃败'}
          </p>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y border-slate-800 text-sm">
          <div>
            <div className="text-xs text-slate-400">当前得分</div>
            <div className="text-xl font-bold font-mono-num text-amber-400">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">击毁敌军</div>
            <div className="text-xl font-bold font-mono-num text-slate-100">
              {hud.enemiesDefeated}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">通过波次</div>
            <div className="text-lg font-semibold font-mono-num text-slate-200">
              {hud.wave}
              {hud.totalWaves > 0 ? ` / ${hud.totalWaves}` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">部署炮塔</div>
            <div className="text-lg font-semibold font-mono-num text-slate-200">
              {hud.towersBuilt}
            </div>
          </div>
        </div>

        {!isPaused && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-200">本局成就徽章</h3>
              <span className="text-xs text-slate-400 font-mono-num">
                累计解锁 {totalUnlockedAchievements} / {totalAchievementCount}
              </span>
            </div>

            {earnedAchievements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {earnedAchievements.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#151F34] border border-slate-800"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                        TONE_STYLES[badge.tone]
                      }`}
                    >
                      {renderAchievementIcon(badge.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {badge.title}
                        </span>
                        {badge.isNew && (
                          <span className="text-[11px] font-medium text-amber-400 shrink-0">
                            新解锁
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-[#151F34] border border-slate-800 text-xs text-slate-400">
                本局暂未达成成就 · 尝试零伤亡通关、低金币通关或特定炮塔体系来解锁徽章。
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onExitToMenu}
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            切换地图
          </button>

          <button
            type="button"
            onClick={onRestart}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isPaused
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {isPaused ? '重新开始' : '再来一局'}
          </button>

          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              继续游戏
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
