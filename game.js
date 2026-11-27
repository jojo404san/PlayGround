import * as THREE from 'three';

const canvas = document.getElementById('game');
const $ = id => document.getElementById(id);
const titleScreen = $('title-screen'), gameScreen = $('game-screen'), endScreen = $('end-screen');
const survivorFloors=[4,8,13,18,23,27];
const survivorNames=['Mara · nurse','Eli · maintenance','June · student','Rafi · cook','Tomas · courier','Nia · engineer'];

let renderer, scene, camera, clock, player, zombies=[], pickups=[], survivors=[], rescued=[], floor=1, ammo=9, reserve=36, health=100;
let playing=false, yaw=0, pitch=0, keys={}, recoil=0, fireCooldown=0, interactCooldown=0, reloadTimer=0, elapsed=0;
let stair, extraction, floorGroup, mobileLook=false, lookOrigin={x:0,y:0};
let audioContext, muzzleFlash, flashTimer=0, walkPhase=0, bobPhase=0, moveVelocity=new THREE.Vector3();

const C={floor:0x171b18,wall:0x303831,edge:0x697168,green:0xd5fa70,orange:0xf18a5d,metal:0x9aa59c};

function mat(color,rough=0.85){return new THREE.MeshStandardMaterial({color,roughness:rough,flatShading:true});}
function box(parent,size,pos,color,rough=0.85){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(color,rough));m.position.set(...pos);m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;}
function setToast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(setToast.timer);setToast.timer=setTimeout(()=>t.classList.remove('show'),2200);}

function makeScene(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x242a26);scene.fog=new THREE.FogExp2(0x242a26,.012);
  camera=new THREE.PerspectiveCamera(68,canvas.clientWidth/canvas.clientHeight,.05,90);camera.rotation.order='YXZ';scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xdce9d5,0x596052,1.7));
  const ambient=new THREE.AmbientLight(0xffffff,.38);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffedcf,1.15);key.position.set(-5,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  buildWeapon();clock=new THREE.Clock();
}

function buildWeapon(){
  const gun=new THREE.Group();gun.position.set(.34,-.31,-.62);gun.rotation.set(-.08,-.08,-.04);camera.add(gun);
  const dark=mat(0x252b2a,.42),metal=mat(0x69716d,.35);
  box(gun,[.16,.16,.34],[0,0,0],dark);box(gun,[.135,.19,.28],[0,.105,-.015],metal);
  box(gun,[.12,.22,.11],[0,-.17,.055],dark).rotation.x=-.12;box(gun,[.12,.045,.18],[0,.19,-.04],dark);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.2,8),metal);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.1,-.22);gun.add(barrel);
  const flashMat=new THREE.MeshBasicMaterial({color:0xffe7a0,transparent:true,opacity:.95});muzzleFlash=new THREE.Mesh(new THREE.ConeGeometry(.12,.38,7),flashMat);muzzleFlash.rotation.x=-Math.PI/2;muzzleFlash.position.set(0,.1,-.48);muzzleFlash.visible=false;gun.add(muzzleFlash);
  const glow=new THREE.PointLight(0xffb84a,0,3);glow.position.copy(muzzleFlash.position);gun.add(glow);muzzleFlash.userData.light=glow;camera.userData.gun=gun;
}

