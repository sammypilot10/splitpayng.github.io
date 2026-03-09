import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const DOMAIN_MAP = {
  'netflix':'netflix.com','spotify':'spotify.com','youtube':'youtube.com',
  'chatgpt':'openai.com','openai':'openai.com','claude':'claude.ai',
  'amazon':'primevideo.com','prime':'primevideo.com','canva':'canva.com',
  'adobe':'adobe.com','microsoft':'microsoft.com','apple':'apple.com',
  'playstation':'playstation.com','xbox':'xbox.com','google':'google.com',
  'midjourney':'midjourney.com','showmax':'showmax.com','notion':'notion.so',
  'figma':'figma.com','disney':'disneyplus.com','cursor':'cursor.com',
  'dstv':'dstv.com','boomplay':'boomplay.com',
}
function getDomain(name=''){
  const l=name.toLowerCase()
  for(const[k,v]of Object.entries(DOMAIN_MAP)){if(l.includes(k))return v}
  return l.split(' ')[0].replace(/[^a-z]/g,'')+'.com'
}
const fmt=(n)=>`₦${Number(n).toLocaleString()}`

export default function JoinPool(){
  const {id}=useParams()
  const navigate=useNavigate()
  const {user}=useAuth()
  const [pool,setPool]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [joining,setJoining]=useState(false)
  const [joinError,setJoinError]=useState(null)

  useEffect(()=>{
    // RECOVERY: if user closed Paystack without waiting for auto-redirect,
    // we still have the reference saved — go verify it immediately
    const pendingRef = sessionStorage.getItem('pendingPaymentRef')
    const pendingPool = sessionStorage.getItem('pendingPoolId')
    if(pendingRef){
      sessionStorage.removeItem('pendingPaymentRef')
      sessionStorage.removeItem('pendingPoolId')
      // Use window.location — more reliable than navigate() on fresh page load
      window.location.replace(`/payment/callback?reference=${encodeURIComponent(pendingRef)}`)
      return
    }

    fetch(`${API}/api/pools/public`)
      .then(r=>r.json())
      .then(json=>{
        const found=(json.pools||[]).find(p=>p.id===id)
        if(!found)throw new Error('Pool not found or no longer active.')
        setPool(found)
      })
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false))
  },[id])

  const handleJoin=async()=>{
    if(!user){
      sessionStorage.setItem('redirectAfterLogin',`/join/${id}`)
      navigate('/auth')
      return
    }
    setJoining(true)
    setJoinError(null)
    try{
      const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))
      const token=key?JSON.parse(localStorage.getItem(key))?.access_token:null
      if(!token)throw new Error('Not authenticated. Please sign in again.')

      // Create/get membership
      const joinRes=await fetch(`${API}/api/memberships/join`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({pool_id:id})
      })
      const joinData=await joinRes.json()
      let membershipId=joinData.membership_id

      if(!joinRes.ok){
        if(joinRes.status===409){
          // Already has a membership
          if(joinData.is_active){
            navigate('/my-subscriptions',{replace:true})
            return
          }
          if(!joinData.membership_id) throw new Error(joinData.error||'Membership error.')
          membershipId=joinData.membership_id
        } else {
          throw new Error(joinData.error||'Failed to join pool.')
        }
      }
      if(!membershipId) throw new Error('Could not get membership ID.')

      // Initialize payment
      const payRes=await fetch(`${API}/api/payments/initialize`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({membership_id:membershipId,pool_id:id})
      })
      const payData=await payRes.json()
      if(!payRes.ok) throw new Error(payData.error||'Failed to start payment.')

      // Already paid — go straight to subscriptions
      if(payData.already_paid){
        navigate('/my-subscriptions',{replace:true})
        return
      }

      // Save reference BEFORE leaving — so if user closes Paystack,
      // coming back to this page auto-redirects to /payment/callback
      sessionStorage.setItem('pendingPaymentRef', payData.reference)
      sessionStorage.setItem('pendingPoolId', id)

      // Go to Paystack
      window.location.href = payData.authorization_url

    }catch(e){
      setJoinError(e.message)
      setJoining(false)
    }
  }

  if(loading) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F7F3EE',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{width:36,height:36,border:'3px solid #E2DAD0',borderTopColor:'#0B3D2E',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if(error) return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#F7F3EE',fontFamily:"'Plus Jakarta Sans',sans-serif",gap:16}}>
      <div style={{fontSize:18,fontWeight:700,color:'#111'}}>Pool not found</div>
      <div style={{color:'#999',fontSize:14}}>{error}</div>
      <button onClick={()=>navigate('/')} style={{background:'#0B3D2E',color:'#fff',border:'none',borderRadius:10,padding:'10px 24px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Browse Marketplace</button>
    </div>
  )

  const seatsLeft=pool.max_members-(pool.current_members||0)
  const domain=getDomain(pool.service_name)
  const savings=pool.split_price?Math.round(((pool.split_price*pool.max_members-pool.split_price)/(pool.split_price*pool.max_members))*100):0

  return(
    <div style={{minHeight:'100vh',background:'#F7F3EE',fontFamily:"'Plus Jakarta Sans',sans-serif",display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 16px'}}>
      <div onClick={()=>navigate('/')} style={{display:'flex',alignItems:'center',gap:10,marginBottom:32,cursor:'pointer'}}>
        <img src="/favicon-32x32.png" alt="SplitPayNG" style={{width:32,height:32,borderRadius:8}}/>
        <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:800,fontSize:20,color:'#0B3D2E'}}>SplitPayNG</span>
      </div>
      <div style={{background:'#fff',borderRadius:20,border:'1px solid #E2DAD0',padding:'32px 28px',maxWidth:440,width:'100%',boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:24}}>
          <div style={{width:56,height:56,borderRadius:14,background:'#F4EFE6',border:'1px solid #E2DAD0',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={pool.service_name} style={{width:36,height:36}}
              onError={e=>{e.target.style.display='none';e.target.parentNode.innerText=pool.service_name?.[0]||'S'}}/>
          </div>
          <div>
            <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:22,fontWeight:800,color:'#111',letterSpacing:'-0.4px'}}>{pool.service_name}</div>
            <div style={{fontSize:12.5,color:'#888',marginTop:2}}>
              {seatsLeft>0?`${seatsLeft} seat${seatsLeft!==1?'s':''} left`:'Pool is full'} · {pool.is_public?'Public':'Private'} pool
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
          {[
            {label:'Monthly cost',value:fmt(pool.split_price),highlight:true},
            {label:'Seats',value:`${pool.current_members||0} / ${pool.max_members} filled`},
            {label:'You save',value:`~${savings}% vs retail`},
            {label:'Protected by',value:'48-hr Escrow'},
          ].map(s=>(
            <div key={s.label} style={{background:'#F9F7F4',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:11,color:'#999',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:s.highlight?'#0B3D2E':'#111'}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#F0F7F4',border:'1px solid #C8E6D8',borderRadius:12,padding:'12px 16px',marginBottom:24,fontSize:13,color:'#0B3D2E',lineHeight:1.5}}>
          💡 Payment held in escrow for 48 hours. If access isn't granted, you get a full automatic refund.
        </div>

        {joinError&&(
          <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#C0392B'}}>
            ⚠ {joinError}
          </div>
        )}

        {seatsLeft>0?(
          <button onClick={handleJoin} disabled={joining}
            style={{width:'100%',background:joining?'#5A8A72':'#0B3D2E',color:'#fff',border:'none',borderRadius:12,padding:'14px',fontSize:15,fontWeight:700,cursor:joining?'not-allowed':'pointer',fontFamily:'inherit',transition:'background 0.2s'}}>
            {joining?'Opening payment…':`Join Pool — ${fmt(pool.split_price)}/mo`}
          </button>
        ):(
          <button disabled style={{width:'100%',background:'#ccc',color:'#fff',border:'none',borderRadius:12,padding:'14px',fontSize:15,fontWeight:700,fontFamily:'inherit'}}>Pool is Full</button>
        )}

        <button onClick={()=>navigate('/')} style={{width:'100%',background:'none',border:'none',color:'#888',fontSize:13,marginTop:12,cursor:'pointer',fontFamily:'inherit'}}>
          ← Back to Marketplace
        </button>
      </div>
    </div>
  )
}