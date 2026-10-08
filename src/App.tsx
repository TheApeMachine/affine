import React, { useState, useMemo } from 'react';
import { generateTestSignals, SignalSource } from './math/gf257';
import { findTopDiscoveries } from './math/autoSearch';
import { Header } from './components/Header';
import { DiscoveryBar } from './components/DiscoveryBar';
import { DecimationTab } from './components/DecimationTab';
import { MultiscaleTab } from './components/MultiscaleTab';
import { SwarmTab } from './components/SwarmTab';
import { LivingMemoryTab } from './components/LivingMemoryTab';
import { GenerativeMoireTab } from './components/GenerativeMoireTab';
import { RecursiveDescentTab } from './components/RecursiveDescentTab';
import { ResonancePredictorTab } from './components/ResonancePredictorTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'decimation' | 'multiscale' | 'swarm' | 'recursive' | 'living' | 'moire' | 'predictor'>('predictor');
  const [signals, setSignals] = useState<SignalSource[]>(() => generateTestSignals());
  const [selectedSignalId, setSelectedSignalId] = useState<string>('circle');
  const [externalTriggerK, setExternalTriggerK] = useState<number | null>(null);

  const currentSource = useMemo(() => {
    return signals.find((s) => s.id === selectedSignalId) || signals[0];
  }, [signals, selectedSignalId]);

  const handleUpdateSourceData = (newData: number[]) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === selectedSignalId ? { ...s, data: newData } : s))
    );
  };

  const handleReset = () => {
    setSignals(generateTestSignals());
    setExternalTriggerK(null);
  };

  const handleSelectDiscovery = (type: 'circle_magic' | 'holographic_shield' | 'swarm_fireflies' | 'noise_proof' | 'living_memory' | 'moire_alice' | 'zero_training_predictor') => {
    if (type === 'zero_training_predictor') {
      setActiveTab('predictor');
    } else if (type === 'moire_alice') {
      setActiveTab('moire');
    } else if (type === 'circle_magic') {
      setSelectedSignalId('circle');
      setActiveTab('decimation');
      setExternalTriggerK(17);
    } else if (type === 'holographic_shield') {
      setSelectedSignalId('rings');
      setActiveTab('multiscale');
    } else if (type === 'living_memory') {
      setSelectedSignalId('circle');
      setActiveTab('living');
    } else if (type === 'swarm_fireflies') {
      setSelectedSignalId('circle');
      setActiveTab('swarm');
    } else if (type === 'noise_proof') {
      setSelectedSignalId('noise');
      setActiveTab('decimation');
      setExternalTriggerK(0);
    }
  };

  const handleAutoTune = () => {
    const discoveries = findTopDiscoveries(currentSource.data);
    if (discoveries.length > 0) {
      setExternalTriggerK(discoveries[0].k);
      setActiveTab('decimation');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 3-Zone Top Navigation Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        signals={signals}
        selectedSignalId={selectedSignalId}
        onSelectSignal={(id) => {
          setSelectedSignalId(id);
          setExternalTriggerK(null);
        }}
        onReset={handleReset}
      />

      {/* Main Laboratory Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5 space-y-5">
        {/* Curated 1-Click Discovery & Auto-Optimizer Bar */}
        <DiscoveryBar
          onSelectDiscovery={handleSelectDiscovery}
          onAutoTune={handleAutoTune}
        />

        {activeTab === 'decimation' && (
          <DecimationTab
            source={currentSource}
            onUpdateSourceData={handleUpdateSourceData}
            externalTriggerK={externalTriggerK}
          />
        )}

        {activeTab === 'multiscale' && (
          <MultiscaleTab source={currentSource} />
        )}

        {activeTab === 'swarm' && (
          <SwarmTab source={currentSource} />
        )}

        {activeTab === 'living' && (
          <LivingMemoryTab source={currentSource} />
        )}

        {activeTab === 'moire' && (
          <GenerativeMoireTab />
        )}

        {activeTab === 'predictor' && (
          <ResonancePredictorTab />
        )}

        {activeTab === 'recursive' && (
          <RecursiveDescentTab
            currentSource={currentSource}
            onSelectSource={setSelectedSignalId}
          />
        )}
      </main>

      {/* Quiet Scientific Footer */}
      <footer className="border-t border-slate-800/80 bg-[#05070a] py-6 px-4 lg:px-8 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>Fermat Prime p = 257 (2⁸ + 1)</span>
            <span aria-hidden="true">·</span>
            <span>Cyclic Group Generator g = 3</span>
            <span aria-hidden="true">·</span>
            <span>Hierarchical Multiscale Addressing GF(257)ᵈ</span>
          </div>
          <div>
            <span>Affine Orbit & Multiscale Compression Lab</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
