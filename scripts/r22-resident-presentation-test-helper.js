'use strict';
// Shared by the real R20 capture caller and the product-helper inert driver.
function assertResidentPresentation(state){
 if(state&&['ready','not-applicable'].includes(state.status))return;
 const original=state?.errors?.find(row=>row.error)?.error||{name:'ResidentPresentationError',message:'Required resident presentation is '+(state?.status||'missing'),stack:null,code:'RESIDENT_PRESENTATION_NOT_READY',isNativeDomException:false};
 const error=new Error(original.message);error.name=original.name;error.code=original.code??'RESIDENT_PRESENTATION_NOT_READY';error.productOriginalError={name:original.name,message:original.message,stack:original.stack??null,code:original.code??null,isNativeDomException:original.isNativeDomException===true};error.productPresentationState=state??null;throw error;
}
module.exports={assertResidentPresentation};
