import type { Action, Movement } from '../../shared/combat';
export interface Landmark { x:number; y:number; z:number; visibility?:number; }
interface Neutral { head:number; headX:number; shoulderX:number; width:number; torsoDepth:number; }
export interface Detection { action:Action|null; block:boolean; movement:Movement; confidence:number; calibrated:boolean; progress:number; message:string; }
const dist=(a:Landmark,b:Landmark)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// The elbow must lie between shoulder and wrist, with an almost straight joint.
export const elbowAngle=(s:Landmark,e:Landmark,w:Landmark)=>{
  const a=dist(s,e),b=dist(e,w),c=dist(s,w);
  return a<.01||b<.01?0:Math.acos(Math.max(-1,Math.min(1,(a*a+b*b-c*c)/(2*a*b))))*180/Math.PI;
};
// A deliberate two-hand salute, held briefly, is distinct from a single punch.
export class TouchGlovesDetector {
  private since:number|null=null;
  private latched=false;
  progress=0;
  message='Raise both hands above shoulder level, or reach both hands forward.';
  reset(){this.since=null;this.latched=false;this.progress=0;}
  update(p:Landmark[],time:number):boolean {
    if([0,11,12,15,16].some(i=>!p[i]||(p[i].visibility??0)<.35)){this.since=null;this.progress=0;this.message='Bring both hands into view.';return false;}
    const width=Math.max(.08,Math.hypot(p[11].x-p[12].x,p[11].y-p[12].y));
    const forward=[0,1].every(side=>{
      const s=p[11+side],w=p[15+side];
      return (s.z-w.z)/width>.2&&Math.abs(w.y-s.y)<width;
    });
    const raised=[15,16].every(i=>p[i].y<p[0].y+width*.2);
    const touching=Math.abs(p[15].x-p[16].x)<width*1.6&&Math.abs(p[15].y-p[16].y)<width*.65;
    if((!forward&&!raised)||!touching){this.reset();this.message='Raise both hands beside your head, or reach both hands toward the camera.';return false;}
    this.since??=time;
    this.progress=Math.min(1,(time-this.since)/600);this.message='Both hands detected — hold to start!';
    if(!this.latched&&time-this.since>=600){this.latched=true;return true;}
    return false;
  }
}
export class GestureDetector {
  private smooth:Landmark[]=[]; private previous:Landmark[]=[]; private neutral:Neutral|null=null;
  private samples:Neutral[]=[]; private calibrating=true; private lastTime=0; private cooldown=0;
  private armed=[true,true]; private guardFrames=0; private defenseFrames=0; private lastDefense='';
  calibrate(){this.samples=[];this.neutral=null;this.calibrating=true;this.smooth=[];this.previous=[];this.armed=[false,false];this.lastTime=0;this.cooldown=0;this.guardFrames=0;this.defenseFrames=0;this.lastDefense='';}
  update(points:Landmark[],time:number,world:Landmark[]=[]):Detection{
    // Hidden hips or the non-punching hand must not disable a visible arm.
    const confidence=Math.min(...[0,11,12].map(i=>points[i]?.visibility??0));
    const result:Detection={action:null,block:false,movement:0,confidence,calibrated:!!this.neutral,progress:this.samples.length/40,message:'Keep your head and both shoulders visible.'};
    if(confidence<.5 || points.length<25){this.guardFrames=0;this.defenseFrames=0;this.lastDefense='';this.armed=[false,false];this.smooth=[];this.previous=[];this.lastTime=0;if(this.calibrating)this.samples=[];return result;}
    this.previous=this.smooth;
    this.smooth=points.map((p,i)=>({x:(this.previous[i]?.x??p.x)*.4+p.x*.6,y:(this.previous[i]?.y??p.y)*.4+p.y*.6,z:(this.previous[i]?.z??p.z)*.4+p.z*.6,visibility:p.visibility}));
    const p=this.smooth, width=Math.max(.08,Math.hypot(p[11].x-p[12].x,p[11].y-p[12].y));
    const shoulders=(p[11].x+p[12].x)/2;
    const hipsVisible=[23,24].every(i=>(p[i]?.visibility??0)>=.5);
    const torsoDepth=hipsVisible?((p[11].z+p[12].z-p[23].z-p[24].z)/2)/width:(this.neutral?.torsoDepth??0);
    if(this.calibrating){this.samples.push({head:p[0].y,headX:p[0].x,shoulderX:shoulders,width,torsoDepth});if(this.samples.length>=40){this.neutral={head:this.samples.reduce((a,b)=>a+b.head,0)/40,headX:this.samples.reduce((a,b)=>a+b.headX,0)/40,shoulderX:this.samples.reduce((a,b)=>a+b.shoulderX,0)/40,width:this.samples.reduce((a,b)=>a+b.width,0)/40,torsoDepth:this.samples.reduce((a,b)=>a+b.torsoDepth,0)/40};this.calibrating=false;this.armed=[elbowAngle(p[11],p[13],p[15])<120,elbowAngle(p[12],p[14],p[16])<120];}
      result.progress=Math.min(1,this.samples.length/40);result.calibrated=!!this.neutral;result.message=this.neutral?'Ready! Straighten either arm to punch, then return to guard.':'Calibrating automatically: hold your guard and keep your head, hands, and hips in view.';this.lastTime=time;return result;}
    if(!this.neutral){result.message='Raise your hands into guard, then calibrate.';this.lastTime=time;return result;}
    const dt=Math.max(.025,Math.min(.15,(time-this.lastTime)/1000));this.lastTime=time;
    const guarded=[15,16].every(i=>(p[i].visibility??0)>=.35&&p[i].y<p[0].y+width*.65 && Math.abs(p[i].x-p[0].x)<width*.85);
    this.guardFrames=guarded?this.guardFrames+1:0;result.block=this.guardFrames>=3;
    result.message=result.block?'Guard detected • move head and shoulders together to slip':'Tracking active • straighten either elbow and hand to punch';
    const duck=(p[0].y-this.neutral.head)/this.neutral.width>.48;
    const shift=(shoulders-this.neutral.shoulderX)/this.neutral.width;
    const headShift=(p[0].x-this.neutral.headX)/this.neutral.width;
    const old=this.previous;
    const headSpeed=old.length>=25?(p[0].x-old[0].x)/this.neutral.width/dt:0;
    const shoulderSpeed=old.length>=25?(shoulders-(old[11].x+old[12].x)/2)/this.neutral.width/dt:0;
    // Raw camera x increases toward the user's left in our mirrored preview.
    const together=Math.abs(headSpeed)>.12&&Math.abs(shoulderSpeed)>.12&&Math.sign(headSpeed)===Math.sign(shoulderSpeed)&&Math.sign(headSpeed)===Math.sign(shift);
    // Shoulder depth catches a torso lean; apparent shoulder size catches a
    // step toward or away from the lens. Ignore short frame-to-frame jitter.
    const distance=width/this.neutral.width;
    const bodyDepth=torsoDepth-this.neutral.torsoDepth;
    if(distance>1.13||bodyDepth<-.18)result.movement=1;
    else if(distance<.87||bodyDepth>.18)result.movement=-1;
    if(result.movement)result.message=result.movement===1?'Moving forward • close the distance':'Moving back • make some space';
    const defense=duck?'duck':together&&shift>.25&&headShift>.25?'dodgeLeft':together&&shift<-.25&&headShift<-.25?'dodgeRight':'';
    this.defenseFrames=defense===this.lastDefense?this.defenseFrames+1:1;this.lastDefense=defense;
    // Observe the return to guard even during recovery, so a quick retraction
    // does not leave the next punch disarmed.
    const armAngles=[0,1].map(side=>{
      const ids=[11+side,13+side,15+side];
      if(ids.some(i=>(p[i]?.visibility??0)<.35))return null;
      const geometry=ids.every(i=>world[i]&&(world[i].visibility??1)>=.35)?world:p;
      const angle=elbowAngle(geometry[ids[0]],geometry[ids[1]],geometry[ids[2]]);
      if(angle<125)this.armed[side]=true;
      return angle;
    });
    if(time<this.cooldown)return result;
    if(defense && this.defenseFrames===2){result.action=defense;result.block=false;this.guardFrames=0;this.cooldown=time+650;return result;}
    if(this.previous.length<25)return result;
    for(let side=0;side<2;side++){
      const angle=armAngles[side];
      if(angle===null)continue;
      if(!this.armed[side])continue;
      // Straightening either arm works sideways or toward the lens. Matching
      // wrist/elbow height alone is insufficient if the elbow is still bent.
      if(angle>130)result.action=side===0?'jab':'cross';
      if(result.action){this.armed[side]=false;this.cooldown=time+360;result.block=false;this.guardFrames=0;break;}
    }
    return result;
  }
}
