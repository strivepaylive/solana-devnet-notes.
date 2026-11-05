// The gateway controls the visible experience; all transaction execution remains devnet-only.
const gateway=document.getElementById('momentumGateway');
const chooser=document.getElementById('momentumChoose');
const workspace=document.getElementById('momentumWorkspace');
const mentor=document.getElementById('mentor');
function route(){
 const hash=location.hash.split('?')[0];
 const mode=hash==='#/mainnet'?'mainnet':hash==='#/devnet'?'devnet':hash==='#/explore'?'choose':hash===''||hash==='#/'?'landing':null;
 const selected=mode||sessionStorage.getItem('momentum-workspace')||'landing';
 const isWorkspace=selected==='mainnet'||selected==='devnet';
 gateway.hidden=selected!=='landing';chooser.hidden=selected!=='choose';workspace.hidden=!isWorkspace;
 if(mentor)mentor.hidden=!isWorkspace;
 document.body.dataset.experience=selected;
 if(isWorkspace){sessionStorage.setItem('momentum-workspace',selected);document.getElementById(selected==='mainnet'?'environmentMainnet':'environmentDevnet')?.click();document.getElementById(selected==='mainnet'?'mainnetTab':'devnetTab')?.click();}
 if(mode)window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
route();
