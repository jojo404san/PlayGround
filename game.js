(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const titleScreen = $('title-screen'), gameScreen = $('game-screen'), endScreen = $('end-screen');
  const W = 1000, H = 620, FLOOR_MAX = 30;
  const survivorFloors = [4, 8, 13, 18, 23, 27];
  const survivorNames = ['Mara · nurse', 'Eli · maintenance', 'June · student', 'Rafi · cook', 'Tomas · courier', 'Nia · engineer'];
  const roomDefs = [
    {x:86,y:65,w:232,h:196,side:'top',name:'NORTH SUITE'}, {x:384,y:65,w:232,h:196,side:'top',name:'WEST SUITE'}, {x:682,y:65,w:232,h:196,side:'top',name:'EAST SUITE'},
    {x:58,y:386,w:204,h:181,side:'bottom',name:'LAUNDRY'}, {x:294,y:386,w:204,h:181,side:'bottom',name:'STORAGE'}, {x:530,y:386,w:204,h:181,side:'bottom',name:'LOUNGE'}, {x:766,y:386,w:176,h:181,side:'bottom',name:'OFFICE'}
  ];
  let player, zombies, survivor, rescued, floor, ammo, reserve, health, keys, aim, shots, particles, pickups, gameState, lastTime, elapsed, toastTimer, fireCooldown, interactCooldown, muzzle, floorSeed, stepSound, reloadTimer;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const roomCenter=(r)=>({x:r.x+r.w/2,y:r.y+r.h/2});
  function isWalkable(x,y,r=8){
    if(x>42+r&&x<W-42-r&&y>278+r&&y<350-r) return true;
    for(const room of roomDefs){
      if(x>room.x+r&&x<room.x+room.w-r&&y>room.y+r&&y<room.y+room.h-r) return true;
      const cx=room.x+room.w/2;
      if(Math.abs(x-cx)<27-r&&room.side==='top'&&y>=room.y+room.h-r&&y<280+r) return true;
      if(Math.abs(x-cx)<27-r&&room.side==='bottom'&&y>348-r&&y<=room.y+r) return true;
    }
    return false;
  }
  function setToast(text){const t=$('toast');t.textContent=text;t.classList.add('show');toastTimer=2.2;}
  function startGame(){
    floor=1;ammo=9;reserve=36;health=100;rescued=[];keys={};aim={x:780,y:310,active:false};shots=[];particles=[];pickups=[];elapsed=0;reloadTimer=0;gameState='playing';
    player={x:500,y:315,r:10,angle:0,walk:0,invuln:0};
    titleScreen.classList.add('hidden');endScreen.classList.add('hidden');gameScreen.classList.remove('hidden');
    enterFloor();
  }
  function enterFloor(){
    floorSeed=Math.random()*1000;player.x=500;player.y=315;zombies=[];shots=[];particles=[];pickups=[];survivor=null;
    const count=floor===30?0:Math.min(3+Math.floor(floor/7),7);
    for(let i=0;i<count;i++){
      const room=roomDefs[Math.floor(Math.random()*roomDefs.length)];const c=roomCenter(room);
      zombies.push({x:rand(room.x+24,room.x+room.w-24),y:rand(room.y+24,room.y+room.h-24),r:10,hp:floor>12&&Math.random()<.25?2:1,speed:rand(25,41)+Math.min(floor,20)*.4,attack:0,phase:rand(0,7),hit:0});
    }
    if(Math.random()<.58&&floor<30){pickups.push({x:rand(440,560),y:rand(290,335),type:'ammo',r:9});}
    if(survivorFloors.includes(floor)&&!rescued.includes(survivorFloors.indexOf(floor))){
      const idx=survivorFloors.indexOf(floor),room=roomDefs[(idx*3+1)%roomDefs.length];const c=roomCenter(room);
      survivor={x:c.x+rand(-40,40),y:c.y+rand(-35,35),index:idx, rescued:false, pulse:0};
    }
    $('floor-title').innerHTML=`${floor===1?'LOBBY':floor===30?'ROOFTOP':'FLOOR '+String(floor).padStart(2,'0')} <span>— FLOOR ${String(floor).padStart(2,'0')}</span>`;
    $('floor-count').innerHTML=`${String(floor).padStart(2,'0')} <i>/ 30</i>`;
    $('floor-progress-fill').style.width=`${floor/30*100}%`;
    $('objective-step').textContent=String(floor).padStart(2,'0');
    $('objective-title').textContent=floor===30?'Reach the extraction zone':survivor?'Find the survivor':'Sweep this floor';
    $('objective-copy').textContent=floor===30?'The helicopter is on the roof. Bring everyone to the extraction marker.':survivor?'A life signal is coming from one of the rooms. Find them and press E.':'Clear the floor and find the stairwell to continue your search.';
    $('radio-line').textContent=floor===30?'“We have eyes on you. Get to the roof, now!”':survivor?`“${survivorNames[survivor.index]} here... I can hear them outside.”`:'“If anyone can hear this... we’re on the upper floors. Please.”';
    $('radio-source').textContent=survivor?`SURVIVOR SIGNAL · FLOOR ${String(floor).padStart(2,'0')}`:'UNKNOWN CALLER · WEAK SIGNAL';
    $('floor-weather').textContent=floor===30?'ROOFTOP · EXTRACTION IN PROGRESS':'POWER UNSTABLE · LIGHTS FLICKERING';
    updateHUD();setToast(floor===30?'ROOFTOP ACCESS — EXTRACTION ZONE MARKED':`FLOOR ${String(floor).padStart(2,'0')} — SWEEP IN PROGRESS`);
  }
  function updateHUD(){
    $('rescued-count').textContent=String(rescued.length).padStart(2,'0');
    $('total-survivors').textContent=String(survivorFloors.length).padStart(2,'0');
    $('survivor-status').textContent=rescued.length===6?'ALL ACCOUNTED':`${6-rescued.length} MISSING`;
    $('survivor-copy').textContent=rescued.length===6?'Everyone is with you. Get to the roof.':`${rescued.length} found · ${6-rescued.length} still out there.`;
    $('survivor-dots').innerHTML=survivorFloors.map((_,i)=>`<i class="${rescued.includes(i)?'found':''}"></i>`).join('');
    $('health-fill').style.width=`${health}%`;$('health-value').textContent=Math.ceil(health);
    $('ammo-fill').style.width=`${Math.max(0,ammo/9*100)}%`;$('ammo-value').textContent=`${String(ammo).padStart(2,'0')} / ${reserve}`;
    $('ammo-scene').textContent=`${ammo} / ${reserve}`;
  }
  function shoot(){
    if(gameState!=='playing'||fireCooldown>0)return;
    if(ammo<=0){setToast('EMPTY — PRESS R TO RELOAD');fireCooldown=.22;return;}
    ammo--;fireCooldown=.24;player.angle=Math.atan2(aim.y-player.y,aim.x-player.x);muzzle=.09;
    shots.push({x:player.x+Math.cos(player.angle)*15,y:player.y+Math.sin(player.angle)*15,vx:Math.cos(player.angle)*650,vy:Math.sin(player.angle)*650,life:.5});
    let target=null,best=Infinity;
    for(const z of zombies){const dx=z.x-player.x,dy=z.y-player.y,d=Math.hypot(dx,dy),ang=Math.atan2(dy,dx),diff=Math.atan2(Math.sin(ang-player.angle),Math.cos(ang-player.angle));if(d<430&&Math.abs(diff)<.12+d*.00028&&d<best){best=d;target=z;}}
    if(target){target.hp--;target.hit=.16;for(let i=0;i<7;i++)particles.push({x:target.x,y:target.y,vx:rand(-60,60),vy:rand(-60,60),life:rand(.16,.42),color:'#d66e53'});if(target.hp<=0){zombies=zombies.filter(z=>z!==target);for(let i=0;i<6;i++)particles.push({x:target.x,y:target.y,vx:rand(-45,45),vy:rand(-55,55),life:rand(.25,.55),color:'#83904f'});if(Math.random()<.22)pickups.push({x:target.x,y:target.y,type:'ammo',r:8});}}
    updateHUD();
  }
  function reload(){if(ammo>=9||reserve<=0||reloadTimer>0||gameState!=='playing')return;$('reload-state').textContent='RELOADING';reloadTimer=.85;}
  function interact(){
    if(gameState!=='playing'||interactCooldown>0)return;
    interactCooldown=.3;
    if(survivor&&distance(player,survivor)<35){
      if(!rescued.includes(survivor.index)){rescued.push(survivor.index);setToast(`${survivorNames[survivor.index].toUpperCase()} JOINED YOUR GROUP`);$('radio-line').textContent='“Thank you. I thought I was the only one left.”';$('radio-source').textContent='SURVIVOR FOUND · SIGNAL LOST';survivor=null;updateHUD();$('objective-title').textContent='Sweep this floor';$('objective-copy').textContent='Clear threats and locate the stairwell to continue your search.';}return;
    }
    const pickup=pickups.find(p=>distance(player,p)<30);
    if(pickup){if(pickup.type==='ammo'){reserve+=12;setToast('AMMO SECURED · +12 ROUNDS');}pickups=pickups.filter(p=>p!==pickup);updateHUD();return;}
    if(floor===30&&distance(player,{x:500,y:128})<58){if(rescued.length===6){gameState='won';$('end-title').textContent='THE ROOF IS YOURS.';$('end-copy').textContent='All six survivors made it. The city still has a heartbeat.';showEnd();}else setToast(`${6-rescued.length} SURVIVOR${6-rescued.length===1?'':'S'} STILL MISSING`);return;}
    if(floor<30&&distance(player,{x:952,y:314})<48){if(zombies.length){setToast('STAIRWELL BLOCKED — CLEAR THE FLOOR');return;}floor++;enterFloor();return;}
    if(floor===30&&distance(player,{x:500,y:128})>=58)setToast('MOVE TO THE HELIPAD');
    else setToast('NOTHING TO USE HERE');
  }
  function showEnd(){gameScreen.classList.add('hidden');endScreen.classList.remove('hidden');}
  function drawRoom(room,i){
    const {x,y,w,h}=room;ctx.fillStyle=i%2?'#202724':'#222925';ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#ffffff05';for(let gx=x+12;gx<x+w;gx+=26)for(let gy=y+12;gy<y+h;gy+=26){ctx.fillRect(gx,gy,1,1);}
    ctx.strokeStyle='#687269';ctx.lineWidth=5;ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#303a33';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,w-10,h-10);
    const cx=x+w/2,doorW=50;
    ctx.fillStyle='#242b27';if(room.side==='top'){ctx.fillRect(cx-doorW/2,y+h-4,doorW,9);ctx.strokeStyle='#8c9a8b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-doorW/2,y+h);ctx.lineTo(cx+doorW/2,y+h);ctx.stroke();}else{ctx.fillRect(cx-doorW/2,y-5,doorW,10);ctx.strokeStyle='#8c9a8b';ctx.beginPath();ctx.moveTo(cx-doorW/2,y);ctx.lineTo(cx+doorW/2,y);ctx.stroke();}
    ctx.fillStyle='#99a39a';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText(room.name,x+13,y+18);
    // Distressed furniture, unique to each suite.
    if(i===0){ctx.fillStyle='#343e37';ctx.fillRect(x+30,y+54,72,56);ctx.fillStyle='#53604f';ctx.fillRect(x+35,y+59,62,18);ctx.fillRect(x+35,y+84,62,20);ctx.fillStyle='#454c42';ctx.fillRect(x+147,y+47,47,44);ctx.fillStyle='#7d684c';ctx.fillRect(x+151,y+51,39,35);}
    else if(i===1){ctx.fillStyle='#404941';ctx.fillRect(x+34,y+52,114,52);ctx.fillStyle='#667164';ctx.fillRect(x+42,y+59,98,36);ctx.fillStyle='#363e39';ctx.fillRect(x+158,y+120,48,30);ctx.fillStyle='#bba477';ctx.fillRect(x+164,y+125,36,19);}
    else if(i===2){ctx.fillStyle='#39423c';ctx.fillRect(x+27,y+49,55,80);ctx.fillStyle='#5e6a60';ctx.fillRect(x+33,y+55,43,13);ctx.fillRect(x+33,y+76,43,13);ctx.fillRect(x+33,y+97,43,13);ctx.fillStyle='#755b4c';ctx.fillRect(x+123,y+70,79,49);ctx.fillStyle='#a28c71';ctx.fillRect(x+129,y+76,67,37);}
    else if(i===3){ctx.fillStyle='#37413a';ctx.fillRect(x+28,y+41,59,107);ctx.fillStyle='#616b5e';ctx.fillRect(x+34,y+47,47,13);ctx.fillRect(x+34,y+69,47,13);ctx.fillRect(x+34,y+91,47,13);ctx.fillRect(x+34,y+113,47,13);ctx.fillStyle='#514c40';ctx.fillRect(x+108,y+85,62,47);}
    else if(i===4){ctx.fillStyle='#4b4b3b';ctx.fillRect(x+22,y+48,70,53);ctx.fillStyle='#89784d';ctx.fillRect(x+27,y+53,60,43);ctx.fillStyle='#39433a';ctx.fillRect(x+117,y+37,55,100);ctx.strokeStyle='#657067';ctx.lineWidth=2;ctx.strokeRect(x+122,y+42,45,90);}
    else if(i===5){ctx.fillStyle='#3b443c';ctx.fillRect(x+28,y+42,68,34);ctx.fillStyle='#687460';ctx.fillRect(x+34,y+47,56,22);ctx.fillStyle='#494b40';ctx.fillRect(x+122,y+95,65,41);ctx.fillStyle='#756f58';ctx.fillRect(x+128,y+101,53,28);}
    else {ctx.fillStyle='#4a4b41';ctx.fillRect(x+24,y+42,62,39);ctx.fillStyle='#857d60';ctx.fillRect(x+30,y+48,50,27);ctx.fillStyle='#3c463e';ctx.fillRect(x+104,y+98,52,48);}
    // Small debris and scuffs.
    ctx.fillStyle='#a2684b33';ctx.beginPath();ctx.ellipse(x+w*.72,y+h*.68,15,7,-.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#85908455';ctx.fillRect(x+w*.25,y+h*.78,16,2);ctx.fillRect(x+w*.26,y+h*.8,10,2);
  }
  function drawWorld(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#151b18';ctx.fillRect(0,0,W,H);
    // Floor tiles and central corridor.
    for(let x=0;x<W;x+=40)for(let y=0;y<H;y+=40){ctx.fillStyle=((x/40+y/40)%2===0)?'#1a211d':'#1c231f';ctx.fillRect(x,y,40,40);ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,39,39);}
    ctx.fillStyle='#252d28';ctx.fillRect(42,278,916,72);ctx.fillStyle='#a3ad9c0a';for(let x=50;x<950;x+=40)ctx.fillRect(x,281,1,66);
    roomDefs.forEach(drawRoom);
    // Blood streaks and a dropped chair suggest the last occupants left in a hurry.
    ctx.strokeStyle='#873f3548';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(333,300);ctx.lineTo(346,304);ctx.lineTo(353,298);ctx.stroke();ctx.fillStyle='#414941';ctx.fillRect(615,301,15,13);ctx.strokeStyle='#657065';ctx.strokeRect(615,301,15,13);
    // Stairwell/door at the east corridor end.
    if(floor<30){ctx.fillStyle='#26322a';ctx.fillRect(931,282,48,67);ctx.strokeStyle='#8a9b88';ctx.lineWidth=3;ctx.strokeRect(931,282,48,67);ctx.fillStyle='#d5fa70';ctx.fillRect(939,290,31,3);ctx.fillStyle='#b5c2b5';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('STAIRS',955,319);ctx.fillText('↑',955,338);ctx.fillStyle='#d5fa7040';ctx.beginPath();ctx.arc(955,315,38,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26322a';ctx.fillRect(931,282,48,67);ctx.strokeStyle='#829286';ctx.strokeRect(931,282,48,67);ctx.fillStyle='#d5fa70';ctx.fillRect(939,290,31,3);ctx.fillStyle='#d1d9d0';ctx.fillText('STAIRS',955,319);ctx.fillText('↑',955,338);}
    if(floor===30){ctx.fillStyle='#171e1a';ctx.fillRect(420,65,160,52);ctx.strokeStyle='#9dad8f';ctx.lineWidth=3;ctx.strokeRect(420,65,160,52);ctx.fillStyle='#d5fa70';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('ROOF ACCESS',500,87);ctx.fillStyle='#a1aca2';ctx.font='8px monospace';ctx.fillText('EXTRACTION ZONE',500,103);ctx.beginPath();ctx.arc(500,142,40,0,Math.PI*2);ctx.strokeStyle='#d5fa706c';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(500,142,31,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d5fa7015';ctx.fill();ctx.fillStyle='#d5fa70';ctx.font='20px sans-serif';ctx.fillText('✳',500,149);}
    // Atmospheric windows along the outside edge.
    ctx.fillStyle='#2d403c';ctx.fillRect(18,103,9,94);ctx.fillRect(973,103,9,94);ctx.fillRect(18,417,9,94);ctx.fillRect(973,417,9,94);ctx.fillStyle='#96a98f27';for(const yy of [108,422]){ctx.fillRect(19,yy,7,2);ctx.fillRect(974,yy,7,2);}
    pickups.forEach(p=>{ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#d5fa70';ctx.globalAlpha=.16+.08*Math.sin(elapsed*5);ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#252d26';ctx.fillRect(-8,-7,16,14);ctx.strokeStyle='#d5fa70';ctx.lineWidth=1.5;ctx.strokeRect(-8,-7,16,14);ctx.fillStyle='#d5fa70';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('+',0,4);ctx.restore();});
    if(survivor){survivor.pulse+=.04;ctx.save();ctx.translate(survivor.x,survivor.y);ctx.globalAlpha=.18+.1*Math.sin(elapsed*4);ctx.fillStyle='#80c7a2';ctx.beginPath();ctx.arc(0,0,24+Math.sin(elapsed*4)*3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;drawPerson(0,0,'#83c8a4',0);ctx.strokeStyle='#a3e4bd';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,16+Math.sin(elapsed*4)*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b8e4cb';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('SURVIVOR',0,-22);ctx.restore();}
    zombies.forEach(drawZombie);
    // Followers trail the player, with a soft ring so the group reads clearly.
    rescued.forEach((idx,i)=>{const a=player.angle+Math.PI+(i%2?-.48:.48),tx=player.x+Math.cos(a)*(23+Math.floor(i/2)*14),ty=player.y+Math.sin(a)*(23+Math.floor(i/2)*14);drawPerson(tx,ty,['#83c8a4','#7bb499','#8bd2af','#b5c99b','#92b9ac','#c3d291'][idx],.35);});
    drawPlayer();shots.forEach(s=>{ctx.fillStyle='#fff4bc';ctx.shadowColor='#f9d782';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(s.x,s.y,2.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
    particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1;});
    // Vignette, barely visible scanline for a tactical-feed feel.
    const grad=ctx.createRadialGradient(500,310,220,500,310,610);grad.addColorStop(0,'#00000000');grad.addColorStop(1,'#080c09a8');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    if(player.invuln>0){ctx.fillStyle=`rgba(181,54,44,${.1+Math.sin(elapsed*30)*.04})`;ctx.fillRect(0,0,W,H);}
  }
  function drawPerson(x,y,color,scale=0){const s=scale?1+scale:1;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#05080766';ctx.beginPath();ctx.ellipse(1,6,9,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ddd8c6';ctx.beginPath();ctx.arc(0,-2,3,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawZombie(z){ctx.save();ctx.translate(z.x,z.y);ctx.rotate(Math.sin(elapsed*2+z.phase)*.08);ctx.fillStyle='#080b096d';ctx.beginPath();ctx.ellipse(1,7,11,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=z.hit>0?'#dca08a':'#68775c';ctx.beginPath();ctx.ellipse(0,1,8,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#889078';ctx.beginPath();ctx.arc(0,-7,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d0b38b';ctx.fillRect(-4,-9,2,2);ctx.fillRect(2,-9,2,2);ctx.strokeStyle='#4b4237';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,2);ctx.lineTo(-12,7);ctx.moveTo(6,2);ctx.lineTo(11,7);ctx.stroke();if(z.hp>1){ctx.fillStyle='#d5fa70';ctx.beginPath();ctx.arc(0,-17,2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);if(player.invuln>0&&Math.floor(elapsed*18)%2===0)ctx.globalAlpha=.5;ctx.fillStyle='#05080788';ctx.beginPath();ctx.ellipse(1,7,13,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c2cbb8';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26312b';ctx.beginPath();ctx.arc(-1,-1,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d3fa70';ctx.fillRect(3,-2,13,4);ctx.fillStyle='#4b544d';ctx.fillRect(7,-3,8,2);if(muzzle>0){ctx.fillStyle='#fff1a7';ctx.shadowColor='#ffc955';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(25,-5);ctx.lineTo(22,0);ctx.lineTo(25,5);ctx.closePath();ctx.fill();ctx.shadowBlur=0;}ctx.restore();}
  function update(dt){
    if(gameState!=='playing')return;
    elapsed+=dt;fireCooldown=Math.max(0,fireCooldown-dt);interactCooldown=Math.max(0,interactCooldown-dt);muzzle=Math.max(0,muzzle-dt);if(mobileFireHeld&&zombies.length){const z=zombies.reduce((a,b)=>distance(a,player)<distance(b,player)?a:b);aim={x:z.x,y:z.y,active:true};shoot();}if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){reloadTimer=0;$('reload-state').textContent='READY';const take=Math.min(9-ammo,reserve);ammo+=take;reserve-=take;updateHUD();}}if(player.invuln>0)player.invuln-=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
    let dx=(keys.right||keys.ArrowRight?1:0)-(keys.left||keys.ArrowLeft?1:0),dy=(keys.down||keys.ArrowDown?1:0)-(keys.up||keys.ArrowUp?1:0);const mag=Math.hypot(dx,dy);if(mag){dx/=mag;dy/=mag;player.walk+=dt*9;const speed=145;let nx=player.x+dx*speed*dt,ny=player.y+dy*speed*dt;if(isWalkable(nx,player.y,player.r))player.x=nx;if(isWalkable(player.x,ny,player.r))player.y=ny;}
    if(aim.active){player.angle=Math.atan2(aim.y-player.y,aim.x-player.x);}
    for(const z of zombies){z.attack=Math.max(0,z.attack-dt);z.hit=Math.max(0,z.hit-dt);const d=distance(z,player);if(d>18){let vx=(player.x-z.x)/Math.max(d,1),vy=(player.y-z.y)/Math.max(d,1);const sp=z.speed*(d<100?.72:1);let nx=z.x+vx*sp*dt,ny=z.y+vy*sp*dt;if(isWalkable(nx,z.y,z.r))z.x=nx;if(isWalkable(z.x,ny,z.r))z.y=ny;}if(d<23&&z.attack<=0&&player.invuln<=0){health=Math.max(0,health-12);player.invuln=.7;z.attack=.9;updateHUD();setToast('YOU’RE HIT — KEEP YOUR DISTANCE');if(health<=0){gameState='dead';$('end-title').textContent='THE SIGNAL WENT QUIET.';$('end-copy').textContent=`You made it to floor ${floor}. ${rescued.length} of 6 survivors came with you.`;showEnd();return;}}}
    for(const s of shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;}shots=shots.filter(s=>s.life>0&&s.x>0&&s.x<W&&s.y>0&&s.y<H);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    if(survivor)survivor.pulse+=dt;
    const near=survivor&&distance(player,survivor)<38||pickups.some(p=>distance(player,p)<30)||floor<30&&distance(player,{x:952,y:314})<48||floor===30&&distance(player,{x:500,y:128})<58;
    $('interact-hint').classList.toggle('hidden',!near);if(near)$('interact-hint').innerHTML=`<span>E</span> <b>${survivor&&distance(player,survivor)<38?'RESCUE':floor===30?'EXTRACT':'INTERACT'}</b>`;
    if(Math.floor(elapsed*3)!==Math.floor((elapsed-dt)*3))updateHUD();drawWorld();
  }
  function loop(now){if(lastTime==null)lastTime=now;const dt=Math.min(.04,(now-lastTime)/1000);lastTime=now;update(dt);requestAnimationFrame(loop);}
  function pointFromEvent(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  $('start-button').addEventListener('click',()=>{fireCooldown=0;interactCooldown=0;toastTimer=0;muzzle=0;lastTime=null;startGame();});
  $('restart-button').addEventListener('click',()=>{fireCooldown=0;interactCooldown=0;toastTimer=0;muzzle=0;lastTime=null;startGame();});
  window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(!keys[k]){if(k==='e')interact();if(k==='r')reload();if(k===' '||k==='f')shoot();}keys[k]=true;});
  window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false;});
  window.addEventListener('blur',()=>{keys={};});
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons>0){const p=pointFromEvent(e);aim={...p,active:true};}});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button===0){const p=pointFromEvent(e);aim={...p,active:true};shoot();}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  const mobileDir={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
  document.querySelectorAll('[data-dir]').forEach(btn=>{const down=e=>{e.preventDefault();keys[mobileDir[btn.dataset.dir]]=true;};const up=e=>{e.preventDefault();keys[mobileDir[btn.dataset.dir]]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);});
  let mobileFireHeld=false;
  $('mobile-fire').addEventListener('pointerdown',e=>{e.preventDefault();mobileFireHeld=true;});
  $('mobile-fire').addEventListener('pointerup',()=>{mobileFireHeld=false;});
  $('mobile-fire').addEventListener('pointercancel',()=>{mobileFireHeld=false;});
  $('mobile-interact').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
  $('clock').textContent='DAY 03 · 06:42';
  requestAnimationFrame(loop);
})();
