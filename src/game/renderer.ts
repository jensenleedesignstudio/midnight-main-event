import { ATTACKS, isAttack, type Fighter, type Match } from '../../shared/combat';
const W=1000,H=580;
function line(c:CanvasRenderingContext2D,points:number[][],color:string,width:number){c.strokeStyle=color;c.lineWidth=width;c.lineCap='square';c.lineJoin='miter';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
const ease=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const motionPhase=(age:number,duration:number)=>Math.min(ease(age/5),ease((duration-age)/7));
function fighter(c:CanvasRenderingContext2D,f:Fighter,index:number,time:number,preview:boolean){
  const color=index===0?'#ffae48':'#c398ef', dark=index===0?'#b85031':'#654284';
  const rhythm=time*(preview?7:10)+index*1.7;
  const bounce=(1-Math.cos(rhythm))*.5;
  const lift=f.hp<=0?0:(preview?8:12)*bounce;
  const duck=f.action==='duck'?42*motionPhase(f.age,32):0;
  const lean=f.action==='dazed'?Math.sin(time*19)*11:(f.action==='dodgeLeft'?-42:f.action==='dodgeRight'?42:0)*motionPhase(f.age,27)+(f.action==='hurt'?-12*ease(f.age/5):0);
  c.save();c.translate(f.x,432);ellipse(c,0,9,66-lift*.7,12-lift*.28,'#0008');
  if(f.hp<=0){c.translate(-22,0);c.rotate(-1.35);}
  const step=Math.sin(rhythm)*6;
  c.translate(0,-lift);
  // Boots and separated legs.
  line(c,[[-16,-67],[-31,-34+step],[-37,lift*.55]],index===0?'#b87750':'#6a9365',23);line(c,[[18,-67],[33,-35-step],[39,lift*.55]],index===0?'#dfa270':'#9cbd7b',23);
  line(c,[[-38,lift*.55-5],[-20,lift*.55-5]],'#241c36',19);line(c,[[36,lift*.55-5],[55,lift*.55-5]],'#241c36',19);
  line(c,[[-43,lift*.55-13],[-29,lift*.55-13]],color,4);line(c,[[31,lift*.55-13],[45,lift*.55-13]],color,4);
  c.translate(lean,duck);
  // Angular shorts, torso, shoulder highlights.
  c.fillStyle=dark;c.beginPath();c.moveTo(-31,-110);c.lineTo(26,-110);c.lineTo(34,-62);c.lineTo(3,-62);c.lineTo(-2,-77);c.lineTo(-9,-62);c.lineTo(-37,-62);c.closePath();c.fill();
  c.fillStyle=color;c.fillRect(-29,-110,55,9);c.fillStyle='#f1f5d9';c.fillRect(-5,-108,9,5);
  const skin=index===0?'#c58257':'#719363', light=index===0?'#edb27b':'#a2bf81';
  c.fillStyle=skin;c.beginPath();c.moveTo(-26,-176);c.quadraticCurveTo(0,-192,27,-173);c.lineTo(22,-115);c.quadraticCurveTo(-2,-102,-26,-117);c.closePath();c.fill();
  line(c,[[-17,-170],[-10,-146],[-13,-121]],light,5);line(c,[[4,-170],[15,-159],[13,-143]],'#ffffff16',3);
  line(c,[[0,-177],[0,-193]],skin,22);
  // Block-built Halloween heads, kept crisp on the low-resolution canvas.
  if(index===0){
    c.fillStyle='#77402f';c.fillRect(-23,-238,43,49);
    c.fillStyle='#e7772f';c.fillRect(-27,-232,52,33);c.fillRect(-20,-241,37,49);
    c.fillStyle='#ffac46';c.fillRect(-14,-237,12,43);c.fillRect(5,-234,10,36);
    c.fillStyle='#8eac5e';c.fillRect(-5,-250,9,12);c.fillRect(0,-253,10,6);
    c.fillStyle='#3b2638';c.fillRect(-15,-221,11,9);c.fillRect(10,-221,12,9);
    c.fillRect(-9,-204,25,7);c.fillRect(-15,-207,6,6);c.fillRect(16,-207,6,6);
    c.fillStyle='#ffe393';c.fillRect(-11,-219,5,4);c.fillRect(14,-219,5,4);c.fillRect(0,-204,5,4);
  }else{
    c.fillStyle='#54724e';c.fillRect(-24,-239,48,45);
    c.fillStyle=light;c.fillRect(-18,-236,43,38);c.fillRect(-12,-199,29,8);
    c.fillStyle='#282239';c.fillRect(-25,-244,50,11);c.fillRect(-24,-235,8,14);c.fillRect(15,-234,10,5);
    c.fillStyle='#d8d6bc';c.fillRect(-31,-207,8,7);c.fillRect(24,-207,7,7);
    c.fillStyle='#3b3542';c.fillRect(-17,-224,13,5);c.fillRect(7,-224,13,5);
    c.fillRect(-14,-219,7,8);c.fillRect(10,-219,7,8);c.fillRect(-9,-203,18,7);
    c.fillStyle='#f1eee0';c.fillRect(-12,-218,3,3);c.fillRect(12,-218,3,3);c.fillRect(-5,-203,3,4);c.fillRect(3,-203,3,4);
    c.fillStyle='#6a8257';c.fillRect(-4,-229,12,2);c.fillRect(-2,-232,2,7);c.fillRect(5,-232,2,7);
  }
  if(f.action==='dazed'){c.fillStyle='#ffe39b';c.fillRect(-41,-267,10,10);c.fillRect(27,-279,11,11);c.fillRect(-5,-290,8,8);}
  let left:[number,number]=[-40,-185],right:[number,number]=[40,-185];
  let leftElbow:[number,number]=[-48,-151],rightElbow:[number,number]=[48,-151];
  let leftReach=0,rightReach=0;
  if(f.action==='block'){left=[-18,-218];right=[18,-218];leftElbow=[-43,-177];rightElbow=[43,-177];}
  if(isAttack(f.action)){
    const a=ATTACKS[f.action], peak=a.startup+a.active/2;
    const p=f.age<peak?f.age/peak:Math.max(0,1-(f.age-peak)/a.recovery);
    const extension=ease(p);
    if(f.action==='jab'){left=[-40+extension*33,-185+extension*17];leftElbow=[-48+extension*20,-151-extension*19];leftReach=extension;}
    if(f.action==='cross'){right=[40-extension*33,-185+extension*17];rightElbow=[48-extension*20,-151-extension*19];rightReach=extension;}
    if(f.action==='hook'){right=[40-extension*38,-185-extension*9];rightElbow=[48+extension*30,-151-extension*41];rightReach=extension;}
  }
  for(const [side,hand,elbow,reach] of [[-1,left,leftElbow,leftReach],[1,right,rightElbow,rightReach]] as const){
    line(c,[[side*25,-169],elbow,hand],side<0?skin:light,20+reach*8);
    ellipse(c,hand[0],hand[1],19+reach*23,19+reach*22,reach?color:dark);
    ellipse(c,hand[0]-5,hand[1]-7,9+reach*10,5+reach*4,'#ffffff35');
  }
  c.restore();
}
function bat(c:CanvasRenderingContext2D,x:number,y:number,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='#120d20';
  c.beginPath();c.moveTo(-22,-7);c.lineTo(-12,-3);c.lineTo(-6,2);c.lineTo(-4,-5);c.lineTo(0,-1);c.lineTo(4,-5);c.lineTo(6,2);c.lineTo(12,-3);c.lineTo(22,-7);c.lineTo(18,7);c.lineTo(10,4);c.lineTo(5,10);c.lineTo(0,6);c.lineTo(-5,10);c.lineTo(-10,4);c.lineTo(-18,7);c.closePath();c.fill();c.restore();
}
function pumpkin(c:CanvasRenderingContext2D,x:number,y:number,size=1){
  c.save();c.translate(x,y);c.scale(size,size);c.fillStyle='#768f4b';c.fillRect(-2,-16,5,7);
  c.fillStyle='#b8582f';c.fillRect(-15,-7,30,18);c.fillRect(-10,-12,20,28);
  c.fillStyle='#ee8c3c';c.fillRect(-8,-10,7,23);c.fillRect(3,-10,5,23);
  c.fillStyle='#ffe39b';c.fillRect(-10,-3,6,5);c.fillRect(5,-3,6,5);c.fillRect(-7,7,15,3);c.fillRect(-3,5,3,3);c.restore();
}
function firstPersonGloves(c:CanvasRenderingContext2D,f:Fighter,index:number,time:number){
  const glove=index===0?'#f6a14a':'#bb91e7';
  const shadow=index===0?'#9e4a33':'#684887';
  const sleeve=index===0?'#c5835a':'#78976c';
  const pulse=Math.sin(time*9)*5;
  let left:[number,number]=[395,407+pulse],right:[number,number]=[605,407-pulse];
  const sideShift=(f.action==='dodgeLeft'?-28:f.action==='dodgeRight'?28:0)*motionPhase(f.age,27);
  left[0]+=sideShift;right[0]+=sideShift;
  if(f.action==='block'){left=[444,333];right=[556,333];}
  if(f.action==='duck'){left[1]+=34*motionPhase(f.age,32);right[1]+=34*motionPhase(f.age,32);}
  if(isAttack(f.action)){
    const a=ATTACKS[f.action],peak=a.startup+a.active/2;
    const progress=f.age<peak?ease(f.age/peak):ease(1-(f.age-peak)/a.recovery);
    if(f.action==='jab')left=[395+progress*92,407-progress*125];
    if(f.action==='cross')right=[605-progress*112,407-progress*132];
    if(f.action==='hook')right=[605-progress*135,407-progress*99];
  }
  for(const [side,pos] of [[-1,left],[1,right]] as const){
    const [x,y]=pos,origin=side<0?245:755;
    line(c,[[origin,590],[origin+side*25,505],[x,y+24]],'#1b1328',75);
    line(c,[[origin,590],[origin+side*25,505],[x,y+24]],sleeve,58);
    line(c,[[origin+side*25,505],[x,y+24]],'#e5c7ad44',7);
    ellipse(c,x+5,y+9,46,44,shadow);ellipse(c,x,y,43,39,glove);
    c.fillStyle='#ffe6c044';c.fillRect(x-25,y-24,31,7);
    c.fillStyle=shadow;c.fillRect(x-34,y+16,67,9);
    c.fillStyle='#f4e4d7';c.fillRect(x-17,y+20,36,7);
  }
}
export function renderArena(c:CanvasRenderingContext2D,m:Match,time:number,preview=false,viewIndex:0|1=0){
  const ratio=c.canvas.width/W;c.setTransform(ratio,0,0,ratio,0,0);c.imageSmoothingEnabled=false;c.clearRect(0,0,W,H);
  const self=m.fighters[viewIndex],opponent=m.fighters[1-viewIndex];
  const distance=Math.max(80,Math.min(400,Math.abs(self.x-opponent.x)));
  const scale=1.25-distance*.0013;
  const cameraShift=(self.action==='dodgeLeft'?65:self.action==='dodgeRight'?-65:0)*motionPhase(self.age,27);
  const cameraDrop=self.action==='duck'?-42*motionPhase(self.age,32):0;
  const hurt=m.events.some(e=>e.target===viewIndex&&e.kind==='hit'&&m.tick-e.tick<12);
  c.fillStyle='#20182c';c.fillRect(0,0,W,H);
  c.save();c.translate(cameraShift+(hurt?Math.sin(time*75)*5:0),cameraDrop);
  // The distant graveyard and far side of the ring form a single vanishing point.
  c.fillStyle='#33243f';c.fillRect(-50,78,1100,252);
  for(let i=0;i<44;i++){const x=(i*137+23)%1000,y=(i*73+32)%200;c.fillStyle=i%3?'#795478':'#c29c98';c.fillRect(x,y,3,3);}
  ellipse(c,500,130,64,64,'#d6bddb');ellipse(c,508,124,51,51,'#e6d1e0');
  for(const x of [65,210,750,895]){
    c.fillStyle='#191425';c.fillRect(x,130,56,175);c.fillRect(x+12,112,32,22);c.fillRect(x+22,96,12,20);
    c.fillStyle='#ae6b55';c.fillRect(x+14,168,28,70);c.fillStyle='#df9c68';c.fillRect(x+21,176,14,48);
    c.fillStyle='#24182f';c.fillRect(x+27,157,4,94);
  }
  bat(c,348,117,1);bat(c,653,96,.8);
  for(let row=0;row<2;row++)for(let i=0;i<29;i++){
    const x=i*38-18+(row?17:0),y=276+row*33+Math.sin(i*6)*4;
    c.fillStyle='#171321';c.fillRect(x-11,y+5,26,31);
    c.fillStyle=['#74617c','#7e8868','#957367','#a49aaf'][i%4];c.fillRect(x-7,y-12,19,20);
    c.fillStyle='#241a2c';c.fillRect(x-9,y-17,23,7);c.fillRect(x-3,y-3,3,3);c.fillRect(x+6,y-3,3,3);
  }
  c.fillStyle='#1b1427';c.fillRect(-50,319,1100,61);
  c.font='bold 19px "Press Start 2P", monospace';c.textAlign='center';c.fillStyle='#bd805d';c.fillText('FIGHT NIGHT',500,354);
  for(let j=0;j<3;j++){const y=330+j*18;line(c,[[-40,y],[1040,y]],j===1?'#d8bbc7':'#f2a05b',6);}
  c.fillStyle='#ae98b6';c.beginPath();c.moveTo(190,379);c.lineTo(810,379);c.lineTo(1160,580);c.lineTo(-160,580);c.closePath();c.fill();
  c.fillStyle='#c1aeca';c.beginPath();c.moveTo(214,390);c.lineTo(786,390);c.lineTo(1090,580);c.lineTo(-90,580);c.closePath();c.fill();
  c.strokeStyle='#9f86aa';c.lineWidth=3;for(let i=0;i<9;i++){c.beginPath();c.moveTo(205+i*74,380);c.lineTo(-120+i*155,580);c.stroke();}
  for(const y of [422,463,510,566])line(c,[[80-(y-379)*1.2,y],[920+(y-379)*1.2,y]],'#9f86aa',2);
  c.save();c.translate(500,445);c.scale(1,.36);c.font='bold 35px monospace';c.fillStyle='#937ba1';c.fillText('MIDNIGHT MAIN EVENT',0,0);c.restore();
  c.save();c.translate(500,445-432*scale);c.scale(scale,scale);
  const projected={...opponent,x:0};fighter(c,projected,1-viewIndex,time,preview);
  c.restore();
  // Side ropes widen toward the camera and frame the opponent.
  for(const side of [-1,1]){
    const outer=side<0?-25:1025,inner=side<0?174:826;
    for(let j=0;j<3;j++)line(c,[[inner,342+j*20],[outer,395+j*56]],j===1?'#e3c5d0':'#f2a05b',7);
    c.fillStyle='#24182e';c.fillRect(outer-13,365,26,220);
    c.fillStyle=side<0?'#b3543e':'#8554a5';c.fillRect(outer-15,385,30,90);
  }
  pumpkin(c,88,525,1.2);pumpkin(c,914,521,1);
  c.restore();
  for(const e of m.events){const age=m.tick-e.tick;if(age>32)continue;
    if(e.kind==='parry'&&e.target===viewIndex){c.save();c.globalAlpha=1-age/32;c.textAlign='center';c.font='bold 20px "Press Start 2P", monospace';c.fillStyle='#e7c1ff';c.fillText('PERFECT BLOCK!',500,270-age*.8);c.restore();continue;}
    if(e.target!==1-viewIndex)continue;
    c.save();c.globalAlpha=1-age/32;
    if(e.kind!=='miss')for(let k=0;k<9;k++){const angle=k*2.4+e.id,r=24+age*2;
      line(c,[[500+Math.cos(angle)*r,260+Math.sin(angle)*r],[500+Math.cos(angle)*(r+11),260+Math.sin(angle)*(r+11)]],e.kind==='block'||e.kind==='parry'?'#d3b3ff':'#ffdb8a',5);}
    c.font='bold 17px "Press Start 2P", monospace';c.fillStyle=e.kind==='miss'?'#e5d3ef':e.kind==='block'||e.kind==='parry'?'#d5b4ff':'#ffe396';
    c.fillText(e.kind==='miss'?'MISS':e.kind==='parry'?'PARRIED!':e.kind==='block'?'BLOCK':`−${e.damage}`,500,184-age*1.2);c.restore();
  }
  firstPersonGloves(c,self,viewIndex,time);
  if(hurt){c.fillStyle='#ff695022';c.fillRect(0,0,W,H);}
}
