const L=require('../logic.js'),a=require('assert');
a.equal(L.nextIndex(2,3,'all'),0);a.equal(L.nextIndex(2,3,'off'),-1);a.equal(L.nextIndex(1,3,'one'),1);
a.equal(L.cue('ok go now'),'again');a.equal(L.cue('please stop'),'stop');a.equal(L.cue('hello'),null);
a.equal(L.buildTree([{path:'A/B/x.mp3'},{path:'y.mp3'}]).dirs.A.dirs.B.songs.length,1);
a.deepEqual(L.move([1,2,3],0,1),[2,1,3]);a.deepEqual(L.clampAB(5,5,10),[5,5.5]);
// queue follows playlist order, not folders
const pl=['f1/a','f2/x','f1/b','f3/y','f2/z','f1/c','f3/w','f2/v'];
let q=L.makeQueue({type:'pl',name:'P'},pl,2,false);
a.equal(q.list[q.qi],'f1/b');L.stepQueue(q,1,'off');a.equal(q.list[q.qi],'f3/y');L.stepQueue(q,-1,'off');a.equal(q.list[q.qi],'f1/b');
q.qi=7;a.equal(L.stepQueue(q,1,'off',true),-1);a.equal(L.stepQueue(q,1,'all',true),0);a.equal(q.list[q.qi],'f1/a');
a.equal(L.stepQueue(q,1,'one',true),0);a.equal(L.stepQueue(q,1,'one',false),1);
// duplicates and missing songs keep the tapped position
q=L.makeQueue({},['a','gone','b','a'],3,false,id=>id!=='gone');a.deepEqual(q.list,['a','b','a']);a.equal(q.qi,2);
// shuffle: starts with tapped song, is a permutation of the playlist, off restores playlist order at current song
let seed=1;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
q=L.makeQueue({},pl,4,true,undefined,rnd);a.equal(q.list[0],'f2/z');a.deepEqual(q.list.slice().sort(),pl.slice().sort());
L.stepQueue(q,1,'off');L.stepQueue(q,1,'off');const c=q.list[q.qi];L.setShuffle(q,false);a.deepEqual(q.list,pl);a.equal(q.list[q.qi],c);
L.setShuffle(q,true,rnd);a.equal(q.list[q.qi],c);L.setShuffle(q,true,rnd);a.equal(q.list[q.qi],c);L.setShuffle(q,false);a.equal(q.list[q.qi],c);a.deepEqual(q.list,pl);
console.log('logic tests ok');
a.equal(L.textOn('#22c55e'),'#000000');a.equal(L.textOn('#1e3a8a'),'#ffffff');a.equal(L.textOn('#ffffff'),'#000000');a.equal(L.normHex('#ABC'),'#aabbcc');a.equal(L.normHex('red'),null);a.equal(L.PRESETS.length,8);
console.log('color tests ok');
a.equal(L.cue('Again!'),'again');a.equal(L.cue('REPEAT'),'again');a.equal(L.cue('Stop.'),'stop');a.equal(L.cue('yes'),'again');a.equal(L.cue('going'),null);
console.log('cue tests ok');
a.deepEqual(L.editorWindow(5,20,100,10,10),[0,30]);a.deepEqual(L.editorWindow(50,95,100,10,10),[40,100]);
a.deepEqual(L.dragHandle('A',-3.4,5,20,100),[0,20]);a.deepEqual(L.dragHandle('A',19.7,5,20,100),[19,20]);a.deepEqual(L.dragHandle('A',7.4,5,20,100),[7,20]);
a.deepEqual(L.dragHandle('B',2,5,20,100),[5,6]);a.deepEqual(L.dragHandle('B',140,5,20,100),[5,100]);a.deepEqual(L.dragHandle('B',30.6,5,20,100),[5,31]);
console.log('editor tests ok');
// v13: playlist reorder/remove while it is the active queue
{const ids=['a','b','c','d','e'];let q=L.makeQueue({type:'pl',id:'p'},ids,2,false);a.equal(q.list[q.qi],'c');
 L.plMove(q,0,4);a.deepEqual(q.list,['b','c','d','e','a']);a.equal(q.list[q.qi],'c');a.equal(q.qi,1);
 L.plMove(q,1,0);a.deepEqual(q.list,['c','b','d','e','a']);a.equal(q.qi,0);
 L.plRemove(q,3);a.deepEqual(q.list,['c','b','d','a']);a.equal(q.list[q.qi],'c');
 L.plRemove(q,0);a.equal(q.list[q.qi],'c','playing song kept');L.stepQueue(q,1,'off');a.equal(q.list[q.qi],'b');a.deepEqual(q.list,['b','d','a']);
 q=L.makeQueue({},['a','b','c','d'],2,false);L.plRemove(q,2);L.stepQueue(q,-1,'off');a.equal(q.list[q.qi],'b');a.deepEqual(q.list,['a','b','d']);
 q=L.makeQueue({},['a','b','c','d'],1,false);L.plRemove(q,1);L.plMove(q,2,0);L.stepQueue(q,1,'off');a.deepEqual(q.list,['d','a','c']);
 let seed=3;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
 q=L.makeQueue({},['a','b','c','d','e'],1,true,undefined,rnd);const sh=q.list.slice();L.plMove(q,4,0);a.deepEqual(q.list,sh,'shuffle order kept');
 L.setShuffle(q,false);a.deepEqual(q.list,['e','a','b','c','d']);a.equal(q.list[q.qi],'b');
 const old={ctx:{},order:['x','y'],list:['y','x'],qi:0,shuffle:true,pos:[1,0]};L.upgradeQueue(old);a.deepEqual(old.list,['y','x']);L.setShuffle(old,false);a.deepEqual(old.list,['x','y']);a.equal(old.list[old.qi],'y');}
console.log('playlist edit tests ok');
