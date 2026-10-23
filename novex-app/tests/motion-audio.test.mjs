import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeSfxWav} from '../src/motion-audio.js';

test('procedural SFX exports a valid deterministic PCM WAV container',()=>{
 const cues=[{name:'impact-large',at:.2,duration:.35,gain:-3},{name:'tick',at:.7,duration:.08,gain:-8}];
 const a=synthesizeSfxWav(cues,1,{sampleRate:8000});
 const b=synthesizeSfxWav(cues,1,{sampleRate:8000});
 assert.equal(a.length,44+8000*2);
 assert.equal(String.fromCharCode(...a.slice(0,4)),'RIFF');
 assert.equal(String.fromCharCode(...a.slice(8,12)),'WAVE');
 assert.equal(String.fromCharCode(...a.slice(36,40)),'data');
 assert.deepEqual(a,b);
});

test('empty SFX schedule creates a correctly sized silent WAV',()=>{
 const bytes=synthesizeSfxWav([],0.5,{sampleRate:8000});
 assert.equal(bytes.length,44+4000*2);
 const pcm=bytes.slice(44);
 assert.ok(pcm.every(v=>v===0));
});
