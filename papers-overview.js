/* Six real, full-size pages share one coordinate system. Only their transforms
   change, so entering the overview never reflows the page being read. */
(() => {
  'use strict';
  window.InksmoreOverview={create({book,sheets,toggle,getCurrent,canOpen,onChange,onSelect,reducedMotion}){
    const panel=document.querySelector('#papers-overview');
    const heading=panel.querySelector('.overview-heading');
    const choices=panel.querySelector('.overview-choices');
    const closeButton=panel.querySelector('.overview-close');
    let state='closed',animations=[],generation=0,positions=[],chosen=0,closingSelection=false,opener=null,resizeFrame=0;
    const duration=value=>reducedMotion.matches?0:value;
    const ease='cubic-bezier(.22,1,.36,1)';
    const buttons=sheets.map((sheet,index)=>{
      const button=document.createElement('button');
      button.type='button';button.className='paper-choice';
      button.setAttribute('aria-label',`Open paper ${index+1}: ${sheet.dataset.title}`);
      const number=document.createElement('span');number.className='paper-choice-number';number.textContent=String(index+1).padStart(2,'0');
      const name=document.createElement('span');name.className='paper-choice-title';name.textContent=sheet.dataset.title;
      const current=document.createElement('span');current.className='paper-choice-current';current.textContent='Reading';
      const caption=document.createElement('span');caption.className='paper-choice-caption';caption.append(number,name,current);
      button.append(caption);choices.append(button);
      button.addEventListener('click',()=>close(index,true));
      const lift=on=>{if(state==='open')sheet.classList.toggle('overview-hover',on);};
      button.addEventListener('pointerenter',()=>lift(true));button.addEventListener('pointerleave',()=>lift(false));
      button.addEventListener('focus',()=>lift(true));button.addEventListener('blur',()=>lift(false));
      button.addEventListener('keydown',event=>{
        const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};
        let target=event.key==='Home'?0:event.key==='End'?5:index+(offsets[event.key]??0);
        if(!(event.key in offsets)&&!['Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();buttons[Math.max(0,Math.min(5,target))].focus({preventScroll:true});
      });
      return button;
    });
    function layout(){
      const width=book.clientWidth,height=book.clientHeight;
      const gap=width<700?12:width<1100?22:30;
      const caption=width<700?42:38;
      const top=heading.offsetHeight+22,bottom=12,rowGap=width<700?22:28;
      const scale=Math.max(.04,Math.min((width-gap*2)/(width*3),(height-top-bottom-rowGap-caption*2)/(height*2)));
      const cardWidth=width*scale,cardHeight=height*scale;
      const left=(width-cardWidth*3-gap*2)/2;
      const startY=top+Math.max(0,(height-top-bottom-(cardHeight+caption)*2-rowGap)/2);
      positions=sheets.map((sheet,index)=>{
        const x=left+(index%3)*(cardWidth+gap),y=startY+Math.floor(index/3)*(cardHeight+caption+rowGap);
        const transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
        Object.assign(buttons[index].style,{left:x+'px',top:y+'px',width:cardWidth+'px',height:cardHeight+caption+'px'});
        buttons[index].style.setProperty('--paper-height',cardHeight+'px');
        return transform;
      });
    }
    function stopAnimations(){animations.forEach(animation=>animation.cancel());animations=[];}
    function animate(element,frames,options){
      const animation=element.animate(frames,{duration:duration(760),easing:ease,fill:'both',...options});
      animations.push(animation);return animation.finished.catch(()=>{});
    }
    function setSheet(index,transform,opacity='1'){
      Object.assign(sheets[index].style,{transform,opacity,zIndex:String(index===getCurrent()?12:index+1)});
    }
    function finishOpen(token){
      if(token!==generation)return;
      stopAnimations();state='open';choices.inert=false;
      if(!document.querySelector('dialog[open]'))buttons[getCurrent()].focus({preventScroll:true});
    }
    function open(){
      if(state!=='closed'||!canOpen())return;
      const token=++generation;state='opening';opener=document.activeElement;
      toggle.setAttribute('aria-expanded','true');panel.hidden=false;choices.inert=true;
      book.classList.add('is-overview');onChange(true);layout();
      const current=getCurrent();
      buttons.forEach((button,index)=>{
        if(index===current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      });
      const motions=sheets.map((sheet,index)=>{
        sheet.classList.remove('overview-hover');setSheet(index,positions[index]);
        return animate(sheet,[{transform:index===current?'none':'translate3d(0,12px,0) scale(.985)',opacity:index===current?1:0},{transform:positions[index],opacity:1}],{delay:duration(index===current?0:45+index*22)});
      });
      motions.push(animate(heading,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:duration(420),delay:duration(180)}));
      motions.push(animate(choices,[{opacity:0},{opacity:1}],{duration:duration(360),delay:duration(430)}));
      Promise.all(motions).then(()=>finishOpen(token));
    }
    function finishClose(token,index,selected){
      if(token!==generation)return;
      stopAnimations();
      sheets.forEach(sheet=>{
        sheet.style.removeProperty('transform');sheet.style.removeProperty('opacity');sheet.style.removeProperty('z-index');
        sheet.classList.remove('overview-hover');
      });
      panel.hidden=true;book.classList.remove('is-overview');state='closed';
      toggle.setAttribute('aria-expanded','false');onSelect(index);onChange(false);
      if(selected)sheets[index].querySelector('h1,h2')?.focus({preventScroll:true});
      else (opener?.isConnected?opener:toggle).focus({preventScroll:true});
    }
    function close(index=getCurrent(),selected=false){
      if(state==='closed'||state==='closing')return;
      const token=++generation;chosen=index;closingSelection=selected;state='closing';choices.inert=true;
      const from=sheets.map(sheet=>({transform:getComputedStyle(sheet).transform,opacity:getComputedStyle(sheet).opacity}));
      const headingOpacity=getComputedStyle(heading).opacity,choicesOpacity=getComputedStyle(choices).opacity;
      stopAnimations();sheets.forEach(sheet=>sheet.classList.remove('overview-hover'));
      const motions=sheets.map((sheet,i)=>{
        const target=i===index?'none':positions[i];
        Object.assign(sheet.style,{zIndex:i===index?'30':String(i+1),transform:target,opacity:i===index?'1':'0'});
        return animate(sheet,[from[i],{transform:target,opacity:i===index?1:0}],{duration:duration(i===index?720:240)});
      });
      motions.push(animate(heading,[{opacity:headingOpacity},{opacity:0}],{duration:duration(180)}));
      motions.push(animate(choices,[{opacity:choicesOpacity},{opacity:0}],{duration:duration(140)}));
      Promise.all(motions).then(()=>finishClose(token,index,selected));
    }
    toggle.addEventListener('click',()=>state==='closed'?open():close());
    closeButton.addEventListener('click',()=>close());
    document.addEventListener('keydown',event=>{
      if(state!=='closed'&&event.key==='Escape'&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();close();}
    },true);
    function settleLayout(){
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(()=>{
        if(state==='closed')return;
        const token=++generation;
        if(state==='closing'){finishClose(token,chosen,closingSelection);return;}
        stopAnimations();layout();sheets.forEach((sheet,index)=>setSheet(index,positions[index]));
        finishOpen(token);
      });
    }
    window.addEventListener('resize',settleLayout);reducedMotion.addEventListener('change',settleLayout);
    window.addEventListener('beforeprint',()=>{if(state!=='closed')finishClose(++generation,getCurrent(),false);});
    return {get active(){return state!=='closed';},open,close};
  }};
})();
