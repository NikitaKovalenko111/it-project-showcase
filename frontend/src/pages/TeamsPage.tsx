import React, { useState } from 'react'
import { TeamsPanel } from '../components/TeamsPanel'
export const TeamsPage: React.FC = () => {
  const [view,setView]=useState('mine')
  return <div className="teams-layout"><div className="page-header"><div className="page-header__content"><h1>Команды</h1><p>Составы команд, приглашения и поиск участников.</p></div></div>
    <div className="uust-container attached-tabs"><nav className="uust-tabs-row" aria-label="Разделы команд"><button className={`uust-tab ${view==='mine'?'active':''}`} onClick={()=>setView('mine')}>Мои команды</button><button className={`uust-tab ${view==='search'?'active':''}`} onClick={()=>setView('search')}>Найти команду</button></nav>
      <div className="uust-box"><TeamsPanel key={view} searchMode={view==='search'}/></div>
    </div>
  </div>
}
