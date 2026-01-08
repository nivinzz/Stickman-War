
import React, { useState } from 'react';
import { UpgradeState, Language } from '../types';
import { TRANS, MAX_UPGRADE_LEVELS } from '../constants';

interface UpgradeMenuProps {
  upgrades: UpgradeState;
  gold: number;
  onUpgrade: (type: keyof UpgradeState, cost: number) => void;
  lang: Language;
}

const UpgradeMenu: React.FC<UpgradeMenuProps> = ({ upgrades, gold, onUpgrade, lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = TRANS[lang];
  
  // New Cost Formula: Cumulative Step Increases
  // Tier 1 (Lvl 1-5): Step 300
  // Tier 2 (Lvl 6-10): Step 500
  // Tier 3 (Lvl 11-15): Step 700
  const getCost = (currentLevel: number) => {
      const targetLevel = currentLevel + 1;
      let cost = 0;
      
      for (let l = 1; l <= targetLevel; l++) {
          const tier = Math.floor((l - 1) / 5);
          const step = 300 + (tier * 200); // 300, 500, 700...
          
          if (l === 1) cost = 300;
          else cost += step;
      }
      return cost;
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
            className={`w-full text-xs py-2 px-2 mb-1 rounded flex justify-between items-center transition-colors
                ${isMax 
                    ? 'bg-slate-800 border border-yellow-600 text-yellow-500'
                    : gold >= cost 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
        >
            <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div className="flex flex-col items-start text-left">
                    <span className="font-bold">{label}</span>
                    <span className={`text-[10px] ${isMax ? 'text-yellow-500' : 'text-slate-400'}`}>
                        {isMax ? 'MAX LEVEL' : `Lvl ${level}/${limit}`}
                    </span>
                </div>
            </div>
            {!isMax && <span className="text-yellow-400 font-mono">{cost}G</span>}
        </button>
      );
  };

  return (
    <div className="absolute top-14 left-4 flex flex-col items-start gap-1 pointer-events-auto z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold py-2 px-3 rounded shadow-lg border border-yellow-500 transition-all w-32"
      >
        <span>⚡ {t.baseUp}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="bg-slate-900/95 p-2 rounded border border-slate-600 text-white w-64 shadow-xl max-h-[400px] overflow-y-auto custom-scrollbar animate-fade-in">
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
