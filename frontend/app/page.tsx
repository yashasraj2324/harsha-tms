'use client';

import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle, Shield, X, Wifi, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import VideoStream from './components/VideoStream';

// ==================== TYPES ====================
interface Alert {
    id: number;
    timestamp: string;
    trigger_reason: string;
    yolo_flag: string;
    yolo_detections: string;
    yolo_confidence: number;
    gemini_status: string;
    gemini_reason: string;
    gemini_confidence: number;
    final_status: string;
    image_url: string;
    created_at: string;
}

interface GeminiMessage {
    id: number;
    timestamp: string;
    trigger_reason: string;
    gemini_reason: string;
    final_status: string;
}

// ==================== CONFIGURATION ====================
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// ==================== MAIN COMPONENT ====================
export default function Dashboard() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
    const [systemStatus, setSystemStatus] = useState<'SAFE' | 'DANGER'>('SAFE');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sseConnected, setSseConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Initialize audio
    useEffect(() => {
        // Create audio element for danger alerts
        const audio = new Audio();
        // Generate a beep sound using data URI
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

        audioRef.current = audio;

        return () => {
            audioContext.close();
        };
    }, []);

    // Fetch initial alerts
    useEffect(() => {
        fetchAlerts();
    }, []);

    // Auto-scroll messages to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [geminiMessages]);

    // Setup Server-Sent Events (SSE) for real-time updates
    useEffect(() => {
        console.log('[SSE] Setting up Server-Sent Events connection...');

        const eventSource = new EventSource(`${BACKEND_URL}/events`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('[SSE] Connection established');
            setSseConnected(true);
        };

        eventSource.addEventListener('alert', (event) => {
            console.log('[SSE] New alert received:', event.data);
            const newAlert = JSON.parse(event.data) as Alert;

            // Add to alerts list
            setAlerts((prev) => [newAlert, ...prev.slice(0, 9)]); // Keep latest 10
            setLatestAlert(newAlert);

            // Add to Gemini messages feed
            const geminiMessage: GeminiMessage = {
                id: newAlert.id,
                timestamp: newAlert.timestamp,
                trigger_reason: newAlert.trigger_reason,
                gemini_reason: newAlert.gemini_reason,
                final_status: newAlert.final_status
            };
            setGeminiMessages((prev) => [geminiMessage, ...prev.slice(0, 19)]); // Keep latest 20

            // Update system status
            if (newAlert.final_status === 'DANGER') {
                setSystemStatus('DANGER');
                setShowModal(true); // Show full-screen alert

                // Play sound alert if not muted
                if (!isMuted) {
                    playAlertSound();
                }
            } else {
                setSystemStatus('SAFE');
            }
        });

        eventSource.onerror = (error) => {
            console.error('[SSE] Connection error]:', error);
            setSseConnected(false);

            // Auto-reconnect after 5 seconds
            setTimeout(() => {
                console.log('[SSE] Attempting to reconnect...');
                eventSource.close();
                // The useEffect cleanup will handle reconnection on next render
            }, 5000);
        };

        return () => {
            console.log('[SSE] Cleaning up connection');
            eventSource.close();
        };
    }, []); // Empty dependency array - only run once

    const fetchAlerts = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/alerts?limit=10`);
            const data = await response.json();

            setAlerts(data.alerts || []);
            if (data.alerts && data.alerts.length > 0) {
                setLatestAlert(data.alerts[0]);
                setSystemStatus(data.alerts[0].final_status as 'SAFE' | 'DANGER');

                // Populate initial Gemini messages
                const messages = data.alerts.map((alert: Alert) => ({
                    id: alert.id,
                    timestamp: alert.timestamp,
                    trigger_reason: alert.trigger_reason,
                    gemini_reason: alert.gemini_reason,
                    final_status: alert.final_status
                }));
                setGeminiMessages(messages);
            }
        } catch (error) {
            console.error('[ERROR] Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const playAlertSound = () => {
        try {
            // Create a simple beep using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Danger alert sound: 800Hz beep
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            // Volume envelope
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            // Play three beeps
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.frequency.value = 800;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0, audioContext.currentTime);
                gain2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
                gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
                osc2.start(audioContext.currentTime);
                osc2.stop(audioContext.currentTime + 0.5);
            }, 600);

            setTimeout(() => {
                const osc3 = audioContext.createOscillator();
                const gain3 = audioContext.createGain();
                osc3.connect(gain3);
                gain3.connect(audioContext.destination);
                osc3.frequency.value = 800;
                osc3.type = 'sine';
                gain3.gain.setValueAtTime(0, audioContext.currentTime);
                gain3.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
                gain3.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
                osc3.start(audioContext.currentTime);
                osc3.stop(audioContext.currentTime + 0.5);
            }, 1200);

            console.log('[AUDIO] Playing danger alert sound');
        } catch (error) {
            console.error('[AUDIO] Failed to play sound:', error);
        }
    };

    // ==================== RENDER ====================
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500 mx-auto mb-4"></div>
                    <p className="text-white text-xl font-semibold">Initializing RailGuard V2...</p>
                </div>
            </div>
        );
    }

    const isDanger = systemStatus === 'DANGER';

    return (
        <>
            {/* Full-Screen Red Alert Modal */}
            {showModal && latestAlert && latestAlert.final_status === 'DANGER' && (
                <div className="fixed inset-0 z-50 bg-red-950/95 backdrop-blur-md flex items-center justify-center p-6 animate-pulse-slow">
                    <div className="bg-red-900/90 rounded-2xl p-8 max-w-4xl w-full border-4 border-red-500 shadow-2xl">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center space-x-4">
                                <AlertTriangle className="w-16 h-16 text-red-300 animate-pulse" />
                                <div>
                                    <h2 className="text-4xl font-bold text-white">⚠️ DANGER ALERT</h2>
                                    <p className="text-red-200 text-lg mt-1">Immediate Attention Required</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-red-300 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-red-300 text-sm font-semibold">TRIGGER REASON</p>
                                <p className="text-white text-2xl font-bold">{latestAlert.trigger_reason}</p>
                            </div>

                            <div>
                                <p className="text-red-300 text-sm font-semibold">AI ANALYSIS</p>
                                <p className="text-white text-lg">{latestAlert.gemini_reason}</p>
                            </div>

                            <div>
                                <p className="text-red-300 text-sm font-semibold">YOLO DETECTIONS</p>
                                <p className="text-white">
                                    {latestAlert.yolo_detections && latestAlert.yolo_detections !== '[]'
                                        ? JSON.parse(latestAlert.yolo_detections).map((d: any) => d.class_name).join(', ')
                                        : 'None'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-red-300 text-sm font-semibold">YOLO CONFIDENCE</p>
                                    <p className="text-white text-xl font-mono">
                                        {(latestAlert.yolo_confidence * 100).toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-red-300 text-sm font-semibold">GEMINI CONFIDENCE</p>
                                    <p className="text-white text-xl font-mono">
                                        {(latestAlert.gemini_confidence * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-red-300 text-sm font-semibold">TIMESTAMP</p>
                                <p className="text-white font-mono">
                                    {new Date(latestAlert.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Dashboard */}
            <div
                className={`min-h-screen transition-all duration-500 ${isDanger
                        ? 'bg-gradient-to-br from-red-950 via-red-900 to-red-950'
                        : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
                    }`}
            >
                {/* Header */}
                <header className="border-b border-white/10 backdrop-blur-sm bg-black/20">
                    <div className="container mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                    <Shield className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">RailGuard V2</h1>
                                    <p className="text-sm text-gray-400">Local SQLite + SSE Real-time</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-6">
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? (
                                        <VolumeX className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <Volume2 className="w-5 h-5 text-emerald-400" />
                                    )}
                                </button>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">SSE Connection</p>
                                    <div className="flex items-center justify-end space-x-2">
                                        <Wifi className={`w-4 h-4 ${sseConnected ? 'text-emerald-400' : 'text-red-400'}`} />
                                        <p className={`text-sm font-semibold ${sseConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {sseConnected ? '● Connected' : '● Disconnected'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="container mx-auto px-6 py-8">
                    {/* Live Video Stream */}
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                            <span className="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"></span>
                            Live Camera Feed
                        </h3>
                        <VideoStream />
                    </div>

                    {/* Live Gemini Messages Feed */}
                    <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-6 py-4 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <MessageSquare className="w-6 h-6 mr-3 text-purple-400" />
                                Live AI Analysis Feed
                                <span className="ml-3 text-sm font-normal text-gray-400">({geminiMessages.length} messages)</span>
                            </h3>
                        </div>
                        <div className="h-96 overflow-y-auto p-4 space-y-3">
                            {geminiMessages.length > 0 ? (
                                geminiMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`p-4 rounded-lg border transition-all duration-300 animate-fade-in ${msg.final_status === 'DANGER'
                                                ? 'bg-red-900/20 border-red-500/30'
                                                : 'bg-emerald-900/20 border-emerald-500/30'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-bold ${msg.final_status === 'DANGER'
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-emerald-500 text-white'
                                                        }`}
                                                >
                                                    {msg.final_status}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    Trigger: {msg.trigger_reason}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 font-mono">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-white text-sm leading-relaxed">
                                            {msg.gemini_reason}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-sm">No AI analysis messages yet</p>
                                    <p className="text-xs mt-1">Messages will appear here in real-time</p>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Status Banner */}
                    <div
                        className={`mb-8 rounded-2xl p-8 shadow-2xl transition-all duration-500 ${isDanger
                                ? 'bg-gradient-to-r from-red-600 to-red-700 animate-pulse'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-700'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                                <div
                                    className={`w-20 h-20 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-900/50 animate-pulse' : 'bg-emerald-900/50'
                                        }`}
                                >
                                    {isDanger ? (
                                        <AlertTriangle className="w-12 h-12 text-white" />
                                    ) : (
                                        <CheckCircle className="w-12 h-12 text-white" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-5xl font-bold text-white mb-2">{systemStatus}</h2>
                                    <p className="text-white/80 text-lg">
                                        {isDanger ? 'Alert Detected - Check Details' : 'System Active - All Clear'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Latest Alert Details */}
                    {latestAlert ? (
                        <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">Latest Alert</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-gray-400 text-sm">Status</p>
                                        <p
                                            className={`text-lg font-semibold ${latestAlert.final_status === 'DANGER'
                                                    ? 'text-red-400'
                                                    : 'text-emerald-400'
                                                }`}
                                        >
                                            {latestAlert.final_status}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Trigger</p>
                                        <p className="text-white text-lg font-semibold">{latestAlert.trigger_reason}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">AI Analysis</p>
                                        <p className="text-white">{latestAlert.gemini_reason}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Timestamp</p>
                                        <p className="text-white font-mono text-sm">
                                            {new Date(latestAlert.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-gray-400 text-sm">YOLO Detections</p>
                                        <p className="text-white">
                                            {latestAlert.yolo_detections && latestAlert.yolo_detections !== '[]'
                                                ? JSON.parse(latestAlert.yolo_detections)
                                                    .map((d: any) => d.class_name)
                                                    .join(', ')
                                                : 'None'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-gray-400 text-sm">YOLO Confidence</p>
                                            <p className="text-white font-mono">
                                                {(latestAlert.yolo_confidence * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm">Gemini Confidence</p>
                                            <p className="text-white font-mono">
                                                {(latestAlert.gemini_confidence * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                            <CheckCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">No alerts recorded</p>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="border-t border-white/10 mt-12 py-6">
                    <div className="container mx-auto px-6 text-center text-gray-400 text-sm">
                        <p>RailGuard V2 © 2024 | Local Storage | YOLOv8 + Gemini | SSE Real-time + Live Video</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
