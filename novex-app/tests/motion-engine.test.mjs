import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionEngine,motionEasings,motionHooks} from '../src/motion-engine.js';

test('motion timeline is deterministic at arbitrary seek timestamps',()=>{
 const engine=createMotionEngine({duration:4,fps:30});
 engine.track('x',{start:1,duration:2,from:0,to:100,ease:'linear'});
 assert.equal(engine.sampleAt(0).x,undefined);
 assert.equal(engine.sampleAt(2).x,50);
 assert.equal(engine.sampleAt(4).x,100);
 assert.equal(engine.seekFrame(60).x,50);
 assert.equal(engine.sampleAt(2).x,50);
});

test('motion hooks can add derived animation channels without wall-clock timers',()=>{
 const engine=createMotionEngine({duration:3,fps:30});
 engine.track('opacity',{start:0,duration:1,from:0,to:1,ease:'power2Out'});
 engine.hook('frame',({time})=>({beatPulse:Math.max(0,Math.sin(time*Math.PI*2))}));
 assert.equal(engine.sampleAt(.5).opacity,.75);
 assert.ok(engine.sampleAt(.5).beatPulse>=0);
 assert.equal(engine.sampleAt(0).beatPulse,0);
});

test('motion timeline rejects unknown easings and invalid durations',()=>{
 const engine=createMotionEngine();
 assert.throws(()=>engine.track('x',{duration:0}),/duration must be positive/);
 assert.throws(()=>engine.track('x',{ease:'random'}),/Unknown motion easing/);
});

test('motion presets expose reusable enter, exit, sway and shake hooks',()=>{
 assert.equal(motionHooks.enter().to.opacity,1);
 assert.equal(motionHooks.exit().to.opacity,0);
 assert.equal(typeof motionHooks.sway()({time:.5}).rotationY,'number');
 assert.equal(typeof motionHooks.shake()({time:.5}).x,'number');
 assert.ok(motionEasings.expoOut(.5)>.5);
});

test('cinematic easing presets have stable endpoints',()=>{ assert.equal(motionEasings.glide(0),0); assert.equal(motionEasings.glide(1),1); assert.equal(motionEasings.elasticOut(1),1); assert.equal(motionEasings.circOut(1),1); assert.equal(motionEasings.bounceOut(1),1); });
