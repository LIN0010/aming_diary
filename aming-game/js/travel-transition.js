/* 底部導覽共用全畫面過場；首次進場不呼叫。 */
(() => {
    const layer=document.createElement('div');
    layer.className='travel-transition';layer.hidden=true;
    layer.setAttribute('role','status');layer.setAttribute('aria-label','列車旅行過場');
    layer.innerHTML='<div class="travel-center"><p>下一站，即將抵達……</p><div class="travel-track" aria-hidden="true"><svg viewBox="0 0 400 36"><path d="M0 12H400 M0 24H400"/><path class="travel-ties" d="M10 6V30 M35 6V30 M60 6V30 M85 6V30 M110 6V30 M135 6V30 M160 6V30 M185 6V30 M210 6V30 M235 6V30 M260 6V30 M285 6V30 M310 6V30 M335 6V30 M360 6V30 M385 6V30"/></svg></div></div>';
    document.body.append(layer);
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    let started=0,visible=false;
    window.TravelTransition={
        get active(){return visible;},
        begin(){visible=true;started=performance.now();layer.hidden=false;layer.classList.remove('leaving');return wait(300);},
        async finish(){if(!visible)return;await wait(Math.max(0,1500-(performance.now()-started)));layer.classList.add('leaving');await wait(400);layer.hidden=true;visible=false;},
        stop(){layer.hidden=true;visible=false;}
    };
})();