function clearFloor(){if(floorGroup)scene.remove(floorGroup);floorGroup=new THREE.Group();scene.add(floorGroup);zombies=[];pickups=[];survivors=[];}
function buildFloor(){
  clearFloor();
  const g=floorGroup;
  box(g,[24,.15,24],[0,-.08,0],C.floor);
  box(g,[24,4,.2],[0,2,-12],C.wall);box(g,[24,4,.2],[0,2,12],C.wall);
  box(g,[.2,4,24],[-12,2,0],C.wall);box(g,[.2,4,24],[12,2,0],C.wall);
  // Central corridor with fluorescent emergency lights.
  box(g,[24,.05,3],[0,.02,0],0x252b27);
  for(let z=-10;z<=10;z+=4){const lamp=box(g,[2.2,.06,.18],[0,3.86,z],0xe8f2d9);lamp.material.emissive=new THREE.Color(0xd7e9ae);lamp.material.emissiveIntensity=.8;const glow=new THREE.PointLight(0xffedc8,4.2,9,1.8);glow.position.set(0,3.25,z);g.add(glow);}
  // Seven rooms: three north, four south, each dressed as a lived-in space.
  const rooms=[[-7,0,-7,5,4,8],[0,0,-7,5,4,8],[7,0,-7,5,4,8],[-8.5,0,7,4,4,7],[-3.5,0,7,4,4,7],[3,0,7,4,4,7],[8.5,0,7,3.5,4,7]];
  rooms.forEach((r,i)=>{const[x,y,z,w,h,d]=r;box(g,[w,.12,d],[x,.01,z],i%2?0x30332e:0x35352e);if(i<3){const doorW=1.65,front=z+d/2;box(g,[(w-doorW)/2,3.8,.18],[x-(w+doorW)/4,2,front],0x65675c);box(g,[(w-doorW)/2,3.8,.18],[x+(w+doorW)/4,2,front],0x65675c);box(g,[.18,3.8,d],[x-w/2,2,z],C.wall);box(g,[.18,3.8,d],[x+w/2,2,z],C.wall);}else{const doorW=1.65,front=z-d/2;box(g,[(w-doorW)/2,3.8,.18],[x-(w+doorW)/4,2,front],0x65675c);box(g,[(w-doorW)/2,3.8,.18],[x+(w+doorW)/4,2,front],0x65675c);box(g,[.18,3.8,d],[x-w/2,2,z],C.wall);box(g,[.18,3.8,d],[x+w/2,2,z],C.wall);}addRoomProps(g,x,z,i);});
  // Rooftop or east stair marker.
  if(floor===30){extraction=new THREE.Vector3(0,0,-9.5);box(g,[5,.08,3],[0,.02,-9.5],0x5d7048);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,.07,6,24),new THREE.MeshBasicMaterial({color:C.green}));ring.rotation.x=Math.PI/2;ring.position.set(0,.12,-9.5);g.add(ring);}else{stair=new THREE.Vector3(10.8,0,0);box(g,[1.8,3.2,.45],[11,1.6,0],0x26322a);box(g,[.12,3.2,2],[10.85,1.6,0],C.green);}
  const count=floor===30?0:Math.min(3+Math.floor(floor/7),7);
  for(let i=0;i<count;i++)makeZombie(randomInRoom(i));
  if(Math.random()<.65&&floor<30)makePickup(randomInRoom(99));
  if(survivorFloors.includes(floor)&&!rescued.includes(survivorFloors.indexOf(floor))){makeSurvivor(survivorFloors.indexOf(floor),randomInRoom(survivorFloors.indexOf(floor)*3+1));}
  updateHUD();setToast(floor===30?'ROOFTOP — EXTRACTION ZONE':'FLOOR '+String(floor).padStart(2,'0')+' — SWEEP IN PROGRESS');
}

