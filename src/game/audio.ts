let context: AudioContext | undefined;
let scareGains: GainNode[]=[];
export function unlockAudio(){context??=new AudioContext();void context.resume();}
export function sound(kind:'hit'|'block'|'parry'|'bell'){
  if(!context || context.state!=='running')return;
  const o=context.createOscillator(),g=context.createGain();o.connect(g);g.connect(context.destination);
  o.type=kind==='bell'?'sine':kind==='parry'?'square':'triangle';const now=context.currentTime;
  o.frequency.setValueAtTime(kind==='bell'?740:kind==='parry'?520:kind==='hit'?135:240,now);o.frequency.exponentialRampToValueAtTime(kind==='bell'?650:kind==='parry'?180:45,now+.15);
  g.gain.setValueAtTime(.14,now);g.gain.exponentialRampToValueAtTime(.001,now+(kind==='bell'?.65:.18));o.start();o.stop(now+.7);
}
export function stopDefeatScream(){
  if(context)for(const gain of scareGains){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(0,context.currentTime,.03);}
  scareGains=[];
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
}
export function playDefeatScream(){
  stopDefeatScream();
  if(context?.state==='running'){
    const duration=2.7,rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),samples=buffer.getChannelData(0);
    let phase=0;
    for(let i=0;i<samples.length;i++){
      const t=i/rate,rise=Math.min(1,t/.48),pitch=(t<1.7?370+rise*310:680-(t-1.7)*240)+Math.sin(t*38)*21+Math.sin(t*71)*8;
      phase+=2*Math.PI*pitch/rate;
      let voice=0;
      for(let harmonic=1;harmonic<=10;harmonic++){
        const frequency=pitch*harmonic,formant=Math.exp(-(((frequency-1050)/550)**2))+.7*Math.exp(-(((frequency-2400)/800)**2));
        voice+=Math.sin(phase*harmonic)*formant/harmonic;
      }
      const envelope=Math.min(1,t/.09)*Math.min(1,(duration-t)/.65),tremble=.83+.17*Math.sin(t*47);
      samples[i]=Math.tanh((voice*1.8+(Math.random()*2-1)*.16)*envelope*tremble);
    }
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),delay=context.createDelay(.5),echo=context.createGain();
    source.buffer=buffer;filter.type='highpass';filter.frequency.value=230;gain.gain.value=.38;
    delay.delayTime.value=.13;echo.gain.value=.18;
    source.connect(filter);filter.connect(gain);gain.connect(context.destination);gain.connect(delay);delay.connect(echo);echo.connect(context.destination);
    source.start();scareGains=[gain,echo];
    const impact=context.createOscillator(),impactGain=context.createGain(),now=context.currentTime;
    impact.type='sine';impact.frequency.setValueAtTime(110,now);impact.frequency.exponentialRampToValueAtTime(43,now+.35);
    impactGain.gain.setValueAtTime(.25,now);impactGain.gain.exponentialRampToValueAtTime(.001,now+.38);
    impact.connect(impactGain);impactGain.connect(context.destination);impact.start(now);impact.stop(now+.4);scareGains.push(impactGain);
  }
  if('speechSynthesis' in window){
    const yell=new SpeechSynthesisUtterance('No! Stay away!');
    const voices=window.speechSynthesis.getVoices();
    yell.voice=voices.find(v=>/female|samantha|victoria|karen|zira|aria|serena|moira|ava|joanna/i.test(v.name))??null;
    yell.pitch=1.55;yell.rate=1.3;yell.volume=.9;
    window.speechSynthesis.speak(yell);
  }
}
