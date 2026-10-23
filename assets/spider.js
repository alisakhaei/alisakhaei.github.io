/* Original six-legged cursor companion. Local canvas renderer; no tracking services. */
(() => {
  'use strict';
  const canvas = document.getElementById('robot-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const control = document.querySelector('.robot-motion');
  const label = control.querySelector('.motion-label');
  const icon = control.querySelector('.motion-icon');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, zoom = 1, raf = 0, previous = 0;
  let paused = reduced.matches, elapsed = 0, moving = 0, activeGroup = 0;
  const body = {x:0, y:0, angle:-.55};
  const trail = [];
  const legs = [];
  const footprints = [];
  let cursor=null, activeProject=null, dockSide=null, lookTarget=null;
  let rest=0, scanPhase=-1, scanDone=true, acknowledgement=0, turning=false;
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const mul = (a,k) => a.map(v => v*k);
  const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
  const norm = a => Math.hypot(...a);
  const unit = a => mul(a,1/(norm(a)||1));
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const local = (x,y,z=0) => [body.x+(x*Math.cos(body.angle)-y*Math.sin(body.angle))*zoom,body.y+(x*Math.sin(body.angle)+y*Math.cos(body.angle))*zoom,z*zoom];
  const project = p => [p[0],p[1]-p[2]*.68];
  function resetFeet() {
    legs.length = 0;
    for (let side=-1;side<=1;side+=2) for(let row=0;row<3;row++) {
      const home=[side*(row===1?64:55),(row-1)*41];
      legs.push({side,row,home,group:(row+(side===1?1:0))%2,foot:local(...home),start:null,end:null,phase:1});
    }
  }
  function queuePoint(x,y,docking=false) {
    if(paused) return;
    if(!docking){
      cursor={x,y};
      if(activeProject)return;
    }
    rest=0;scanPhase=-1;scanDone=docking;
    const margin=Math.min(76*zoom,width*.2,height*.2);
    x=clamp(x,margin,width-margin);y=clamp(y,margin,height-margin);
    // Always pursue the latest position; discard stale cursor history.
    trail.length=0;
    trail.push({x,y,docking});
    start();
  }
  function dockProject(element) {
    if(paused)return;
    if(activeProject!==element){
      activeProject?.classList.remove('spider-inspecting');
      activeProject=element;dockSide=null;
      activeProject.classList.add('spider-inspecting');
    }
    const r=element.getBoundingClientRect(),pad=70*zoom;
    const center={x:(r.left+r.right)/2,y:clamp((r.top+r.bottom)/2,pad,height-pad)};
    if(r.bottom<0||r.top>height){leaveProject(element);return;}
    const options=[{side:'left',x:r.left-pad,y:center.y},{side:'right',x:r.right+pad,y:center.y},{side:'top',x:center.x,y:r.top-pad},{side:'bottom',x:center.x,y:r.bottom+pad}];
    const available=options.filter(p=>p.x>=pad&&p.x<=width-pad&&p.y>=pad&&p.y<=height-pad);
    const chosen=available.find(p=>p.side===dockSide)||available.sort((a,b)=>Math.hypot(a.x-body.x,a.y-body.y)-Math.hypot(b.x-body.x,b.y-body.y))[0]||{side:'edge',x:r.right-pad,y:clamp(r.top+pad,pad,height-pad)};
    dockSide=chosen.side;lookTarget=center;
    queuePoint(chosen.x,chosen.y,true);
  }
  function leaveProject(element){
    if(activeProject!==element)return;
    activeProject.classList.remove('spider-inspecting');activeProject=null;dockSide=null;lookTarget=null;
    if(cursor)queuePoint(cursor.x,cursor.y);
  }
  function update(dt) {
    elapsed+=dt;
    acknowledgement=Math.max(0,acknowledgement-dt);
    for(let i=footprints.length-1;i>=0;i--){footprints[i].age+=dt;if(footprints[i].age>1.5)footprints.splice(i,1);}
    const oldX=body.x,oldY=body.y;
    if(trail.length) {
      const target=trail[0],dx=target.x-body.x,dy=target.y-body.y,d=Math.hypot(dx,dy);
      const stop=target.docking?1:22*zoom;
      if(d<=stop+1)trail.length=0;
      else {
        const step=Math.min(900*zoom*dt,(d-stop)*(1-Math.exp(-dt*11)));
        body.x+=dx/d*step;body.y+=dy/d*step;
      }
    }
    const distance=Math.hypot(body.x-oldX,body.y-oldY);
    moving+=(Math.min(1,distance/(dt*150*zoom||1))-moving)*(1-Math.exp(-dt*10));
    turning=false;
    if(distance>.01){
      const desired=Math.atan2(body.y-oldY,body.x-oldX)+Math.PI/2;
      const diff=Math.atan2(Math.sin(desired-body.angle),Math.cos(desired-body.angle));
      body.angle+=clamp(diff,-dt*16,dt*16);
    }
    else if(!trail.length&&(activeProject||(!scanDone&&cursor))){
      const target=lookTarget||cursor;
      const desired=Math.atan2(target.y-body.y,target.x-body.x)+Math.PI/2;
      const diff=Math.atan2(Math.sin(desired-body.angle),Math.cos(desired-body.angle));
      turning=Math.abs(diff)>.005;
      body.angle+=clamp(diff,-dt*5,dt*5);
    }
    if(!trail.length&&moving<.02&&!activeProject&&!scanDone){
      rest+=dt;
      if(rest>.4){scanPhase=Math.max(0,scanPhase)+dt;if(scanPhase>=1.25){scanPhase=-1;scanDone=true;}}
    }
    const stepping=legs.some(l=>l.phase<1);
    if(!stepping){
      let candidates=legs.filter(l=>l.group===activeGroup);
      let error=Math.max(...candidates.map(l=>norm(sub(local(...l.home),l.foot))));
      if(error<13*zoom){candidates=legs.filter(l=>l.group!==activeGroup);error=Math.max(...candidates.map(l=>norm(sub(local(...l.home),l.foot))));}
      if(error>13*zoom){
        activeGroup=1-candidates[0].group;
        for(const leg of candidates){leg.start=leg.foot.slice();leg.end=local(leg.home[0],leg.home[1]-moving*17);leg.phase=0;}
      }
    }
    for(const leg of legs)if(leg.phase<1){
      const stepDuration=clamp(20/(distance/dt||1),.035,.15);
      leg.phase=Math.min(1,leg.phase+dt/stepDuration);
      const t=leg.phase, ease=t*t*(3-2*t);
      leg.foot=add(mul(leg.start,1-ease),mul(leg.end,ease));leg.foot[2]=Math.sin(t*Math.PI)*13*zoom;
      if(leg.phase===1&&distance>.02){
        footprints.push({x:leg.foot[0],y:leg.foot[1],angle:body.angle,age:0});
        if(footprints.length>42)footprints.shift();
      }
    }
  }
  let shapes=[];
  const colors={shell:[96,110,110],edge:[46,57,60],dark:[26,32,34],alloy:[151,166,164],orange:[255,128,80]};
  function face(points,color,shade=1){shapes.push({points,color:color.map(v=>Math.round(clamp(v*shade,0,255))),depth:points.reduce((s,p)=>s+p[2]+p[1]*.003,0)/points.length});}
  function rod(a,b,r,color,sides=7){
    const axis=unit(sub(b,a));
    const u=unit(cross(axis,Math.abs(axis[2])>.9?[0,1,0]:[0,0,1])),v=cross(axis,u);
    const ring=c=>Array.from({length:sides},(_,i)=>add(c,add(mul(u,r*Math.cos(i*2*Math.PI/sides)),mul(v,r*Math.sin(i*2*Math.PI/sides)))));
    const first=ring(a),last=ring(b);
    for(let i=0;i<sides;i++){const j=(i+1)%sides;face([first[i],first[j],last[j],last[i]],color,.6+.4*(1+Math.sin(i*2*Math.PI/sides))/2);}
    face(first,color,.7);face(last,color,1.05);
  }
  function plate(points,z,h,color){
    const bottom=points.map(p=>local(p[0],p[1],z)),top=points.map(p=>local(p[0],p[1],z+h));
    face(top,color,1.1);
    for(let i=0;i<points.length;i++){const j=(i+1)%points.length;face([bottom[i],bottom[j],top[j],top[i]],color,i%2?.55:.75);}
  }
  function draw(){
    ctx.clearRect(0,0,width,height);shapes=[];
    for(const mark of footprints){ctx.save();ctx.translate(mark.x,mark.y);ctx.rotate(mark.angle);ctx.fillStyle=`rgba(184,194,183,${.18*(1-mark.age/1.5)})`;ctx.fillRect(-1.1*zoom,-2.5*zoom,2.2*zoom,5*zoom);ctx.restore();}
    const sensor=activeProject?[126,226,207]:scanPhase>=0?[255,188,114]:colors.orange;
    const bob=moving*Math.sin(elapsed*19)*.8+(acknowledgement>0?Math.sin((.65-acknowledgement)*Math.PI/.65)*3:0);
    if(scanPhase>=0&&cursor){
      const progress=scanPhase/1.25,alpha=Math.sin(progress*Math.PI);
      ctx.save();
      ctx.strokeStyle=`rgba(255,164,98,${alpha*.35})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(cursor.x,cursor.y,(9+progress*24)*zoom,progress*4,progress*4+Math.PI*1.4);ctx.stroke();
      const origin=project(local(0,-31,21));
      ctx.strokeStyle=`rgba(255,164,98,${alpha*.14})`;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(cursor.x,cursor.y);ctx.stroke();ctx.restore();
    }
    if(acknowledgement>0){ctx.strokeStyle=`rgba(126,226,207,${acknowledgement*.35})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(body.x,body.y,(40+(.65-acknowledgement)*45)*zoom,26*zoom,body.angle,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(body.x,body.y+8*zoom);ctx.rotate(body.angle);ctx.scale(1,.72);ctx.fillStyle='rgba(0,0,0,.3)';ctx.shadowColor='#000';ctx.shadowBlur=16*zoom;ctx.beginPath();ctx.ellipse(0,0,42*zoom,50*zoom,0,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const leg of legs){
      const hip=local(leg.side*16,(leg.row-1)*17,19+bob);
      const delta=sub(leg.foot,hip),distance=norm(delta);
      const direction=unit(delta),l1=31*zoom,l2=44*zoom,d=clamp(distance,Math.abs(l1-l2)+.01,l1+l2-.01);
      const along=(l1*l1-l2*l2+d*d)/(2*d);
      const outward=unit(sub(local(leg.side*70,(leg.row-1)*30,65),hip));
      const perpendicular=unit(sub(outward,mul(direction,dot(outward,direction))));
      const knee=add(hip,add(mul(direction,along),mul(perpendicular,Math.sqrt(Math.max(0,l1*l1-along*along)))));
      const foot=add(hip,mul(direction,d));
      rod(hip,knee,3.7*zoom,colors.edge);
      rod(add(hip,[0,0,1.8*zoom]),add(knee,[0,0,1.8*zoom]),1.6*zoom,colors.alloy);
      rod(knee,foot,3*zoom,colors.shell);
      rod(knee,add(knee,mul(sub(foot,knee),.55)),3.8*zoom,colors.dark);
      rod(add(knee,[0,0,-2*zoom]),add(knee,[0,0,3*zoom]),4.2*zoom,colors.edge,12);
      rod(add(knee,[0,0,3*zoom]),add(knee,[0,0,3.8*zoom]),2.4*zoom,colors.orange,12);
      rod(foot,add(foot,[0,0,2*zoom]),2*zoom,colors.dark,8);
    }
    // Beveled chassis, separate side housings, visible fasteners, forward optics.
    const hull=[[-13,-28],[13,-28],[20,-19],[20,19],[13,28],[-13,28],[-20,19],[-20,-19]];
    plate(hull,15+bob,9,colors.edge);
    plate([[-10,-25],[10,-25],[16,-16],[16,17],[9,23],[-9,23],[-16,17],[-16,-16]],24+bob,3,colors.shell);
    plate([[-8,-18],[8,-18],[8,9],[-8,9]],27+bob,2,colors.dark);
    for(let y=-12;y<7;y+=4)rod(local(-5,y,29+bob),local(5,y,29+bob),.55*zoom,colors.alloy,5);
    for(const side of [-1,1]){
      plate([[side*16,-18],[side*21,-15],[side*21,14],[side*16,18]],20+bob,7,colors.dark);
      rod(local(side*17,-10,28+bob),local(side*17,8,28+bob),.85*zoom,colors.orange,6);
      for(const y of [-19,17])rod(local(side*11,y,27+bob),local(side*11,y,28+bob),1.3*zoom,colors.alloy,8);
      rod(local(side*8,-24,21+bob),local(side*8,-31,21+bob),3*zoom,colors.dark,10);
      rod(local(side*8,-31,21+bob),local(side*8,-32,21+bob),2.1*zoom,sensor,10);
    }
    plate([[-7,13],[7,13],[7,19],[-7,19]],27+bob,2,colors.orange);
    shapes.sort((a,b)=>a.depth-b.depth).forEach(s=>{ctx.beginPath();s.points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.fillStyle=`rgb(${s.color.join(',')})`;ctx.fill();ctx.strokeStyle='rgba(10,14,15,.2)';ctx.lineWidth=.45;ctx.stroke();});
  }
  function tick(time){raf=0;const dt=previous?Math.min((time-previous)/1000,.035):1/60;previous=time;update(dt);draw();if(!paused&&!document.hidden&&(trail.length||moving>.001||turning||!scanDone||acknowledgement>0||footprints.length||legs.some(l=>l.phase<1)))raf=requestAnimationFrame(tick);}
  function start(){if(!paused&&!document.hidden&&!raf){previous=0;raf=requestAnimationFrame(tick);}}
  function stop(){cancelAnimationFrame(raf);raf=0;previous=0;}
  function setPaused(value){paused=value;if(paused){scanPhase=-1;scanDone=true;acknowledgement=0;footprints.length=0;}label.textContent=paused?'Resume spider':'Pause spider';icon.textContent=paused?'▷':'Ⅱ';control.setAttribute('aria-pressed',String(paused));control.setAttribute('aria-label',paused?'Resume spider robot':'Pause spider robot');paused?stop():start();draw();}
  function resize(){const rect=canvas.getBoundingClientRect(),first=!width;const oldW=width||rect.width,oldH=height||rect.height;width=rect.width;height=rect.height;zoom=width<620?.7:1.05;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);body.x=first?width*.68:clamp(body.x/oldW*width,35,width-35);body.y=first?height*.82:clamp(body.y/oldH*height,50,height-40);trail.length=0;resetFeet();draw();}
  window.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')queuePoint(e.clientX,e.clientY);},{passive:true});
  window.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&!e.target.closest('a,button,dialog'))queuePoint(e.clientX,e.clientY);},{passive:true});
  document.querySelectorAll('.project-open').forEach(element=>{
    element.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')dockProject(element);});
    element.addEventListener('pointerleave',()=>leaveProject(element));
    element.addEventListener('focus',()=>dockProject(element));
    element.addEventListener('blur',()=>leaveProject(element));
    element.addEventListener('click',()=>{if(!paused){acknowledgement=.65;start();}});
  });
  window.addEventListener('scroll',()=>{if(activeProject)dockProject(activeProject);},{passive:true});
  window.addEventListener('blur',()=>{trail.length=0;stop();});
  window.addEventListener('focus',start);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  control.addEventListener('click',()=>setPaused(!paused));
  reduced.addEventListener('change',e=>setPaused(e.matches));
  new ResizeObserver(()=>{resize();footprints.length=0;if(activeProject)dockProject(activeProject);}).observe(canvas);
  resize();setPaused(paused);
})();
