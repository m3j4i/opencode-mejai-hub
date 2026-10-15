import {releaseInfo,update} from './mejai-controller.mjs';
try{const mode=process.argv[2];if(!['check','update','rollback'].includes(mode))throw Error('Choose check, update or rollback.');console.log(JSON.stringify(mode==='check'?await releaseInfo():await update(mode==='rollback'),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
