(function(){
var K='tef-cram90::', b=document.body;
function get(k,d){try{var v=localStorage.getItem(K+k);return v===null?d:JSON.parse(v)}catch(e){return d}}
function put(k,v){try{localStorage.setItem(K+k,JSON.stringify(v))}catch(e){}}
var got=get('got',{});
document.querySelectorAll('.ln').forEach(function(li){
  var id=li.dataset.id; if(got[id]) li.classList.add('got');
  li.querySelector('.tick').addEventListener('click',function(){
    if(got[id]){delete got[id];li.classList.remove('got')}else{got[id]=1;li.classList.add('got')}
    put('got',got)});
  li.querySelector('.fr').addEventListener('click',function(){li.classList.toggle('shown')});
});
function tog(btn,cls,key,def){var on=get(key,def);function ap(){b.classList.toggle(cls,on);btn.classList.toggle('on',on)}
  ap();btn.addEventListener('click',function(){on=!on;put(key,on);ap();
    if(cls==='hide')document.querySelectorAll('.ln.shown').forEach(function(l){l.classList.remove('shown')})})}
tog(document.getElementById('b-hide'),'hide','hide',true);
tog(document.getElementById('b-must'),'mustonly','must',false);
tog(document.getElementById('b-todo'),'todo','todo',false);
var st=get('start',null), sb=document.getElementById('start'), ck=document.getElementById('clock');
var plan=[].slice.call(document.querySelectorAll('.plan li'));
function tick(){
  if(!st){ck.textContent='';sb.textContent='Start 90:00';return}
  sb.textContent='Restart';
  var el=(Date.now()-st)/60000, left=Math.max(0,90-el), m=Math.floor(left), s=Math.floor((left-m)*60);
  ck.textContent=m+':'+(s<10?'0':'')+s+' left';
  plan.forEach(function(li){var r=li.dataset.at.split('–'),a=+r[0],z=+r[1];li.classList.toggle('now',el>=a&&el<z)});
}
sb.addEventListener('click',function(){if(st&&!confirm('Restart the 90-minute clock?'))return;st=Date.now();put('start',st);tick()});
tick();setInterval(tick,1000);
})();
