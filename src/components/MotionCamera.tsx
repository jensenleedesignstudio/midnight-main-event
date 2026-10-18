import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, ScanLine } from 'lucide-react';
import { GestureDetector, TouchGlovesDetector, elbowAngle, type Detection, type Landmark } from '../motion/gestures';
import { LABELS, type Action, type Movement } from '../../shared/combat';
const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[0,11],[0,12]];
const joints:[number,string,string][]=[[0,'Head','#ffffff'],[11,'L shoulder','#65e5cf'],[13,'L elbow','#65e5cf'],[15,'L hand','#65e5cf'],[12,'R shoulder','#ffad59'],[14,'R elbow','#ffad59'],[16,'R hand','#ffad59'],[23,'L hip','#d4b2f1'],[24,'R hip','#d4b2f1']];
function drawPose(c:CanvasRenderingContext2D,points:Landmark[]){
  c.lineWidth=3;
  for(const [a,b]of edges){if((points[a]?.visibility??0)<.35||(points[b]?.visibility??0)<.35)continue;c.strokeStyle=[13,15].includes(b)?'#65e5cf':[14,16].includes(b)?'#ffad59':'#d4b2f1';c.beginPath();c.moveTo(points[a].x*640,points[a].y*480);c.lineTo(points[b].x*640,points[b].y*480);c.stroke();}
  for(const [i,label,color]of joints){const p=points[i];if(!p||(p.visibility??0)<.35)continue;const x=p.x*640,y=p.y*480;c.fillStyle=color;c.strokeStyle='#101019';c.lineWidth=2;c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill();c.stroke();
    // The canvas is mirrored by CSS; counter-mirror labels to keep them readable.
    c.save();c.translate(x,y);c.scale(-1,1);c.font='bold 11px system-ui';const width=c.measureText(label).width;c.fillStyle='#101019dd';c.fillRect(9,-19,width+8,16);c.fillStyle=color;c.fillText(label,13,-7);c.restore();}
}
export function MotionCamera({onAction,onMove,onReady,onTouchGloves,compact=false}:{onAction:(a:Action,held?:boolean)=>void;onMove:(direction:Movement)=>void;onReady:(ready:boolean)=>void;onTouchGloves?:()=>void;compact?:boolean}){
  const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),detector=useRef(new GestureDetector());
  const callbacks=useRef({onAction,onMove,onReady,onTouchGloves});callbacks.current={onAction,onMove,onReady,onTouchGloves};
  const [status,setStatus]=useState('Requesting camera…'),[error,setError]=useState(''),[overlay,setOverlay]=useState(true),[retry,setRetry]=useState(0);
  const [detection,setDetection]=useState<Detection|null>(null),[last,setLast]=useState('No gesture yet');
  const [hands,setHands]=useState('Waiting for hands'),[gloveStatus,setGloveStatus]=useState(''),[gloveProgress,setGloveProgress]=useState(0);
  const showSkeleton=useRef(overlay);showSkeleton.current=overlay;
  const filePreview = window.location.protocol === 'file:';
  useEffect(()=>{
    let disposed=false,stream:MediaStream|undefined,worker:Worker|undefined,interval:ReturnType<typeof setInterval>|undefined,watchdog:ReturnType<typeof setTimeout>|undefined;
    let busy=false,ready=false,block=false,movement:Movement=0,lastPose=0,suppressBlockUntil=0;
    const gloves=new TouchGlovesDetector();
    setError('');setDetection(null);setLast('Waiting for pose');callbacks.current.onReady(false);detector.current=new GestureDetector();
    const fail=(message:string)=>{if(disposed)return;clearTimeout(watchdog);setError(message);setStatus('Camera unavailable');ready=false;callbacks.current.onReady(false);callbacks.current.onAction('block',false);callbacks.current.onMove(0);stream?.getTracks().forEach(t=>t.stop());worker?.terminate();if(interval)clearInterval(interval);};
    const start=async()=>{
      try{
        // file:// can expose getUserMedia in Chrome but cannot load our worker.
        // Check the origin before asking for permission or opening the camera.
        if (filePreview) {
          fail('This standalone file supports keyboard play only. For motion controls, run npm install and npm run dev in the project folder, then open http://localhost:5173.');
          return;
        }
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          fail('Motion controls need localhost or HTTPS. Open the app at http://localhost:5173 on the server computer, or use an HTTPS address. Keyboard controls still work.');
          return;
        }
        stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30},facingMode:'user'},audio:false});
        if(disposed){stream.getTracks().forEach(t=>t.stop());return;}
        video.current!.srcObject=stream;await video.current!.play();if(disposed)return;setStatus('Loading pose model…');
        worker=new Worker('/pose-worker.js');
        watchdog=setTimeout(()=>fail('The pose model took too long to load. Check your connection and retry, or switch to keyboard.'),45000);
        worker.onerror=()=>fail('This browser could not start pose tracking. Try a current Chrome or Edge browser, or use keyboard.');
        worker.onmessage=event=>{
          if(disposed)return;
          if(event.data.type==='ready'){clearTimeout(watchdog);ready=true;setStatus('Camera live');return;}
          if(event.data.type==='error'){fail(`Pose model could not load: ${event.data.message}. Retry or use keyboard.`);return;}
          if(event.data.type!=='pose')return;
          busy=false;lastPose=performance.now();setStatus('Camera live');const points:Landmark[]=event.data.landmarks;
          const world:Landmark[]=event.data.worldLandmarks||[];
          const d=detector.current.update(points,event.data.timestamp,world);setDetection(d);callbacks.current.onReady(d.calibrated && d.confidence>=.5);
          setHands([0,1].map(side=>{const s=11+side,e=13+side,w=15+side;const visible=[s,e,w].every(i=>(points[i]?.visibility??0)>=.35);const geometry=[s,e,w].every(i=>world[i]&&(world[i].visibility??1)>=.35)?world:points;return `${side===0?'Left':'Right'} hand: ${visible?`${Math.round(elbowAngle(geometry[s],geometry[e],geometry[w]))}° elbow`:'out of view'}`;}).join(' · '));
          if(callbacks.current.onTouchGloves&&d.calibrated&&d.confidence>=.5){if(gloves.update(points,event.data.timestamp)){callbacks.current.onTouchGloves();setLast('Gloves touched — ready!');}setGloveStatus(gloves.message);setGloveProgress(gloves.progress);}else{gloves.reset();setGloveProgress(0);}
          if(d.movement!==movement){movement=d.movement;if(movement)setLast(movement===1?'Moving forward':'Moving back');}
          callbacks.current.onMove(movement);
          if(d.action){
            // Keeping the other hand up is good form. Release the held game
            // block before sending a punch or slip so the move is not rejected.
            if(block){block=false;callbacks.current.onAction('block',false);}
            suppressBlockUntil=event.data.timestamp+400;
            callbacks.current.onAction(d.action);setLast(LABELS[d.action]);
          }else{
            const nextBlock=d.block&&event.data.timestamp>=suppressBlockUntil;
            if(nextBlock!==block){block=nextBlock;callbacks.current.onAction('block',block);if(block)setLast('Guard up');}
          }
          const c=canvas.current?.getContext('2d');if(c){c.clearRect(0,0,640,480);if(showSkeleton.current&&points.length)drawPose(c,points);}
        };
        worker.postMessage({type:'init'});
        interval=setInterval(async()=>{
          if(lastPose && performance.now()-lastPose>650){if(block){block=false;callbacks.current.onAction('block',false);}if(movement){movement=0;callbacks.current.onMove(0);}callbacks.current.onReady(false);setStatus('Tracking interrupted');}
          if(!ready||busy||!video.current||video.current.readyState<2)return;busy=true;
          try{const bitmap=await createImageBitmap(video.current);if(disposed){bitmap.close();return;}worker?.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);}catch{busy=false;}
        },33);
      }catch(e){
        const name = e instanceof Error ? e.name : '';
        if (name === 'NotAllowedError') fail('Camera permission was denied. Allow camera access in your browser’s site settings, then retry or choose Keyboard.');
        else if (name === 'NotFoundError') fail('No camera was found. Connect a webcam, then retry or choose Keyboard.');
        else if (name === 'NotReadableError') fail('The camera is busy or unavailable. Close other apps using it, then retry or choose Keyboard.');
        else fail(e instanceof Error ? `Motion tracking could not start: ${e.message}. Run the app from localhost or HTTPS, or choose Keyboard.` : 'Could not start motion tracking. Choose Keyboard to play.');
      }
    };void start();
    return()=>{disposed=true;clearInterval(interval);clearTimeout(watchdog);worker?.terminate();stream?.getTracks().forEach(t=>t.stop());callbacks.current.onAction('block',false);callbacks.current.onMove(0);callbacks.current.onReady(false);};
  },[retry,filePreview]);
  return <section className={`camera-panel ${compact?'compact':''}`} aria-label="Motion camera">
    <div className="camera-title"><span><Camera size={14}/>{status}</span><span className="live-dot"/></div>
    <div className="camera-feed"><video ref={video} muted playsInline/><canvas ref={canvas} width={640} height={480}/>{error&&<div className="camera-error" role="alert">{error}{!filePreview&&<button className="small-button" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={13}/>Retry camera</button>}</div>}</div>
    <div className="camera-debug"><span>CONFIDENCE <b>{Math.round((detection?.confidence??0)*100)}%</b></span><span className="lime">{detection?.calibrated?last:'Calibrating automatically'}</span></div>
    <p className="hand-tracking-status">{hands}</p>
    <p className="micro" aria-live="polite">{detection?.message||'Face the camera with your head, hands, and hips visible. Calibration starts automatically.'}</p>
    {onTouchGloves&&detection?.calibrated&&<div className="glove-start-status"><p>{gloveStatus||'Raise both hands beside your head, or extend both fists forward.'}</p><progress aria-label="Hold both hands to start" max={1} value={gloveProgress}/></div>}
    {!compact&&<button className="secondary full" disabled={!!error||status==='Requesting camera…'||status==='Loading pose model…'} onClick={()=>{detector.current.calibrate();callbacks.current.onReady(false);setLast('Waiting for pose');}}><ScanLine size={15}/>Recalibrate stance</button>}
    {!!detection?.progress&&!detection.calibrated&&<progress max={1} value={detection.progress}/>}
    <label className="overlay-toggle"><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/> Show labeled body points</label>
    {overlay&&<p className="micro">Mint: left arm · orange: right arm · purple: hips. Slip with your head and shoulders together. Straighten either arm to punch.</p>}
  </section>;
}
