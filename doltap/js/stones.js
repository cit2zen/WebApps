// js/stones.js
import { mulberry32 } from './rng.js';
const PI=Math.PI, TAU=2*Math.PI;
const red=t=>{while(t>PI)t-=TAU; while(t<-PI)t+=TAU; return t;};
const dsin=t=>{const x=red(t),x2=x*x; return x - x*x2/6 + x*x2*x2/120 - x*x2*x2*x2/5040;};
const dcos=t=>{const x=red(t),x2=x*x; return 1 - x2/2 + x2*x2/24 - x2*x2*x2/720 + x2*x2*x2*x2/40320;};
const r2=v=>Math.floor(v*100+0.5)/100;
const r1=v=>Math.floor(v*10+0.5)/10;
// k·15° (k=0..23) 6자리 반올림 상수. 폭은 k=0..11, aim 회전은 24개 전부
const COS=[1,0.965926,0.866025,0.707107,0.5,0.258819,0,-0.258819,-0.5,-0.707107,-0.866025,-0.965926,
           -1,-0.965926,-0.866025,-0.707107,-0.5,-0.258819,0,0.258819,0.5,0.707107,0.866025,0.965926];
const SIN=COS.map((_,k)=>COS[(k+18)%24]);
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
const hull=P=>{const p=[...P].sort((a,b)=>a[0]-b[0]||a[1]-b[1]); if(p.length<3)return p;
  const lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));};
const widthRatio=V=>{let mn=Infinity,mx=-Infinity;
  for(let k=0;k<12;k++){let lo=Infinity,hi=-Infinity;
    for(const[x,y]of V){const X=x*COS[k]-y*SIN[k];if(X<lo)lo=X;if(X>hi)hi=X;}
    const w=hi-lo;if(w<mn)mn=w;if(w>mx)mx=w;}
  return mn/mx;};
const area2=V=>{let A=0;for(let i=0;i<V.length;i++){const[a,b]=V[i],[c,d]=V[(i+1)%V.length];A+=a*d-c*b;}return A/2;};
const centroid=V=>{const A=area2(V);let cx=0,cy=0;
  for(let i=0;i<V.length;i++){const[a,b]=V[i],[c,d]=V[(i+1)%V.length];const w=a*d-c*b;cx+=(a+c)*w;cy+=(b+d)*w;}
  return [cx/(6*A),cy/(6*A)];};

// ---- 여기부터 규약 밖: 운영 export와 생성기(§5 추첨 순서 1~6, ref_stones.py와 같은 순서) ----
export { dsin, dcos, COS, SIN, hull, widthRatio, area2, centroid };
export const rotCW=(v,k)=>[v[0]*COS[k]+v[1]*SIN[k], -v[0]*SIN[k]+v[1]*COS[k]];

// [band, 마지막 슬롯, r 중심, s 중심, 가중치(납작·모난·둥근·쐐기) | null=A 고정 패턴] — §3 난이도 표
const BANDS=[['A',3,40,0.62,null],['B',8,36,0.65,[45,35,12,8]],['C',14,34,0.72,[35,30,20,15]],
  ['D',19,32,0.78,[25,29,25,21]],['E',24,30,0.85,[20,20,35,25]]];
const TYPES=['flat','angular','round','wedge'];
// 유형: [n_min, n_max, 각도 지터, 반지름 지터, s 보정] — §2 돌 유형 파라미터
const PARAM={flat:[6,8,0.20,0.12,-0.10],angular:[5,6,0.35,0.25,0],round:[9,9,0.10,0.08,0.10],wedge:[6,7,0.25,0.15,0]};
const FAMILY={flat:['gray','ochre'],angular:['gray','slate'],round:['slate','ochre'],wedge:['ochre','gray']};
const FALLBACK=[[-36,0],[-18,-17.15],[18,-17.15],[36,0],[18,17.15],[-18,17.15]];
const TONE_TOKEN={'stone-gray-l':'--doltap-stone-gray','stone-gray-d':'--doltap-stone-gray-dk',
  'stone-ochre-l':'--doltap-stone-ochre','stone-ochre-d':'--doltap-stone-ochre-dk',
  'stone-slate-l':'--doltap-stone-slate','stone-slate-d':'--doltap-stone-slate-dk'};
