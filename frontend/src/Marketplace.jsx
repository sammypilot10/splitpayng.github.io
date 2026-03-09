import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import JoinPoolButton from './components/JoinPoolButton';

const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// Map service names to correct domains for favicon lookup
const DOMAIN_MAP = {
  'netflix': 'netflix.com',
  'spotify': 'spotify.com',
  'youtube': 'youtube.com',
  'chatgpt': 'openai.com',
  'openai': 'openai.com',
  'claude': 'claude.ai',
  'amazon': 'primevideo.com',
  'prime': 'primevideo.com',
  'canva': 'canva.com',
  'adobe': 'adobe.com',
  'microsoft': 'microsoft.com',
  'apple': 'apple.com',
  'playstation': 'playstation.com',
  'xbox': 'xbox.com',
  'google': 'google.com',
  'midjourney': 'midjourney.com',
  'showmax': 'showmax.com',
  'cursor': 'cursor.com',
  'notion': 'notion.so',
  'figma': 'figma.com',
  'dropbox': 'dropbox.com',
  'duolingo': 'duolingo.com',
  'disney': 'disneyplus.com',
  'hbo': 'max.com',
  'dstv': 'dstv.com',
  'boomplay': 'boomplay.com',
  'audiomack': 'audiomack.com',
};

function getDomain(serviceName) {
  if (!serviceName) return 'google.com';
  const lower = serviceName.toLowerCase();
  for (const [key, domain] of Object.entries(DOMAIN_MAP)) {
    if (lower.includes(key)) return domain;
  }
  // fallback: take first word, strip spaces
  return lower.split(' ')[0].replace(/[^a-z]/g, '') + '.com';
}

const POOL_DATA = [
  {id:1,  cat:"Music",       svc:"Spotify Family",       domain:"spotify.com",       host:"Zara K.",    price:2000,  retail:7900,  max:6, filled:4, renew:5,  ver:true  },
  {id:2,  cat:"Video",       svc:"Netflix Premium",      domain:"netflix.com",        host:"Seun B.",    price:6400,  retail:25600, max:4, filled:1, renew:14, ver:true  },
  {id:3,  cat:"Video",       svc:"YouTube Premium",      domain:"youtube.com",        host:"Uche M.",    price:2500,  retail:11900, max:6, filled:4, renew:9,  ver:true  },
  {id:4,  cat:"AI Tools",    svc:"ChatGPT Plus",         domain:"openai.com",         host:"Tunde A.",   price:7500,  retail:30000, max:4, filled:2, renew:18, ver:true  },
  {id:5,  cat:"AI Tools",    svc:"Claude Pro",           domain:"claude.ai",          host:"Amaka O.",   price:9500,  retail:28000, max:3, filled:1, renew:6,  ver:true  },
  {id:6,  cat:"Video",       svc:"Amazon Prime Video",   domain:"primevideo.com",     host:"Kemi F.",    price:4500,  retail:18000, max:4, filled:3, renew:3,  ver:true  },
  {id:7,  cat:"Creative",    svc:"Canva for Teams",      domain:"canva.com",          host:"Ngozi A.",   price:9000,  retail:45000, max:5, filled:3, renew:20, ver:true  },
  {id:8,  cat:"Creative",    svc:"Adobe Creative Cloud", domain:"adobe.com",          host:"Femi O.",    price:23750, retail:95000, max:4, filled:1, renew:25, ver:false },
  {id:9,  cat:"Productivity",svc:"Microsoft 365 Family", domain:"microsoft.com",      host:"Dami P.",    price:7000,  retail:42000, max:6, filled:5, renew:17, ver:true  },
  {id:10, cat:"Music",       svc:"Apple Music Family",   domain:"music.apple.com",    host:"Tola A.",    price:2800,  retail:14000, max:5, filled:2, renew:12, ver:true  },
  {id:11, cat:"Gaming",      svc:"PS Plus Extra",        domain:"playstation.com",    host:"Kunle R.",   price:7000,  retail:28000, max:4, filled:2, renew:8,  ver:true  },
  {id:12, cat:"Gaming",      svc:"Xbox Game Pass",       domain:"xbox.com",           host:"Chidi N.",   price:6500,  retail:26000, max:4, filled:1, renew:19, ver:false },
  {id:13, cat:"Storage",     svc:"Google One 2TB",       domain:"one.google.com",     host:"Adaeze I.",  price:2375,  retail:9500,  max:4, filled:3, renew:26, ver:true  },
  {id:14, cat:"AI Tools",    svc:"Midjourney",           domain:"midjourney.com",     host:"Chisom N.",  price:9000,  retail:36000, max:4, filled:3, renew:11, ver:true  },
  {id:15, cat:"Video",       svc:"Showmax",              domain:"showmax.com",        host:"Bola T.",    price:8000,  retail:32000, max:4, filled:2, renew:30, ver:false },
  {id:16, cat:"AI Tools",    svc:"Cursor AI",            domain:"cursor.com",         host:"Emeka S.",   price:8000,  retail:24000, max:3, filled:2, renew:22, ver:false },
];

