/* 短期頁面資源交接；只存原始模板與樣式，不存玩家狀態。 */
(() => {
    const key='aming-entry-template-v1';
    const pages={home:'home.html',explore:'explore.html',diary:'diary.html',event:'event.html',group:'group.html'};
    function cssText(text,href){return text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(_,q,url)=>`url("${new URL(url,new URL(href,document.baseURI)).href}")`);}
    const api={
        save(route,html,css,style,root){try{sessionStorage.setItem(key,JSON.stringify({url:route,html,css:cssText(css,style),root,at:Date.now()}));}catch(_){}},
        take(reference){try{const data=JSON.parse(sessionStorage.getItem(key)||'null');const url=new URL(reference,document.baseURI);return data&&data.url===url.pathname.split('/').pop()+url.search&&Date.now()-data.at<1800000?data:null;}catch(_){return null;}},
        preview(host){
            const [name,query='']=location.hash.slice(2).split('?');if(!pages[name])return;
            const data=api.take(pages[name]+(query?'?'+query:''));if(!data)return;
            const root=new DOMParser().parseFromString(data.html,'text/html').getElementById(data.root);if(!root)return;
            root.querySelectorAll('script').forEach(el=>el.remove());root.inert=true;host.append(document.importNode(root,true));
            const style=document.createElement('style');style.textContent=data.css;document.head.insertBefore(style,document.getElementById('common-style'));
            window.JourneyEntryPreview={...data,style};
        }
    };
    window.JourneyEntryCache=api;
})();