function addRoomProps(parent,x,z,index){
  const wood=[0x554b3d,0x625441,0x4c5149][index%3], cushion=[0x697565,0x766957,0x4b5c53][index%3];
  // Desk or side table with legs, clutter and a small pool of warm light.
  const tableX=x+(index%2?-.7:.7),tableZ=z+(index<3?1.7:-1.6);
  box(parent,[1.45,.12,.72],[tableX,.85,tableZ],wood);for(const dx of [-.61,.61])for(const dz of [-.26,.26])box(parent,[.09,.82,.09],[tableX+dx,.41,tableZ+dz],0x383a34);
  box(parent,[.28,.045,.36],[tableX-.2,.94,tableZ],0xa0a28e);box(parent,[.12,.16,.12],[tableX+.38,.98,tableZ-.12],0x4b6255);
  // Scattered chairs and a low couch/bed against the far wall.
  const seatX=x+(index%2?1.2:-1.15),seatZ=z+(index<3?-2.45:2.2);
  box(parent,[.82,.18,.72],[seatX,.58,seatZ],cushion);box(parent,[.82,.52,.16],[seatX,.84,seatZ+(index<3?-.28:.28)],wood);
  for(const dx of [-.32,.32])for(const dz of [-.25,.25])box(parent,[.07,.48,.07],[seatX+dx,.27,seatZ+dz],0x3c4039);
  // Tall filing cabinet, wall-mounted emergency sign and ceiling lamp.
  const cabX=x+(index%2?1.7:-1.7),cabZ=z+(index<3?-.45:.35);
  box(parent,[.55,1.55,.48],[cabX,.78,cabZ],0x59645f);box(parent,[.48,.05,.035],[cabX,.96,cabZ+.25],0x818b80);box(parent,[.48,.05,.035],[cabX,.48,cabZ+.25],0x818b80);
  const sign=box(parent,[.55,.26,.055],[x,2.65,index<3?z+3.86:z-3.36],index%2?0x426e57:0x8c583f);sign.material.emissive=new THREE.Color(index%2?0x1d5831:0x622816);sign.material.emissiveIntensity=.45;
  const fixture=box(parent,[1.1,.07,.45],[x,3.8,z],0xf4eccd);fixture.material.emissive=new THREE.Color(0xffe6a0);fixture.material.emissiveIntensity=.75;
  const light=new THREE.PointLight(index%2?0xd9edff:0xffd49b,2.6,7,1.7);light.position.set(x,3.15,z);parent.add(light);
  if(index%3===0){box(parent,[.22,.55,.22],[x-1.6,.3,z-.5],0x485a42);for(let n=0;n<3;n++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.18,.48,5),mat(0x536e48));leaf.position.set(x-1.6,.78+n*.1,z-.5);parent.add(leaf);}}
  if(index%2===0){const spill=box(parent,[.55,.06,.75],[x+(index?-.9:.9),.055,z+(index<3?-.9:.8)],0x5c493b);spill.rotation.y=.3;}
}
function ellipsoid(parent,size,pos,color,rough=.86){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,9,7),mat(color,rough));mesh.scale.set(...size);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function makeZombie(pos){
  const g=new THREE.Group(),skin=0x8c8b70,skinDark=0x56594c,shirt=[0x58634d,0x584b45,0x465659][Math.floor(Math.random()*3)],pants=0x373d36;
  ellipsoid(g,[.39,.53,.27],[0,1.08,0],shirt);ellipsoid(g,[.28,.22,.25],[0,.62,0],0x45473c);ellipsoid(g,[.27,.33,.26],[0,1.79,.015],skin);
  ellipsoid(g,[.24,.11,.24],[0,2.02,.02],skinDark);ellipsoid(g,[.055,.055,.035],[-.105,1.82,.24],0xe9b764);ellipsoid(g,[.055,.055,.035],[.105,1.82,.24],0xe9b764);
  box(g,[.2,.045,.035],[0,1.68,.255],0x382d29);for(let n=-1;n<=1;n++)box(g,[.035,.035,.025],[n*.055,1.67,.28],0xd9cbb1);
  const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(-.39,1.35,0);armR.position.set(.39,1.35,0);g.add(armL,armR);
  for(const [arm,sign] of [[armL,-1],[armR,1]]){ellipsoid(arm,[.17,.35,.17],[sign*.04,-.2,0],shirt);ellipsoid(arm,[.13,.34,.13],[sign*.11,-.52,.08],skin);ellipsoid(arm,[.14,.12,.1],[sign*.13,-.78,.13],skinDark);for(let f=0;f<3;f++)ellipsoid(arm,[.035,.11,.035],[sign*(.08+f*.045),-.86,.2],skin);}
  const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.18,.58,0);legR.position.set(.18,.58,0);g.add(legL,legR);
  for(const leg of [legL,legR]){ellipsoid(leg,[.16,.33,.17],[0,-.2,0],pants);ellipsoid(leg,[.13,.34,.13],[0,-.53,.04],0x656957);ellipsoid(leg,[.16,.1,.25],[0,-.76,.11],0x292c27);}
  // Torn fabric and mottled wounds break up the silhouette.
  box(g,[.12,.3,.04],[-.24,1.1,.22],skinDark).rotation.z=-.22;ellipsoid(g,[.085,.06,.035],[.22,.94,.24],0x753d35);
  g.position.copy(pos);g.userData={hp:floor>12&&Math.random()<.25?2:1,speed:.9+Math.min(floor,20)*.015,attack:0,phase:Math.random()*6,armL,armR,legL,legR};floorGroup.add(g);zombies.push(g);
}
function makeSurvivor(index,pos){const g=new THREE.Group();const body=box(g,[.75,1.25,.55],[0,.75,0],[0x83c8a4,0x7bb499,0x8bd2af,0xb5c99b,0x92b9ac,0xc3d291][index]);box(g,[.55,.55,.55],[0,1.7,0],0xddd8c6);g.position.copy(pos);g.userData={index};floorGroup.add(g);survivors.push(g);}
function makePickup(pos){const g=new THREE.Group();box(g,[.55,.28,.35],[0,.25,0],C.green);box(g,[.18,.12,.36],[0,.26,.18],0x252d26);g.position.copy(pos);g.userData={type:'ammo'};floorGroup.add(g);pickups.push(g);}

