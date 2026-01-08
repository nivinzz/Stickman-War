
import React, { useState } from 'react';
import { UpgradeState, Language, UnitType } from '../types';
import { TRANS, MAX_UPGRADE_LEVELS, calculateUnitStats, BASE_HP, TOWER_DAMAGE_BASE, UNIT_CONFIG } from '../constants';

interface UpgradeMenuProps {
  upgrades: UpgradeState;
  gold: number;
  onUpgrade: (type: keyof UpgradeState, cost: number) => void;
  lang: Language;
}

const UpgradeMenu: React.FC<UpgradeMenuProps> = ({ upgrades, gold, onUpgrade, lang }) => {
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

  const getStatPreview = (key: keyof UpgradeState, level: number) => {
      const nextLevel = level + 1;
      let currentInfo = "";
      let nextInfo = "";

      // Unit Stats
      if (key === 'swordDamage') {
          const c = calculateUnitStats(UnitType.SWORDMAN, level);
          const n = calculateUnitStats(UnitType.SWORDMAN, nextLevel);
          currentInfo = `HP:${c.maxHp} Dmg:${c.damage}`;
          nextInfo = `HP:${n.maxHp} Dmg:${n.damage}`;
      } else if (key === 'archerDamage') {
          const c = calculateUnitStats(UnitType.ARCHER, level);
          const n = calculateUnitStats(UnitType.ARCHER, nextLevel);
          currentInfo = `HP:${c.maxHp} Dmg:${c.damage} Spd:${(60/c.attackSpeed).toFixed(1)}/s`;
          nextInfo = `HP:${n.maxHp} Dmg:${n.damage} Spd:${(60/n.attackSpeed).toFixed(1)}/s`;
      } else if (key === 'cavalryDamage') {
          const c = calculateUnitStats(UnitType.CAVALRY, level);
          const n = calculateUnitStats(UnitType.CAVALRY, nextLevel);
          currentInfo = `HP:${c.maxHp} Dmg:${c.damage}`;
          nextInfo = `HP:${n.maxHp} Dmg:${n.damage}`;
      } else if (key === 'heroPower') {
          const c = calculateUnitStats(UnitType.HERO, level);
          const n = calculateUnitStats(UnitType.HERO, nextLevel);
          currentInfo = `HP:${c.maxHp} Dmg:${c.damage}`;
          nextInfo = `HP:${n.maxHp} Dmg:${n.damage}`;
      } else if (key === 'minerSpeed') {
           const c = calculateUnitStats(UnitType.MINER, level);
           const n = calculateUnitStats(UnitType.MINER, nextLevel);
           currentInfo = `Spd:${c.speed.toFixed(1)} Gold:${25+level}`;
           nextInfo = `Spd:${n.speed.toFixed(1)} Gold:${25+nextLevel}`;
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
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
              {currentInfo} <span className="text-green-400">→ {nextInfo}</span>
          </div>
      );
  };

  const renderUpgrade = (icon: string, label: string, level: number, key: keyof UpgradeState) => {
      const cost = getCost(level);
      const limit = MAX_UPGRADE_LEVELS[key] || 99; 
      const isMax = level >= limit;
      
      return (
        <button 
            key={key}
            onClick={() => !isMax && onUpgrade(key, cost)}
            disabled={isMax || gold < cost}
            className={`w-full text-xs py-2 px-2 mb-1 rounded flex flex-col items-stretch transition-colors
                ${isMax 
                    ? 'bg-slate-800 border border-yellow-600 text-yellow-500'
                    : gold >= cost 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
        >
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <div className="flex flex-col items-start text-left">
                        <span className="font-bold">{label}</span>
                        <span className={`text-[10px] ${isMax ? 'text-yellow-500' : 'text-slate-400'}`}>
                            {isMax ? 'MAX' : `Lvl ${level}/${limit}`}
                        </span>
                    </div>
                </div>
                {!isMax && <span className="text-yellow-400 font-mono">{cost}G</span>}
            </div>
            
            {!isMax && getStatPreview(key, level)}
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
