import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ArrowUpRight, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { LABELS, step, type Match } from '../../shared/combat';
import { Bot } from '../../shared/ai';
import { renderArena } from '../game/renderer';
import { sound } from '../game/audio';
export function Arena({matchRef,botRef,playing,online,viewIndex,names,muted,onMute,onFinish,paused,onFullscreen}:{matchRef:MutableRefObject<Match>;botRef:MutableRefObject<Bot|null>;playing:boolean;online:boolean;viewIndex:0|1;names:[string,string];muted:boolean;onMute:()=>void;onFinish:()=>void;paused:boolean;onFullscreen?:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const [hud,setHud]=useState(()=>structuredClone(matchRef.current));
  const latest=useRef({playing,online,viewIndex,muted,onFinish,paused});latest.current={playing,online,viewIndex,muted,onFinish,paused};
  useEffect(()=>{
    let raf=0,last=performance.now(),acc=0,lastUI=0,eventId=0,ended=false,phase='countdown';
    const draw=(now:number)=>{
      const m=matchRef.current,opts=latest.current;
      if(m.phase!=='finished')ended=false;
      if(m.eventId<eventId)eventId=0;
      const elapsed=Math.min(100,now-last);last=now;
      if(opts.playing&&!opts.online&&!opts.paused){acc+=elapsed;while(acc>=1000/60){botRef.current?.update(m);step(m);acc-=1000/60;}}
      else acc=0;
      if(!opts.muted&&opts.playing){for(const e of m.events){if(e.id>eventId&&e.kind!=='miss')sound(e.kind);}if(phase==='countdown'&&m.phase==='fight')sound('bell');}
      phase=m.phase;eventId=m.eventId;
      if(m.phase==='finished'&&opts.playing&&!ended){ended=true;opts.onFinish();}
      const c=canvas.current?.getContext('2d');if(c)renderArena(c,m,now/1000,!opts.playing,opts.viewIndex);
      if(now-lastUI>60){setHud(structuredClone(m));lastUI=now;}
      raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
  },[matchRef,botRef]);
  const seconds=Math.ceil(hud.remaining/60);
  return <div className="arena-shell" ref={container}>
    <div className="arena-top"><span><i/> THE GRAVEYARD <small> / MIDNIGHT DIVISION</small></span><div><button aria-label={muted?'Enable sound':'Mute sound'} onClick={onMute}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button><button aria-label="Toggle fullscreen" onClick={onFullscreen??(()=>{if(document.fullscreenElement)void document.exitFullscreen();else void container.current?.requestFullscreen?.();})}><Maximize2 size={15}/></button></div></div>
    <div className="arena-stage"><canvas ref={canvas} width={500} height={290} aria-label="First person pixel art boxing ring with your gloves facing the opposing fighter"/>
      <div className="fight-hud">
        <div className="fighter-hud"><div><span className="player-badge">P1</span><b>{names[0]}</b><span>{Math.ceil(hud.fighters[0].hp)}<small> / 100</small></span></div><div className="health-track"><i style={{width:`${hud.fighters[0].hp}%`}}/></div><div className="guard-meter" role="meter" aria-label={`${names[0]} guard`} aria-valuenow={Math.ceil(hud.fighters[0].guard)} aria-valuemin={0} aria-valuemax={100}><span>GUARD</span><i><b style={{width:`${hud.fighters[0].guard}%`}}/></i><span>{hud.fighters[0].guardBroken?'BROKEN':`${Math.ceil(hud.fighters[0].guard)}%`}</span></div><small>{playing?LABELS[hud.fighters[0].action]:'PUMPKIN PUNCHER'}<span>{hud.fighters[0].hits} HITS</span></small></div>
        <div className="timer"><small>ROUND 01</small><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong><span>● ○ ○</span></div>
        <div className="fighter-hud opponent"><div><span className="player-badge">P2</span><b>{names[1]}</b><span>{Math.ceil(hud.fighters[1].hp)}<small> / 100</small></span></div><div className="health-track"><i style={{width:`${hud.fighters[1].hp}%`}}/></div><div className="guard-meter" role="meter" aria-label={`${names[1]} guard`} aria-valuenow={Math.ceil(hud.fighters[1].guard)} aria-valuemin={0} aria-valuemax={100}><span>GUARD</span><i><b style={{width:`${hud.fighters[1].guard}%`}}/></i><span>{hud.fighters[1].guardBroken?'BROKEN':`${Math.ceil(hud.fighters[1].guard)}%`}</span></div><small>{playing?LABELS[hud.fighters[1].action]:'BACK FROM THE DEAD'}<span>{hud.fighters[1].hits} HITS</span></small></div>
      </div>
      {!playing&&<div className="arena-preview-label"><span className="live-dot"/> THE RING AWAITS <ArrowUpRight size={13}/></div>}
      {playing&&hud.phase==='countdown'&&<div className="round-overlay"><small>ROUND ONE</small><strong key={Math.ceil(hud.countdown/60)}> {Math.ceil(hud.countdown/60)===1?'FIGHT!':Math.ceil(hud.countdown/60)===3?'READY': 'SET'}</strong><span>Gloves up. Ghouls out.</span></div>}
      {playing&&paused&&<div className="round-overlay pause"><strong>TIME OUT</strong><span>{online?'Reconnecting fighter… match paused for up to 20 seconds.':'Match paused. Resume when you’re ready.'}</span></div>}
    </div>
    <div className="arena-bottom"><span><i className="live-dot"/>{playing?(hud.phase==='finished'?'THE FINAL BELL':paused?'MATCH PAUSED':'MATCH IN PROGRESS'):'NO COINS NEEDED. JUST COURAGE.'}</span><span>AUTO-POSITIONING <b>ON</b></span></div>
  </div>;
}