function isBlocked(pos){return Math.abs(pos.x)>11.65||Math.abs(pos.z)>11.65;}
function movePlayer(dt){
  const forward=(keys.ArrowUp||keys.KeyW?1:0)-(keys.ArrowDown||keys.KeyS?1:0),side=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0);
  const input=new THREE.Vector2(side,forward);if(input.lengthSq()>1)input.normalize();const angle=yaw,sprint=keys.ShiftLeft||keys.ShiftRight?1.32:1;
  const desiredX=(Math.sin(angle)*input.y+Math.cos(angle)*input.x)*5.1*sprint,desiredZ=(-Math.cos(angle)*input.y+Math.sin(angle)*input.x)*5.1*sprint;
  const blend=1-Math.exp(-(input.lengthSq()?12:9)*dt);moveVelocity.x=THREE.MathUtils.lerp(moveVelocity.x,desiredX,blend);moveVelocity.z=THREE.MathUtils.lerp(moveVelocity.z,desiredZ,blend);
  const nx=player.x+moveVelocity.x*dt,nz=player.z+moveVelocity.z*dt;if(!isBlocked(new THREE.Vector3(nx,0,nz))){player.x=nx;player.z=nz;}else{moveVelocity.set(0,0,0);}
  const moving=input.lengthSq()>.02;if(moving)walkPhase+=dt*(sprint?13:9);bobPhase=THREE.MathUtils.lerp(bobPhase,moving?1:0,1-Math.exp(-7*dt));
}
function playSound(type){
  try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);
    if(type==='shot'){osc.type='sawtooth';osc.frequency.setValueAtTime(145,now);osc.frequency.exponentialRampToValueAtTime(48,now+.11);gain.gain.setValueAtTime(.14,now);gain.gain.exponentialRampToValueAtTime(.001,now+.13);osc.start(now);osc.stop(now+.14);
      const buffer=audioContext.createBuffer(1,audioContext.sampleRate*.07,audioContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const noise=audioContext.createBufferSource(),ng=audioContext.createGain();noise.buffer=buffer;noise.connect(ng);ng.connect(audioContext.destination);ng.gain.setValueAtTime(.12,now);ng.gain.exponentialRampToValueAtTime(.001,now+.07);noise.start(now);
    }else{osc.type='sine';osc.frequency.setValueAtTime(type==='reload'?440:type==='hit'?82:type==='pickup'?720:560,now);osc.frequency.exponentialRampToValueAtTime(type==='hit'?45:Math.max(100,osc.frequency.value*.62),now+.16);gain.gain.setValueAtTime(type==='hit'?.12:.07,now);gain.gain.exponentialRampToValueAtTime(.001,now+.18);osc.start(now);osc.stop(now+.19);}
  }catch{}
}
function shoot(){if(!playing||fireCooldown>0)return;if(ammo<=0){setToast('EMPTY — PRESS R TO RELOAD');fireCooldown=.25;return;}ammo--;fireCooldown=.24;recoil=.12;if(muzzleFlash){muzzleFlash.visible=true;muzzleFlash.scale.setScalar(.7+Math.random()*.7);muzzleFlash.userData.light.intensity=8;flashTimer=.075;}playSound('shot');updateHUD();const origin=camera.position.clone();const dir=new THREE.Vector3();camera.getWorldDirection(dir);const ray=new THREE.Raycaster(origin,dir,0,55);let target=null,best=Infinity;for(const z of zombies){const hit=ray.intersectObject(z,true)[0];if(hit&&hit.distance<best){best=hit.distance;target=z;}}if(target){target.userData.hp--;playSound('hit');if(target.userData.hp<=0){floorGroup.remove(target);zombies=zombies.filter(z=>z!==target);if(Math.random()<.22)makePickup(target.position.clone());}}}
function reload(){if(ammo>=9||reserve<=0||reloadTimer>0)return;playSound('reload');$('reload-state').textContent='RELOADING';reloadTimer=1.05;}

