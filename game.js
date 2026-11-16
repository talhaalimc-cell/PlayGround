(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 900, H = 580, TW = 58, TH = 29;
  const $ = (id) => document.getElementById(id);
  const species = [
    {name:'Cindercub', icon:'🦊', type:'EMBER', color:'#df8a61', hp:27, atk:7, note:'A bright little firestarter.'},
    {name:'Spriglet', icon:'🌱', type:'LEAF', color:'#a6c77e', hp:25, atk:6, note:'A curious sprout with a brave heart.'},
    {name:'Brookfin', icon:'🐸', type:'WATER', color:'#7ebaca', hp:29, atk:5, note:'A mellow pond-hopper.'},
    {name:'Mothmoss', icon:'🦋', type:'WIND', color:'#c3a9d8', hp:21, atk:7, note:'It follows the evening breeze.'},
    {name:'Pebblit', icon:'🐢', type:'STONE', color:'#c6a878', hp:32, atk:5, note:'Small, sturdy, and very patient.'},
    {name:'Pipmouse', icon:'🐭', type:'SPARK', color:'#e6c36f', hp:23, atk:6, note:'A pocket-sized bolt of energy.'}
  ];
  const starters = [species[0], species[1], species[2]];
  const player = {x:7,z:7,fromX:7,fromZ:7,toX:7,toZ:7,moveAt:0,dir:'down',step:0};
  const state = {started:false,starter:null,party:[],caught:new Set(),battle:null,steps:0,badges:0,level:1,xp:0,toastTimer:0,encounterLock:0,dialogueLock:0,sound:false};
  const directions = {up:[-1,-1],down:[1,1],left:[-1,1],right:[1,-1]};
  const mapSize=23;
  let raf, lastTime=0, keysDown=new Set(), cssW=900, cssH=580;

  function project(x,z){return {x:(x-z)*TW/2,y:(x+z)*TH/2};}
  function hash(x,z){let n=(x*374761393+z*668265263)|0;n=(n^(n>>13))*1274126177;return ((n^(n>>16))>>>0)/4294967295;}
  function tileType(x,z){
    if(x<0||z<0||x>=mapSize||z>=mapSize)return 'void';
    if(x>=17&&x<=20&&z>=9&&z<=13)return 'water';
    if((x>=3&&x<=10&&z>=3&&z<=10)){
      if((z===6||z===7)&&x>=3&&x<=10)return 'path';
      if(x===7&&z>=3&&z<=10)return 'path';
      return 'town';
    }
    if((x>=12&&x<=17&&z>=3&&z<=11)||(x>=10&&x<=15&&z>=13&&z<=17))return 'tall';
    return 'field';
  }
  function blocked(x,z){
    if(x<1||z<1||x>=mapSize-1||z>=mapSize-1||tileType(x,z)==='water')return true;
    if(x>=3&&x<=5&&z>=3&&z<=4)return true; // Rowan's laboratory
    if(x>=9&&x<=10&&z>=4&&z<=5)return true; // clinic
    return false;
  }
  function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function tilePolygon(x,y,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(x,y-h/2);ctx.lineTo(x+w/2,y);ctx.lineTo(x,y+h/2);ctx.lineTo(x-w/2,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function drawTile(sx,sy,type,x,z,t){
    const palette={town:['#8db77f','#84ad76'],field:['#79a96f','#70a168'],tall:['#729e64','#6b965f'],path:['#c9ad78','#bea16e'],water:['#6dada9','#69a8a6'],void:['#678d69','#678d69']};
    const c=palette[type]||palette.field;
    tilePolygon(sx,sy,TW,TH,c[hash(x,z)>.5?0:1],type==='water'?'#75b7b0':'#ffffff09');
    if(type==='water'){
      const wave=hash(x,z);ctx.strokeStyle='#c1e6d54a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx-8,sy-2+wave*3);ctx.lineTo(sx+7,sy-2+wave*3);ctx.stroke();
      if(hash(x+2,z+5)>.84){ctx.fillStyle='#92c3aa';ctx.beginPath();ctx.ellipse(sx+10,sy-2,4,2,-.25,0,Math.PI*2);ctx.fill();}
    } else if(type==='path'){
      const r=hash(x+37,z+3); if(r>.36){ctx.fillStyle='#8c7655';ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(sx+(r-.5)*23,sy+(hash(z,x)-.5)*7,2.4,1.3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    } else if(type!=='tall'&&hash(x*2+9,z*2+3)>.81){
      ctx.fillStyle=hash(z,x)>.5?'#d8c37c':'#d6a5a2';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(sx+(hash(x,z+3)-.5)*16,sy+(hash(x+4,z)-.5)*8,1.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
  }
  function drawGrass(sx,sy,x,z,time){
    const seed=hash(x,z);const sway=Math.sin(time/460+x*2+z)*1.3;
    for(let i=0;i<5;i++){
      const px=sx+(i-2)*6, base=sy+2+Math.abs(i-2)*.8, h=10+hash(x+i,z+4)*7;
      ctx.strokeStyle=i%2?'#4f8053':'#56895b';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,base);ctx.quadraticCurveTo(px-2+sway,base-h*.6,px-2+sway,base-h);ctx.stroke();
      ctx.strokeStyle='#9dc77b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,base-3);ctx.lineTo(px-2+sway,base-h+2);ctx.stroke();
    }
    ctx.fillStyle='#34573d25';ctx.beginPath();ctx.ellipse(sx,sy+7,18,4,0,0,Math.PI*2);ctx.fill();
  }
  function drawTree(sx,sy,kind=0){
    ctx.fillStyle='#354f4138';ctx.beginPath();ctx.ellipse(sx,sy+8,18,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#745b45';ctx.fillRect(sx-4,sy-22,8,27);ctx.fillStyle='#80664b';ctx.fillRect(sx+1,sy-21,3,22);
    if(kind===1){ctx.fillStyle='#497652';ctx.beginPath();ctx.moveTo(sx,sy-62);ctx.lineTo(sx-23,sy-20);ctx.lineTo(sx+23,sy-20);ctx.closePath();ctx.fill();ctx.fillStyle='#598b5b';ctx.beginPath();ctx.moveTo(sx,sy-53);ctx.lineTo(sx-19,sy-14);ctx.lineTo(sx+20,sy-14);ctx.closePath();ctx.fill();ctx.fillStyle='#70a269';ctx.beginPath();ctx.moveTo(sx-2,sy-52);ctx.lineTo(sx-16,sy-25);ctx.lineTo(sx-3,sy-29);ctx.closePath();ctx.fill();}
    else{ctx.fillStyle='#426b4c';ctx.beginPath();ctx.arc(sx-7,sy-30,18,0,Math.PI*2);ctx.arc(sx+8,sy-33,19,0,Math.PI*2);ctx.arc(sx,sy-45,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#568458';ctx.beginPath();ctx.arc(sx-6,sy-41,12,0,Math.PI*2);ctx.arc(sx+9,sy-32,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#82a866';ctx.beginPath();ctx.arc(sx-8,sy-45,5,0,Math.PI*2);ctx.fill();}
  }
  function drawBuilding(x,z,type,camX,camY){
    const p=project(x,z),sx=p.x-camX+cssW/2,sy=p.y-camY+cssH*.53;
    ctx.fillStyle='#253b3433';ctx.beginPath();ctx.ellipse(sx+4,sy+10,45,17,0,0,Math.PI*2);ctx.fill();
    const wall=type==='lab'?'#e1c49b':'#e9d8b8', roof=type==='lab'?'#bd6553':'#78a3a0';
    // isometric building body
    ctx.fillStyle='#9d8064';ctx.beginPath();ctx.moveTo(sx-36,sy-16);ctx.lineTo(sx,sy-1);ctx.lineTo(sx,sy+32);ctx.lineTo(sx-36,sy+17);ctx.closePath();ctx.fill();
    ctx.fillStyle='#c4a982';ctx.beginPath();ctx.moveTo(sx,sy-1);ctx.lineTo(sx+37,sy-16);ctx.lineTo(sx+37,sy+17);ctx.lineTo(sx,sy+32);ctx.closePath();ctx.fill();
    ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(sx-42,sy-18);ctx.lineTo(sx,sy-38);ctx.lineTo(sx+43,sy-18);ctx.lineTo(sx,sy+1);ctx.closePath();ctx.fill();
    ctx.fillStyle=type==='lab'?'#de8061':'#94c6b3';ctx.beginPath();ctx.moveTo(sx-38,sy-17);ctx.lineTo(sx,sy-36);ctx.lineTo(sx+36,sy-18);ctx.lineTo(sx,sy-2);ctx.closePath();ctx.fill();
    ctx.fillStyle=wall;ctx.fillRect(sx-7,sy+6,13,25);ctx.fillStyle='#694e48';ctx.fillRect(sx-5,sy+9,10,22);
    ctx.fillStyle='#8ec4c6';ctx.fillRect(sx-29,sy-5,10,9);ctx.fillStyle='#65918e';ctx.fillRect(sx+18,sy-7,10,9);
    ctx.fillStyle='#f1e8ca';ctx.font='500 8px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(type==='lab'?'ROWAN LAB':'HEALING HOUSE',sx,sy-44);
    if(type==='clinic'){ctx.fillStyle='#f8eadd';ctx.fillRect(sx-2,sy+12,3,11);ctx.fillRect(sx-6,sy+16,11,3);}
  }
  function drawHero(x,z,time){
    const p=project(x,z),sx=p.x-camX+cssW/2,sy=p.y-camY+cssH*.53;
    const bounce=Math.sin(time/115)*1.8;
    ctx.fillStyle='#263a3140';ctx.beginPath();ctx.ellipse(sx,sy+6,10,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#39343d';ctx.fillRect(sx-6,sy-10+bounce,5,13);ctx.fillRect(sx+1,sy-10+bounce,5,13);
    ctx.fillStyle='#df6654';ctx.fillRect(sx-8,sy-24+bounce,16,15);ctx.fillStyle='#f2d5a9';ctx.fillRect(sx-6,sy-31+bounce,12,10);
    ctx.fillStyle='#333039';ctx.fillRect(sx-7,sy-35+bounce,14,6);ctx.fillRect(sx-10,sy-32+bounce,5,4);ctx.fillStyle='#d3b375';ctx.fillRect(sx-7,sy-31+bounce,14,2);
    ctx.fillStyle='#4f5361';ctx.fillRect(sx-8,sy-10+bounce,7,3);ctx.fillRect(sx+1,sy-10+bounce,7,3);
    ctx.fillStyle='#2e3440';ctx.fillRect(sx+3,sy-27+bounce,2,2);
  }
  let camX=0,camY=0;

  function resize(){
    const r=canvas.getBoundingClientRect();cssW=r.width;cssH=r.height;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function render(time){
    finishMove(time);
    ctx.clearRect(0,0,cssW,cssH);
    const sky=ctx.createLinearGradient(0,0,0,cssH);sky.addColorStop(0,'#a9d0c0');sky.addColorStop(.58,'#9cc89e');sky.addColorStop(1,'#80ad78');ctx.fillStyle=sky;ctx.fillRect(0,0,cssW,cssH);
    const mix=player.moveAt?Math.min(1,(time-player.moveAt)/145):1;
    const eased=mix*mix*(3-2*mix),hx=player.fromX+(player.toX-player.fromX)*eased,hz=player.fromZ+(player.toZ-player.fromZ)*eased;
    const hp=project(hx,hz);camX+=(hp.x-camX)*.12;camY+=(hp.y-camY)*.12;
    const tiles=[];for(let x=0;x<mapSize;x++)for(let z=0;z<mapSize;z++)tiles.push({x,z,depth:x+z});tiles.sort((a,b)=>a.depth-b.depth);
    for(const t of tiles){const p=project(t.x,t.z),sx=p.x-camX+cssW/2,sy=p.y-camY+cssH*.53;
      if(sx < -65||sx>cssW+65||sy < -80||sy>cssH+80)continue;
      const type=tileType(t.x,t.z);drawTile(sx,sy,type,t.x,t.z,time);
      if(type==='tall')drawGrass(sx,sy,t.x,t.z,time);
      if(type!=='water'&&type!=='path'&&type!=='tall'&&(t.x<3||t.z<3||t.x>19||t.z>19||hash(t.x+12,t.z+5)>.955)&&!(t.x>=3&&t.x<=10&&t.z>=3&&t.z<=10)){
        if(hash(t.x,t.z)>.48)drawTree(sx,sy,hash(t.x+2,t.z)> .5?1:0);
      }
    }
    drawBuilding(4,4,'lab',camX,camY);drawBuilding(9,5,'clinic',camX,camY);
    // A few hand-placed landmarks and a sunlit pond bank.
    for(const [x,z,label] of [[12,7,'ROUTE 01'],[16,13,'STILLWATER POND']]){
      const p=project(x,z),sx=p.x-camX+cssW/2,sy=p.y-camY+cssH*.53;
      if(sx>0&&sx<cssW&&sy>0&&sy<cssH){ctx.fillStyle='#24342b88';ctx.font='500 8px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(label,sx,sy-19);}
    }
    drawHero(hx,hz,time);
    // A small fluttering firefly trail gives the meadow a living, gentle feel.
    for(let i=0;i<6;i++){
      const x=player.x+Math.sin(time/1300+i*4)*4+i*.62,z=player.z+Math.cos(time/1500+i*5)*3;
      const p=project(x,z),sx=p.x-camX+cssW/2,sy=p.y-camY+cssH*.53-24-Math.sin(time/220+i)*3;
      ctx.globalAlpha=.35+Math.sin(time/260+i)*.22;ctx.fillStyle='#fff5bd';ctx.beginPath();ctx.arc(sx,sy,1.3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(state.battle){const tint=ctx.createLinearGradient(0,0,0,cssH);tint.addColorStop(0,'#1828211a');tint.addColorStop(1,'#16221c40');ctx.fillStyle=tint;ctx.fillRect(0,0,cssW,cssH);}
    raf=requestAnimationFrame(render);
  }
  function startRender(){resize();if(!raf)raf=requestAnimationFrame(render);}

  function makeMon(spec,level=3){return {spec,level,maxHp:spec.hp+Math.max(0,level-3)*3,hp:spec.hp+Math.max(0,level-3)*3,xp:0};}
  let selectedStarter=0;
  function setupStarters(){
    const list=$('starter-list');list.innerHTML='';
    starters.forEach((s,i)=>{const b=document.createElement('button');b.className='starter-choice'+(i===selectedStarter?' selected':'');b.innerHTML=`<span class="starter-emoji">${s.icon}</span><span class="starter-desc"><strong>${s.name}</strong><small>${s.note}</small></span><span class="starter-type">${s.type}</span>`;b.addEventListener('click',()=>{selectedStarter=i;updateStarterFocus();beginGame();});list.appendChild(b);});
  }
  function updateStarterFocus(){[...document.querySelectorAll('.starter-choice')].forEach((el,i)=>el.classList.toggle('selected',i===selectedStarter));}
  function beginGame(){
    if(state.started)return;state.started=true;state.starter=starters[selectedStarter];const mon=makeMon(state.starter,5);mon.hp=mon.maxHp;state.party.push(mon);state.caught.add(mon.spec.name);
    $('start-screen').classList.add('dismissed');$('partner-short').textContent=mon.spec.name;$('ally-art').textContent=mon.spec.icon;$('ally-name').textContent=mon.spec.name;$('ally-level').textContent=mon.level;
    $('tip-copy').textContent='Tall grass grows along the northern trail. Step inside and see who crosses your path.';
    showToast(`Professor Rowan: ${mon.spec.name} is a fine choice. The meadow is yours to explore!`);updateParty();updateQuest();updateHint();beep(540,.09);
  }
  function updateParty(){
    const list=$('party-list');list.innerHTML='';
    if(!state.party.length){list.innerHTML='<div class="empty-party"><span>✳</span> Your first partner is waiting.</div>';}
    state.party.forEach(m=>{const el=document.createElement('div');el.className='party-mon';const pct=Math.max(0,m.hp/m.maxHp*100);el.innerHTML=`<div class="party-icon">${m.spec.icon}</div><div class="party-main"><strong>${m.spec.name}</strong><small>${m.spec.type} TYPE</small><div class="party-mini-hp"><i style="width:${pct}%;background:${pct<30?'#df796c':'#a3c77e'}"></i></div></div><span class="party-lv">LV ${String(m.level).padStart(2,'0')}</span>`;list.appendChild(el);});
    $('party-count').textContent=`${state.party.length} / 6`;$('caught-count').textContent=state.caught.size;$('trainer-level').textContent=String(state.level).padStart(2,'0');
  }
  function updateQuest(){
    let progress=0,title='A PARTNER FOR THE ROAD',copy='Choose your first partner from Professor Rowan, then head into the meadow.',caption='MEET YOUR PARTNER';
    if(state.started){progress=1;title='THE MEADOW CALLS';copy=`Find and befriend two wild creatures in the tall grass. Wild friends are easiest to catch when their energy is low. (${state.caughtWild||0} / 2)`;caption='FIND TWO WILD FRIENDS';}
    if(state.started&&state.caughtWild>=2){progress=3;title='A BADGE TO REMEMBER';copy='Your new friends are ready. Return to the Healing House in Pallet Town and press E to talk to Nurse Hazel.';caption='RETURN TO PALLET TOWN';}
    if(state.badges){progress=4;title='THE ROAD IS YOURS';copy='The Meadow Badge is yours! Keep exploring the Kanto trails and fill your field guide.';caption='MEADOW BADGE EARNED';}
    $('quest-title').textContent=title;$('quest-copy').textContent=copy;$('quest-progress-label').textContent=`${progress} / 4`;$('quest-progress-bar').style.width=`${progress*25}%`;$('step-caption').textContent=caption;
    ['step-starter','step-catch1','step-catch2','step-return'].forEach((id,i)=>$(id).classList.toggle('done',progress>i));$('badge-count').innerHTML=`${String(state.badges).padStart(2,'0')} <i> / 08</i>`;
  }
  function showToast(text,duration=3200){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),duration);}
  function beep(freq=450,duration=.08){if(!state.sound)return;try{const ac=beep.ac||(beep.ac=new AudioContext()),o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.035,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+duration);}catch(_){}}
  function playerMon(){return state.party[0];}
  function nearby(to){return Math.abs(player.x-to[0])+Math.abs(player.z-to[1])<=4;}
  function updateHint(){
    const hint=$('scene-hint');if(!state.started){hint.classList.add('quiet');return;}
    hint.classList.remove('quiet');let text='WANDER INTO THE TALL GRASS';
    if(state.caughtWild>=2&&!state.badges&&nearby([9,5]))text='EARN YOUR MEADOW BADGE';
    else if(nearby([9,5]))text='E · HEAL & TALK TO NURSE HAZEL';
    else if(nearby([4,4]))text='E · TALK TO PROFESSOR ROWAN';
    else if(tileType(player.x,player.z)==='tall')text='THE GRASS IS RUSTLING…';
    $('hint-text').textContent=text;
  }
  function move(dir){
    if(!state.started||state.battle||player.moveAt)return;
    const [dx,dz]=directions[dir]||[];if(dx===undefined)return;
    const nx=player.x+dx,nz=player.z+dz;if(blocked(nx,nz))return;
    player.fromX=player.x;player.fromZ=player.z;player.toX=nx;player.toZ=nz;player.moveAt=performance.now();player.dir=dir;player.step++;
    state.steps++;state.encounterLock=Math.max(0,state.encounterLock-1);updateHint();
    if(tileType(nx,nz)==='tall'&&state.encounterLock===0&&Math.random()<.17){state.encounterLock=4;setTimeout(()=>{if(!state.battle)beginEncounter();},190);}
    if(state.steps%5===0)updateQuest();
  }
  function finishMove(now){if(player.moveAt&&now-player.moveAt>=145){player.x=player.toX;player.z=player.toZ;player.moveAt=0;updateHint();}}
  function interact(){
    if(!state.started){beginGame();return;}
    if(state.battle)return;
    if(nearby([9,5])){
      if(state.caughtWild>=2&&!state.badges){state.badges=1;state.party.forEach(m=>m.hp=m.maxHp);updateParty();updateQuest();showToast('Nurse Hazel pins the Meadow Badge to your jacket. “Your adventure starts now, Red.”',5200);beep(750,.2);}
      else{state.party.forEach(m=>m.hp=m.maxHp);updateParty();showToast('Nurse Hazel: All your friends are feeling bright and bouncy again.');beep(620,.08);}
      return;
    }
    if(nearby([4,4])){showToast(state.caughtWild>=2?'Professor Rowan: You have a real knack for making friends. Head back to Nurse Hazel for your badge!':'Professor Rowan: Look for the darker, rustling grass north of town. Wild creatures love to hide there.');return;}
    showToast('Nothing close by to interact with. Follow the path toward the tall grass!');
  }
  state.caughtWild=0;
  function beginEncounter(){
    if(!state.started||state.battle)return;
    const options=species.filter(s=>s!==state.starter);const spec=options[Math.floor(Math.random()*options.length)];const wild=makeMon(spec,2+Math.floor(Math.random()*3));
    state.battle={wild,locked:false};const ally=playerMon();
    $('wild-art').textContent=spec.icon;$('wild-name').textContent=spec.name;$('wild-type').textContent=`${spec.type} · LV ${wild.level}`;$('battle-turn').textContent=`A wild ${spec.name} appeared!`;$('battle-message').textContent=`${spec.name} is watching you carefully.`;
    $('ally-art').textContent=ally.spec.icon;$('ally-name').textContent=ally.spec.name;$('ally-level').textContent=ally.level;
    $('battle-panel').classList.remove('hidden');$('scene-hint').classList.add('quiet');updateBattleBars();beep(330,.12);
  }
  function updateBattleBars(){
    if(!state.battle)return;const {wild}=state.battle,ally=playerMon();
    $('wild-hp').style.width=`${Math.max(0,wild.hp/wild.maxHp*100)}%`;$('wild-hp').style.background=wild.hp/wild.maxHp<.3?'#df796c':'#a9cb80';$('wild-hp-label').textContent=`HP ${Math.max(0,wild.hp)} / ${wild.maxHp}`;
    $('ally-hp').style.width=`${Math.max(0,ally.hp/ally.maxHp*100)}%`;$('ally-hp').style.background=ally.hp/ally.maxHp<.3?'#df796c':'#a9cb80';$('ally-hp-label').textContent=`HP ${Math.max(0,ally.hp)} / ${ally.maxHp}`;
  }
  function battleMessage(text){$('battle-message').textContent=text;}
  function enemyTurn(){
    if(!state.battle)return;const {wild}=state.battle,ally=playerMon();
    if(wild.hp<=0){winBattle();return;}
    const damage=Math.max(2,wild.spec.atk+Math.floor(Math.random()*3)-Math.floor(ally.level/3));ally.hp=Math.max(0,ally.hp-damage);updateBattleBars();
    if(ally.hp===0){ally.hp=Math.max(1,Math.ceil(ally.maxHp*.45));battleMessage(`${ally.spec.name} needs a breather. It rallies with a little HP restored!`);}
    else battleMessage(`${wild.spec.name} nudges ${ally.spec.name} for ${damage} damage.`);
    updateParty();
  }
  function attack(){
    if(!state.battle||state.battle.locked)return;state.battle.locked=true;const {wild}=state.battle,ally=playerMon();
    const damage=ally.spec.atk+Math.floor(Math.random()*4)+Math.floor(ally.level/2);wild.hp=Math.max(0,wild.hp-damage);updateBattleBars();beep(510,.07);
    if(wild.hp===0){battleMessage(`${ally.spec.name} landed a lovely hit!`);setTimeout(winBattle,500);return;}
    battleMessage(`${ally.spec.name} sends a ${damage}-point ${ally.spec.type.toLowerCase()} burst!`);setTimeout(()=>{if(state.battle){enemyTurn();if(state.battle)setTimeout(()=>{if(state.battle)state.battle.locked=false;},280);}},650);
  }
  function capture(){
    if(!state.battle||state.battle.locked)return;state.battle.locked=true;const wild=state.battle.wild;
    const chance=.22+(1-wild.hp/wild.maxHp)*.72;beep(690,.08);
    if(Math.random()<chance){
      const mon=makeMon(wild.spec,wild.level);mon.hp=Math.max(1,Math.ceil(wild.hp));if(state.party.length<6)state.party.push(mon);
      state.caught.add(wild.spec.name);state.caughtWild++;updateParty();updateQuest();
      battleMessage(`${wild.spec.name} joined your field crew!`);$('battle-turn').textContent='A NEW FRIEND!';$('wild-art').style.transform='scale(.45)';
      setTimeout(()=>endBattle(`${wild.spec.name} is now in your party. What a good catch!`),850);return;
    }
    battleMessage(`${wild.spec.name} wriggled free! Try again when it's tired.`);setTimeout(()=>{if(state.battle){enemyTurn();if(state.battle)setTimeout(()=>{if(state.battle)state.battle.locked=false;},250);}},650);
  }
  function runAway(){if(!state.battle||state.battle.locked)return;state.battle.locked=true;battleMessage('You wave goodbye and step back onto the trail.');setTimeout(()=>endBattle('You made it back to the meadow path.'),450);}
  function winBattle(){if(!state.battle)return;const wild=state.battle.wild,ally=playerMon(),gained=12+wild.level*2;state.xp+=gained;ally.xp+=gained;if(ally.xp>=30){ally.xp-=30;ally.level++;ally.maxHp+=3;ally.hp=Math.min(ally.maxHp,ally.hp+5);state.level++;battleMessage(`${ally.spec.name} grew to level ${ally.level}!`);}else battleMessage(`${wild.spec.name} scampered off. ${ally.spec.name} earned ${gained} XP.`);updateParty();setTimeout(()=>endBattle('The tall grass settles around you again.'),850);}
  function endBattle(text){state.battle=null;$('battle-panel').classList.add('hidden');$('wild-art').style.transform='';updateHint();updateParty();if(text)showToast(text,2600);}
  $('attack-btn').addEventListener('click',attack);$('capture-btn').addEventListener('click',capture);$('run-btn').addEventListener('click',runAway);
  function updateArea(){
    const t=tileType(player.x,player.z);let name='ROUTE 01';
    if(t==='town')name='PALLET MEADOW';else if(t==='tall')name='CLOVER PATCH';else if(t==='water')name='STILLWATER POND';
    $('location-name').textContent=name;$('area-label').textContent=name;
  }
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
    if(state.battle){if(key==='1')attack();else if(key==='2')capture();else if(key==='3'||key==='escape')runAway();return;}
    if(!state.started&&['arrowleft','arrowright','a','d'].includes(key)){selectedStarter=(selectedStarter+(key==='arrowleft'||key==='a'?2:1))%3;updateStarterFocus();return;}
    if(!state.started&&['arrowup','arrowdown','w','s'].includes(key)){selectedStarter=(selectedStarter+(key==='arrowup'||key==='w'?2:1))%3;updateStarterFocus();return;}
    if(['arrowup','w'].includes(key))move('up');else if(['arrowdown','s'].includes(key))move('down');else if(['arrowleft','a'].includes(key))move('left');else if(['arrowright','d'].includes(key))move('right');
    else if(key==='e'||key===' '){if(!state.started)beginGame();else interact();}
    else if(key==='enter'&&!state.started)beginGame();
  });
  document.querySelectorAll('.mobile-pad button').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();move(button.dataset.dir);});
    button.addEventListener('contextmenu',e=>e.preventDefault());
  });
  $('sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;$('sound-state').textContent=state.sound?'ON':'OFF';if(state.sound){beep(540,.08);}});
  window.addEventListener('resize',resize);if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);
  const areaUpdate=updateHint;updateHint=function(){updateArea();areaUpdate();};
  setupStarters();updateParty();updateQuest();startRender();
})();