const CATEGORIES = ["All","Music","Video","AI Tools","Creative","Productivity","Gaming","Storage"];

const FAQS = [
  {q:"Is it legal to share a subscription?", a:"Yes. We only list subscriptions that officially support multiple users or family plans — like Spotify Family, Netflix, and Microsoft 365. All sharing is done within each platform's own terms of service."},
  {q:"How does the 48-hour escrow work?", a:"When you join a pool, your payment is held for 48 hours while you verify that the credentials actually work. If they don't, raise a dispute and get a full automatic refund. If all is well, the host gets paid."},
  {q:"What if the host changes the password?", a:"That triggers an automatic dispute. Our system detects access failures and freezes the host's payout until the issue is resolved. Repeat offenders are permanently banned from the platform."},
  {q:"How do I receive my monthly payout as a host?", a:"Set up your Nigerian bank account once in Payout Settings. Every billing cycle, your earnings are transferred directly to your account via Paystack — no manual action needed."},
  {q:"Can I cancel anytime?", a:"Yes. Cancel from your subscriptions page at any time. You keep access until the end of the current billing period. No lock-in, no cancellation fees."},
  {q:"What payment methods are accepted?", a:"We accept all Nigerian debit cards, bank transfers, and USSD via Paystack. Your card is saved securely for automatic monthly billing — you only need to enter it once."},
];

const TICKERS = ["847 active pools live","Zero failed payouts this month","48-Hour Escrow on all pools","Auto-billing — charge once, relax forever","New Netflix pool — 3 seats left","Spotify Family — 2 seats left","Adobe CC pool just opened"];

export default function Marketplace() {
  const [dark, setDark] = useState(() => localStorage.getItem("spng-theme") === "dark");
  useEffect(() => { localStorage.setItem("spng-theme", dark ? "dark" : "light"); }, [dark]);
  return (
    <div className={`mp ${dark ? "dark" : "light"}`}>
      <Styles />
      <NavBar dark={dark} setDark={setDark} />
      <div style={{marginTop:62}}><Ticker /></div>
      <Hero />
      <PoolGrid />
      <HowItWorks />
      <SavingsCalc />
      <WhyUs />
      <FaqSection />
      <CTABanner />
      <Footer />
    </div>
  );
}

