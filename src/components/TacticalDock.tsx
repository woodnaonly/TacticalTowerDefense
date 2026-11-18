import React from 'react';
import { ArrowUpCircle, Trash2, X } from 'lucide-react';
import {
  ENEMIES,
  getWaveDefinition,
  TARGETING_LABELS,
  TOWER_LIST,
  TOWERS,
} from '../game/constants';
import { getTowerSellValue } from '../game/engine';
import { TOWER_SPRITE_URLS } from '../game/sprites';
import { EffectiveTowerStats, TargetingMode, TowerEntity, TowerType } from '../game/types';

interface TacticalDockProps {
  gold: number;
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  waveCountdown: number;
  buildTowerType: TowerType | null;
  selectedTower: TowerEntity | null;
  selectedTowerEffective: EffectiveTowerStats | null;
  onSelectBuildTower: (type: TowerType | null) => void;
  onUpgradeTower: (id: string) => void;
  onSellTower: (id: string) => void;
  onChangeTargeting: (id: string, mode: TargetingMode) => void;
  onDeselectTower: () => void;
}

export const TacticalDock: React.FC<TacticalDockProps> = ({
  gold,
  wave,
  totalWaves,
  waveActive,
  waveCountdown,
  buildTowerType,
  selectedTower,
  selectedTowerEffective,
  onSelectBuildTower,
  onUpgradeTower,
  onSellTower,
  onChangeTargeting,
  onDeselectTower,
}) => {
  const [failedThumb, setFailedThumb] = React.useState<Record<string, boolean>>({});
  const nextWaveNumber = wave + 1;
  const hasNextWave = totalWaves === 0 || nextWaveNumber <= totalWaves;
  const nextWaveDef = hasNextWave ? getWaveDefinition(nextWaveNumber) : null;

  const selectedDef = selectedTower ? TOWERS[selectedTower.type] : null;
  const selectedStats =
    selectedTower && selectedDef ? selectedDef.levels[selectedTower.level - 1] : null;
  const nextStats =
    selectedTower && selectedDef
      ? selectedTower.level === 1
        ? selectedDef.levels[1]
        : selectedTower.level === 2
          ? selectedDef.levels[2]
          : null
      : null;
  const upgradeCost = selectedStats?.upgradeCost;
  const canUpgrade = Boolean(upgradeCost && gold >= upgradeCost);

  return (
    <footer className="bg-[#11192C] border-t border-slate-800 px-4 py-3 shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: 4 Tower Build Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
          {TOWER_LIST.map((tower) => {
            const active = buildTowerType === tower.type;
            const affordable = gold >= tower.cost;
            return (
              <button
                key={tower.type}
                type="button"
                onClick={() => onSelectBuildTower(active ? null : tower.type)}
                className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                  active
                    ? 'bg-[#1A2744] border-amber-500'
                    : affordable
                      ? 'bg-[#151F34] border-slate-800 hover:border-slate-600'
                      : 'bg-[#0F172A] border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {failedThumb[tower.type] ? (
                      <span
                        className="w-7 h-7 rounded bg-[#1E293B] border border-slate-700/80 flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: tower.accentColor }}
                        />
                      </span>
                    ) : (
                      <img
                        src={TOWER_SPRITE_URLS[tower.type]}
                        alt={tower.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedThumb((prev) => ({ ...prev, [tower.type]: true }))
                        }
                        className="w-7 h-7 rounded bg-[#1E293B] border border-slate-700/80 object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-100 whitespace-nowrap truncate">
                        <span className="font-mono-num text-xs text-slate-400 mr-1.5">
                          [{tower.hotkey}]
                        </span>
                        {tower.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{tower.role}</div>
                    </div>
                  </div>
                  <span
                    className={`font-mono-num text-xs font-semibold whitespace-nowrap self-start ${
                      affordable ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {tower.cost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Contextual Inspector OR Next Wave Preview */}
        <div className="lg:w-[440px] shrink-0 bg-[#151F34] border border-slate-800 rounded-lg px-4 py-2.5 min-h-[72px] flex items-center justify-between gap-3">
          {selectedTower && selectedDef && selectedStats ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-semibold text-sm whitespace-nowrap"
                    style={{ color: selectedDef.accentColor }}
                  >
                    {selectedDef.name} Lv.{selectedTower.level}
                  </span>
                  <span className="text-xs text-slate-400 font-mono-num whitespace-nowrap">
                    伤害{' '}
                    <span
                      className={
                        selectedTowerEffective &&
                        selectedTowerEffective.damage > selectedStats.damage
                          ? 'text-sky-300 font-semibold'
                          : ''
                      }
                    >
                      {selectedTowerEffective?.damage ?? selectedStats.damage}
                    </span>
                    {nextStats ? ` → ${nextStats.damage}` : ''} · 射程{' '}
                    <span
                      className={
                        selectedTowerEffective &&
                        selectedTowerEffective.range > selectedStats.range
                          ? 'text-sky-300 font-semibold'
                          : selectedTowerEffective &&
                              selectedTowerEffective.range < selectedStats.range
                            ? 'text-rose-400 font-semibold'
                            : ''
                      }
                    >
                      {selectedTowerEffective?.range ?? selectedStats.range}
                    </span>
                  </span>
                </div>

                {selectedTowerEffective && selectedTowerEffective.activeSynergies.length > 0 && (
                  <div className="text-[11px] text-sky-300 truncate">
                    协同激活:{' '}
                    {selectedTowerEffective.activeSynergies.map((s) => s.name).join(' · ')}
                  </div>
                )}

                {/* Targeting mode selector */}
                <div className="flex items-center gap-1">
                  {(Object.keys(TARGETING_LABELS) as TargetingMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChangeTargeting(selectedTower.id, mode)}
                      className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap cursor-pointer ${
                        selectedTower.targeting === mode
                          ? 'bg-sky-500/20 text-sky-300 font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {TARGETING_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedTower.level < 3 && upgradeCost ? (
                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => onUpgradeTower(selectedTower.id)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      canUpgrade
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    <span>升级 {upgradeCost}</span>
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-400 px-2 whitespace-nowrap">
                    已满级
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onSellTower(selectedTower.id)}
                  className="h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="font-mono-num">+{getTowerSellValue(selectedTower)}</span>
                </button>

                <button
                  type="button"
                  onClick={onDeselectTower}
                  aria-label="关闭炮塔面板"
                  className="h-9 w-8 rounded-lg text-slate-400 hover:text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : nextWaveDef ? (
            <div className="w-full flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    {wave === 0
                      ? '第 1 波敌军预告'
                      : waveActive
                        ? `下波预告（第 ${nextWaveNumber} 波）`
                        : `第 ${nextWaveNumber} 波倒计时 ${Math.ceil(waveCountdown)}s`}
                  </span>
                  <span className="text-slate-400 font-mono-num">
                    通关赏金 +{nextWaveDef.clearBonus}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-300">
                  {nextWaveDef.groups.map((g, i) => {
                    const eDef = ENEMIES[g.type];
                    return (
                      <span key={i} className="whitespace-nowrap">
                        <span style={{ color: eDef.color }}>{eDef.name}</span>{' '}
                        <span className="font-mono-num text-slate-400">×{g.count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              {buildTowerType && (
                <button
                  type="button"
                  onClick={() => onSelectBuildTower(null)}
                  className="h-8 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  取消建造
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">最终决战波次进行中，守住防线即可获胜。</div>
          )}
        </div>
      </div>
    </footer>
  );
};