function interact(){if(!playing||interactCooldown>0)return;interactCooldown=.3;const survivor=survivors.find(s=>s.position.distanceTo(player)<2);if(survivor){playSound('pickup');rescued.push(survivor.userData.index);floorGroup.remove(survivor);survivors=[];setToast(survivorNames[survivor.userData.index].toUpperCase()+' JOINED YOUR GROUP');updateHUD();return;}const pickup=pickups.find(p=>p.position.distanceTo(player)<1.8);if(pickup){playSound('pickup');reserve+=12;floorGroup.remove(pickup);pickups=pickups.filter(p=>p!==pickup);setToast('AMMO SECURED · +12 ROUNDS');updateHUD();return;}if(floor<30&&stair&&player.distanceTo(stair)<2){if(zombies.length){setToast('STAIRWELL BLOCKED — CLEAR THE FLOOR');return;}floor++;buildFloor();player.set(0,1.65,9);moveVelocity.set(0,0,0);return;}if(floor===30&&extraction&&player.distanceTo(extraction)<3){if(rescued.length===6)showEnd('THE ROOF IS YOURS.','All six survivors made it. The city still has a heartbeat.');else setToast(`${6-rescued.length} SURVIVOR${6-rescued.length===1?'':'S'} STILL MISSING`);return;}setToast('NOTHING TO USE HERE');}

function updateHUD(){$('rescued-count').textContent=String(rescued.length).padStart(2,'0');$('survivor-status').textContent=rescued.length===6?'ALL ACCOUNTED':`${6-rescued.length} MISSING`;$('survivor-copy').textContent=rescued.length===6?'Everyone is with you. Get to the roof.':`${rescued.length} found · ${6-rescued.length} still out there.`;$('survivor-dots').innerHTML=survivorFloors.map((_,i)=>`<i class="${rescued.includes(i)?'found':''}"></i>`).join('');$('health-fill').style.width=health+'%';$('health-value').textContent=Math.ceil(health);$('ammo-fill').style.width=Math.max(0,ammo/9*100)+'%';$('ammo-value').textContent=String(ammo).padStart(2,'0')+' / '+reserve;$('ammo-scene').textContent=ammo+' / '+reserve;$('floor-count').innerHTML=String(floor).padStart(2,'0')+' <i>/ 30</i>';$('floor-progress-fill').style.width=(floor/30*100)+'%';$('floor-title').innerHTML=(floor===1?'LOBBY':floor===30?'ROOFTOP':'FLOOR '+String(floor).padStart(2,'0'))+' <span>— FLOOR '+String(floor).padStart(2,'0')+'</span>';$('objective-step').textContent=String(floor).padStart(2,'0');$('objective-title').textContent=floor===30?'Reach the extraction zone':survivors.length?'Find the survivor':'Sweep this floor';$('objective-copy').textContent=floor===30?'Bring everyone to the marked roof helipad.':survivors.length?'A survivor is nearby. Find them and press E.':'Clear the floor and use the eastern stairwell.';$('radio-line').textContent=floor===30?'“We have eyes on you. Get to the roof, now!”':survivors.length?'“Please... somebody, I’m still here.”':'“If anyone can hear this... we’re on the upper floors. Please.”';}

