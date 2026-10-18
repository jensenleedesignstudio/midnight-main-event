import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
rmSync('.test-build',{recursive:true,force:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','shared/combat.ts','shared/ai.ts','src/motion/gestures.ts','--outDir','.test-build','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--skipLibCheck','--strict'],{stdio:'inherit'});
execFileSync(process.execPath,['--test','tests/combat.test.mjs','tests/gestures.test.mjs'],{stdio:'inherit'});
