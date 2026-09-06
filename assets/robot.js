(() => {
  'use strict';
  const canvas = document.getElementById('robot-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const button = document.querySelector('.robot-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, visible = true, frame = 0, last = 0, elapsed = 0;
  let size = 450, height = 450, scale = 5, pointer = null, yaw = -.28, shoulder = 1.25, elbow = -1.6;
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const mul = (a,k) => a.map(v => v*k);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => mul(a,1/(Math.hypot(...a)||1));
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  // Orthographic overhead view: XY is the working plane; +Z faces the viewer.
  const camera = p => [p[0],p[1],-p[2]];
  const project = p => { const q=camera(p); return [size*.5+q[0]*scale,height*.5-q[1]*scale]; };
  let faces=[];
  function tube(a,b,r,color,segments=12) {
    const axis=unit(sub(b,a));
    const u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0]));
    const v=cross(axis,u), rings=[a,b].map(c => Array.from({length:segments},(_,i) => add(c,add(mul(u,r*Math.cos(i*2*Math.PI/segments)),mul(v,r*Math.sin(i*2*Math.PI/segments))))));
    const push=(pts,shade)=>faces.push({pts,color:color.map(c=>Math.round(c*shade)),depth:pts.reduce((n,p)=>n+camera(p)[2],0)/pts.length});
    for(let i=0;i<segments;i++) { const j=(i+1)%segments;push([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],.6+.35*(1+Math.cos(i*2*Math.PI/segments-.6))/2); }
    push(rings[0],.65);push(rings[1],1);
  }
  function line(points,color,width=1) { ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(); }
  const mint=[114,224,186], steel=[107,138,154], dark=[33,61,76], blue=[106,174,247];
  function draw(dt=0) {
    ctx.clearRect(0,0,size,height);faces=[];
    const t=elapsed;
    // Invert the same orthographic camera used for rendering, on world z=0.
    // Solve for the actual gripping point, not the wrist joint.
    const screenTarget=pointer || {x:size*.5+Math.cos(t*.35)*scale*35,y:height*.5-scale*(38+Math.sin(t*.35)*8)};
    const tx=(screenTarget.x-size*.5)/scale;
    const ty=(height*.5-screenTarget.y)/scale;
    const distance=Math.hypot(tx,ty);
    const direction=distance>.001?[tx/distance,ty/distance,0]:[1,0,0];
    const tip=[tx,ty,0];
    const p0=[0,0,0], p2=sub(tip,mul(direction,10));
    const d=Math.hypot(p2[0],p2[1]);
    const axis=d>.001?mul(p2,1/d):[1,0,0];
    // Restore telescopic reach while keeping the base and compact idle pose.
    const length=Math.max(31,d/2+1.5);
    const bend=Math.sqrt(Math.max(0,length*length-d*d/4));
    const p1=add(mul(p2,.5),mul([-axis[1],axis[0],0],bend));
    tube([0,0,-15],[0,0,-12],10,dark,24);
    tube([0,0,-12],[0,0,-10],9,mint,24);
    tube([0,0,-10],p0,5,steel,20);
    const link=(a,b,r)=>{
      const delta=sub(b,a), mid=add(a,mul(delta,.58));
      tube(a,mid,r,steel);tube(mid,b,r*.72,dark);
      tube(add(a,[0,0,r]),add(mid,[0,0,r]),.5,mint,8);
    };
    link(p0,p1,2.8);link(p1,p2,2.3);
    const joint=(p,r)=>{tube(add(p,[0,0,-3]),add(p,[0,0,3]),r,dark,20);tube(add(p,[0,0,3]),add(p,[0,0,3.8]),r*.72,mint,20);};
    joint(p0,4.8);joint(p1,3.8);joint(p2,3);
    const wrist=add(p2,mul(direction,3));tube(p2,wrist,1.8,blue);
    const side=[-direction[1],direction[0],0];
    for(const sign of [-1,1]) {
      const knuckle=add(wrist,mul(side,sign*3));
      const finger=add(sub(tip,mul(direction,2)),mul(side,sign*2.4));
      tube(wrist,knuckle,1,steel,8);tube(knuckle,finger,.8,steel,8);tube(finger,tip,.7,mint,8);
    }
    faces.sort((a,b)=>b.depth-a.depth).forEach(f=>{ctx.beginPath();f.pts.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.fillStyle=`rgb(${f.color.join(',')})`;ctx.fill();ctx.strokeStyle='rgba(7,16,23,.23)';ctx.lineWidth=.5;ctx.stroke();});
  }
  function tick(now) { frame=0;const dt=last?Math.min((now-last)/1000,.05):0;last=now;elapsed+=dt;draw(dt);schedule(); }
  function schedule() { if(!paused&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick); }
  function stop() { if(frame)cancelAnimationFrame(frame);frame=0;last=0; }
  function setPaused(value) { paused=value;button.textContent=paused?'Play animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',button.textContent);if(paused)stop();else schedule(); }
  function resize() {const bounds=canvas.getBoundingClientRect();size=bounds.width;height=bounds.height;scale=Math.min(size,height)/240;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(size*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?schedule():stop();}).observe(canvas);
  window.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||paused)return;const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top};});
  document.documentElement.addEventListener('pointerleave',()=>{pointer=null;});
  button.addEventListener('click',()=>setPaused(!paused));
  document.addEventListener('visibilitychange',()=>document.hidden?stop():schedule());
  reduced.addEventListener('change',e=>{setPaused(e.matches);draw();});
  setPaused(paused);resize();
})();
