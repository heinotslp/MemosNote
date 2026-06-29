import {
  ListMusic,
  LogOutIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  QrCodeIcon,
  RepeatIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAccessToken } from "@/auth-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Track {
  id: string; // NetEase song ID or direct URL
  name: string;
  artist: string;
  coverUrl?: string;
  url?: string; // Direct link
  isNetease: boolean;
}

interface NeteasePlaylist {
  id: number | string;
  name: string;
  trackCount: number;
}

interface NeteaseArtist {
  id: number;
  name: string;
}

interface NeteaseAlbum {
  id: number;
  name: string;
  picUrl?: string;
}

interface NeteaseTrack {
  id: number;
  name: string;
  ar?: NeteaseArtist[];
  al?: NeteaseAlbum;
}

let lastNeteaseAlertTime = 0;

const EmbeddedMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Player State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<"list" | "single" | "shuffle">("list");

  // Custom URL Input State
  const [customUrl, setCustomUrl] = useState<string>("");
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [showPlaylistQueue, setShowPlaylistQueue] = useState<boolean>(false);

  // NetEase State
  const [neteaseCookie, setNeteaseCookie] = useState<string | null>(null);
  const [neteasePlaylists, setNeteasePlaylists] = useState<NeteasePlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [qrCodeKey, setQrCodeKey] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeStatus, setQrCodeStatus] = useState<number>(0); // 0: none, 801: waiting, 802: scanned, 803: success
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Resolved play URL for current track (especially for NetEase)
  const [resolvedUrl, setResolvedUrl] = useState<string>("");

  // Load player state on mount
  useEffect(() => {
    const initPlayer = async () => {
      try {
        // 1. Fetch cookie from server first (survives dynamic port / container restart)
        let cookie = "";
        try {
          const res = await fetchNetease("/api/v1/netease/cookie");
          if (res.cookie) {
            cookie = res.cookie;
            localStorage.setItem("memos_netease_cookie", cookie);
          }
        } catch (err) {
          console.warn("Failed to fetch NetEase cookie from server", err);
        }

        // 2. Fallback to localStorage if server didn't return one
        if (!cookie) {
          cookie = localStorage.getItem("memos_netease_cookie") || "";
        }

        if (cookie) {
          setNeteaseCookie(cookie);
          loadNeteasePlaylists(cookie);
        }

        // Restore Player State
        const savedPlayerState = localStorage.getItem("memos_player_state");
        if (savedPlayerState) {
          const state = JSON.parse(savedPlayerState);
          if (state.playlist) setPlaylist(state.playlist);
          if (state.currentTrackIndex !== undefined) setCurrentTrackIndex(state.currentTrackIndex);
          if (state.volume !== undefined) setVolume(state.volume);
          if (state.isMuted !== undefined) setIsMuted(state.isMuted);
          if (state.playMode) setPlayMode(state.playMode);
        }
      } catch (e) {
        console.error("Failed to load saved player state", e);
      }
    };

    initPlayer();
  }, []);

  // Save player state to localStorage when it changes
  useEffect(() => {
    const stateToSave = {
      playlist,
      currentTrackIndex,
      volume,
      isMuted,
      playMode,
    };
    localStorage.setItem("memos_player_state", JSON.stringify(stateToSave));
  }, [playlist, currentTrackIndex, volume, isMuted, playMode]);

  // Fetch utility for NetEase API proxy
  const fetchNetease = async (path: string, options?: RequestInit) => {
    const token = getAccessToken();
    const headers: Record<string, string> = (options?.headers as Record<string, string>) || {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401) {
        try {
          const errData = await res.clone().json();
          if (errData.error && errData.error.includes("cookie")) {
            handleSessionExpired();
          }
        } catch (_) {}
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    if (data && (data.code === 301 || data.code === -200)) {
      handleSessionExpired();
      throw new Error("NetEase session expired");
    }
    return data;
  };

  // Start NetEase QR Code Login
  const startQrLogin = async () => {
    try {
      setQrCodeStatus(0);
      setQrCodeKey(null);
      setQrCodeUrl(null);
      const data = await fetchNetease("/api/v1/netease/qr/key");
      if (data.code === 200 && data.unikey) {
        const key = data.unikey;
        setQrCodeKey(key);
        setQrCodeUrl(`https://music.163.com/login?codekey=${key}`);
        setQrCodeStatus(801); // Waiting for scan
      }
    } catch (err) {
      console.error("Failed to start NetEase QR login", err);
    }
  };

  // Poll QR Code Scan Status
  const checkQrStatus = async (key: string) => {
    try {
      const data = await fetchNetease(`/api/v1/netease/qr/check?key=${key}`);
      if (data.code === 803) {
        // Success
        setQrCodeStatus(803);
        const cookie = data.cookie;
        setNeteaseCookie(cookie);
        localStorage.setItem("memos_netease_cookie", cookie);
        loadNeteasePlaylists(cookie);
        setShowLoginModal(false);
      } else if (data.code === 802) {
        setQrCodeStatus(802);
      } else if (data.code === 801) {
        setQrCodeStatus(801);
      } else if (data.code === 800) {
        setQrCodeStatus(800);
      }
    } catch (err) {
      console.error("Failed to check QR code status", err);
    }
  };

  // Poll scanning status when modal is active
  useEffect(() => {
    let timer: number;
    if (showLoginModal && qrCodeKey && qrCodeStatus !== 803 && qrCodeStatus !== 800) {
      timer = window.setInterval(() => {
        checkQrStatus(qrCodeKey);
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [qrCodeKey, qrCodeStatus, showLoginModal]);

  const loadNeteasePlaylists = async (cookie: string) => {
    try {
      const data = await fetchNetease(`/api/v1/netease/user/playlists?cookie=${encodeURIComponent(cookie)}`);
      if (data.playlist) {
        setNeteasePlaylists(data.playlist);
      }
    } catch (err) {
      console.error("Failed to load playlists", err);
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    if (!neteaseCookie) return;
    try {
      const data = await fetchNetease(
        `/api/v1/netease/playlist/tracks?playlist_id=${playlistId}&cookie=${encodeURIComponent(neteaseCookie)}`,
      );
      if (data.playlist && data.playlist.tracks) {
        const tracks: Track[] = data.playlist.tracks.map((t: NeteaseTrack) => ({
          id: String(t.id),
          name: t.name,
          artist: t.ar?.map((artist: NeteaseArtist) => artist.name).join(", ") || "Unknown",
          coverUrl: t.al?.picUrl || "",
          isNetease: true,
        }));
        setPlaylist(tracks);
        if (tracks.length > 0) {
          setCurrentTrackIndex(0);
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error("Failed to load playlist tracks", err);
    }
  };

  const handleLogoutNetease = () => {
    setNeteaseCookie(null);
    setNeteasePlaylists([]);
    setPlaylist([]);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
    setResolvedUrl("");
    localStorage.removeItem("memos_netease_cookie");
    fetchNetease("/api/v1/netease/logout", { method: "POST" }).catch((err) => {
      console.warn("Failed to notify server of logout", err);
    });
  };

  const handleSessionExpired = () => {
    const now = Date.now();
    if (now - lastNeteaseAlertTime > 5000) {
      lastNeteaseAlertTime = now;
      alert("登录已失效，请重新登录网易云音乐账号");
    }
    handleLogoutNetease();
  };

  // Resolve Song Direct Playable URL
  const resolveNeteaseUrl = async (songId: string): Promise<string> => {
    if (!neteaseCookie) return "";
    const data = await fetchNetease(`/api/v1/netease/song/url?song_id=${songId}&cookie=${encodeURIComponent(neteaseCookie)}`);
    if (data.data && data.data[0] && data.data[0].url) {
      return data.data[0].url;
    }
    return "";
  };

  // Track URL Resolution Effect
  useEffect(() => {
    let isCurrent = true;

    if (currentTrackIndex < 0 || currentTrackIndex >= playlist.length) {
      setResolvedUrl("");
      setIsPlaying(false);
      return;
    }

    const track = playlist[currentTrackIndex];
    if (track.isNetease) {
      resolveNeteaseUrl(track.id)
        .then((url) => {
          if (!isCurrent) return;
          if (url) {
            setResolvedUrl(url);
          } else {
            console.warn("NetEase resolved URL is empty, stopping playback");
            setResolvedUrl("");
            setIsPlaying(false);
          }
        })
        .catch((err) => {
          if (!isCurrent) return;
          console.error("Failed to resolve NetEase song url", err);
          setResolvedUrl("");
          setIsPlaying(false);
        });
    } else {
      setResolvedUrl(track.url || "");
    }

    return () => {
      isCurrent = false;
    };
  }, [currentTrackIndex, playlist, neteaseCookie]);

  // Volume synchronization
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && resolvedUrl) {
        audioRef.current.play().catch((err) => {
          console.warn("Playback prevented or interrupted", err);
          // Only force state to pause if it's an autoplay block (NotAllowedError)
          // Ignore AbortError which happens naturally when switching tracks rapidly
          if (err.name === "NotAllowedError") {
            setIsPlaying(false);
          }
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, resolvedUrl]);

  // Controls
  const handlePlayPause = () => {
    if (playlist.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    if (playMode === "shuffle") {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    }
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    if (playMode === "shuffle") {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
    setIsPlaying(true);
  };

  const handleEnded = () => {
    if (playMode === "single") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      handleNext();
    }
  };

  const handlePlayCustomUrl = () => {
    if (!customUrl) return;
    const filename = customUrl.split("/").pop() || "Custom Stream";
    const newTrack: Track = {
      id: customUrl,
      name: filename,
      artist: "Direct Link",
      url: customUrl,
      isNetease: false,
    };
    setPlaylist([newTrack]);
    setCurrentTrackIndex(0);
    setIsPlaying(true);
    setCustomUrl("");
    setShowUrlInput(false);
  };

  const currentTrack = playlist[currentTrackIndex];

  const formatTime = (secs: number) => {
    if (Number.isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="w-full flex flex-col gap-3 rounded-2xl bg-card border border-border/80 p-3 shadow-xs select-none">
      {/* Album Art & Title */}
      <div className="flex items-center gap-3">
        {currentTrack ? (
          <div
            className={cn(
              "w-12 h-12 rounded-full border border-border shadow-xs shrink-0 bg-muted overflow-hidden flex items-center justify-center relative",
              isPlaying && "animate-spin [animation-duration:8s]",
            )}
          >
            {currentTrack.coverUrl ? (
              <img src={currentTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <MusicIcon className="w-5 h-5 text-muted-foreground" />
            )}
            <div className="absolute inset-0 m-auto w-3 h-3 bg-background rounded-full border border-border" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full border border-border bg-muted flex items-center justify-center shrink-0">
            <MusicIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex flex-col min-w-0 grow">
          <div className="text-xs font-semibold text-foreground truncate">{currentTrack ? currentTrack.name : "Not Playing"}</div>
          <div className="text-[10px] text-muted-foreground truncate">{currentTrack ? currentTrack.artist : "Select a song or login"}</div>
        </div>
      </div>

      {/* Progress Bar */}
      {currentTrack && (
        <div className="flex flex-col gap-1">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden cursor-pointer relative" onClick={handleProgressBarClick}>
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Playback Controls Row */}
      <div className="flex justify-between items-center gap-1">
        {/* Shuffle/Repeat Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-75 hover:opacity-100"
          onClick={() => {
            if (playMode === "list") setPlayMode("single");
            else if (playMode === "single") setPlayMode("shuffle");
            else setPlayMode("list");
          }}
        >
          {playMode === "shuffle" ? (
            <ShuffleIcon className="w-3.5 h-3.5 text-primary" />
          ) : playMode === "single" ? (
            <RepeatIcon className="w-3.5 h-3.5 text-primary" />
          ) : (
            <RepeatIcon className="w-3.5 h-3.5" />
          )}
        </Button>

        {/* Previous Song */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev} disabled={playlist.length === 0}>
          <SkipBackIcon className="w-4 h-4" />
        </Button>

        {/* Play / Pause */}
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md shrink-0"
          onClick={handlePlayPause}
          disabled={playlist.length === 0}
        >
          {isPlaying ? <PauseIcon className="w-4 h-4 fill-foreground" /> : <PlayIcon className="w-4 h-4 fill-foreground" />}
        </Button>

        {/* Next Song */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext} disabled={playlist.length === 0}>
          <SkipForwardIcon className="w-4 h-4" />
        </Button>

        {/* Play Queue Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 opacity-75 hover:opacity-100", showPlaylistQueue && "text-primary")}
          onClick={() => setShowPlaylistQueue(!showPlaylistQueue)}
        >
          <ListMusic className="w-3.5 h-3.5" />
        </Button>

        {/* Volume button with dropdown slider */}
        <div className="relative group/vol">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? (
              <VolumeXIcon className="w-3.5 h-3.5" />
            ) : volume < 0.5 ? (
              <Volume1Icon className="w-3.5 h-3.5" />
            ) : (
              <Volume2Icon className="w-3.5 h-3.5" />
            )}
          </Button>
          <div className="absolute right-0 bottom-full pb-1.5 hidden group-hover/vol:block z-50">
            <div className="bg-background border border-border shadow-md rounded-md p-1.5 flex items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setIsMuted(false);
                }}
                className="w-16 h-1 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Play Queue Drawer */}
      {showPlaylistQueue && (
        <div className="flex flex-col gap-1 border-t border-border/50 pt-2 max-h-40 overflow-y-auto pr-1">
          <div className="text-[10px] font-semibold text-muted-foreground flex justify-between px-1 mb-1">
            <span>Play Queue ({playlist.length})</span>
            {playlist.length > 0 && (
              <button
                className="text-red-500 hover:underline"
                onClick={() => {
                  setPlaylist([]);
                  setCurrentTrackIndex(-1);
                  setIsPlaying(false);
                }}
              >
                Clear All
              </button>
            )}
          </div>
          {playlist.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {playlist.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlaying(true);
                  }}
                  className={cn(
                    "flex items-center justify-between text-[11px] rounded px-1.5 py-1 cursor-pointer transition-colors",
                    idx === currentTrackIndex
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="truncate pr-1 grow">
                    {idx + 1}. {track.name}
                  </span>
                  <span className="text-[9px] opacity-75 shrink-0 max-w-[80px] truncate">{track.artist}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground italic px-1 py-1">Queue is empty.</div>
          )}
        </div>
      )}

      {/* NetEase Section & Custom URL Selector */}
      <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
        {neteaseCookie ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <MusicIcon className="w-3 h-3 text-primary" />
                NetEase Cloud
              </span>
              <button
                className="text-muted-foreground hover:text-primary transition-colors flex items-center"
                onClick={handleLogoutNetease}
              >
                <LogOutIcon className="w-3 h-3 inline mr-0.5" />
                Logout
              </button>
            </div>

            {/* Playlist selector */}
            {neteasePlaylists.length > 0 ? (
              <select
                value={selectedPlaylistId}
                onChange={(e) => {
                  setSelectedPlaylistId(e.target.value);
                  if (e.target.value) {
                    loadPlaylistTracks(e.target.value);
                  }
                }}
                className="w-full text-xs bg-muted border border-border rounded px-1.5 py-1 text-foreground cursor-pointer focus:outline-none"
              >
                <option value="">-- Choose Playlist --</option>
                {neteasePlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.trackCount})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[10px] text-muted-foreground italic">No playlists found.</div>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs py-1 h-7 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => {
              setShowLoginModal(true);
              startQrLogin();
            }}
          >
            <QrCodeIcon className="w-3.5 h-3.5 mr-1.5 text-red-500" />
            Login NetEase account
          </Button>
        )}

        {/* Custom URL Input Toggle */}
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground text-left"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          {showUrlInput ? "Hide Direct Link Input" : "Play Direct URL Link..."}
        </button>

        {showUrlInput && (
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="mp3/ogg url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 grow focus:outline-none"
            />
            <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handlePlayCustomUrl}>
              Play
            </Button>
          </div>
        )}
      </div>

      {/* HTML5 Audio element */}
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        className="hidden"
      />

      {/* QR Code login Modal using Portal */}
      {showLoginModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-xs">
            <div className="bg-background border border-border shadow-2xl rounded-2xl p-6 w-72 flex flex-col items-center gap-4 text-center">
              <div className="font-semibold text-base text-foreground">Scan QR Code to Login</div>
              <div className="text-xs text-muted-foreground font-mono">Please scan with your NetEase Cloud Music mobile application.</div>

              {/* QR Image rendering container */}
              <div className="w-40 h-40 border border-border rounded-xl flex items-center justify-center bg-white p-2">
                {qrCodeUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground animate-pulse">Generating...</div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Status:{" "}
                {qrCodeStatus === 802 ? (
                  <span className="text-blue-500 font-semibold animate-pulse">Scanned! Please authorize on mobile</span>
                ) : qrCodeStatus === 803 ? (
                  <span className="text-green-500 font-semibold">Success! Logging in...</span>
                ) : qrCodeStatus === 800 ? (
                  <span className="text-red-500 font-semibold">Code expired. Please try again</span>
                ) : (
                  <span className="text-yellow-600">Waiting for scan</span>
                )}
              </div>

              <div className="flex gap-2 w-full mt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowLoginModal(false)}>
                  Cancel
                </Button>
                <Button variant="outline" className="flex-1" onClick={startQrLogin}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EmbeddedMusicPlayer;
