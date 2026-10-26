'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Exercise the production renderer with an instrumented canvas. Pixel topology
// and real UI/save/offline checks live in the headless journey, not this mock.
const context={window:{FARM_VERSION_QUERY:''},Image:class{constructor(){this.complete=true;this.naturalWidth=96;}},setInterval(){},Date,Math,Number,document:{}};
vm.runInNewContext(fs.readFileSync('src/content-r8.js','utf8'),context);
let count=0;
for(const id of ['river_carp','silver_dace','river_perch'])for(const revealed of [false,true])for(const elapsed of [0,180,720,1440]){
 const draws=[],canvas={dataset:{},getContext:()=>({clearRect(){},drawImage(...a){draws.push(a);},getImageData:()=>({data:new Uint8ClampedArray(128*112*4)}),putImageData(){}})},stage={dataset:{rhythm:id,blind:'true',result:'perfect',revealed:String(revealed),elapsed:String(elapsed)},style:{setProperty(){}},clientWidth:366,clientHeight:230,querySelector:s=>s==='canvas'?canvas:null};
 context.window.ContentR8.drawWater(stage,{canReel:true,pose:'strike',motion:'wide-swell',index:2});
 assert.equal(canvas.dataset.generatedWater,id+'-2');assert.deepEqual(draws.at(-1).slice(1),[4,-8,120,90]);count++;
}
console.log('VERIFIED R20 '+count+' frozen answer renders retain the expanded evidence frame');
