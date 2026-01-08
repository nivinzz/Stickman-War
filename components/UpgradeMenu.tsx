
import React, { useState } from 'react';
import { UpgradeState, Language, UnitType } from '../types';
import { TRANS, MAX_UPGRADE_LEVELS, calculateUnitStats, BASE_HP, TOWER_DAMAGE_BASE, UNIT_CONFIG } from '../constants';

interface UpgradeMenuProps {
  upgrades: UpgradeState;
  gold: number;
  onUpgrade: (type: keyof UpgradeState, cost: number) => void;
  lang: Language;
  maxReachedLevel: number;
}

const UpgradeMenu: React.FC<UpgradeMenuProps> = ({ upgrades, gold, onUpgrade, lang, maxReachedLevel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = TRANS[lang];
  
  const getCost = (currentLevel: number) => {
      const targetLevel = currentLevel + 1;
      let cost = 0;
      for (let l = 1; l <= targetLevel; l++) {
          const tier = Math.floor((l - 1) / 5);
          const step = 300 + (tier * 200); 
          if (l === 1) cost = 300;
          else cost += step;
      }
      return cost;
  };

  const getStatPreview = (key: keyof UpgradeState, level: number, isMax: boolean) => {
      const nextLevel = level + 1;
      let currentInfo = "";
      let nextInfo = "";

      // Unit Stats
      if (key === 'swordDamage') {
          const c = calculateUnitStats(UnitType.SWORDMAN, level);
          const n = calculateUnitStats(UnitType.SWORDMAN, nextLevel);
          currentInfo = `HP: ${c.maxHp} | Dmg: ${c.damage}`;
          nextInfo = `HP: ${n.maxHp} | Dmg: ${n.damage}`;
      } else if (key === 'archerDamage') {
          const c = calculateUnitStats(UnitType.ARCHER, level);
          const n = calculateUnitStats(UnitType.ARCHER, nextLevel);
          currentInfo = `HP: ${c.maxHp} | Dmg: ${c.damage} | Spd: ${(60/c.attackSpeed).toFixed(1)}/s`;
          nextInfo = `HP: ${n.maxHp} | Dmg: ${n.damage} | Spd: ${(60/n.attackSpeed).toFixed(1)}/s`;
      } else if (key === 'cavalryDamage') {
          const c = calculateUnitStats(UnitType.CAVALRY, level);
          const n = calculateUnitStats(UnitType.CAVALRY, nextLevel);
          currentInfo = `HP: ${c.maxHp} | Dmg: ${c.damage}`;
          nextInfo = `HP: ${n.maxHp} | Dmg: ${n.damage}`;
      } else if (key === 'heroPower') {
          const c = calculateUnitStats(UnitType.HERO, level);
          const n = calculateUnitStats(UnitType.HERO, nextLevel);
          currentInfo = `HP: ${c.maxHp} | Dmg: ${c.damage}`;
          nextInfo = `HP: ${n.maxHp} | Dmg: ${n.damage}`;
      } else if (key === 'minerSpeed') {
           const c = calculateUnitStats(UnitType.MINER, level);
           const n = calculateUnitStats(UnitType.MINER, nextLevel);
           currentInfo = `Spd: ${c.speed.toFixed(1)} | Gold: ${25+level}`;
           nextInfo = `Spd: ${n.speed.toFixed(1)} | Gold: ${25+nextLevel}`;
      } 
      // Building Stats
      else if (key === 'baseHp') {
          const c = BASE_HP * (1 + (level * 0.1));
          const n = BASE_HP * (1 + (nextLevel * 0.1));
          currentInfo = `HP: ${c.toFixed(0)}`;
          nextInfo = `HP: ${n.toFixed(0)}`;
      } else if (key === 'towerPower') {
          const c = TOWER_DAMAGE_BASE * (1 + (level * 0.1));
          const n = TOWER_DAMAGE_BASE * (1 + (nextLevel * 0.1));
          currentInfo = `Dmg: ${c.toFixed(0)}`;
          nextInfo = `Dmg: ${n.toFixed(0)}`;
      } else {
          // Generic skills
          return null;
      }
      
      return (
          <div className="text-[10px] font-mono mt-1 w-full bg-slate-900/50 p-1 rounded">
              <div className="text-green-400 font-semibold">{currentInfo}</div>
              {!isMax && (
                <div className="text-red-400 mt-0.5 border-t border-slate-700 pt-0.5">
                    ➤ {nextInfo}
                </div>
              )}
          </div>
      );
  };

  const renderUpgrade = (icon: string, label: string, level: number, key: keyof UpgradeState) => {
      const cost = getCost(level);
      const globalLimit = MAX_UPGRADE_LEVELS[key] || 99; 
      
      // --- PROGRESS GATING LOGIC ---
      // Primary units (Sword, Archer, Cav): Limit = maxReachedLevel
      // Secondary (Base, Tower, Hero, etc): Limit = Math.ceil(maxReachedLevel / 2.5)
      
      const isPrimary = key === 'swordDamage' || key === 'archerDamage' || key === 'cavalryDamage';
      const progressCap = isPrimary ? maxReachedLevel : Math.ceil(maxReachedLevel * 0.4); 
      
      // The effective limit is the smaller of the Game Global Limit and the Player Progress Limit
      const effectiveLimit = Math.min(globalLimit, progressCap);
      const isMax = level >= globalLimit;
      const isGated = level >= effectiveLimit && !isMax;

      return (
        <button 
            key={key}
            onClick={() => !isMax && !isGated && onUpgrade(key, cost)}
            disabled={isMax || isGated || gold < cost}
            className={`w-full text-xs py-2 px-2 mb-1 rounded flex flex-col items-stretch transition-colors border
                ${isMax 
                    ? 'bg-slate-800 border-yellow-600/50 text-slate-300'
                    : isGated
                        ? 'bg-slate-900 border-red-900/50 text-slate-600 cursor-not-allowed'
                        : gold >= cost 
                            ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'}`}
        >
            <div className="flex justify-between items-center w-full mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <div className="flex flex-col items-start text-left">
                        <span className="font-bold text-sm">{label}</span>
                        <div className="flex items-center gap-1">
                            <span className={`text-[10px] ${isMax ? 'text-yellow-500 font-bold' : 'text-slate-400'}`}>
                                {isMax ? 'MAX LEVEL' : `Lvl ${level}/${globalLimit}`}
                            </span>
                            {isGated && (
                                <span className="text-[9px] text-red-500 font-bold border border-red-900 px-1 rounded bg-black/40">
                                    LOCKED (Req Map {isPrimary ? effectiveLimit + 1 : Math.ceil((level + 1) * 2.5)})
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {!isMax && !isGated && <span className="text-yellow-400 font-mono font-bold">{cost}G</span>}
            </div>
            
            {getStatPreview(key, level, isMax)}
        </button>
      );
  };

  return (
    <div className="absolute top-14 left-4 flex flex-col items-start gap-1 pointer-events-auto z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold py-2 px-3 rounded shadow-lg border border-yellow-500 transition-all w-36"
      >
        <span>⚡ {t.baseUp}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="bg-slate-900/95 p-2 rounded border border-slate-600 text-white w-72 shadow-xl max-h-[60vh] overflow-y-auto custom-scrollbar animate-fade-in">
            {renderUpgrade('⛏️', t.upMiner, upgrades.minerSpeed, 'minerSpeed')}
            {renderUpgrade('🏠', t.upBaseHp, upgrades.baseHp, 'baseHp')}
            {renderUpgrade('🏯', t.upTower, upgrades.towerPower, 'towerPower')}
            {renderUpgrade('⚔️', t.upSword, upgrades.swordDamage, 'swordDamage')}
            {renderUpgrade('🏹', t.upArcher, upgrades.archerDamage, 'archerDamage')}
            {renderUpgrade('🐎', t.upCav, upgrades.cavalryDamage, 'cavalryDamage')}
            {renderUpgrade('🦸', t.upHero, upgrades.heroPower, 'heroPower')}
            {renderUpgrade('⏳', t.upSpawn, upgrades.spawnSpeed, 'spawnSpeed')}
            {renderUpgrade('🌧️', t.upRain, upgrades.arrowRainPower, 'arrowRainPower')}
            {renderUpgrade('⚡', t.upBolt, upgrades.lightningPower, 'lightningPower')}
            {renderUpgrade('❄️', t.upFreeze, upgrades.freezePower, 'freezePower')}
        </div>
      )}
    </div>
  );
};

export default UpgradeMenu;
