'use client';

import { useState, useEffect, useRef } from 'react';
import { Anomaly } from '../lib/types';
import { generateBriefing } from '../lib/api';

interface Props {
  anomaly: Anomaly;
}

export default function AIBriefing({ anomaly }: Props) {
  const [briefing, setBriefing] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [displayed, setDisplayed] = useState('');
  const [generated, setGenerated] = useState(false);
  const [prevId, setPrevId] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when anomaly changes
  useEffect(() => {
    if (anomaly.id !== prevId) {
      setBriefing('');
      setDisplayed('');
      setGenerated(false);
      setPrevId(anomaly.id);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [anomaly.id, prevId]);

  // Typewriter effect
  useEffect(() => {
    if (!briefing) return;
    setDisplayed('');
    let i = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(briefing.slice(0, i));
      if (i >= briefing.length && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 20);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [briefing]);

  const handleGenerate = async () => {
    setLoading(true);
    setBriefing('');
    setDisplayed('');
    try {
      const text = await generateBriefing(anomaly.id, anomaly);
      setBriefing(text);
      setGenerated(true);
    } catch (e) {
      setBriefing('SENTINEL-AI ERROR: Could not generate briefing. Verify backend connectivity and Gemini API key.');
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <div className="text-green-DEFAULT text-xs tracking-widest font-bold text-glow-green">
            SENTINEL-AI BRIEFING MODULE
          </div>
          <div className="text-text-muted text-xs mt-0.5">
            Powered by Gemini 1.5 Flash • Threat analysis & remediation
          </div>
        </div>
        <button
          id="generate-briefing-btn"
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 border text-xs tracking-wider transition-all"
          style={{
            borderColor: loading ? '#0d3320' : '#00ff88',
            color: loading ? '#2d5540' : '#00ff88',
            background: loading ? 'transparent' : 'rgba(0,255,136,0.06)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Share Tech Mono', monospace",
            boxShadow: loading ? 'none' : '0 0 10px rgba(0,255,136,0.2)',
            letterSpacing: '0.1em',
          }}
        >
          {loading ? '► ANALYZING...' : generated ? '► REGENERATE' : '► GENERATE AI BRIEFING'}
        </button>
      </div>

      {/* Briefing Display */}
      <div className="flex-1 overflow-y-auto">
        {!generated && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4" style={{ filter: 'grayscale(0.3)' }}>🛡</div>
            <div className="text-text-dim text-sm tracking-wider mb-2">
              SENTINEL AI STANDBY
            </div>
            <div className="text-text-muted text-xs max-w-sm leading-relaxed">
              Click "Generate AI Briefing" to produce an expert security analysis with
              attack vector assessment, impact analysis, and a concrete remediation step
              powered by Gemini 1.5 Flash.
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ background: '#00ff88', boxShadow: '0 0 10px #00ff88' }}
              />
              <span className="text-green-DEFAULT text-sm tracking-widest">
                SENTINEL-AI ANALYZING...
              </span>
            </div>
            <div className="text-text-muted text-xs">
              Consulting Gemini 1.5 Flash security knowledge base
            </div>
          </div>
        )}

        {generated && briefing && (
          <div
            className="p-4 border"
            style={{
              borderColor: '#0d3320',
              background: '#041510',
              fontFamily: "'Share Tech Mono', monospace",
              lineHeight: '1.9',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#00ff88', boxShadow: '0 0 6px #00ff88' }}
              />
              <span className="text-green-DEFAULT text-xs tracking-widest text-glow-green">
                SENTINEL-AI THREAT BRIEF — {anomaly.id}
              </span>
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: '#c8ffe0' }}
            >
              {displayed}
              {displayed.length < briefing.length && (
                <span className="typewriter-cursor" />
              )}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 mt-3 pt-2 border-t border-[#0d3320] flex items-center justify-between text-text-muted"
        style={{ fontSize: '9px', letterSpacing: '0.05em' }}>
        <span>MODEL: GEMINI-1.5-FLASH</span>
        <span>ANOMALY: {anomaly.id} • SCORE: {(anomaly.score * 100).toFixed(1)}%</span>
        <span>LOG-SENTINEL v1.0</span>
      </div>
    </div>
  );
}