const isRW=t=>t==='round'||t==='wedge';
const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;
const bandOf=i=>BANDS.find(b=>i<=b[1]);

// 규칙 3 (a) 같은 유형 3연속, (b) 둥근+쐐기 3연속
function violates(T,t){
  const n=T.length; if(n<2) return false;
  if(T[n-1]===t&&T[n-2]===t) return true;
  return isRW(t)&&isRW(T[n-1])&&isRW(T[n-2]);
}

function drawStone(rng,i,T,pattern){
  const [band,,rc,sc,w]=bandOf(i);
  for(let att=1;att<=20;att++){
    let t;
    if(!w) t=pattern[i-1]==='F'?'flat':'angular';
    else {
      const u=rng(); let acc=0; t=TYPES[3];
      for(let k=0;k<4;k++){acc+=w[k]; if(u*100<acc){t=TYPES[k];break;}}
      if(violates(T,t)) continue;
    }
    const [nmin,nmax,aj,rj,sk]=PARAM[t];
    const r0=rc+(2*rng()-1)*6;
    let s=sc+(2*rng()-1)*0.10;
    if(w) s=s+sk;
    s=clamp(s,0.45,1.0);
    const n=nmin+Math.floor(rng()*(nmax-nmin+1));
    const pts=[];
    for(let k=0;k<n;k++){
      const th=TAU*k/n+(2*rng()-1)*aj;
      const rho=1+(2*rng()-1)*rj;
      let x=rho*dcos(th), y=rho*dsin(th);
      if(t==='wedge'&&x<0){x*=0.55;y*=0.55;}
      pts.push([r2(x*r0),r2(y*r0*s)]);
    }
    const v0=hull(pts);
    if(Math.floor(widthRatio(v0)*1000)<300) continue;
    return {i,type:t,band,r0,s,n,v0,attempts:att};
  }
  return {i,type:'flat',band,r0:36,s:0.55,n:6,v0:FALLBACK.map(p=>[...p]),attempts:21};
}

export function generate(seed,day,n){
  seed=seed>>>0;
  const rng=mulberry32(seed);
  const pattern=rng()<0.5?'FFA':'FAF';
  const raw=[],T=[];
  for(let i=1;i<=24;i++){const st=drawStone(rng,i,T,pattern); raw.push(st); T.push(st.type);}
  let mean=0; for(const st of raw) mean+=st.r0; mean=mean/24;
  const f=clamp(34/mean,0.9,1.1);
  const stones=raw.map(st=>{
    const r=clamp(st.r0*f,22,46), q=r/st.r0;
    const verts=st.v0.map(([x,y])=>[r2(x*q),r2(y*q)]);
    const [cx,cy]=centroid(verts);
    return {i:st.i,type:st.type,band:st.band,r0:st.r0,r,s:st.s,n:st.n,verts,
      cx:r2(cx),cy:r2(cy),area:r1(area2(verts)),tone:'',moss:0,attempts:st.attempts};
  });
  const A=stones.map(s=>s.area).sort((a,b)=>a-b), med=(A[11]+A[12])/2;
  const tr=mulberry32((seed^0x27D4EB2F)>>>0);
  for(const st of stones){
    const u1=tr(), u2=tr();
    st.tone=`stone-${FAMILY[st.type][u1<0.5?0:1]}-${st.area>=med?'d':'l'}`;
    st.moss=Math.floor(u2*4);
  }
  const wishIdx=Math.floor(mulberry32((seed^0x9E3779B9)>>>0)()*60);
  const trailIdx=n!==0?((n-1)%30+30)%30:Math.floor(mulberry32((seed^0x85EBCA6B)>>>0)()*30);
  return {day,n,seed,pattern,rScale:f,wishIdx,trailIdx,stones};
}

// Stone.tone → §4 --doltap-stone-* 토큰 이름(§6 정합 #1)
export const toneOf=tone=>TONE_TOKEN[tone];
