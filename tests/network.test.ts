import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';
import { createArenaServer } from '../server/index.js';
import type { Match } from '../shared/combat.js';
function next<T>(socket:Socket,event:string,predicate:(value:T)=>boolean=()=>true):Promise<T>{return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(event,listener);reject(new Error(`Timed out waiting for ${event}`));},8000);const listener=(value:T)=>{if(predicate(value)){clearTimeout(timeout);socket.off(event,listener);resolve(value);}};socket.on(event,listener);});}
interface Joined {code:string;token:string;index:number;}
interface Room {players:{ready:boolean;connected:boolean}[];paused:boolean;match:Match|null;}
test('authoritative two-player lobby, combat, disconnect pause, resume, rematch and leave',async()=>{
  const arena=createArenaServer();await new Promise<void>(resolve=>arena.http.listen(0,'127.0.0.1',resolve));
  const address=arena.http.address();assert.ok(address&&typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}`,clients:Socket[]=[];
  const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false,forceNew:true});clients.push(s);await next(s,'connect');return s;};
  try{
    const a=await connect(),b=await connect();
    const joinedA=next<Joined>(a,'joined');a.emit('createRoom',{name:'ALPHA'});const host=await joinedA;
    assert.match(host.code,/^[0-9A-F]{6}$/);assert.equal(host.index,0);
    const joinedB=next<Joined>(b,'joined');b.emit('joinRoom',{code:host.code,name:'BRAVO'});const guest=await joinedB;assert.equal(guest.index,1);
    const outsider=await connect(),denied=next<string>(outsider,'roomError');outsider.emit('joinRoom',{code:host.code});assert.match(await denied,/two fighters/);
    const roomReady=next<Room>(a,'room',r=>!!r.match);a.emit('ready');b.emit('ready');assert.equal((await roomReady).match?.phase,'countdown');
    const live=next<Match>(a,'state',m=>m.phase==='fight'&&m.fighters[1].x-m.fighters[0].x<145);await live;
    const damage=next<Match>(b,'state',m=>m.fighters[1].hp<100);a.emit('action',{action:'jab',damage:100000});
    for(let i=0;i<10;i++)a.emit('action',{action:'hook',damage:100000});const hit=await damage;assert.equal(hit.fighters[1].hp,94);
    const moved=next<Match>(a,'state',m=>m.fighters[0].x<hit.fighters[0].x-5);a.emit('movement',-1);assert.ok((await moved).fighters[0].x<hit.fighters[0].x-5);a.emit('movement',0);
    outsider.emit('action',{action:'cross'});const unchanged=await next<Match>(a,'state');assert.equal(unchanged.fighters[0].hp,100);
    const paused=next<Room>(a,'room',r=>r.paused);b.disconnect();assert.equal((await paused).paused,true);
    const before=await next<Match>(a,'state'),after=await next<Match>(a,'state');assert.equal(before.tick,after.tick);
    const replacement=await connect();const restored=next<Joined>(replacement,'joined');replacement.emit('joinRoom',{code:guest.code,token:guest.token});assert.equal((await restored).index,1);
    const resumed=await next<Match>(a,'state',m=>m.tick>after.tick);assert.ok(resumed.tick>after.tick);
    // Put the authoritative state one hit from a knockout; clients still submit only an action.
    const room=arena.rooms.get(host.code)!;room.match!.fighters[1].hp=1;room.match!.fighters[0].action='idle';room.match!.fighters[0].cooldown=0;room.match!.hitstop=0;
    const knockout=next<Match>(a,'state',m=>m.phase==='finished');a.emit('action',{action:'cross'});assert.equal((await knockout).winner,0);
    const rematch=next<Room>(a,'room',r=>r.match?.phase==='countdown');a.emit('ready');replacement.emit('ready');assert.equal((await rematch).match?.fighters[0].hp,100);
    const departure=next<Room>(a,'room',r=>r.match?.phase==='finished');replacement.emit('leaveRoom');assert.equal((await departure).match?.reason,'Opponent left');
  }finally{clients.forEach(s=>s.disconnect());await arena.close();}
});
