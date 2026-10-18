import { act, isAttack, type Match, type Difficulty, type Action } from './combat.js';
const PROFILES = {
  easy: { delay: 66, reaction: 22, defense: .12, combo: .08 },
  medium: { delay: 36, reaction: 12, defense: .42, combo: .35 },
  hard: { delay: 19, reaction: 5, defense: .72, combo: .65 },
};
export class Bot {
  private next = 0; private release = 0; private sequence = 0; private seed: number;
  constructor(public difficulty: Difficulty, seed = 42) { this.seed = seed; }
  private random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  update(m: Match, index = 1) {
    if (m.phase !== 'fight') return;
    const f = m.fighters[index], opponent = m.fighters[1-index], p = PROFILES[this.difficulty];
    if (m.tick >= this.release) act(m,index,'block',false);
    if (f.action !== 'idle' || m.tick < this.next) return;
    if (isAttack(opponent.action) && opponent.age >= p.reaction && this.random() < p.defense) {
      const defense: Action = opponent.action === 'hook' ? 'duck' : this.random() < .65 ? 'block' : 'dodgeLeft';
      act(m,index,defense); this.release = m.tick+24; this.next = m.tick + p.delay; return;
    }
    if (Math.abs(f.x-opponent.x) > 175) return;
    const pattern: Action[] = this.difficulty === 'easy' ? ['jab','jab','cross'] : ['jab','cross','hook','cross'];
    const attack = this.difficulty === 'hard' && opponent.action === 'block' ? 'hook' : pattern[this.sequence++ % pattern.length];
    act(m,index,attack);
    this.next = m.tick + (this.random() < p.combo ? 27 : p.delay + 25 + Math.floor(this.random()*30));
  }
}