function showEnd(title,copy){playing=false;document.exitPointerLock?.();$('end-title').textContent=title;$('end-copy').textContent=copy;gameScreen.classList.add('hidden');endScreen.classList.remove('hidden');}
function startGame(){floor=1;ammo=9;reserve=36;health=100;rescued=[];keys={};moveVelocity.set(0,0,0);playing=true;titleScreen.classList.add('hidden');endScreen.classList.add('hidden');gameScreen.classList.remove('hidden');yaw=0;pitch=0;player=new THREE.Vector3(0,1.65,9);buildFloor();resize();if(window.matchMedia('(pointer: fine)').matches)canvas.requestPointerLock?.();}

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
function animate(){
  requestAnimationFrame(animate);if(!renderer)return;const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;
  if(playing){
    movePlayer(dt);fireCooldown=Math.max(0,fireCooldown-dt);interactCooldown=Math.max(0,interactCooldown-dt);recoil=Math.max(0,recoil-dt);
    if(flashTimer>0){flashTimer-=dt;if(flashTimer<=0&&muzzleFlash){muzzleFlash.visible=false;muzzleFlash.userData.light.intensity=0;}}
    if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){reloadTimer=0;$('reload-state').textContent='READY';const take=Math.min(9-ammo,reserve);ammo+=take;reserve-=take;updateHUD();}}
    camera.position.copy(player);camera.position.y+=Math.sin(walkPhase*2)*.035*bobPhase;camera.rotation.set(pitch+recoil*.055,yaw,0,'YXZ');
    const gun=camera.userData.gun;if(gun){gun.position.y=-.31-Math.abs(Math.sin(walkPhase*2))*.025*bobPhase;gun.position.x=.34+Math.sin(walkPhase)*.018*bobPhase;gun.rotation.x=-.08+recoil*1.1;gun.rotation.z=-.04-Math.sin(walkPhase)*.018*bobPhase;}
    for(const z of zombies){z.userData.attack=Math.max(0,z.userData.attack-dt);const d=z.position.distanceTo(player),phase=elapsed*5+z.userData.phase;
      if(d>1.3){const dir=player.clone().sub(z.position).setY(0).normalize();z.position.addScaledVector(dir,z.userData.speed*dt);z.lookAt(player.x,z.position.y,player.z);}
      z.userData.armL.rotation.x=Math.sin(phase)*.34-.18;z.userData.armR.rotation.x=-Math.sin(phase)*.34-.18;z.userData.armL.rotation.z=-.22;z.userData.armR.rotation.z=.22;z.userData.legL.rotation.x=Math.sin(phase)*.28;z.userData.legR.rotation.x=-Math.sin(phase)*.28;z.position.y=.1+Math.sin(phase*1.7)*.035;
      if(d<1.5&&z.userData.attack<=0){z.userData.attack=.9;health=Math.max(0,health-12);playSound('hit');updateHUD();setToast('YOU’RE HIT — KEEP YOUR DISTANCE');if(health<=0)showEnd('THE SIGNAL WENT QUIET.','You made it to floor '+floor+'. '+rescued.length+' of 6 survivors came with you.');}
    }
    for(const s of survivors)s.position.y=.1+Math.sin(elapsed*3+s.userData.index)*.04;for(let i=0;i<pickups.length;i++)pickups[i].position.y=.25+Math.sin(elapsed*4+i)*.05;
    const near=(survivors.some(s=>s.position.distanceTo(player)<2.2)||pickups.some(p=>p.position.distanceTo(player)<1.8)||(floor<30&&stair&&player.distanceTo(stair)<2)||(floor===30&&extraction&&player.distanceTo(extraction)<3));$('interact-hint').classList.toggle('hidden',!near);
  }
  renderer.render(scene,camera);
}

$('start-button').addEventListener('click',startGame);$('restart-button').addEventListener('click',startGame);
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();const k=e.code||e.key.toLowerCase();if(!e.repeat&&k==='KeyE')interact();if(!e.repeat&&k==='KeyR')reload();if(!e.repeat&&(k==='Space'||k==='KeyF'))shoot();keys[k]=true;});
window.addEventListener('keyup',e=>{keys[e.code||e.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>keys={});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch));}});
canvas.addEventListener('mousedown',e=>{if(e.button===0){if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();else shoot();}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('[data-dir]').forEach(btn=>{const k={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[btn.dataset.dir];const down=e=>{e.preventDefault();keys[k]=true;};const up=e=>{e.preventDefault();keys[k]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);});
$('mobile-fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});
$('mobile-interact').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&e.buttons>0){if(!mobileLook){mobileLook=true;lookOrigin={x:e.clientX,y:e.clientY};}else{yaw-=(e.clientX-lookOrigin.x)*.006;pitch-=(e.clientY-lookOrigin.y)*.006;pitch=Math.max(-1.25,Math.min(1.25,pitch));lookOrigin={x:e.clientX,y:e.clientY};}}});
canvas.addEventListener('pointerup',()=>mobileLook=false);canvas.addEventListener('pointercancel',()=>mobileLook=false);
window.addEventListener('resize',resize);
$('clock').textContent='DAY 03 · 06:42';makeScene();animate();
