import { useState, useEffect } from "react";
import JoinPoolButton from './components/JoinPoolButton';

const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    body{-webkit-font-smoothing:antialiased;}
    h1,h2,h3,h4{font-family:'Bricolage Grotesque',sans-serif;}

    .app{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg-page);color:var(--ink-1);min-height:100vh;transition:background .35s,color .35s;}

    .light{
      --bg-page:#F4EFE6;--bg-surface:#FFFFFF;--bg-elevated:#F9F6F1;--bg-invert:#0B3D2E;
      --border:#E2DAD0;--border-strong:#C8BFB3;
      --ink-1:#111111;--ink-2:#666666;--ink-3:#BBBBBB;--ink-4:#F0EDE8;
      --accent:#0B3D2E;--accent-mid:#1A5C42;--accent-pale:#E8F5EF;--accent-ring:#C5E0D4;--accent-text:#0B3D2E;
      --amber:#C97B1A;--amber-pale:#FEF3E2;--amber-ring:#F0D5A0;
      --shadow-sm:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
      --shadow-md:0 4px 16px rgba(0,0,0,.08),0 2px 6px rgba(0,0,0,.04);
      --nav-bg:rgba(244,239,230,.93);
      --hiw-bg:#0B3D2E;--hiw-step:rgba(255,255,255,.06);--hiw-step-h:rgba(255,255,255,.11);
      --hiw-t:#FFFFFF;--hiw-d:rgba(255,255,255,.52);--hiw-l:rgba(255,255,255,.38);
      --progress-track:#F0EDE8;--btn-primary-text:#FFFFFF;--toggle-active:#FFFFFF;
    }

    .dark{
      --bg-page:#080C10;--bg-surface:#0D1117;--bg-elevated:#131B24;--bg-invert:#131B24;
      --border:#1E2D3D;--border-strong:#2E4A60;
      --ink-1:#F0F6FC;--ink-2:#8B9BB4;--ink-3:#3A4A5C;--ink-4:#131B24;
      --accent:#00E87A;--accent-mid:#00C060;--accent-pale:#00E87A14;--accent-ring:#00E87A38;--accent-text:#00E87A;
      --amber:#F5A623;--amber-pale:#F5A62314;--amber-ring:#F5A62338;
      --shadow-sm:0 1px 3px rgba(0,0,0,.35);
      --shadow-md:0 4px 20px rgba(0,0,0,.5);
      --nav-bg:rgba(8,12,16,.93);
      --hiw-bg:#0D1117;--hiw-step:#131B24;--hiw-step-h:#1A2535;
      --hiw-t:#F0F6FC;--hiw-d:#8B9BB4;--hiw-l:#3A4A5C;
      --progress-track:#1E2D3D;--btn-primary-text:#000000;--toggle-active:#0D1117;
    }

    .nav{position:fixed;top:0;left:0;right:0;z-index:200;background:var(--nav-bg);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid var(--border);transition:background .35s,border-color .35s,box-shadow .3s;}
    .nav.scrolled{box-shadow:var(--shadow-sm);}
    .nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:62px;}
    .logo{display:flex;align-items:center;gap:9px;text-decoration:none;}
    .logo-mark{width:30px;height:30px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:var(--btn-primary-text);font-family:'Bricolage Grotesque',sans-serif;font-size:15px;font-weight:800;transition:background .35s,color .35s;}
    .logo-text{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;font-weight:700;color:var(--ink-1);letter-spacing:-.4px;transition:color .35s;}
    .logo-text span{color:var(--accent);transition:color .35s;}
    .nav-links{display:flex;align-items:center;gap:28px;}
    .nav-links a{font-size:13.5px;font-weight:500;color:var(--ink-2);text-decoration:none;transition:color .15s;}
    .nav-links a:hover{color:var(--ink-1);}
    .nav-right{display:flex;align-items:center;gap:10px;}
    .toggle{display:flex;align-items:center;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:3px;gap:0;transition:background .35s,border-color .35s;}
    .toggle-btn{width:30px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:7px;border:none;background:none;font-size:14px;cursor:pointer;transition:background .2s,box-shadow .2s;}
    .toggle-btn.on{background:var(--toggle-active);box-shadow:var(--shadow-sm);}
    .btn-ghost{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:500;color:var(--ink-2);background:none;border:1px solid var(--border);border-radius:9px;padding:8px 16px;cursor:pointer;transition:all .15s;}
    .btn-ghost:hover{border-color:var(--border-strong);color:var(--ink-1);background:var(--bg-elevated);}
    .btn-solid{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;background:var(--accent);color:var(--btn-primary-text);border:none;border-radius:9px;padding:9px 18px;cursor:pointer;transition:all .2s;}
    .btn-solid:hover{background:var(--accent-mid);transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.28);}

    .ticker{background:var(--bg-surface);border-bottom:1px solid var(--border);padding:10px 0;overflow:hidden;transition:background .35s,border-color .35s;}
    @keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    .ticker-track{display:inline-flex;gap:48px;animation:tick 30s linear infinite;white-space:nowrap;}
    .tick-item{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:var(--ink-2);}
    .tick-dot{width:5px;height:5px;border-radius:50%;background:var(--accent);flex-shrink:0;transition:background .35s;}

    .hero{max-width:1200px;margin:0 auto;padding:112px 24px 68px;}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:var(--accent-text);background:var(--accent-pale);border:1px solid var(--accent-ring);border-radius:100px;padding:5px 14px;margin-bottom:26px;transition:all .35s;}
    .eyebrow-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;transition:background .35s;}
    .hero-h{font-size:clamp(36px,5.5vw,64px);font-weight:800;line-height:1.04;letter-spacing:-2.5px;color:var(--ink-1);max-width:760px;margin-bottom:20px;transition:color .35s;}
    .hero-h em{font-style:normal;color:var(--accent);transition:color .35s;}
    .hero-sub{font-size:clamp(15px,1.8vw,17px);font-weight:400;color:var(--ink-2);line-height:1.65;max-width:480px;margin-bottom:34px;transition:color .35s;}
    .hero-btns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:52px;}
    .btn-primary{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:600;background:var(--accent);color:var(--btn-primary-text);border:none;border-radius:12px;padding:14px 28px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;}
    .btn-primary:hover{background:var(--accent-mid);transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,.28);}
    .btn-secondary{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:500;color:var(--ink-1);background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:14px 26px;cursor:pointer;transition:all .2s;}
    .btn-secondary:hover{border-color:var(--border-strong);transform:translateY(-1px);box-shadow:var(--shadow-sm);}
    .stats{display:flex;background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;width:fit-content;box-shadow:var(--shadow-sm);transition:background .35s,border-color .35s;}
    .stat{padding:15px 28px;text-align:center;border-right:1px solid var(--border);transition:border-color .35s;}
    .stat:last-child{border-right:none;}
    .stat-n{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:800;color:var(--ink-1);letter-spacing:-.8px;display:block;transition:color .35s;}
    .stat-l{font-size:11.5px;font-weight:500;color:var(--ink-2);margin-top:2px;white-space:nowrap;transition:color .35s;}

    .trust{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg-surface);padding:13px 24px;transition:background .35s,border-color .35s;}
    .trust-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;}
    .trust-item{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:var(--ink-2);transition:color .35s;}

    .market{max-width:1200px;margin:0 auto;padding:52px 24px 96px;}
    .sec-label{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-2);margin-bottom:6px;transition:color .35s;}
    .sec-title{font-size:clamp(22px,2.8vw,30px);font-weight:800;letter-spacing:-.8px;color:var(--ink-1);transition:color .35s;}
    .controls{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;}
    .search-wrap{position:relative;flex:1;min-width:240px;max-width:400px;}
    .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--ink-3);font-size:15px;pointer-events:none;}
    .search-input{width:100%;font-family:'Plus Jakarta Sans',sans-serif;font-size:13.5px;color:var(--ink-1);background:var(--bg-surface);border:1px solid var(--border);border-radius:9px;padding:10px 14px 10px 40px;outline:none;transition:all .2s;}
    .search-input::placeholder{color:var(--ink-3);}
    .search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-pale);}
    .sort{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:500;color:var(--ink-2);background:var(--bg-surface);border:1px solid var(--border);border-radius:9px;padding:10px 14px;outline:none;cursor:pointer;transition:background .35s,color .35s,border-color .35s;}

    .cats{display:flex;gap:6px;margin-bottom:28px;overflow-x:auto;padding-bottom:2px;}
    .cats::-webkit-scrollbar{display:none;}
    .cat{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:500;border-radius:100px;padding:7px 16px;border:1px solid var(--border);cursor:pointer;white-space:nowrap;transition:all .18s;background:var(--bg-surface);color:var(--ink-2);display:flex;align-items:center;gap:6px;}
    .cat:hover{border-color:var(--border-strong);color:var(--ink-1);}
    .cat.active{background:var(--accent);color:var(--btn-primary-text);border-color:var(--accent);}
    .cat-n{font-size:10px;font-weight:700;background:rgba(255,255,255,.18);border-radius:100px;padding:1px 6px;}
    .cat:not(.active) .cat-n{background:var(--ink-4);color:var(--ink-2);}

    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,308px),1fr));gap:16px;}

    .card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:22px;cursor:pointer;display:flex;flex-direction:column;transition:box-shadow .22s,transform .22s,border-color .22s,background .35s;}
    @keyframes cIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .card{animation:cIn .4s ease both;}
    .card:nth-child(1){animation-delay:.04s}.card:nth-child(2){animation-delay:.08s}.card:nth-child(3){animation-delay:.12s}.card:nth-child(4){animation-delay:.16s}.card:nth-child(5){animation-delay:.20s}.card:nth-child(6){animation-delay:.24s}.card:nth-child(7){animation-delay:.28s}.card:nth-child(8){animation-delay:.32s}.card:nth-child(9){animation-delay:.36s}.card:nth-child(10){animation-delay:.40s}.card:nth-child(11){animation-delay:.44s}.card:nth-child(12){animation-delay:.48s}
    .card:hover{box-shadow:var(--shadow-md);transform:translateY(-3px);border-color:var(--accent-ring);}
    .card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;}
    .card-svc{display:flex;align-items:center;gap:12px;}

    /* ── Real brand icon ── */
    .svc-icon{
      width:44px;height:44px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;border:1px solid var(--border);
      overflow:hidden;transition:border-color .35s;
    }
    .svc-icon img{
      width:26px;height:26px;object-fit:contain;
      display:block;transition:filter .35s;
    }

    .svc-name{font-family:'Bricolage Grotesque',sans-serif;font-size:15px;font-weight:700;color:var(--ink-1);letter-spacing:-.3px;line-height:1.2;transition:color .35s;}
    .svc-host{font-size:12px;color:var(--ink-2);margin-top:2px;transition:color .35s;}
    .badge{font-family:'Plus Jakarta Sans',sans-serif;font-size:10.5px;font-weight:700;border-radius:6px;padding:3px 9px;white-space:nowrap;flex-shrink:0;}
    .badge-v{background:var(--accent-pale);color:var(--accent-text);border:1px solid var(--accent-ring);}
    .badge-e{background:var(--amber-pale);color:var(--amber);border:1px solid var(--amber-ring);}
    .card-div{height:1px;background:var(--border);margin:0 0 18px;transition:background .35s;}
    .price-row{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;}
    .price{font-family:'Bricolage Grotesque',sans-serif;font-size:27px;font-weight:800;color:var(--ink-1);letter-spacing:-1px;transition:color .35s;}
    .price-unit{font-size:12px;color:var(--ink-2);margin-left:3px;transition:color .35s;}
    .savings{font-size:11.5px;font-weight:700;color:var(--accent-text);background:var(--accent-pale);border-radius:6px;padding:3px 9px;transition:all .35s;}
    .seats-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
    .seats-l{font-size:11.5px;font-weight:500;color:var(--ink-2);transition:color .35s;}
    .seats-w{font-size:11.5px;font-weight:600;color:var(--amber);}
    .bar{height:4px;background:var(--progress-track);border-radius:2px;overflow:hidden;margin-bottom:18px;transition:background .35s;}
    .bar-fill{height:100%;border-radius:2px;background:var(--accent);transition:width .4s ease,background .35s;}
    .bar-fill.w{background:var(--amber);}
    .card-bot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:16px;margin-top:auto;transition:border-color .35s;}
    .renew{font-size:11.5px;color:var(--ink-2);transition:color .35s;}
    .renew strong{font-weight:600;color:var(--ink-1);transition:color .35s;}
    .btn-join{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;color:var(--accent-text);background:var(--accent-pale);border:1px solid var(--accent-ring);border-radius:8px;padding:8px 18px;cursor:pointer;transition:all .15s;}
    .btn-join:hover{background:var(--accent);color:var(--btn-primary-text);border-color:var(--accent);}

    .empty{grid-column:1/-1;text-align:center;padding:80px 20px;}
    .empty-t{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;color:var(--ink-1);margin-bottom:6px;}
    .empty-s{font-size:13.5px;color:var(--ink-2);}

    .hiw{background:var(--hiw-bg);padding:80px 24px;transition:background .35s;}
    .hiw-in{max-width:1200px;margin:0 auto;}
    .hiw-lbl{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--hiw-l);margin-bottom:8px;transition:color .35s;}
    .hiw-ttl{font-size:clamp(24px,3vw,36px);font-weight:800;letter-spacing:-1px;color:var(--hiw-t);line-height:1.1;margin-bottom:48px;transition:color .35s;}
    .hiw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2px;}
    .hiw-step{background:var(--hiw-step);padding:28px 24px;border-radius:0;transition:background .2s;}
    .hiw-step:first-child{border-radius:12px 0 0 12px;}
    .hiw-step:last-child{border-radius:0 12px 12px 0;}
    .hiw-step:hover{background:var(--hiw-step-h);}
    .hiw-num{font-family:'Bricolage Grotesque',sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;color:var(--hiw-l);margin-bottom:14px;transition:color .35s;}
    .hiw-icon{font-size:26px;margin-bottom:12px;display:block;}
    .hiw-st{font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:700;color:var(--hiw-t);margin-bottom:8px;transition:color .35s;}
    .hiw-sd{font-size:13.5px;color:var(--hiw-d);line-height:1.6;transition:color .35s;}

    .cta{max-width:1200px;margin:0 auto;padding:60px 24px;}
    .cta-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:48px 44px;display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap;box-shadow:var(--shadow-sm);transition:background .35s,border-color .35s;}
    .cta-t{font-size:clamp(22px,2.8vw,30px);font-weight:800;letter-spacing:-.8px;color:var(--ink-1);margin-bottom:8px;transition:color .35s;}
    .cta-s{font-size:14px;color:var(--ink-2);line-height:1.6;max-width:420px;transition:color .35s;}

    .footer{border-top:1px solid var(--border);background:var(--bg-surface);padding:28px 24px;transition:background .35s,border-color .35s;}
    .footer-in{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;}
    .flogo{font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:700;color:var(--ink-1);transition:color .35s;}
    .flogo span{color:var(--accent);transition:color .35s;}
    .flinks{display:flex;gap:22px;}
    .flinks a{font-size:12.5px;font-weight:500;color:var(--ink-2);text-decoration:none;transition:color .15s;}
    .flinks a:hover{color:var(--ink-1);}
    .fcopy{font-size:12.5px;color:var(--ink-3);transition:color .35s;}

    @media(max-width:680px){
      .nav-links{display:none;}
      .stats{flex-direction:column;width:100%;}
      .stat{border-right:none;border-bottom:1px solid var(--border);}
      .stat:last-child{border-bottom:none;}
      .hiw-step:first-child{border-radius:12px 12px 0 0;}
      .hiw-step:last-child{border-radius:0 0 12px 12px;}
      .cta-card{padding:32px 24px;}
      .controls{flex-direction:column;align-items:stretch;}
      .search-wrap{max-width:100%;}
    }
  `}</style>
);

// ── Brand icon URLs from cdn.simpleicons.org ─────────────────
// Format: https://cdn.simpleicons.org/{slug}/{hex-color}
// Dark mode gets a lighter tint of each brand color.
const BRAND_ICONS = {
  chatgpt:    { light: "https://cdn.simpleicons.org/openai/10A37F",       dark: "https://cdn.simpleicons.org/openai/3ECF8E"       },
  claude:     { light: "https://cdn.simpleicons.org/anthropic/CC785C",    dark: "https://cdn.simpleicons.org/anthropic/E8967A"    },
  cursor:     { light: "https://cdn.simpleicons.org/cursor/000000",       dark: "https://cdn.simpleicons.org/cursor/FFFFFF"       },
  midjourney: { light: "https://cdn.simpleicons.org/midjourney/000000",   dark: "https://cdn.simpleicons.org/midjourney/FFFFFF"   },
  netflix:    { light: "https://cdn.simpleicons.org/netflix/E50914",      dark: "https://cdn.simpleicons.org/netflix/E50914"      },
  prime:      { light: "https://cdn.simpleicons.org/amazonprime/00A8E1",  dark: "https://cdn.simpleicons.org/amazonprime/00A8E1"  },
  showmax:    { light: "https://cdn.simpleicons.org/showmax/E82929",      dark: "https://cdn.simpleicons.org/showmax/E82929"      },
  youtube:    { light: "https://cdn.simpleicons.org/youtube/FF0000",      dark: "https://cdn.simpleicons.org/youtube/FF0000"      },
  canva:      { light: "https://cdn.simpleicons.org/canva/00C4CC",        dark: "https://cdn.simpleicons.org/canva/00C4CC"        },
  microsoft:  { light: "https://cdn.simpleicons.org/microsoft/737373",    dark: "https://cdn.simpleicons.org/microsoft/AAAAAA"    },
  adobe:      { light: "https://cdn.simpleicons.org/adobe/FF0000",        dark: "https://cdn.simpleicons.org/adobe/FF0000"        },
  spotify:    { light: "https://cdn.simpleicons.org/spotify/1DB954",      dark: "https://cdn.simpleicons.org/spotify/1DB954"      },
  applemusic: { light: "https://cdn.simpleicons.org/applemusic/FC3C44",   dark: "https://cdn.simpleicons.org/applemusic/FC3C44"   },
  playstation:{ light: "https://cdn.simpleicons.org/playstation/003EA6",  dark: "https://cdn.simpleicons.org/playstation/4A7FD4"  },
  xbox:       { light: "https://cdn.simpleicons.org/xbox/107C10",         dark: "https://cdn.simpleicons.org/xbox/52B043"         },
  google:     { light: "https://cdn.simpleicons.org/google/4285F4",       dark: "https://cdn.simpleicons.org/google/4285F4"       },
};

const CATS = ["All","AI & Dev Tools","Entertainment","Creative & Work","Music","Gaming & Storage"];

const POOLS = [
  {id:1,  cat:"AI & Dev Tools",   svc:"ChatGPT Plus",            icon:"chatgpt",     bg:{l:"#F0FDF4",d:"#10A37F10"}, host:"Tunde A.",   total:30000, price:7500,  max:4, filled:2, ver:true,  renew:18},
  {id:2,  cat:"AI & Dev Tools",   svc:"Claude Pro",              icon:"claude",      bg:{l:"#FFF8F5",d:"#CC785C10"}, host:"Amaka O.",   total:28000, price:9500,  max:3, filled:1, ver:true,  renew:6 },
  {id:3,  cat:"AI & Dev Tools",   svc:"Cursor AI",               icon:"cursor",      bg:{l:"#F5F5F5",d:"#FFFFFF08"}, host:"Emeka S.",   total:24000, price:8000,  max:3, filled:2, ver:false, renew:22},
  {id:4,  cat:"AI & Dev Tools",   svc:"Midjourney",              icon:"midjourney",  bg:{l:"#F5F5F5",d:"#FFFFFF08"}, host:"Chisom N.",  total:36000, price:9000,  max:4, filled:3, ver:true,  renew:11},
  {id:5,  cat:"Entertainment",    svc:"Netflix Premium",         icon:"netflix",     bg:{l:"#FFF0F0",d:"#E5000010"}, host:"Seun B.",    total:25600, price:6400,  max:4, filled:1, ver:true,  renew:14},
  {id:6,  cat:"Entertainment",    svc:"Amazon Prime Video",      icon:"prime",       bg:{l:"#F0F9FF",d:"#00A8E110"}, host:"Kemi F.",    total:18000, price:4500,  max:4, filled:3, ver:true,  renew:3 },
  {id:7,  cat:"Entertainment",    svc:"Showmax Premier League",  icon:"showmax",     bg:{l:"#FFF0F0",d:"#E8292910"}, host:"Bola T.",    total:32000, price:8000,  max:4, filled:2, ver:false, renew:30},
  {id:8,  cat:"Entertainment",    svc:"YouTube Premium Family",  icon:"youtube",     bg:{l:"#FFF0F0",d:"#FF000010"}, host:"Uche M.",    total:15000, price:2500,  max:6, filled:4, ver:true,  renew:9 },
  {id:9,  cat:"Creative & Work",  svc:"Canva for Teams",         icon:"canva",       bg:{l:"#F0FFFE",d:"#00C4CC10"}, host:"Ngozi A.",   total:45000, price:9000,  max:5, filled:3, ver:true,  renew:20},
  {id:10, cat:"Creative & Work",  svc:"Microsoft 365 Family",    icon:"microsoft",   bg:{l:"#F0F8FF",d:"#73737310"}, host:"Dami P.",    total:42000, price:7000,  max:6, filled:5, ver:true,  renew:17},
  {id:11, cat:"Creative & Work",  svc:"Adobe Creative Cloud",    icon:"adobe",       bg:{l:"#FFF0F0",d:"#FF000010"}, host:"Femi O.",    total:95000, price:23750, max:4, filled:1, ver:false, renew:25},
  {id:12, cat:"Music",            svc:"Spotify Family",          icon:"spotify",     bg:{l:"#F0FDF5",d:"#1DB95410"}, host:"Zara K.",    total:12000, price:2000,  max:6, filled:4, ver:true,  renew:5 },
  {id:13, cat:"Music",            svc:"Apple Music Family",      icon:"applemusic",  bg:{l:"#FFF5F7",d:"#FC3C4410"}, host:"Tola A.",    total:14000, price:2800,  max:5, filled:2, ver:true,  renew:12},
  {id:14, cat:"Gaming & Storage", svc:"PS Plus Extra",           icon:"playstation", bg:{l:"#F0F4FF",d:"#003EA610"}, host:"Kunle R.",   total:28000, price:7000,  max:4, filled:2, ver:true,  renew:8 },
  {id:15, cat:"Gaming & Storage", svc:"Xbox Game Pass Ultimate", icon:"xbox",        bg:{l:"#F0FBF0",d:"#10760010"}, host:"Chidi N.",   total:26000, price:6500,  max:4, filled:1, ver:false, renew:19},
  {id:16, cat:"Gaming & Storage", svc:"Google One 2TB",          icon:"google",      bg:{l:"#F5F8FF",d:"#4285F410"}, host:"Adaeze I.",  total:9500,  price:2375,  max:4, filled:3, ver:true,  renew:26},
];

const TICKS = ["847 active pools live","Zero failed payouts this month","48-Hour Escrow on all public pools","Auto-billing — charge once, relax forever","New Netflix pool — 3 seats left","Spotify Family — 2 seats left","Adobe CC pool just opened"];

function NavBar({dark,setDark}){
  const [sc,setSc]=useState(false);
  useEffect(()=>{const fn=()=>setSc(window.scrollY>10);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  return(
    <nav className={`nav${sc?" scrolled":""}`}>
      <div className="nav-inner">
        <a href="#" className="logo">
          <div className="logo-mark">S</div>
          <span className="logo-text">SplitPay<span>NG</span></span>
        </a>
        <div className="nav-links">
          <a href="#">Marketplace</a>
          <a href="#">How It Works</a>
          <a href="#">Host a Pool</a>
        </div>
        <div className="nav-right">
          <div className="toggle">
            <button className={`toggle-btn${!dark?" on":""}`} onClick={()=>setDark(false)} title="Light mode">☀️</button>
            <button className={`toggle-btn${dark?" on":""}`}  onClick={()=>setDark(true)}  title="Dark mode">🌙</button>
          </div>
          <button className="btn-ghost">Sign In</button>
          <button className="btn-solid">Get Started</button>
        </div>
      </div>
    </nav>
  );
}

function Ticker(){
  const all=[...TICKS,...TICKS];
  return(
    <div className="ticker">
      <div className="ticker-track">
        {all.map((t,i)=><span key={i} className="tick-item"><span className="tick-dot"/>{t}</span>)}
      </div>
    </div>
  );
}

function Hero(){
  return(
    <section>
      <div className="hero">
        <div className="eyebrow"><div className="eyebrow-dot"/>847 active pools · Zero failed payouts this month</div>
        <h1 className="hero-h">Premium subscriptions,<br/><em>split fairly.</em></h1>
        <p className="hero-sub">Netflix, ChatGPT, Adobe CC — join a trusted pool and pay your share automatically every month. Protected by 48-hour escrow.</p>
        <div className="hero-btns">
          <button className="btn-primary">Browse Pools <span>→</span></button>
          <button className="btn-secondary">Host a Pool</button>
        </div>
        <div className="stats">
          {[{n:"₦2.4M+",l:"Saved this month"},{n:"847",l:"Active pools"},{n:"4,200+",l:"Members"},{n:"100%",l:"Escrow protected"}].map(s=>(
            <div key={s.n} className="stat"><span className="stat-n">{s.n}</span><span className="stat-l">{s.l}</span></div>
          ))}
        </div>
      </div>
      <div className="trust">
        <div className="trust-inner">
          {[{i:"🔒",t:"48-Hour Escrow"},{i:"💳",t:"Powered by Paystack"},{i:"✓",t:"Verified hosts"},{i:"🔄",t:"Auto monthly billing"},{i:"🛡️",t:"24hr dispute resolution"}].map(x=>(
            <div key={x.t} className="trust-item"><span>{x.i}</span><span>{x.t}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pool Card ─────────────────────────────────────────────────
function Card({p, dark}){
  const left = p.max - p.filled;
  const pct  = Math.round(p.filled / p.max * 100);
  const perSeat = p.total / p.max;
  const sav  = Math.round(((perSeat - p.price) / perSeat) * 100);

  const brand = BRAND_ICONS[p.icon];
  const iconSrc  = dark ? brand?.dark  : brand?.light;
  const iconBg   = dark ? p.bg.d : p.bg.l;

  return(
    <div className="card">
      <div className="card-top">
        <div className="card-svc">
          {/* Real brand icon */}
          <div className="svc-icon" style={{background: iconBg}}>
            <img
              src={iconSrc}
              alt={p.svc}
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
          <div>
            <div className="svc-name">{p.svc}</div>
            <div className="svc-host">by {p.host}</div>
          </div>
        </div>
        <span className={`badge ${p.ver?"badge-v":"badge-e"}`}>{p.ver?"✓ Verified":"⏱ Escrow"}</span>
      </div>
      <div className="card-div"/>
      <div className="price-row">
        <div><span className="price">₦{p.price.toLocaleString()}</span><span className="price-unit">/month</span></div>
        {sav>0 && <span className="savings">Save {sav}%</span>}
      </div>
      <div className="seats-row">
        <span className="seats-l">{p.filled} of {p.max} seats filled</span>
        {left===1
          ? <span className="seats-w">Last seat</span>
          : <span className="seats-l" style={{color:"var(--ink-3)"}}>{left} open</span>
        }
      </div>
      <div className="bar"><div className={`bar-fill${pct>=75?" w":""}`} style={{width:`${pct}%`}}/></div>
      <div className="card-bot">
        <span className="renew">Renews in <strong>{p.renew}d</strong></span>
        <JoinPoolButton pool={p} />
      </div>
    </div>
  );
}

function Market({dark}){
  const [cat,  setCat]  = useState("All");
  const [q,    setQ]    = useState("");
  const [sort, setSort] = useState("popular");

  const list = POOLS
    .filter(p => cat==="All" || p.cat===cat)
    .filter(p => p.svc.toLowerCase().includes(q.toLowerCase()) || p.cat.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b) => {
      if(sort==="price-asc")  return a.price - b.price;
      if(sort==="price-desc") return b.price - a.price;
      if(sort==="seats")      return (a.max-a.filled) - (b.max-b.filled);
      return b.filled - a.filled;
    });

  return(
    <section className="market">
      <div style={{marginBottom:28}}>
        <div className="sec-label">Marketplace</div>
        <h2 className="sec-title">Browse Live Pools</h2>
      </div>
      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" type="text" placeholder="Search by service or category…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12.5,color:"var(--ink-2)"}}>{list.length} pool{list.length!==1?"s":""}</span>
          <select className="sort" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="popular">Most popular</option>
            <option value="price-asc">Price: Low to high</option>
            <option value="price-desc">Price: High to low</option>
            <option value="seats">Most seats available</option>
          </select>
        </div>
      </div>
      <div className="cats">
        {CATS.map(c=>(
          <button key={c} className={`cat${cat===c?" active":""}`} onClick={()=>setCat(c)}>
            {c}{c!=="All"&&<span className="cat-n">{POOLS.filter(p=>p.cat===c).length}</span>}
          </button>
        ))}
      </div>
      <div className="grid">
        {list.length>0
          ? list.map(p=><Card key={p.id} p={p} dark={dark}/>)
          : (
            <div className="empty">
              <div style={{fontSize:30,marginBottom:12,color:"var(--ink-3)"}}>○</div>
              <div className="empty-t">No pools found</div>
              <p className="empty-s">Try adjusting your search or filter.</p>
            </div>
          )
        }
      </div>
      {list.length>0 && (
        <div style={{textAlign:"center",marginTop:48}}>
          <button className="btn-ghost" style={{padding:"11px 36px",fontSize:13.5}}>Load more pools</button>
        </div>
      )}
    </section>
  );
}

function How(){
  const steps=[
    {n:"01",i:"🔍",t:"Find a pool",   d:"Browse the marketplace. Filter by service, price, and available seats."},
    {n:"02",i:"💳",t:"Pay your share",d:"Enter your card once. Tokenized securely for automatic monthly billing."},
    {n:"03",i:"🔐",t:"Get credentials",d:"Receive login details instantly. 48 hours to confirm everything works."},
    {n:"04",i:"✅",t:"Access confirmed",d:"Funds released to host. Auto-billed on the same day every month."},
  ];
  return(
    <section className="hiw">
      <div className="hiw-in">
        <div className="hiw-lbl">How it works</div>
        <h2 className="hiw-ttl">From browsing to access<br/>in under 3 minutes.</h2>
        <div className="hiw-grid">
          {steps.map(s=>(
            <div key={s.n} className="hiw-step">
              <div className="hiw-num">STEP {s.n}</div>
              <span className="hiw-icon">{s.i}</span>
              <div className="hiw-st">{s.t}</div>
              <div className="hiw-sd">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA(){
  return(
    <section className="cta">
      <div className="cta-card">
        <div>
          <h2 className="cta-t">Own a subscription?<br/>Make it pay for itself.</h2>
          <p className="cta-s">Create a pool in 60 seconds. Invite friends privately or open it to the public. Get paid every billing cycle.</p>
        </div>
        <button className="btn-primary" style={{flexShrink:0}}>Host your first pool →</button>
      </div>
    </section>
  );
}

function Footer(){
  return(
    <footer className="footer">
      <div className="footer-in">
        <span className="flogo">SplitPay<span>NG</span></span>
        <span className="fcopy">© 2025 SplitPayNG · Secured by Paystack · Built in Lagos</span>
        <div className="flinks"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></div>
      </div>
    </footer>
  );
}

export default function App(){
  const [dark,setDark]=useState(false);
  useEffect(()=>{ const s=localStorage.getItem("spng-theme"); if(s==="dark") setDark(true); },[]);
  useEffect(()=>{ localStorage.setItem("spng-theme", dark?"dark":"light"); },[dark]);
  return(
    <div className={`app ${dark?"dark":"light"}`}>
      <Styles/>
      <NavBar dark={dark} setDark={setDark}/>
      <main>
        <div style={{marginTop:62}}><Ticker/></div>
        <Hero/>
        <Market dark={dark}/>
        <How/>
        <CTA/>
      </main>
      <Footer/>
    </div>
  );
}