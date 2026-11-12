const $=id=>document.getElementById(id);
const reveal=(id)=>{$(id).hidden=false;$(id).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
$('start-story').onclick=()=>{$('expert-tools').open=true;$('transaction-id').focus();$('expert-tools').scrollIntoView({behavior:'smooth'});};
$('start-test').onclick=()=>reveal('guided-lab');
$('story-evidence').onclick=()=>{$('expert-tools').open=true;$('inspection').scrollIntoView({behavior:'smooth'});};
$('nav-inspect').addEventListener('click',()=>{$('expert-tools').open=true;});
$('nav-compare').addEventListener('click',()=>{$('expert-tools').open=true;});
$('nav-lab').addEventListener('click',()=>reveal('guided-lab'));
if(location.hash==='#guided-lab')$('guided-lab').hidden=false;
