(() => {
'use strict';
const sheets=[...document.querySelectorAll('.sheet')],book=document.querySelector('.book'),dots=document.querySelector('.page-dots'),previous=document.querySelector('#prev-page'),next=document.querySelector('#next-page'),dialog=document.querySelector('#detail-dialog');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let current=0,busy=false,wheelTotal=0,lastWheel=0,lockedUntil=0,drag=null,suppressClickUntil=0;
let overview;
const allPapers=document.querySelector('#all-papers'),scrollHint=document.querySelector('.scroll-hint');
const cornerNext=document.querySelector('.page-corner'),cornerPrevious=document.querySelector('.page-corner-previous');
sheets.forEach((sheet,index)=>{const dot=document.createElement('button');dot.type='button';dot.dataset.page=index;dot.setAttribute('aria-label',`Page ${index+1}: ${sheet.dataset.title}`);dots.append(dot);});
function update(){
  const inOverview=Boolean(overview?.active);
  sheets.forEach((sheet,index)=>{sheet.inert=inOverview||index!==current;sheet.setAttribute('aria-hidden',String(inOverview||index!==current));});
  previous.disabled=inOverview||current===0;next.disabled=inOverview||current===sheets.length-1;cornerNext.disabled=next.disabled;cornerPrevious.disabled=previous.disabled;
  allPapers.disabled=busy;dots.inert=inOverview;
  scrollHint.textContent=inOverview?'Choose a paper · Esc to return':'Drag a corner · Scroll to explore';
  dots.querySelectorAll('button').forEach((dot,index)=>index===current?dot.setAttribute('aria-current','page'):dot.removeAttribute('aria-current'));
  document.querySelectorAll('.site-header nav [data-page]').forEach(link=>Number(link.dataset.page)===current?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current'));
  document.querySelector('#current-page').textContent=String(current+1).padStart(2,'0');document.querySelector('#page-name').textContent=sheets[current].dataset.title;
  document.querySelector('#page-announcement').textContent=`Page ${current+1} of ${sheets.length}: ${sheets[current].dataset.title}`;
  if(!inOverview&&!reducedMotion.matches)window.InksmorePaperTurn?.prepare(sheets[current]).catch(()=>{});
}
let prepareTimer;
const warmPaper=()=>{clearTimeout(prepareTimer);prepareTimer=setTimeout(()=>{if(!busy&&!overview?.active&&!reducedMotion.matches)window.InksmorePaperTurn?.prepare(sheets[current]).catch(()=>{});},180);};
book.addEventListener('scroll',warmPaper,true);window.addEventListener('resize',warmPaper);
function startTurn(index,focusHeading=false,top=false){
  if(busy||overview?.active||index===current||index<0||index>=sheets.length)return null;
  busy=true;wheelTotal=0;allPapers.disabled=true;
  const old=sheets[current],target=sheets[index],forward=index>current,previousFocus=document.activeElement,focusWasInside=old.contains(previousFocus);
  old.inert=true;target.inert=true;book.classList.add('is-turning');
  target.classList.add('underneath');
  const finish=({committed})=>{
    target.classList.remove('underneath');
    if(committed){old.classList.remove('active');target.classList.add('active');current=index;history.replaceState(null,'',`#${target.id}`);}
    book.classList.remove('is-turning','is-dragging');
    if(drag){const pointerId=drag.id;drag=null;if(book.hasPointerCapture(pointerId))book.releasePointerCapture(pointerId);}
    busy=false;lockedUntil=performance.now()+240;update();
    if(committed&&(focusHeading||focusWasInside))target.querySelector('h1,h2')?.focus({preventScroll:true});
    else if(!committed&&focusWasInside&&previousFocus.isConnected&&!dialog.open)previousFocus.focus({preventScroll:true});
  };
  if(reducedMotion.matches||!window.InksmorePaperTurn){finish({committed:true});return null;}
  try{
    return window.InksmorePaperTurn.create({book,source:old,backward:!forward,top,onFinish:finish});
  }catch(error){finish({committed:false});console.error('Unable to turn the page',error);return null;}
}
function goTo(index,focusHeading=false){if(overview?.active){overview.close(index,true);return;}startTurn(index,focusHeading)?.settle(true,{automatic:true});}
previous.addEventListener('click',()=>goTo(current-1));next.addEventListener('click',()=>goTo(current+1));
cornerNext.addEventListener('click',()=>goTo(current+1));cornerPrevious.addEventListener('click',()=>goTo(current-1));
// Keep ordinary links/text interactive. Only desktop corner grips start a drag.
book.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||event.button!==0||busy||overview?.active||dialog.open||book.clientWidth<740)return;
  if(event.target.closest('a,button,input,textarea,select')&&!event.target.closest('.page-corner,.page-corner-previous'))return;
  const rect=book.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const left=x<88,right=x>rect.width-88,top=y<80,bottom=y>rect.height-88;
  if(!(left||right)||!(top||bottom))return;
  const direction=right?1:-1,index=current+direction;
  if(index<0||index>=sheets.length)return;
  event.preventDefault();
  const turn=startTurn(index,false,top);
  if(!turn){suppressClickUntil=performance.now()+450;return;}
  drag={id:event.pointerId,turn,rect,direction,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastTime:performance.now(),velocity:0,distance:0,moved:0,top};
  book.classList.add('is-dragging');book.setPointerCapture(event.pointerId);
});
book.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const now=performance.now(),dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  drag.velocity=(drag.lastX-event.clientX)*drag.direction/Math.max(1,now-drag.lastTime);
  drag.lastX=event.clientX;drag.lastTime=now;drag.distance=-dx*drag.direction;
  drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
  drag.turn.move({x:(drag.direction>0?drag.rect.width:0)+dx,y:(drag.top?0:drag.rect.height)+dy});
});
function releaseDrag(cancel=false){
  if(!drag)return;
  const released=drag;drag=null;suppressClickUntil=performance.now()+500;
  book.classList.remove('is-dragging');
  if(book.hasPointerCapture(released.id))book.releasePointerCapture(released.id);
  const click=released.moved<6;
  const commit=!cancel&&(click||released.distance>released.rect.width*.46||(released.distance>released.rect.width*.15&&released.velocity>.65&&performance.now()-released.lastTime<100));
  released.turn.settle(commit,{automatic:click&&!cancel});
}
book.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId)releaseDrag();});
book.addEventListener('pointercancel',()=>releaseDrag(true));
book.addEventListener('lostpointercapture',()=>{if(drag)releaseDrag(true);});
book.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('click',event=>{const link=event.target.closest('[data-page]');if(link){event.preventDefault();goTo(Number(link.dataset.page),Boolean(link.closest('.site-header')));}const trigger=event.target.closest('[data-dialog]');if(trigger)openDialog(trigger.dataset.dialog);});
function canScrollInside(direction){const inner=sheets[current].querySelector('.sheet-inner');return direction>0?inner.scrollTop+inner.clientHeight<inner.scrollHeight-3:inner.scrollTop>3;}
book.addEventListener('wheel',event=>{if(event.ctrlKey||dialog.open)return;if(overview?.active){event.preventDefault();return;}if(Math.abs(event.deltaX)>Math.abs(event.deltaY))return;const direction=Math.sign(event.deltaY);if(!direction)return;if(canScrollInside(direction)){wheelTotal=0;return;}event.preventDefault();const now=performance.now();if(busy||now<lockedUntil){lastWheel=now;wheelTotal=0;return;}if(now-lastWheel>180||Math.sign(wheelTotal)!==direction)wheelTotal=0;wheelTotal+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?500:1);lastWheel=now;if(Math.abs(wheelTotal)>45)goTo(current+direction);},{passive:false});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&drag){event.preventDefault();releaseDrag(true);return;}
  if(dialog.open||overview?.active||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  const direction=['ArrowDown','ArrowRight','PageDown'].includes(event.key)?1:['ArrowUp','ArrowLeft','PageUp'].includes(event.key)?-1:0;
  if(direction){
    event.preventDefault();
    const vertical=['ArrowDown','ArrowUp','PageDown','PageUp'].includes(event.key);
    if(vertical&&canScrollInside(direction)){
      const inner=sheets[current].querySelector('.sheet-inner');
      inner.scrollBy({top:direction*(event.key.startsWith('Page')?inner.clientHeight*.8:80),behavior:reducedMotion.matches?'instant':'smooth'});
    }else goTo(current+direction,true);
  }
  if(event.key==='Home'){event.preventDefault();goTo(0,true);}
  if(event.key==='End'){event.preventDefault();goTo(sheets.length-1,true);}
});
let touchStart=null;
book.addEventListener('touchstart',event=>{if(!overview?.active&&event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY,time:performance.now(),top:sheets[current].querySelector('.sheet-inner').scrollTop};},{passive:true});
book.addEventListener('touchend',event=>{if(!touchStart||dialog.open||overview?.active)return;const point=event.changedTouches[0],dx=point.clientX-touchStart.x,dy=point.clientY-touchStart.y,horizontal=Math.abs(dx)>Math.abs(dy),direction=horizontal?-Math.sign(dx):-Math.sign(dy),moved=sheets[current].querySelector('.sheet-inner').scrollTop!==touchStart.top;if(performance.now()-touchStart.time<850&&Math.max(Math.abs(dx),Math.abs(dy))>65&&(horizontal||(!moved&&!canScrollInside(direction))))goTo(current+direction);touchStart=null;},{passive:true});
const dialogs={
waitlist:`<p class="dialog-eyebrow">EARLY ACCESS</p><h2 id="dialog-title">A little patience.<br><em>A lot to look forward to.</em></h2><p>Our first math course is for ages 2–6, free during early access.</p><p>Account registration isn’t open on this preview yet. When it opens, you’ll be able to create an account and join the waitlist.</p><button class="button" data-close>Keep exploring <span aria-hidden="true">↗</span></button>`,
paper:`<p class="dialog-eyebrow">PAPER-FIRST</p><h2 id="dialog-title">Print. Play. <em>Discover.</em></h2><p>Print, cut out, and explore together. From pointing and counting to matching, drawing, and connecting, Inksmore turns printable learning materials into hands-on activities.</p><p>The learning is on paper. The technology works in the background.</p><button class="button" data-close>Back to the story</button>`,
angi:`<p class="dialog-eyebrow">ADAPTIVE NEURAL GRAPH INTELLIGENCE</p><h2 id="dialog-title">A clearer view of<br><em>how learning connects.</em></h2><p>Your child’s ANGI Learning Profile is an evolving picture of their learning—a visual map of skills, how well they’re understood, and how they connect.</p><p>Our AI uses this picture to personalize lessons and practice, building on strengths and revisiting foundations that need more attention.</p><button class="button" data-close>Back to the story</button>`,
parents:`<p class="dialog-eyebrow">FOR FAMILIES</p><h2 id="dialog-title">Learning at home.<br><em>At their own pace.</em></h2><p>Print, cut out, and explore together. Share what you notice, and ANGI helps shape what comes next.</p><p>You decide when to practice. ANGI uses your child’s learning profile to guide the content.</p><p>Our first math course is for ages 2–6, free during early access.</p><button class="button" data-dialog="waitlist">Join the Waitlist <span aria-hidden="true">↗</span></button>`,
partners:`<p class="dialog-eyebrow">FOR SCHOOLS &amp; PARTNERS</p><h2 id="dialog-title">More children.<br><em>More possibilities.</em></h2><p>Help explore how personalized, paper-first learning can reach more children. Join us in a free early research partnership.</p><p>Explore paper-based activities, individual learning profiles, and feedback that helps guide each child’s next step.</p><p class="dialog-note">Partnership enquiries will open soon.</p><button class="button" data-close>Back to the story</button>`,
team:`<p class="dialog-eyebrow">EDUCATION, AI &amp; DESIGN</p><h2 id="dialog-title">Parents.<br><em>With a shared purpose.</em></h2><h3 class="dialog-subtitle">Professor Lyn Ge</h3><p>A mathematics educator and software developer pursuing a PhD in Mathematics Education at Simon Fraser University, with experience teaching university mathematics.</p><h3 class="dialog-subtitle">Andrew Ngai</h3><p>Andrew brings 10+ years of AI experience and works as a Software Development Manager in an AI product team at Amazon. He is pursuing the Doctor of Artificial Intelligence degree at The Hong Kong Polytechnic University and holds a master’s degree in big data from The Hong Kong University of Science and Technology.</p><h3 class="dialog-subtitle">Tero</h3><p>As a designer and parent, Tero focuses on making Inksmore’s visual experience clear and welcoming, drawing on nine years across graphic design and marketing.</p>`,
privacy:`<p class="dialog-eyebrow">PRIVACY POLICY</p><h2 id="dialog-title">Before we begin.</h2><p>The full Privacy Policy will be available before account registration opens.</p><p>This homepage preview does not offer registration or collect children’s learning profiles.</p><button class="button" data-close>Back to the story</button>`,
terms:`<p class="dialog-eyebrow">TERMS OF USE</p><h2 id="dialog-title">The details matter.</h2><p>The Terms of Use will be available before account registration opens.</p><p>This is a homepage preview. Learning activities and account services are not yet available here.</p><button class="button" data-close>Back to the story</button>`
};
function openDialog(name){if(!dialogs[name])return;document.querySelector('#dialog-content').innerHTML=dialogs[name];if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target.closest('[data-close]'))dialog.close();if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
const requested=sheets.findIndex(sheet=>`#${sheet.id}`===location.hash);
if(requested>0){sheets[0].classList.remove('active');current=requested;sheets[current].classList.add('active');}
overview=window.InksmoreOverview.create({book,sheets,toggle:allPapers,getCurrent:()=>current,canOpen:()=>!busy&&!dialog.open,reducedMotion,
  onChange:()=>{wheelTotal=0;touchStart=null;lockedUntil=performance.now()+350;update();},
  onSelect:index=>{sheets[current].classList.remove('active');current=index;sheets[current].classList.add('active');history.replaceState(null,'',`#${sheets[current].id}`);}
});
update();
})();
