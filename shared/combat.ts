/** Fixed-step, serializable combat rules shared by the client and authoritative server. */
export type Action = 'jab' | 'cross' | 'hook' | 'block' | 'dodgeLeft' | 'dodgeRight' | 'duck';
export type Attack = 'jab' | 'cross' | 'hook';
export type Difficulty = 'easy' | 'medium' | 'hard';
export const ACTIONS: Action[] = ['jab','cross','hook','block','dodgeLeft','dodgeRight','duck'];
export const FPS = 60;
export const ATTACKS = {
  jab: { startup: 7, active: 5, recovery: 15, damage: 6, range: 158 },
  cross: { startup: 13, active: 6, recovery: 23, damage: 11, range: 171 },
  hook: { startup: 19, active: 7, recovery: 30, damage: 16, range: 148 },
};
export type Movement = -1 | 0 | 1;
export interface Fighter { x: number; hp: number; guard: number; guardBroken: boolean; action: Action | 'idle' | 'hurt' | 'dazed'; age: number; cooldown: number; hit: boolean; blockHeld: boolean; movement: Movement; hits: number; damage: number; }
export interface HitEvent { id: number; x: number; target: number; kind: 'hit' | 'block' | 'parry' | 'miss'; damage: number; tick: number; }
export interface Match { fighters: [Fighter, Fighter]; tick: number; remaining: number; phase: 'countdown' | 'fight' | 'finished'; countdown: number; winner: number | null; reason: string; hitstop: number; events: HitEvent[]; eventId: number; }
export function createMatch(): Match {
  const fighter = (x: number): Fighter => ({ x, hp: 100, guard: 100, guardBroken: false, action: 'idle', age: 0, cooldown: 0, hit: false, blockHeld: false, movement: 0, hits: 0, damage: 0 });
  return { fighters: [fighter(300), fighter(700)], tick: 0, remaining: 90 * FPS, phase: 'countdown', countdown: 3 * FPS, winner: null, reason: '', hitstop: 0, events: [], eventId: 0 };
}
export function isAttack(action: string): action is Attack { return action in ATTACKS; }
export function move(m: Match, index: number, direction: Movement): boolean {
  const f=m.fighters[index];
  if(!f || (direction!==-1 && direction!==0 && direction!==1))return false;
  f.movement=m.phase==='fight'?direction:0;
  return true;
}
export function act(m: Match, index: number, action: Action, held = true): boolean {
  const f = m.fighters[index];
  if (!f || !ACTIONS.includes(action)) return false;
  if (action === 'block' && !held) { f.blockHeld = false; if (f.action === 'block') { f.action = 'idle'; f.age = 0; } return true; }
  if (m.phase !== 'fight' || m.hitstop > 0) return false;
  if (action === 'block') { if(f.guardBroken || f.guard<20)return false; f.blockHeld = true; if (f.action === 'block') return true; }
  if (f.action !== 'idle' || f.cooldown > 0) return false;
  f.action = action; f.age = 0; f.hit = false;
  return true;
}
export function finish(m: Match, winner: number | null, reason: string) { m.phase = 'finished'; m.winner = winner; m.reason = reason; }
export function step(m: Match): void {
  if (m.phase === 'finished') return;
  m.tick++;
  if (m.phase === 'countdown') { if (--m.countdown <= 0) m.phase = 'fight'; return; }
  if (--m.remaining <= 0) { finish(m, m.fighters[0].hp === m.fighters[1].hp ? null : m.fighters[0].hp > m.fighters[1].hp ? 0 : 1, 'Time decision'); return; }
  if (m.hitstop > 0) { m.hitstop--; return; }
  for (const f of m.fighters) {
    f.age++; f.cooldown = Math.max(0, f.cooldown - 1);
    if(f.action==='block'){
      f.guard=Math.max(0,f.guard-.8);
      if(f.guard===0){f.action='idle';f.age=0;f.blockHeld=false;f.guardBroken=true;f.cooldown=24;}
    }else f.guard=Math.min(100,f.guard+.42);
    if(f.guardBroken && f.guard>=45)f.guardBroken=false;
    const duration = isAttack(f.action) ? ATTACKS[f.action].startup + ATTACKS[f.action].active + ATTACKS[f.action].recovery : f.action === 'dazed' ? 48 : f.action === 'hurt' ? 14 : f.action === 'duck' ? 32 : 27;
    if (f.action !== 'idle' && f.action !== 'block' && f.age >= duration) { const defended = !isAttack(f.action) && f.action !== 'hurt'; f.action = 'idle'; f.age = 0; if (defended) f.cooldown = 22; }
    if (f.action === 'idle' && f.blockHeld && !f.guardBroken && f.guard>=20 && f.cooldown === 0) { f.action = 'block'; f.age = 0; }
  }
  // Camera body movement takes priority over automatic approach.
  for(let i=0;i<2;i++){
    const f=m.fighters[i],opponent=m.fighters[1-i],facing=i===0?1:-1;
    const canMove=f.action==='idle'||f.action==='block'||f.action==='dodgeLeft'||f.action==='dodgeRight';
    const direction=canMove?f.movement:0;
    if(direction){
      const next=f.x+facing*direction*3;
      f.x=i===0?Math.max(130,Math.min(opponent.x-80,next)):Math.min(870,Math.max(opponent.x+80,next));
    }else if((f.action==='idle'||f.action==='block') && opponent.x-f.x>135 && i===0){
      f.x+=Math.min(1.7,(opponent.x-f.x-135)/2);
    }else if((f.action==='idle'||f.action==='block') && f.x-opponent.x>135 && i===1){
      f.x-=Math.min(1.7,(f.x-opponent.x-135)/2);
    }
  }
  for (let i = 0; i < 2; i++) {
    const f = m.fighters[i], t = m.fighters[1-i];
    if (!isAttack(f.action)) continue;
    const a = ATTACKS[f.action];
    if (f.hit || f.age < a.startup || f.age >= a.startup + a.active) continue;
    f.hit = true;
    const dodge = (t.action === 'dodgeLeft' || t.action === 'dodgeRight') && t.age >= 3 && t.age <= 20 && f.action !== 'hook';
    const duck = t.action === 'duck' && t.age >= 4 && t.age <= 27 && f.action !== 'jab';
    const missed = Math.abs(f.x - t.x) > a.range || dodge || duck;
    const blocked = t.action === 'block';
    const parried = !missed && blocked && t.age<=12;
    const damage = missed || parried ? 0 : blocked ? Math.ceil(a.damage * 0.2) : a.damage;
    m.events.push({ id: ++m.eventId, x: t.x, target: 1-i, kind: missed ? 'miss' : parried ? 'parry' : blocked ? 'block' : 'hit', damage, tick: m.tick });
    m.events = m.events.slice(-12);
    if (!missed) {
      t.hp = Math.max(0, t.hp-damage); f.damage += damage;if(!parried)f.hits++;
      t.x = Math.max(130, Math.min(870, t.x + (i === 0 ? 1 : -1) * (blocked ? 6 : 18)));
      m.hitstop = parried ? 7 : blocked ? 2 : 5;
      if(parried){t.guard=Math.max(0,t.guard-3);f.action='dazed';f.age=0;f.blockHeld=false;}
      else if(blocked)t.guard=Math.max(0,t.guard-9);
      else { t.action = 'hurt'; t.age = 0; }
      if (t.hp <= 0) { finish(m, i, 'Knockout'); return; }
    }
  }
}
export const LABELS: Record<Action | 'idle' | 'hurt' | 'dazed', string> = { jab:'Jab', cross:'Cross', hook:'Hook', block:'Guard up', dodgeLeft:'Slip left', dodgeRight:'Slip right', duck:'Duck', idle:'In stance', hurt:'Hit!', dazed:'Dazed!' };
