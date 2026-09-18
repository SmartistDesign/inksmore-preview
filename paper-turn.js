/* Corner-driven paper surface. The fold is the perpendicular bisector of the
   original corner and the dragged corner, softened into a cylindrical bend.
   Orthographic projection keeps the paper tip attached to the pointer. */
(() => {
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const dot=(p,n)=>p.x*n.x+p.y*n.y;
  const rectangle=(w,h)=>[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];

  function clip(points,n,limit,below=true){
    const result=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const da=dot(a,n)-limit,db=dot(b,n)-limit;
      const insideA=below?da<=0:da>=0,insideB=below?db<=0:db>=0;
      if(insideA)result.push(a);
      if(insideA!==insideB){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    }
    return result;
  }

  function geometry(width,height,corner,point){
    const dx=corner.x-point.x,dy=corner.y-point.y,distance=Math.hypot(dx,dy);
    const n=distance>.001?{x:dx/distance,y:dy/distance}:{x:corner.x?1:-1,y:0};
    const middle=dot({x:(corner.x+point.x)/2,y:(corner.y+point.y)/2},n);
    // A small corner lift has a tight bend. It relaxes as the sheet is pulled.
    const radius=Math.max(.01,Math.min(width*.047,58,distance*.16));
    const a=middle-Math.PI*radius/2,b=middle+Math.PI*radius/2;
    const surface=u=>{
      if(u<=a)return {u,z:0,theta:0};
      if(u>=b)return {u:2*middle-u,z:2*radius,theta:Math.PI};
      const theta=(u-a)/radius;
      return {u:a+radius*Math.sin(theta),z:radius*(1-Math.cos(theta)),theta};
    };
    return {n,middle,radius,a,b,distance,surface,rect:rectangle(width,height)};
  }

  // Geometry can be verified in Node without a browser or a DOM mock.
  if(typeof module!=='undefined'&&module.exports){module.exports={geometry,clip};return;}


  const snapshots=new WeakMap();
  let embeddedFonts;
  function preserveScroll(native,clone){
    if(!native.classList?.contains('sheet-inner'))return;
    // The export library cannot serialize scroll offsets. Keep the existing
    // grid/flex layout intact inside a viewport translated to the reading point.
    const content=document.createElement('div');
    content.style.cssText=clone.style.cssText;
    Object.assign(content.style,{width:native.clientWidth+'px',height:native.clientHeight+'px',
      overflow:'visible',margin:'0',transform:'translateY('+(-native.scrollTop)+'px)'});
    while(clone.firstChild)content.append(clone.firstChild);
    Object.assign(clone.style,{display:'block',padding:'0',overflow:'hidden'});
    clone.append(content);
  }
  function prepare(source){
    const inner=source.querySelector('.sheet-inner');
    const key=[source.offsetWidth,source.offsetHeight,inner.scrollTop,inner.clientWidth,window.devicePixelRatio].join(':');
    const saved=snapshots.get(source);
    if(saved?.key===key)return saved.promise;
    const entry={key,promise:null};
    entry.promise=document.fonts.ready.then(async()=>{
      embeddedFonts??=window.htmlToImage.getFontEmbedCSS(source);
      return window.htmlToImage.toCanvas(source,{
      pixelRatio:Math.min(window.devicePixelRatio||1,1.5),
      width:source.offsetWidth,height:source.offsetHeight,
      fontEmbedCSS:await embeddedFonts,onClone:preserveScroll,
      style:{position:'relative',left:'0',top:'0',right:'auto',bottom:'auto',margin:'0',transform:'none',visibility:'visible'}
    });}).catch(error=>{embeddedFonts=null;if(snapshots.get(source)===entry)snapshots.delete(source);throw error;});
    snapshots.set(source,entry);return entry.promise;
  }

  window.InksmorePaperTurn={prepare,create({book,source,backward=false,top=false,onFinish=()=>{}}){
    const width=source.offsetWidth,height=source.offsetHeight,bounds=book.getBoundingClientRect();
    const corner={x:backward?0:width,y:top?0:height};
    const canvas=document.createElement('canvas');
    canvas.className='paper-turn-viewport';
    canvas.setAttribute('aria-hidden','true');canvas.inert=true;
    const scale=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(window.innerWidth*scale);canvas.height=Math.round(window.innerHeight*scale);
    canvas.style.width=window.innerWidth+'px';canvas.style.height=window.innerHeight+'px';
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)throw new Error('Canvas is unavailable');
    document.body.append(canvas);
    const savedVisibility=source.style.visibility;
    let point={...corner},texture=null,frame=0,settling=false,disposed=false,resolveFinished;
    const finished=new Promise(resolve=>{resolveFinished=resolve;});
    const ready=prepare(source).then(image=>{
      if(disposed)return;
      texture=image;render();source.style.visibility='hidden';
    }).catch(error=>{console.error('Unable to prepare the paper surface',error);destroy(false);});
    const path=points=>{
      ctx.beginPath();
      if(!points.length)return;
      ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
      ctx.closePath();
    };
    function render(){
      frame=0;if(disposed||!texture)return;
      const g=geometry(width,height,corner,point),{n,a,b,radius,rect}=g;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.setTransform(scale,0,0,scale,bounds.left*scale,bounds.top*scale);
      canvas.dataset.phase=settling?'settling':'dragging';
      canvas.dataset.corner=point.x.toFixed(1)+','+point.y.toFixed(1);
      // A single canvas paints paper and shadow together in one atomic frame.
      const lifted=clip(rect,n,a,false),outline=[];
      for(let i=0;i<lifted.length;i++){
        const p=lifted[i],q=lifted[(i+1)%lifted.length];
        for(let j=0;j<=16;j++){
          const t=j/16,x=p.x+(q.x-p.x)*t,y=p.y+(q.y-p.y)*t;
          const u=x*n.x+y*n.y,s=g.surface(u),shift=s.u-u;
          outline.push({x:x+n.x*shift+n.x*radius*.13,y:y+n.y*shift+radius*.12});
        }
      }
      ctx.save();path(outline);
      const strength=Math.min(1,g.distance/90);
      ctx.shadowColor='rgba(25,48,37,'+(strength*.19)+')';
      ctx.shadowBlur=radius*.36;ctx.fillStyle='rgba(25,48,37,'+(strength*.07)+')';
      ctx.fill();ctx.restore();
      const count=40,step=(b-a)/count;
      for(let i=0;i<count+2;i++){
        let polygon,u,u0,u1;
        if(i===0){polygon=clip(rect,n,a+.5);u=a;u0=a-step;u1=a;}
        else if(i===count+1){polygon=clip(rect,n,b-.5,false);u=b;u0=b;u1=b+step;}
        else{
          u0=a+(i-1)*step;u1=u0+step;u=(u0+u1)/2;
          const compression=Math.abs(Math.cos(g.surface(u).theta));
          const overlap=Math.min(step*.45,.7/Math.max(.1,compression));
          polygon=clip(clip(rect,n,u0-overlap,false),n,u1+overlap);
        }
        if(polygon.length<3)continue;
        const s=g.surface(u),cos=Math.cos(s.theta),k=cos-1,translation=s.u-cos*u;
        ctx.save();
        ctx.transform(1+k*n.x*n.x,k*n.x*n.y,k*n.x*n.y,1+k*n.y*n.y,translation*n.x,translation*n.y);
        path(polygon);ctx.clip();
        const l0=Math.sin(g.surface(u0).theta),l1=Math.sin(g.surface(u1).theta);
        const light=ctx.createLinearGradient(n.x*u0,n.y*u0,n.x*u1,n.y*u1);
        if(i<=count/2){
          ctx.drawImage(texture,0,0,width,height);
          light.addColorStop(0,'rgba(48,70,57,'+(l0*.11)+')');
          light.addColorStop(1,'rgba(48,70,57,'+(l1*.11)+')');
        }else{
          const color=l=>'rgb('+(249-l*27)+','+(248-l*27)+','+(239-l*26)+')';
          light.addColorStop(0,color(l0));light.addColorStop(1,color(l1));
        }
        ctx.fillStyle=light;ctx.fillRect(0,0,width,height);ctx.restore();
      }
    }
    function move(next){
      if(disposed||settling)return;
      const direction=backward?-1:1;
      let x=clamp(next.x,backward?.5:-width-120,backward?2*width+120:width-.5);
      let y=clamp(next.y,top?.5:-height*.15,top?height*1.15:height-.5);
      const spine={x:backward?width:0,y:corner.y},length=Math.hypot(x-spine.x,y-spine.y);
      if(length>width){const ratio=width/length;x=spine.x+(x-spine.x)*ratio;y=spine.y+(y-spine.y)*ratio;}
      if(Math.hypot(x-corner.x,y-corner.y)<.5)x=corner.x-direction*.5;
      point={x,y};if(!frame)frame=requestAnimationFrame(render);
    }
    function destroy(committed=false){
      if(disposed)return;disposed=true;cancelAnimationFrame(frame);
      onFinish({committed});source.style.visibility=savedVisibility;canvas.remove();
      window.removeEventListener('resize',cancel);window.removeEventListener('blur',cancel);
      document.removeEventListener('visibilitychange',onVisibility);resolveFinished({committed});
    }
    const cancel=()=>destroy(false),onVisibility=()=>{if(document.hidden)cancel();};
    window.addEventListener('resize',cancel);window.addEventListener('blur',cancel);
    document.addEventListener('visibilitychange',onVisibility);
    function settle(commit,{automatic=false}={}){
      if(disposed||settling)return finished;
      settling=true;cancelAnimationFrame(frame);
      ready.then(()=>{
        if(disposed)return;
        const from={...point},direction=backward?-1:1;
        const outerMargin=backward?window.innerWidth-bounds.right:bounds.left;
        const end=commit?{x:corner.x-direction*(width*2+outerMargin*2+160),y:corner.y}:{...corner};
        const duration=automatic?1150:clamp(Math.hypot(end.x-from.x,end.y-from.y)/width*650,300,900);
        const started=performance.now();
        const tick=time=>{
          if(disposed)return;
          const t=clamp((time-started)/duration,0,1),ease=automatic?t*t*(3-2*t):1-Math.pow(1-t,3);
          const arc=(top?1:-1)*height*(automatic?.9:.12)*Math.sin(Math.PI*ease);
          point={x:from.x+(end.x-from.x)*ease,y:from.y+(end.y-from.y)*ease+arc};
          render();if(t<1)frame=requestAnimationFrame(tick);else destroy(commit);
        };
        frame=requestAnimationFrame(tick);
      });
      return finished;
    }
    return {move,settle,cancel,finished};
  }};
})();
