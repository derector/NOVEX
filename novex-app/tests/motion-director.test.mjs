import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionDirector} from '../src/motion-director.js';

test('Motion Director compiles scene sequences with deterministic transition state',()=>{
 const M=createMotionDirector({duration:5,fps:30});
 const seq=M.seq([{id:'one',duration:2},{id:'two',duration:2}],{transition:.25});
 assert.equal(seq.length,2);
 assert.equal(seq[0].start,0);
 assert.equal(seq[1].start,1.75);
 assert.equal(M.renderAt(1).scenes[0].target,'one');
 assert.equal(M.renderAt(1.8).scenes.length,2);
 assert.equal(M.check().ok,true);
});

test('M.start and timeline hooks evaluate at arbitrary frame times',()=>{
 const M=createMotionDirector({duration:3,fps:30});
 M.start(({tl})=>tl.fromTo('#card',{opacity:0,x:20},{opacity:1,x:0,duration:1,ease:'linear'},0));
 const frame=M.renderAt(.5);
 assert.equal(frame.elements['#card'].opacity,.5);
 assert.equal(frame.elements['#card'].x,10);
 assert.equal(M.seekFrame(15).elements['#card'].opacity,.5);
});

test('text, count and drawing cues are represented in the frame output',()=>{
 const M=createMotionDirector({duration:3,fps:30});
 M.text('#headline',{at:0,dur:1,in:'blur',by:'words'});
 M.count('#counter',{at:0,dur:1,from:0,to:100});
 M.draw.ring('#counter',{at:.25,duration:.5,color:'#ff5c7a'});
 const frame=M.renderAt(.5);
 assert.equal(frame.elements['#counter'].value,75);
 assert.ok(frame.effects.some(x=>x.type==='text-in'&&x.progress===.5));
 assert.ok(frame.effects.some(x=>x.type==='draw-ring'));
});

test('audio cues, captions, float and shake are timestamp deterministic',()=>{
 const M=createMotionDirector({duration:4,fps:30});
 M.hit(.5,'l').captions([{w:'hello',s:.25,e:.8}]).float('#card',{at:0,duration:2,period:2}).shake('#card',{at:0,duration:1});
 const frame=M.renderAt(.5);
 assert.equal(frame.audioEvents[0].name,'impact-large');
 assert.ok(frame.effects.some(x=>x.type==='caption'&&x.text==='hello'));
 assert.equal(typeof frame.elements['#card'].y,'number');
 assert.equal(typeof frame.elements['#card'].x,'number');
});

test('M.onFrame derives deterministic per-frame hook values',()=>{
 const M=createMotionDirector({duration:2,fps:30});
 M.onFrame(frame=>({beat:Math.max(0,Math.sin(frame.time*Math.PI*2))}));
 assert.equal(M.renderAt(0).beat,0);
 assert.ok(M.renderAt(.25).beat>.99);
});
