import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Camera, Check, ChevronRight, CircleHelp, Copy, Crosshair, Gamepad2, Globe2, Keyboard, MoveRight, Pause, Play, Radio, Shield, Swords, Trophy, X, Zap } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { loadSocketClient } from './network';
import { act, createMatch, move, type Action, type Difficulty, type Match, type Movement } from '../shared/combat';
import { Bot } from '../shared/ai';
import { Arena } from './components/Arena';
import { MotionCamera } from './components/MotionCamera';
import { DefeatScare } from './components/DefeatScare';
import { playDefeatScream, stopDefeatScream, unlockAudio } from './game/audio';
import './fight-view.css';
interface Room {code:string;players:{name:string;ready:boolean;connected:boolean}[];paused:boolean;match:Match|null;}
const keymap:Record<string,Action>={j:'jab',k:'cross',l:'hook',' ':'block',a:'dodgeLeft',d:'dodgeRight',s:'duck'};
const controls=[['J','Jab','Straighten your left arm through shoulder, elbow, and hand; return to guard.'],['K','Cross','Straighten your right arm through shoulder, elbow, and hand; return to guard.'],['L','Hook','Press L to throw a hook. Camera punches use straight arms.'],['SPACE','Block','Raise your guard just before impact to daze the attacker. Holding it drains the guard bar.'],['A / D','Dodge','Move your head and shoulders left or right together.'],['S','Duck','Drop your head by bending your knees.']];
export default function App(){
  const [mode,setMode]=useState<'ai'|'online'>('ai'),[difficulty,setDifficulty]=useState<Difficulty>('medium'),[input,setInput]=useState<'keyboard'|'motion'>('keyboard');
  const [playing,setPlaying]=useState(false),[finished,setFinished]=useState(false),[scare,setScare]=useState(false),[paused,setPaused]=useState(false),[help,setHelp]=useState(false),[muted,setMuted]=useState(false);
  const [cameraReady,setCameraReady]=useState(false),[room,setRoom]=useState<Room|null>(null),[code,setCode]=useState(''),[name,setName]=useState('YOU'),[connection,setConnection]=useState('offline'),[error,setError]=useState(''),[copied,setCopied]=useState(false),[wins,setWins]=useState(0);
  const matchRef=useRef(createMatch()),botRef=useRef<Bot|null>(null),socket=useRef<Socket|null>(null),playerIndex=useRef(0),session=useRef<{code:string;token:string}|null>(null);
  const resultShown=useRef(false),finishRef=useRef<()=>void>(()=>{});
  const [immersive,setImmersive]=useState(false),[fullscreenHint,setFullscreenHint]=useState(false);
  const gloveStartPending=useRef(false);
  const enterFullscreen=()=>{setImmersive(true);if(document.fullscreenElement)return;try{const request=document.documentElement.requestFullscreen?.();if(request)void request.then(()=>setFullscreenHint(false)).catch(()=>setFullscreenHint(true));else setFullscreenHint(true);}catch{setFullscreenHint(true);}};
  const exitFightView=()=>{setImmersive(false);setFullscreenHint(false);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});};
  useEffect(()=>{const changed=()=>{if(!document.fullscreenElement){setImmersive(false);setFullscreenHint(false);}};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  useEffect(()=>{if(playing&&gloveStartPending.current){gloveStartPending.current=false;setImmersive(true);setFullscreenHint(!document.fullscreenElement);}},[playing]);
  const state=useRef({playing,mode,input,paused});state.current={playing,mode,input,paused};
  const send=useCallback((action:Action,held=true)=>{const s=state.current;if(!s.playing||s.paused)return;if(s.mode==='online')socket.current?.emit('action',{action,held});else act(matchRef.current,0,action,held);},[]);
  const sendMove=useCallback((direction:Movement)=>{const s=state.current;if(!s.playing||s.paused)return;if(s.mode==='online')socket.current?.emit('movement',direction);else move(matchRef.current,0,direction);},[]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,textarea,select'))return;if(e.key==='Escape'&&state.current.playing&&state.current.mode==='ai'){setPaused(v=>!v);return;}const a=keymap[e.key.toLowerCase()];if(!a||!state.current.playing)return;e.preventDefault();if(!e.repeat){if(a!=='block')send('block',false);send(a);}};
    const up=(e:KeyboardEvent)=>{if(e.key===' ')send('block',false);};
    const blur=()=>{send('block',false);if(state.current.playing&&state.current.mode==='ai')setPaused(true);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[send]);
  useEffect(()=>{
    if(mode!=='online')return;
    let disposed=false;let active:Socket|null=null;
    setConnection('connecting');
    void loadSocketClient().then(io=>{
    if(disposed)return;
    const s=io(import.meta.env.VITE_SERVER_URL||undefined,{autoConnect:true});active=s;socket.current=s;
    s.on('connect',()=>{setConnection('connected');setError('');if(session.current)s.emit('joinRoom',session.current);});
    s.on('disconnect',()=>setConnection('reconnecting'));
    s.on('connect_error',()=>{setConnection('reconnecting');setError('Cannot reach the arena server. Make sure the server is running. Retrying…');});
    s.on('joined',(data:{code:string;token:string;index:number})=>{session.current={code:data.code,token:data.token};playerIndex.current=data.index;setError('');});
    s.on('room',(data:Room)=>{setRoom(data);if(data.match){matchRef.current=data.match;if(data.match.phase==='finished')finishRef.current();else{resultShown.current=false;setPlaying(true);setFinished(false);}}});
    s.on('state',(data:Match)=>{matchRef.current=data;if(data.phase==='finished')finishRef.current();});
    s.on('roomError',(message:string)=>setError(message));
    }).catch(e=>{if(!disposed){setError(e.message);setConnection('offline');}});
    return()=>{disposed=true;active?.disconnect();socket.current=null;session.current=null;setRoom(null);setConnection('offline');};
  },[mode]);
  const endScare=useCallback(()=>{stopDefeatScream();setScare(false);},[]);
  const showScare=useCallback(()=>{if(!muted)try{playDefeatScream();}catch{stopDefeatScream();}},[muted]);
  useEffect(()=>()=>stopDefeatScream(),[]);
  const start=()=>{enterFullscreen();endScare();unlockAudio();setError('');setPaused(false);if(mode==='online'){socket.current?.emit('ready');return;}resultShown.current=false;setFinished(false);matchRef.current=createMatch();botRef.current=new Bot(difficulty,Date.now()>>>0);setPlaying(true);};
  const finish=useCallback(()=>{if(resultShown.current)return;resultShown.current=true;setFinished(true);if(matchRef.current.winner===playerIndex.current)setWins(v=>v+1);else if(matchRef.current.winner!==null)setScare(true);},[]);finishRef.current=finish;
  const leave=()=>{exitFightView();gloveStartPending.current=false;endScare();send('block',false);sendMove(0);if(mode==='online'){socket.current?.emit('leaveRoom');session.current=null;setRoom(null);}resultShown.current=false;setPlaying(false);setFinished(false);setPaused(false);setInput('keyboard');matchRef.current=createMatch();botRef.current=null;};
  const canGloveStart=input==='motion'&&cameraReady&&!playing&&!help&&(mode==='ai'||(!!room&&room.players.length>=2&&connection==='connected'&&!room.players[playerIndex.current]?.ready));
  const touchGloves=()=>{if(!canGloveStart||gloveStartPending.current)return;gloveStartPending.current=true;start();};
  const changeMode=(next:'ai'|'online')=>{setMode(next);setError('');matchRef.current=createMatch();playerIndex.current=0;};
  const opponent=difficulty==='easy'?'LIL’ GHOUL':difficulty==='medium'?'GRAVE GUARD':'THE REAPER';
  const names:[string,string]=mode==='online'?[room?.players[0]?.name||'FIGHTER 1',room?.players[1]?.name||'WAITING…']:[name||'YOU',opponent];
  const outcome=matchRef.current.winner===null?'DRAW':matchRef.current.winner===playerIndex.current?'VICTORY':'DEFEAT';
  return <div className={`app ${immersive?'fight-view':''} ${input==='motion'?'has-motion-camera':''}`}>
    {immersive&&<div className="fight-view-controls">{fullscreenHint&&<button className="secondary" onClick={enterFullscreen}>Enter fullscreen</button>}{playing&&!finished&&mode==='ai'&&<button className="secondary" onClick={()=>setPaused(v=>!v)}>{paused?'Resume':'Pause'}</button>}<button className="secondary" onClick={exitFightView}>Exit fight view</button></div>}
    <header className="site-header"><a className="brand" href="/" aria-label="Motion Boxing Arena home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" shapeRendering="crispEdges"><path fill="#a4bd70" d="M11 1h4v3h-2v3h-3V4h1z"/><path fill="currentColor" d="M5 6h14v2h3v12h-3v2H5v-2H2V8h3z"/><path fill="#21162c" d="M6 10h3v4H5v-2h1zm9 0h3v2h1v2h-4zM6 17h3v2h2v-2h2v2h2v-2h3v3H6z"/></svg></span><div>MOTION<span>BOXING AFTER DARK</span></div></a><div className="header-links"><span className="edition">HALLOWEEN SPECIAL · VOL. 01</span><button className="help-link" onClick={()=>setHelp(true)}><CircleHelp size={16}/> How to play <ArrowUpRight size={14}/></button></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow"><span/> THE ARCADE IS ALIVE AFTER DARK</div><h1>{playing?'FIGHT NIGHT.':'MIDNIGHT'} <em>{playing?'FRIGHT NIGHT.':'MAIN EVENT.'}</em></h1><p>{playing?'Keep your guard up. The graveyard hits back.':'All treats. No retreat. Step into the ring and put your monsters down.'}</p></div><div className="season-tag"><span className="season-moon" aria-hidden="true">✦</span><div><span>OCTOBER SPECIAL</span><b>GLOVES ON. LIGHTS OUT.</b><small>OPEN ALL NIGHT / EST. 2026</small></div></div></div>
      {window.location.protocol === 'file:' && <div className="standalone-notice" role="note"><b>KEYBOARD TRAINING EDITION</b><p>Webcam and online play need the local server. Run <code>npm install</code>, then <code>npm run dev</code> in the project folder and open <a href="http://localhost:5173">localhost:5173</a>.</p></div>}
      <div className="main-layout">
        <div className="stage-column">
          <Arena onFullscreen={()=>immersive?exitFightView():enterFullscreen()} matchRef={matchRef} botRef={botRef} playing={playing} online={mode==='online'} viewIndex={mode==='online'?playerIndex.current as 0|1:0} names={names} muted={muted} onMute={()=>{unlockAudio();setMuted(v=>!v);}} onFinish={finish} paused={paused||(playing&&mode==='online'&&(!!room?.paused||connection!=='connected'))}/>
          <div className="below-arena"><div className="auto-icon"><MoveRight size={20}/></div><div><b>Bring the punches. Control the distance.</b><p>Lean toward or away from the camera to move in or out. Otherwise, your fighter closes the gap automatically.</p></div><span className="tag">BODY MOVEMENT</span></div>
          <div className="feature-strip"><div><Camera size={19}/><span><b>MOVE TO FIGHT</b><small>Webcam-powered controls</small></span></div><div><Shield size={19}/><span><b>YOUR CAMERA, YOURS</b><small>Video never leaves your device</small></span></div><div><Globe2 size={19}/><span><b>FIGHT ANYWHERE</b><small>Challenge a friend online</small></span></div></div>
        </div>
        <aside className="setup-panel">
          <div className="panel-heading"><span className="eyebrow">{playing?'IN YOUR CORNER':'PLAYER SELECT'}</span><span className="step-label">{playing?(finished?'FINAL':'LIVE'):'P1 / READY?'}</span></div>
          {playing?<>
            <h2>{finished?'The witching hour.':'Give ’em a fright.'}</h2><p className="panel-sub">{mode==='online'?`ROOM ${room?.code} · ${connection}`:`${difficulty.toUpperCase()} · 90 SECOND ROUND`}</p>
            <div className="match-info"><span>YOUR FIGHTER</span><b>{names[playerIndex.current]}</b><span>CONTROLS</span><b>{input==='motion'?'Motion tracking':'Keyboard'}</b></div>
            {input==='keyboard'&&<div className="compact-controls">{controls.map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>}
            {input==='motion'&&<button className="text-button" onClick={()=>{send('block',false);sendMove(0);setInput('keyboard');}}>Use keyboard instead</button>}
            <p className="fight-tip"><Zap size={16}/>Raise your guard just before a punch lands to daze your opponent. Watch your guard bar.</p>
            {mode==='ai'&&!finished&&<button className="secondary full" onClick={()=>{send('block',false);setPaused(v=>!v);}}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'Resume fight':'Pause fight'} <kbd>ESC</kbd></button>}
            <button className="text-button" onClick={leave}>Leave arena <ArrowUpRight size={14}/></button>
          </>:<>
            <h2>Pick your poison.</h2><p className="panel-sub">A little fright. A lot of fight.</p>
            <label className="section-label"><span>01</span> GAME MODE</label>
            <div className="mode-select"><button aria-pressed={mode==='ai'} className={mode==='ai'?'selected':''} onClick={()=>changeMode('ai')}><Swords size={20}/><strong>VS AI</strong><small>Haunt the solo ring</small>{mode==='ai'&&<Check size={12} className="selection-check"/>}</button><button aria-pressed={mode==='online'} className={mode==='online'?'selected':''} onClick={()=>changeMode('online')}><Globe2 size={20}/><strong>Online</strong><small>Summon a friend</small>{mode==='online'&&<Check size={12} className="selection-check"/>}</button></div>
            {mode==='ai'?<><label className="section-label"><span>02</span> OPPONENT DIFFICULTY</label><div className="segmented">{(['easy','medium','hard'] as Difficulty[]).map(d=><button key={d} aria-pressed={difficulty===d} className={difficulty===d?'selected':''} onClick={()=>setDifficulty(d)}>{d}</button>)}</div><p className="difficulty-note"><i/>{difficulty==='easy'?'Lil’ Ghoul goes easy. Find your rhythm.':difficulty==='medium'?'Grave Guard is awake. Keep your guard up.':'The Reaper hits back. Bring your best.'}</p></>:<><label className="section-label"><span>02</span> YOUR ROOM <small className="connection">{connection}</small></label>{room?<div className="lobby"><div><small>ROOM CODE</small><button className="room-code" onClick={()=>{void navigator.clipboard.writeText(room.code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>setError('Copy the room code shown above to share it.'));}}>{room.code}{copied?<Check size={16}/>:<Copy size={16}/>}</button></div>{[0,1].map(i=><p key={i}><Radio size={13}/>{room.players[i]?.name||'Waiting for opponent…'}<span>{room.players[i]?.ready?'READY':room.players[i]?.connected?'CONNECTED':'—'}</span></p>)}<button className="text-button" onClick={leave}>Leave room</button></div>:<div className="room-setup"><input aria-label="Fighter name" placeholder="Your fighter name" maxLength={20} value={name} onChange={e=>setName(e.target.value)}/><button className="secondary full" disabled={connection!=='connected'} onClick={()=>socket.current?.emit('createRoom',{name})}>Create a room <ArrowRight size={15}/></button><div className="join-row"><input aria-label="Room code" placeholder="ROOM CODE" maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="secondary" disabled={code.length!==6||connection!=='connected'} onClick={()=>socket.current?.emit('joinRoom',{code,name})}>Join</button></div></div>}</>}
            <label className="section-label"><span>03</span> CHOOSE YOUR CONTROLS</label><div className="control-select"><button aria-pressed={input==='motion'} className={input==='motion'?'selected':''} onClick={()=>setInput('motion')}><Camera size={19}/><span><b>Motion controls</b><small>Use your webcam & your moves</small></span><i/></button><button aria-pressed={input==='keyboard'} className={input==='keyboard'?'selected':''} onClick={()=>setInput('keyboard')}><Keyboard size={19}/><span><b>Keyboard</b><small>Classic keys. Same intensity.</small></span><i/></button></div>
            {error&&<p role="alert" className="error-message">{error}</p>}
            <button className="primary full" onClick={start} disabled={(input==='motion'&&!cameraReady)||(mode==='online'&&(!room||room.players.length<2||connection!=='connected'||!!room.players[playerIndex.current]?.ready))}>{mode==='online'?(room?.players[playerIndex.current]?.ready?'WAITING FOR OPPONENT':'READY UP'):'ENTER THE RING'}<ArrowRight size={19}/></button>
            <p className="start-note">{input==='motion'?'After calibration, raise both hands beside your head or reach both fists forward. Hold briefly to start, or click ENTER THE RING for fullscreen.':'No camera needed. Jump straight into the action.'}</p>
          </>}
          {input==='motion'&&<MotionCamera compact={playing} onTouchGloves={canGloveStart?touchGloves:undefined} onAction={send} onMove={sendMove} onReady={setCameraReady}/>}
        </aside>
      </div>
      <section className="quick-controls"><div className="quick-title"><Gamepad2 size={19}/><b>HOW TO HAUNT</b><span>Six keys. No mercy.</span></div><div className="key-list">{controls.map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div><button onClick={()=>setHelp(true)}>Full guide <ChevronRight size={15}/></button></section>
    </main>
    <footer><span>NO TRICKS. JUST UPPERCUTS.</span><span><span className="live-dot"/> {wins} SESSION WINS <i/> MOTION / HALLOWEEN ’26</span></footer>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()}><button className="close-modal" aria-label="Close guide" onClick={()=>setHelp(false)}><X/></button><span className="eyebrow">THE MIDNIGHT FIGHT MANUAL</span><h2 id="guide-title">Learn the dark arts.</h2><p>Face the camera rather than standing sideways. A slight boxing stance is fine, but keep both shoulders, elbows, wrists, and hips visible. Hold a relaxed guard during calibration. Lean your body toward the lens to move forward or away to retreat. Punch toward the lens and snap back to guard.</p><div className="guide-controls">{controls.map(([key,label,description])=><div key={key}><kbd>{key}</kbd><span><b>{label}</b><small>{description}</small></span></div>)}</div><p><b>Fight smart.</b> Holding block reduces damage by 80% but drains the guard bar. Raise it within a split second of impact for a perfect block that deals no damage and dazes the attacker. An empty bar breaks guard until it recovers. Slips avoid straight punches, but hooks catch them. Duck under crosses and hooks; jabs catch ducks.</p><p>The round lasts 90 seconds. Win by knockout or remaining health. Without camera movement, your fighter approaches automatically. Online matches pause for up to 20 seconds on disconnection.</p><button className="primary full" onClick={()=>setHelp(false)}>GOT IT. GLOVES UP. <Crosshair size={17}/></button></section></div>}
    {scare&&<DefeatScare onSkip={endScare} onShow={showScare} onHide={stopDefeatScream}/>}
    {finished&&!scare&&<div className="modal-backdrop"><section className="modal result" role="dialog" aria-modal="true" aria-labelledby="result-title"><Trophy size={38}/><span className="eyebrow">{matchRef.current.reason==='Knockout'?'K.O. — THE FINAL BELL':matchRef.current.reason.toUpperCase()}</span><h2 id="result-title">{outcome}<span>.</span></h2><p>{outcome==='VICTORY'?'You owned the round. Ready for another?':outcome==='DRAW'?'Nothing between you. Settle it in the next round.':'Every round makes you sharper. Get back in there.'}</p><div className="result-stats"><div><b>{matchRef.current.fighters[playerIndex.current].hits}</b><small>HITS LANDED</small></div><div><b>{matchRef.current.fighters[playerIndex.current].damage}</b><small>DAMAGE DEALT</small></div><div><b>{Math.ceil(matchRef.current.fighters[playerIndex.current].hp)}</b><small>HEALTH LEFT</small></div></div><button className="primary full" disabled={mode==='online'&&(!!room?.players[playerIndex.current]?.ready||!!room?.paused)} onClick={start}>{mode==='online'?(room?.players[playerIndex.current]?.ready?'WAITING FOR OPPONENT':'READY FOR REMATCH'):'FIGHT AGAIN'}<ArrowRight size={17}/></button><button className="text-button" onClick={leave}>Back to setup</button></section></div>}
  </div>;
}
