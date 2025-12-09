
'use client';

import { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Settings } from 'lucide-react';

interface VideoStreamProps {
    className?: string;
}

export default function VideoStream({ className = '' }: VideoStreamProps) {
    const [streamUrl, setStreamUrl] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [inputUrl, setInputUrl] = useState('http://192.168.111.84:81/stream');
    const imgRef = useRef<HTMLImageElement>(null);

    // Load saved URL and streaming state from localStorage on mount
    useEffect(() => {
        const savedUrl = localStorage.getItem('esp32_stream_url');
        const wasStreaming = localStorage.getItem('esp32_streaming') === 'true';

        if (savedUrl) {
            setInputUrl(savedUrl);

            // Auto-start stream if it was previously streaming
            if (wasStreaming) {
                setStreamUrl(savedUrl);
                setIsStreaming(true);
            }
        }
    }, []);

    const startStream = () => {
        if (inputUrl.trim()) {
            // Save URL and streaming state to localStorage
            localStorage.setItem('esp32_stream_url', inputUrl);
            localStorage.setItem('esp32_streaming', 'true');
            setStreamUrl(inputUrl);
            setIsStreaming(true);
            setShowSettings(false);
        }
    };

    const stopStream = () => {
        localStorage.setItem('esp32_streaming', 'false');
        setStreamUrl('');
        setIsStreaming(false);
    };

    const handleError = () => {
        console.error('[VIDEO] Stream connection failed');
        // Don't stop streaming, just show error in console
        // This prevents the component from disappearing
    };

    return (
        <div className={`relative ${className}`}>
            {/* Video Display */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden border-2 border-white/20">
                {isStreaming && streamUrl ? (
                    <img
                        ref={imgRef}
                        src={streamUrl}
                        alt="ESP32-CAM Stream"
                        className="w-full h-full object-contain"
                        onError={handleError}
                    />
                ) : (
                    <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <VideoOff className="w-16 h-16 text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg font-semibold">No Video Stream</p>
                        <p className="text-gray-500 text-sm mt-2">Click settings to configure ESP32-CAM</p>
                    </div>
                )}

                {/* Stream Status Indicator */}
                {isStreaming && (
                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-white text-xs font-bold">LIVE</span>
                    </div>
                )}

                {/* Controls Overlay */}
                <div className="absolute bottom-4 right-4 flex space-x-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="bg-black/60 hover:bg-black/80 text-white p-3 rounded-lg backdrop-blur-sm transition-all"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    {isStreaming ? (
                        <button
                            onClick={stopStream}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                        >
                            Stop Stream
                        </button>
                    ) : (
                        <button
                            onClick={startStream}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center space-x-2"
                        >
                            <Video className="w-5 h-5" />
                            <span>Start Stream</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="mt-4 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                    <h4 className="text-white font-semibold mb-4 flex items-center">
                        <Settings className="w-5 h-5 mr-2" />
                        ESP32-CAM Configuration
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="text-gray-400 text-sm block mb-2">
                                Stream URL
                            </label>
                            <input
                                type="text"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                placeholder="http://192.168.1.100:81/stream"
                                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                            />
                            <p className="text-gray-500 text-xs mt-2">
                                Default ESP32-CAM stream endpoint: http://[ESP32_IP]:81/stream
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={startStream}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold transition-all"
                            >
                                Apply & Start
                            </button>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
