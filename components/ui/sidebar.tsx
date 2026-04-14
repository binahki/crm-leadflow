import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, Megaphone, Image as ImageIcon,
  Webhook, MessageCircle, Settings, Sun, Moon, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const NAV_MAIN = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Users,           label: 'Leads',     href: '/leads' },
  { icon: BarChart3,       label: 'Funil CRM', href: '/kanban' },
];
const NAV_META = [
  { icon: Megaphone, label: 'Campanhas', href: '/campanhas' },
  { icon: ImageIcon, label: 'Criativos',  href: '/criativos' },
];
const NAV_INT = [
  { icon: Webhook,       label: 'Webhook',      href: '/webhook' },
  { icon: MessageCircle, label: 'WhatsApp',      href: '/whatsapp' },
  { icon: Settings,      label: 'Configurações', href: '/configuracoes' },
];

interface SidebarProps { leadCount?: number; }

export function Sidebar({ leadCount = 0 }: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  function isActive(href: string) {
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
  }

  function NavGroup({ label, items }: { label: string; items: typeof NAV_MAIN }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize:'10px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0 12px', marginBottom:'6px', color:isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.3)' }}>
          {label}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {items.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} to={item.href} style={{
                display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'10px',
                fontSize:'13.5px', fontWeight:active?600:500, textDecoration:'none', transition:'all 0.15s ease',
                background:active?(isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)'):'transparent',
                color:active?(isDark?'#fff':'#000'):(isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)'),
              }}
                onMouseEnter={e=>{ if(!active){ (e.currentTarget as HTMLElement).style.background=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'; (e.currentTarget as HTMLElement).style.color=isDark?'rgba(255,255,255,0.75)':'rgba(0,0,0,0.75)'; }}}
                onMouseLeave={e=>{ if(!active){ (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color=isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)'; }}}
              >
                <item.icon style={{ width:'16px', height:'16px', flexShrink:0, strokeWidth:active?2.2:1.8 }} />
                <span style={{ flex:1, letterSpacing:'-0.01em' }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside style={{ width:'220px', flexShrink:0, display:'flex', flexDirection:'column', background:isDark?'#0f0f11':'#f5f5f7', borderRight:isDark?'1px solid rgba(255,255,255,0.06)':'1px solid rgba(0,0,0,0.06)', height:'100vh' }}>

      {/* Logo real */}
      <div style={{ padding:'20px 16px 16px' }}>
        <img
          src={isDark ? '/logo-light.png' : '/logo-dark.png'}
          alt="floow"
          style={{ height:'32px', width:'auto', objectFit:'contain' }}
        />
        <p style={{ fontSize:'11px', color:isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.3)', marginTop:'4px', letterSpacing:'0.01em' }}>
          Lead CRM
        </p>
      </div>

      <nav style={{ flex:1, padding:'0 8px', overflowY:'auto' }}>
        <NavGroup label="Principal"   items={NAV_MAIN} />
        <NavGroup label="Meta Ads"    items={NAV_META} />
        <NavGroup label="Integrações" items={NAV_INT}  />
      </nav>

      <div style={{ padding:'12px 8px', borderTop:isDark?'1px solid rgba(255,255,255,0.06)':'1px solid rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', gap:'2px' }}>
        {[
          { icon:isDark?Sun:Moon, label:isDark?'Modo claro':'Modo escuro', onClick:toggleTheme, danger:false },
          { icon:LogOut,          label:'Sair',                            onClick:signOut,      danger:true  },
        ].map((item,i)=>(
          <button key={i} onClick={item.onClick} style={{
            width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'10px',
            fontSize:'13.5px', fontWeight:500, background:'transparent', border:'none', cursor:'pointer',
            color:item.danger?(isDark?'rgba(255,80,80,0.7)':'rgba(200,0,0,0.5)'):(isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)'),
            transition:'all 0.15s ease', textAlign:'left', letterSpacing:'-0.01em',
          }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background=item.danger?(isDark?'rgba(255,50,50,0.08)':'rgba(200,0,0,0.05)'):(isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'); }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; }}
          >
            <item.icon style={{ width:'16px', height:'16px', strokeWidth:1.8, flexShrink:0 }} />
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