function Styles() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    .mp.light{
      --bg:#F4EFE6;--surface:#fff;--border:#E5DDD4;--border2:#C9BAA8;
      --ink1:#111;--ink2:#555;--ink3:#999;
      --accent:#0B3D2E;--accent2:#1A5C42;--accent-pale:#E8F5EF;--accent-ring:#C5E0D4;--accent-text:#1A5C42;
      --card:#fff;--nav-bg:rgba(244,239,230,0.95);
      --ticker-bg:#0B3D2E;--ticker-c:#fff;
      --hiw-bg:#0B3D2E;--hiw-t:#fff;--hiw-m:rgba(255,255,255,0.5);
      --calc-bg:#111;--calc-t:#fff;
      --tag:#F0EDE8;--tag-t:#666;
      --sh:0 2px 16px rgba(0,0,0,.07);--sh2:0 8px 40px rgba(0,0,0,.12);
    }
    .mp.dark{
      --bg:#0D0D0D;--surface:#161616;--border:#252525;--border2:#333;
      --ink1:#F0F0F0;--ink2:#AAA;--ink3:#555;
      --accent:#2ECC71;--accent2:#27AE60;--accent-pale:#0A1F12;--accent-ring:#1A5C42;--accent-text:#2ECC71;
      --card:#1A1A1A;--nav-bg:rgba(13,13,13,0.96);
      --ticker-bg:#0A0A0A;--ticker-c:#2ECC71;
      --hiw-bg:#111;--hiw-t:#F0F0F0;--hiw-m:rgba(255,255,255,0.4);
      --calc-bg:#161616;--calc-t:#F0F0F0;
      --tag:#222;--tag-t:#888;
      --sh:0 2px 16px rgba(0,0,0,.4);--sh2:0 8px 40px rgba(0,0,0,.5);
    }
    .mp{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--ink1);min-height:100vh;transition:background .3s,color .3s;}

    /* NAV */
    .nav{position:fixed;top:0;left:0;right:0;z-index:200;background:var(--nav-bg);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);transition:all .3s;}
    .nav-in{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:62px;}
    .logo{display:flex;align-items:center;gap:9px;text-decoration:none;}
    .lmark{width:32px;height:32px;border-radius:9px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:800;flex-shrink:0;}
    .ltext{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:800;color:var(--ink1);}
    .ltext em{font-style:normal;color:var(--accent);}
    .nav-links{display:flex;gap:28px;}
    .nav-links a{font-size:14px;font-weight:500;color:var(--ink2);cursor:pointer;transition:color .15s;}
    .nav-links a:hover{color:var(--ink1);}
    .nav-r{display:flex;align-items:center;gap:10px;}
    .toggle{display:flex;background:var(--tag);border-radius:8px;padding:3px;}
    .tbtn{background:none;border:none;cursor:pointer;padding:5px 8px;border-radius:6px;font-size:13px;transition:background .2s;}
    .tbtn.on{background:var(--surface);box-shadow:var(--sh);}
    .btn-ghost{background:none;border:1px solid var(--border2);border-radius:9px;padding:8px 18px;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--ink1);cursor:pointer;transition:all .2s;}
    .btn-ghost:hover{border-color:var(--accent);color:var(--accent);}
    .btn-solid{background:var(--accent);border:none;border-radius:9px;padding:8px 18px;font-family:inherit;font-size:13.5px;font-weight:700;color:#fff;cursor:pointer;transition:all .2s;}
    .btn-solid:hover{background:var(--accent2);transform:translateY(-1px);}

    /* TICKER */
    .ticker{background:var(--ticker-bg);overflow:hidden;padding:9px 0;}
    .t-track{display:flex;gap:48px;animation:tick 30s linear infinite;width:max-content;}
    .t-item{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--ticker-c);white-space:nowrap;opacity:.85;letter-spacing:.3px;}
    .t-dot{width:4px;height:4px;border-radius:50%;background:var(--ticker-c);opacity:.5;}
    @keyframes tick{from{transform:translateX(0);}to{transform:translateX(-50%);}}

    /* HERO */
    .hero{max-width:1100px;margin:0 auto;padding:90px 24px 70px;display:flex;align-items:center;gap:60px;}
    .hero-l{flex:1;}
    .h-badge{display:inline-flex;align-items:center;gap:7px;background:var(--accent-pale);border:1px solid var(--accent-ring);border-radius:100px;padding:5px 14px;font-size:11.5px;font-weight:700;color:var(--accent-text);letter-spacing:.6px;text-transform:uppercase;margin-bottom:24px;}
    .h-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
    .hero-h{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(36px,5vw,64px);font-weight:800;line-height:1.05;letter-spacing:-2.5px;color:var(--ink1);margin-bottom:18px;}
    .hero-h em{font-style:normal;color:var(--accent);}
    .hero-sub{font-size:clamp(15px,1.8vw,17px);color:var(--ink2);line-height:1.7;max-width:460px;margin-bottom:32px;}
    .hero-btns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:48px;}
    .hbtn-p{background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;}
    .hbtn-p:hover{background:var(--accent2);transform:translateY(-2px);box-shadow:0 8px 28px rgba(11,61,46,.3);}
    .hbtn-s{background:var(--surface);color:var(--ink1);border:1px solid var(--border2);border-radius:12px;padding:14px 24px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;}
    .hbtn-s:hover{border-color:var(--accent);color:var(--accent);}
    .h-stats{display:flex;gap:32px;align-items:center;}
    .h-stat-n{font-family:'Bricolage Grotesque',sans-serif;font-size:26px;font-weight:800;color:var(--ink1);line-height:1;}
    .h-stat-l{font-size:12px;color:var(--ink3);margin-top:3px;}
    .h-div{width:1px;height:36px;background:var(--border);}

    /* FLOATING CARDS */
    .hero-r{flex:0 0 320px;position:relative;height:380px;}
    .fc{position:absolute;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 16px;box-shadow:var(--sh2);display:flex;align-items:center;gap:12px;width:210px;animation:float 5s ease-in-out infinite;}
    .fc:nth-child(2){animation-delay:-2s;}
    .fc:nth-child(3){animation-delay:-4s;}
    @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
    .fc-icon{width:40px;height:40px;border-radius:10px;background:var(--tag);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}
    .fc-icon img{width:26px;height:26px;}
    .fc-name{font-weight:700;font-size:13px;color:var(--ink1);}
    .fc-price{font-size:12px;color:var(--accent);font-weight:600;margin-top:2px;}
    .fc-save{position:absolute;top:-8px;right:-8px;background:var(--accent);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:100px;white-space:nowrap;}

    /* POOL GRID */
    .sec{max-width:1200px;margin:0 auto;padding:72px 24px;}
    .sec-lbl{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent-text);margin-bottom:8px;}
    .sec-title{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(26px,3.5vw,38px);font-weight:800;color:var(--ink1);letter-spacing:-1px;margin-bottom:8px;}
    .sec-sub{font-size:15px;color:var(--ink2);margin-bottom:36px;}
    .cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px;}
    .cat{background:var(--tag);border:1px solid var(--border);border-radius:100px;padding:7px 18px;font-family:inherit;font-size:13px;font-weight:600;color:var(--tag-t);cursor:pointer;transition:all .18s;}
    .cat:hover{border-color:var(--accent);color:var(--accent);}
    .cat.active{background:var(--accent);border-color:var(--accent);color:#fff;}
    .pool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;}

    /* POOL CARD */
    .pc{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:22px;transition:all .22s;}
    .pc:hover{box-shadow:var(--sh2);transform:translateY(-3px);border-color:var(--border2);}
    .pc-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
    .pc-svc{display:flex;align-items:center;gap:11px;}
    .pc-icon{width:44px;height:44px;border-radius:12px;background:var(--tag);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}
    .pc-icon img{width:28px;height:28px;}
    .pc-fb{font-size:18px;font-weight:800;color:var(--ink3);}
    .pc-name{font-weight:700;font-size:14.5px;color:var(--ink1);margin-bottom:2px;}
    .pc-host{font-size:12px;color:var(--ink3);}
    .bver{background:var(--accent-pale);color:var(--accent-text);border:1px solid var(--accent-ring);font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;}
    .besc{background:#FEF3E2;color:#B45309;border:1px solid #F0D5A0;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;}
    .pc-price{font-family:'Bricolage Grotesque',sans-serif;font-size:28px;font-weight:800;color:var(--ink1);letter-spacing:-1px;margin-bottom:2px;}
    .pc-price span{font-size:13px;font-weight:500;color:var(--ink3);letter-spacing:0;}
    .pc-save{font-size:12px;color:var(--accent-text);font-weight:600;margin-bottom:14px;}
    .pc-seats{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink3);margin-bottom:6px;}
    .seats-last{color:#E67E22;font-weight:700;}
    .pc-bar{height:5px;background:var(--border);border-radius:100px;margin-bottom:16px;overflow:hidden;}
    .pc-fill{height:100%;border-radius:100px;transition:width .5s;}
    .pc-foot{display:flex;align-items:center;justify-content:space-between;}
    .pc-renew{font-size:12px;color:var(--ink3);margin-bottom:3px;}
    .pc-mem{font-size:11.5px;color:var(--ink3);display:flex;align-items:center;gap:4px;}

    /* HOW IT WORKS */
    .hiw{background:var(--hiw-bg);padding:80px 24px;}
    .hiw-in{max-width:1100px;margin:0 auto;}
    .hiw-lbl{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--hiw-m);margin-bottom:8px;}
    .hiw-title{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(26px,3.5vw,38px);font-weight:800;color:var(--hiw-t);letter-spacing:-1px;margin-bottom:52px;}
    .hiw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;}
    .hiw-step{background:rgba(255,255,255,.05);padding:28px 24px;transition:background .2s;}
    .hiw-step:first-child{border-radius:14px 0 0 14px;}
    .hiw-step:last-child{border-radius:0 14px 14px 0;}
    .hiw-step:hover{background:rgba(255,255,255,.09);}
    .hiw-num{font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--hiw-m);margin-bottom:18px;text-transform:uppercase;}
    .hiw-icon{width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);margin-bottom:18px;}
    .hiw-st{font-family:'Bricolage Grotesque',sans-serif;font-size:15px;font-weight:700;color:var(--hiw-t);margin-bottom:8px;}
    .hiw-sd{font-size:13px;color:var(--hiw-m);line-height:1.65;}

    /* SAVINGS CALC */
    .calc-wrap{background:var(--calc-bg);padding:80px 24px;}
    .calc-in{max-width:900px;margin:0 auto;}
    .calc-lbl{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:8px;}
    .calc-title{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(26px,3.5vw,38px);font-weight:800;color:var(--calc-t);letter-spacing:-1px;margin-bottom:8px;}
    .calc-sub{font-size:15px;color:rgba(255,255,255,.45);margin-bottom:40px;}
    .calc-body{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;}
    .cf label{display:block;font-size:11px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:8px;letter-spacing:.8px;text-transform:uppercase;}
    .cf+.cf{margin-top:20px;}
    .csel{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:13px 16px;font-family:inherit;font-size:14px;font-weight:600;color:var(--calc-t);cursor:pointer;outline:none;appearance:none;}
    .csel:focus{border-color:rgba(255,255,255,.3);}
    .cslider-val{font-size:20px;font-weight:800;color:#fff;margin-bottom:10px;}
    .cslider{width:100%;accent-color:#2ECC71;cursor:pointer;}
    .cres{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;}
    .crow{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px;}
    .crow:last-child{border-bottom:none;}
    .crow-l{color:rgba(255,255,255,.45);}
    .crow-v{font-weight:700;color:#fff;}
    .crow-hi{color:#2ECC71;}
    .crow-yr{font-size:24px;font-weight:800;color:#2ECC71;font-family:'Bricolage Grotesque',sans-serif;}

    /* WHY US */
    .why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:40px;}
    .why-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:26px;transition:all .2s;}
    .why-card:hover{transform:translateY(-3px);box-shadow:var(--sh2);}
    .why-icon{width:44px;height:44px;border-radius:11px;background:var(--accent-pale);display:flex;align-items:center;justify-content:center;color:var(--accent);margin-bottom:16px;}
    .why-title{font-weight:700;font-size:15px;color:var(--ink1);margin-bottom:7px;}
    .why-desc{font-size:13.5px;color:var(--ink2);line-height:1.65;}

    /* FAQ */
    .faq-list{margin-top:36px;display:flex;flex-direction:column;gap:10px;}
    .faq-item{background:var(--card);border:1px solid var(--border);border-radius:13px;overflow:hidden;}
    .faq-item.open{border-color:var(--border2);}
    .faq-q{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;cursor:pointer;font-weight:600;font-size:14.5px;color:var(--ink1);gap:16px;transition:color .15s;}
    .faq-q:hover{color:var(--accent);}
    .faq-chev{flex-shrink:0;transition:transform .25s;color:var(--ink3);}
    .faq-chev.open{transform:rotate(180deg);color:var(--accent);}
    .faq-a{font-size:14px;color:var(--ink2);line-height:1.7;padding:0 22px 18px;}

    /* CTA */
    .cta-banner{background:var(--accent);padding:64px 24px;text-align:center;}
    .cta-banner h2{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(26px,4vw,42px);font-weight:800;color:#fff;letter-spacing:-1.2px;margin-bottom:14px;}
    .cta-banner p{font-size:16px;color:rgba(255,255,255,.75);margin-bottom:32px;}
    .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
    .cta-w{background:#fff;color:var(--accent);border:none;border-radius:12px;padding:14px 28px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
    .cta-w:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.2);}
    .cta-o{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.4);border-radius:12px;padding:14px 28px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;}
    .cta-o:hover{border-color:#fff;}

    /* FOOTER */
    .footer{background:#080808;padding:52px 24px 32px;}
    .footer-in{max-width:1200px;margin:0 auto;}
    .footer-top{display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap;margin-bottom:40px;}
    .footer-brand p{font-size:13.5px;color:#555;line-height:1.7;margin-top:14px;max-width:240px;}
    .footer-col h4{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#444;margin-bottom:14px;}
    .footer-col a{display:block;font-size:13.5px;color:#666;margin-bottom:9px;cursor:pointer;transition:color .15s;}
    .footer-col a:hover{color:#fff;}
    .footer-bot{border-top:1px solid #161616;padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
    .footer-copy{font-size:12.5px;color:#333;}
    .pay-badges{display:flex;gap:8px;}
    .pay-b{background:#111;border:1px solid #222;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:#555;}

    /* RESPONSIVE */
    @media(max-width:900px){
      .hero{flex-direction:column;text-align:center;padding:72px 24px 48px;}
      .hero-sub{max-width:100%;}
      .hero-btns{justify-content:center;}
      .h-stats{justify-content:center;}
      .hero-r{display:none;}
      .hiw-grid{grid-template-columns:1fr 1fr;}
      .calc-body{grid-template-columns:1fr;}
      .nav-links{display:none;}
      .footer-top{flex-direction:column;}
    }
    @media(max-width:600px){
      .pool-grid{grid-template-columns:1fr;}
      .hiw-grid{grid-template-columns:1fr;}
      .hiw-step:first-child{border-radius:14px 14px 0 0;}
      .hiw-step:last-child{border-radius:0 0 14px 14px;}
      .h-stats{flex-wrap:wrap;gap:20px;}
      .hero-h{letter-spacing:-1.5px;}
    }
  `}</style>;
}

// ── NavBar ────────────────────────────────────────────────────
function NavBar({dark,setDark}){
  const [sc,setSc]=useState(false);
  const navigate=useNavigate();
  useEffect(()=>{const fn=()=>setSc(window.scrollY>10);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  const go=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
  return(
    <nav className="nav" style={{boxShadow:sc?"0 2px 20px rgba(0,0,0,.1)":"none"}}>
      <div className="nav-in">
        <a href="/" className="logo">
          <img src="/favicon-32x32.png" alt="SplitPayNG" style={{width:32,height:32,borderRadius:9,flexShrink:0}} />
          <span className="ltext">SplitPay<em>NG</em></span>
        </a>
        <div className="nav-links">
          <a onClick={()=>go("pools")}>Browse Pools</a>
          <a onClick={()=>go("how")}>How It Works</a>
          <a onClick={()=>go("savings")}>Savings</a>
          <a onClick={()=>go("faq")}>FAQ</a>
        </div>
        <div className="nav-r">
          <div className="toggle">
            <button className={`tbtn${!dark?" on":""}`} onClick={()=>setDark(false)}>☀️</button>
            <button className={`tbtn${dark?" on":""}`} onClick={()=>setDark(true)}>🌙</button>
          </div>
          <button className="btn-ghost" onClick={()=>navigate("/auth")}>Sign In</button>
          <button className="btn-solid" onClick={()=>navigate("/auth")}>Get Started</button>
        </div>
      </div>
    </nav>
  );
}

// ── Ticker ────────────────────────────────────────────────────
function Ticker(){
  const items=[...TICKERS,...TICKERS];
  return(
    <div className="ticker">
      <div className="t-track">
        {items.map((t,i)=><div key={i} className="t-item"><span className="t-dot"/>{t}</div>)}
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function Hero(){
  const navigate=useNavigate();
  const go=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
  const cards=[
    {svc:"Spotify Family",   domain:"spotify.com",    price:"₦2,000/mo",save:"Save 67%",style:{top:20,left:0}},
    {svc:"Netflix Premium",  domain:"netflix.com",     price:"₦6,400/mo",save:"Save 75%",style:{top:150,right:0}},
    {svc:"ChatGPT Plus",     domain:"openai.com",      price:"₦7,500/mo",save:"Save 75%",style:{bottom:30,left:30}},
  ];
  return(
    <section style={{background:"var(--bg)"}}>
      <div className="hero">
        <div className="hero-l">
          <div className="h-badge"><div className="h-dot"/>Nigeria's #1 Subscription Sharing Platform</div>
          <h1 className="hero-h">Cut subscription<br/>costs by up to <em>75%</em></h1>
          <p className="hero-sub">Join shared pools for Netflix, Spotify, ChatGPT, Canva and more. Pay your fair share automatically every month — protected by 48-hour escrow.</p>
          <div className="hero-btns">
            <button className="hbtn-p" onClick={()=>go("pools")}>Browse Pools →</button>
            <button className="hbtn-s" onClick={()=>{sessionStorage.setItem('redirectAfterLogin','/create-pool');navigate("/auth")}}>Host a Pool</button>
          </div>
          <div className="h-stats">
            <div><div className="h-stat-n">847</div><div className="h-stat-l">Active pools</div></div>
            <div className="h-div"/>
            <div><div className="h-stat-n">4,200+</div><div className="h-stat-l">Members</div></div>
            <div className="h-div"/>
            <div><div className="h-stat-n">₦2.4M+</div><div className="h-stat-l">Saved this month</div></div>
          </div>
        </div>
        <div className="hero-r">
          {cards.map((c,i)=>(
            <div key={i} className="fc" style={c.style}>
              <div className="fc-save">{c.save}</div>
              <div className="fc-icon"><img src={favicon(c.domain)} alt={c.svc} width={26} height={26}/></div>
              <div><div className="fc-name">{c.svc}</div><div className="fc-price">{c.price}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pool Grid ─────────────────────────────────────────────────
function PoolGrid(){
  const [cat,setCat]=useState("All");
  const [livePools,setLivePools]=useState([]);
  const [poolsLoading,setPoolsLoading]=useState(true);
  const [fetchFailed,setFetchFailed]=useState(false);

  useEffect(()=>{
    let cancelled=false
    const load = async () => {
      setPoolsLoading(true)
      setFetchFailed(false)
      try {
        const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const res = await fetch(`${API}/api/pools/public`)
        const json = await res.json()
        if(cancelled) return
        if (json.pools) {
          setLivePools(json.pools.map(p => ({
            id: p.id,
            cat: p.category || 'Other',
            svc: p.service_name,
            domain: getDomain(p.service_name),
            host: 'Verified Host',
            price: p.split_price,
            retail: p.split_price * p.max_members,
            max: p.max_members,
            filled: p.current_members || 0,
            renew: (() => {
              const today = new Date()
              const day = p.renewal_day || 1
              const nextRenewal = new Date(today.getFullYear(), today.getMonth(), day)
              if (nextRenewal <= today) nextRenewal.setMonth(nextRenewal.getMonth() + 1)
              return Math.max(1, Math.round((nextRenewal - today) / (1000*60*60*24)))
            })(),
            ver: true,
          })))
        }
      } catch(e){
        if(!cancelled){ console.log('Pool fetch failed:', e.message); setFetchFailed(true) }
      } finally {
        if(!cancelled) setPoolsLoading(false)
      }
    }
    load()
    return ()=>{ cancelled=true }
  },[])

  // Never show demo data in the live pool grid — only real pools
  const filtered = cat==="All" ? livePools : livePools.filter(p=>p.cat===cat);

  return(
    <section id="pools" style={{background:"var(--bg)"}}>
      <div className="sec">
        <div className="sec-lbl">Marketplace</div>
        <div className="sec-title">Available Subscriptions</div>
        <div className="sec-sub">Join a pool and start saving today. New pools added weekly.</div>
        <div className="cats">
          {CATEGORIES.map(c=>(
            <button key={c} className={`cat${cat===c?" active":""}`} onClick={()=>setCat(c)}>{c}</button>
          ))}
        </div>
        {poolsLoading ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 0',gap:14}}>
            <div style={{width:36,height:36,border:'3px solid #E2DAD0',borderTopColor:'#0B3D2E',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
            <div style={{color:'#999',fontSize:14}}>Loading pools…</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px 0',color:'#999',fontSize:15}}>
            {fetchFailed ? '⚠ Could not load pools — check your connection and refresh.' : 'No pools available yet. Be the first to host one!'}
          </div>
        ) : (
          <div className="pool-grid">
            {filtered.map(p=><PoolCard key={p.id} pool={p}/>)}
          </div>
        )}
      </div>
    </section>
  );
}

function PoolCard({pool:p}){
  const [fail,setFail]=useState(false);
  const left=p.max-p.filled;
  const pct=Math.round(p.filled/p.max*100);
  const save=Math.round((p.retail-p.price)/p.retail*100);
  const barColor=left===1?"#E67E22":"var(--accent)";
  return(
    <div className="pc">
      <div className="pc-top">
        <div className="pc-svc">
          <div className="pc-icon">
            {!fail
              ?<img src={favicon(p.domain)} alt={p.svc} width={28} height={28} onError={()=>setFail(true)}/>
              :<span className="pc-fb">{p.svc[0]}</span>}
          </div>
          <div>
            <div className="pc-name">{p.svc}</div>
            <div className="pc-host">by {p.host}</div>
          </div>
        </div>
        {p.ver?<div className="bver">✓ Verified</div>:<div className="besc">⏱ Escrow</div>}
      </div>
      <div className="pc-price">₦{p.price.toLocaleString()}<span>/month</span></div>
      <div className="pc-save">You save {save}% vs buying alone</div>
      <div className="pc-seats">
        <span>{p.filled} of {p.max} seats filled</span>
        {left===1?<span className="seats-last">Last seat!</span>:<span>{left} open</span>}
      </div>
      <div className="pc-bar"><div className="pc-fill" style={{width:`${pct}%`,background:barColor}}/></div>
      <div className="pc-foot">
        <div>
          <div className="pc-renew">Renews in {p.renew}d</div>
          <div className="pc-mem">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {p.filled} members
          </div>
        </div>
        <JoinPoolButton pool={p}/>
      </div>
    </div>
  );
}

// ── How It Works ──────────────────────────────────────────────
function HowItWorks(){
  const steps=[
    {n:"01",title:"Find a pool",desc:"Browse by category. Filter by price, seats, and service. Every pool shows verified host status.",
     icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>},
    {n:"02",title:"Pay your share",desc:"Enter your card once via Paystack. Saved securely for automatic monthly billing — no action needed.",
     icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>},
    {n:"03",title:"Get credentials",desc:"Receive login details instantly. You have 48 hours to confirm credentials work before the host is paid.",
     icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>},
    {n:"04",title:"Access confirmed",desc:"Confirm it works, host gets paid. Auto-billed same day every month. Cancel anytime from your dashboard.",
     icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>},
  ];
  return(
    <section className="hiw" id="how">
      <div className="hiw-in">
        <div className="hiw-lbl">How It Works</div>
        <div className="hiw-title">From browsing to access<br/>in under 3 minutes.</div>
        <div className="hiw-grid">
          {steps.map(s=>(
            <div key={s.n} className="hiw-step">
              <div className="hiw-num">STEP {s.n}</div>
              <div className="hiw-icon">{s.icon}</div>
              <div className="hiw-st">{s.title}</div>
              <div className="hiw-sd">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Savings Calculator ────────────────────────────────────────
function SavingsCalc(){
  const svcs=POOL_DATA.slice(0,8);
  const [sel,setSel]=useState(0);
  const [co,setCo]=useState(3);
  const [open,setOpen]=useState(false);
  const p=svcs[sel];
  const totalMembers = co + 1; // co-subscribers + you
  const yourPrice = Math.round(p.retail / totalMembers);
  const saving = p.retail - yourPrice;
  const yearSave = saving * 12;
  const savePct = Math.round(saving / p.retail * 100);
  return(
    <section className="calc-wrap" id="savings">
      <div className="calc-in">
        <div className="calc-lbl">Savings Calculator</div>
        <div className="calc-title">See how much you could save</div>
        <div className="calc-sub">Save up to 75% on your yearly subscription costs</div>
        <div className="calc-body">
          <div>
            <div className="cf">
              <label>Select subscription</label>
              {/* Custom dropdown — avoids invisible native options on dark bg */}
              <div style={{position:"relative"}}>
                <div
                  onClick={()=>setOpen(o=>!o)}
                  style={{
                    width:"100%",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.18)",
                    borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,color:"#fff",
                    cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                    userSelect:"none",
                  }}
                >
                  <span>{p.svc}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transition:"transform .2s",transform:open?"rotate(180deg)":"none"}}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                {open&&(
                  <div style={{
                    position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                    background:"#1E1E1E",border:"1px solid rgba(255,255,255,.15)",
                    borderRadius:10,overflow:"hidden",zIndex:50,boxShadow:"0 12px 40px rgba(0,0,0,.6)",
                  }}>
                    {svcs.map((s,i)=>(
                      <div
                        key={i}
                        onClick={()=>{setSel(i);setOpen(false);}}
                        style={{
                          padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer",
                          color:sel===i?"#2ECC71":"#E0E0E0",
                          background:sel===i?"rgba(46,204,113,.08)":"transparent",
                          transition:"background .15s",
                          borderBottom:"1px solid rgba(255,255,255,.06)",
                        }}
                        onMouseEnter={e=>{ if(sel!==i) e.currentTarget.style.background="rgba(255,255,255,.05)"; }}
                        onMouseLeave={e=>{ if(sel!==i) e.currentTarget.style.background="transparent"; }}
                      >
                        {s.svc}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="cf" style={{marginTop:24}}>
              <label>Co-subscribers</label>
              <div className="cslider-val">{co} co-subscriber{co!==1?"s":""}</div>
              <input type="range" className="cslider" min={1} max={9} value={co} onChange={e=>setCo(Number(e.target.value))}/>
            </div>
          </div>
          <div className="cres">
            <div className="crow"><span className="crow-l">Standard price (solo)</span><span className="crow-v">₦{p.retail.toLocaleString()}/mo</span></div>
            <div className="crow"><span className="crow-l">Your price ({totalMembers} members)</span><span className="crow-v crow-hi">₦{yourPrice.toLocaleString()}/mo</span></div>
            <div className="crow"><span className="crow-l">You save per month</span><span className="crow-v crow-hi">₦{saving.toLocaleString()} ({savePct}%)</span></div>
            <div className="crow" style={{paddingTop:16}}>
              <span className="crow-l" style={{fontSize:12,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>Yearly saving</span>
              <span className="crow-yr">₦{yearSave.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Why Us ────────────────────────────────────────────────────
function WhyUs(){
  const cards=[
    {title:"48-Hour Escrow",desc:"Payment held for 48 hours while you verify access. If credentials don't work, you get a full automatic refund.",
     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>},
    {title:"Verified Hosts",desc:"Every host is identity-verified before listing a pool. Unverified pools are clearly labelled and escrow-protected.",
     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>},
    {title:"Auto Monthly Billing",desc:"Card saved securely by Paystack. Billed same day every month — no reminders, no manual payments, ever.",
     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>},
    {title:"24hr Dispute Resolution",desc:"Raise a dispute from your dashboard. Our team reviews and resolves within 24 hours — refunding or releasing funds.",
     icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>},
  ];
  return(
    <section style={{background:"var(--bg)"}}>
      <div className="sec">
        <div className="sec-lbl">Why SplitPayNG</div>
        <div className="sec-title">Built for trust, not just savings</div>
        <div className="sec-sub">Every feature is designed to protect both members and hosts.</div>
        <div className="why-grid">
          {cards.map(c=>(
            <div key={c.title} className="why-card">
              <div className="why-icon">{c.icon}</div>
              <div className="why-title">{c.title}</div>
              <div className="why-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────
function FaqSection(){
  const [open,setOpen]=useState(null);
  return(
    <section style={{background:"var(--bg)"}} id="faq">
      <div className="sec" style={{paddingTop:0}}>
        <div className="sec-lbl">FAQ</div>
        <div className="sec-title">Frequently asked questions</div>
        <div className="faq-list">
          {FAQS.map((f,i)=>(
            <div key={i} className={`faq-item${open===i?" open":""}`}>
              <div className="faq-q" onClick={()=>setOpen(open===i?null:i)}>
                {f.q}
                <svg className={`faq-chev${open===i?" open":""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              {open===i&&<div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ────────────────────────────────────────────────
function CTABanner(){
  const navigate=useNavigate();
  const go=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
  return(
    <div className="cta-banner">
      <h2>Start saving on subscriptions today</h2>
      <p>Join thousands of Nigerians already splitting subscriptions on SplitPayNG</p>
      <div className="cta-btns">
        <button className="cta-w" onClick={()=>go("pools")}>Browse Pools</button>
        <button className="cta-o" onClick={()=>{sessionStorage.setItem('redirectAfterLogin','/create-pool');navigate("/auth")}}>Host a Pool</button>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────
function Footer(){
  const navigate=useNavigate();
  const go=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
  return(
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-top">
          <div className="footer-brand">
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <img src="/favicon-32x32.png" alt="SplitPayNG" style={{width:32,height:32,borderRadius:9,flexShrink:0}} />
              <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:17,fontWeight:800,color:"#fff"}}>SplitPay<span style={{color:"#2ECC71"}}>NG</span></span>
            </div>
            <p>Nigeria's trusted platform for sharing premium subscriptions. Save more, together.</p>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <a onClick={()=>go("pools")}>Browse Pools</a>
            <a onClick={()=>{sessionStorage.setItem('redirectAfterLogin','/create-pool');navigate("/auth")}}>Host a Pool</a>
            <a onClick={()=>navigate("/auth")}>Dashboard</a>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <a onClick={()=>go("faq")}>FAQ</a>
            <a href="mailto:hello@splitpayng.com">Contact Us</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a>Privacy Policy</a>
            <a>Terms of Service</a>
            <a>Refund Policy</a>
          </div>
        </div>
        <div className="footer-bot">
          <div className="footer-copy">© 2025 SplitPayNG — All rights reserved.</div>
          <div className="pay-badges">
            <span className="pay-b">Paystack</span>
            <span className="pay-b">Visa</span>
            <span className="pay-b">Mastercard</span>
            <span className="pay-b">USSD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}