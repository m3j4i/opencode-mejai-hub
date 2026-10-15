// Compatibility entry point: the Windows and Linux launchers share preparation.
import {prepare} from './mejai-controller.mjs';
try { const result=await prepare(); console.log(JSON.stringify({ready:true,configFile:result.configFile})); }
catch(error){console.error(error.message);process.exitCode=1;}
