'use strict';
// Test evidence only: exclusive held-fd exact write -> fsync -> close -> readback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function errorData(error){return {name:error?.name??'Error',message:error?.message??String(error),stack:error?.stack??null,code:error?.code??null,isNativeDomException:typeof DOMException!=='undefined'&&error instanceof DOMException};}
function preservedOriginalError(callerError,diagnostic,phase){
 const browser=diagnostic?.firstFatal?.error??null;
 if(phase==='native-finish'&&browser)return {origin:'browser:firstFatal.error',value:{name:browser.name,message:browser.message,stack:browser.stack??null,code:browser.code??null,isNativeDomException:browser.isNativeDomException===true}};
 return {origin:'node:caller',value:errorData(callerError)};
}
function readbackEnvelope(file,expectedSha256,expectedBytes){
 const bytes=fs.readFileSync(file),actualSha256=sha(bytes);
 if(actualSha256!==expectedSha256||expectedBytes!==undefined&&bytes.length!==expectedBytes){const error=new Error('Durable envelope readback does not match exact written bytes');error.code='ENVELOPE_READBACK_SHA_MISMATCH';error.expectedSha256=expectedSha256;error.actualSha256=actualSha256;error.expectedBytes=expectedBytes??null;error.actualBytes=bytes.length;throw error;}
 return {path:file,sha256:actualSha256,bytes:bytes.length,readbackVerified:true,readbackNodeMs:Date.now()};
}
function writeExclusiveDurable(file,exactBytes){
 const bytes=Buffer.isBuffer(exactBytes)?exactBytes:Buffer.from(exactBytes),expectedSha256=sha(bytes);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL);let primaryError=null,written=0,fsyncNodeMs=null,closedNodeMs=null;
 try{
  while(written<bytes.length){const count=fs.writeSync(fd,bytes,written,bytes.length-written,null);if(count<=0){const error=new Error('Envelope write made no progress');error.code='ENVELOPE_WRITE_NO_PROGRESS';throw error;}written+=count;}
  fs.fsyncSync(fd);fsyncNodeMs=Date.now();
 }catch(error){primaryError=error;throw error;}
 finally{try{fs.closeSync(fd);closedNodeMs=Date.now();}catch(error){if(primaryError)primaryError.envelopeCloseError=errorData(error);else throw error;}}
 const verified=readbackEnvelope(file,expectedSha256,bytes.length);
 return {...verified,exclusiveOpen:true,exactBytesWritten:written,fsyncCompleted:true,fsyncNodeMs,fdClosed:true,closedNodeMs,meaning:'O_EXCL held-fd exact write, successful fsync/close and byte-count+SHA readback; no power-loss guarantee beyond the OS fsync contract.'};
}
module.exports={writeExclusiveDurable,readbackEnvelope,errorData,preservedOriginalError};
