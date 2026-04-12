"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Megaphone,
  Image as ImageIcon,
  Webhook,
  MessageCircle,
  Settings,
  Sun,
  Search,
  Bell,
  RefreshCw,
  ChevronDown,
  Flame,
  TrendingDown,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

// Dados do gráfico de leads por dia
const leadsChartData = [
  { date: "29/03", leads: 0 },
  { date: "30/03", leads: 1 },
  { date: "31/03", leads: 1 },
  { date: "01/04", leads: 1 },
  { date: "02/04", leads: 1 },
  { date: "03/04", leads: 1 },
  { date: "04/04", leads: 2 },
  { date: "05/04", leads: 1 },
  { date: "06/04", leads: 0 },
  { date: "07/04", leads: 0 },
  { date: "08/04", leads: 0 },
  { date: "09/04", leads: 0 },
  { date: "10/04", leads: 0 },
  { date: "11/04", leads: 0 },
]

// Dados do funil de conversão - Minimalista com visual de funil
const funnelStages = [
  { stage: "Aguardando", value: 56, color: "from-blue-500 to-blue-400" },
  { stage: "Em atendimento", value: 0, color: "from-blue-400 to-blue-300" },
  { stage: "Proposta enviada", value: 0, color: "from-blue-300 to-blue-200" },
  { stage: "Convertida", value: 0, color: "from-emerald-500 to-emerald-400" },
]

// Dados dos leads recentes com tempo relativo
const recentLeads = [
  {
    id: 1,
    name: "Elayne Santos Garcia",
    location: "São José Do Rio Preto",
    initials: "ES",
    color: "bg-rose-400",
    status: "Aguardando",
    time: "há 2 dias",
    phone: "(17) 99999-0001",
  },
  {
    id: 2,
    name: "Angélica Mascarenhas",
    location: "São Paulo",
    initials: "AM",
    color: "bg-yellow-400",
    status: "Aguardando",
    time: "há 5 horas",
    phone: "(11) 99999-0002",
  },
  {
    id: 3,
    name: "Janile santana Brito",
    location: "CAPIVARI SP",
    initials: "JS",
    color: "bg-emerald-400",
    status: "Aguardando",
    time: "há 3 horas",
    phone: "(19) 99999-0003",
  },
  {
    id: 4,
    name: "Debora Francisca Rufino Figueiredo",
    location: "São Paulo",
    initials: "DF",
    color: "bg-orange-400",
    status: "Aguardando",
    time: "há 1 hora",
    phone: "(11) 99999-0004",
  },
  {
    id: 5,
    name: "Eliana Aparecida Oliveira finoti",
    location: "Porto feliz sp",
    initials: "EA",
    color: "bg-cyan-400",
    status: "Em atendimento",
    time: "há 30 min",
    phone: "(15) 99999-0005",
  },
]

// Leads mais antigos aguardando atendimento - Próximas Ações
const proximasAcoes = [
  {
    id: 1,
    name: "Elayne Santos Garcia",
    location: "São José Do Rio Preto",
    initials: "ES",
    color: "bg-rose-400",
    waitingTime: "há 2 dias",
    phone: "(17) 99999-0001",
  },
  {
    id: 2,
    name: "Angélica Mascarenhas",
    location: "São Paulo",
    initials: "AM",
    color: "bg-yellow-400",
    waitingTime: "há 5 horas",
    phone: "(11) 99999-0002",
  },
  {
    id: 3,
    name: "Janile santana Brito",
    location: "CAPIVARI SP",
    initials: "JS",
    color: "bg-emerald-400",
    waitingTime: "há 3 horas",
    phone: "(19) 99999-0003",
  },
]

// Menu items da sidebar - PRINCIPAL
const mainMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Leads", badge: 56 },
  { icon: BarChart3, label: "Funil CRM" },
]

// Menu items - META ADS
const metaAdsItems = [
  { icon: Megaphone, label: "Campanhas" },
  { icon: ImageIcon, label: "Criativos" },
]

// Menu items - INTEGRAÇÕES
const integracoesItems = [
  { icon: Webhook, label: "Webhook" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: Settings, label: "Configurações" },
]

// Filtros de período
const periodFilters = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7days" },
  { label: "30 dias", value: "30days" },
  { label: "Este mês", value: "month" },
]

export default function Dashboard() {
  const [darkMode, setDarkMode] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState("today")
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get current greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Bom dia"
    if (hour < 18) return "Boa tarde"
    return "Boa noite"
  }

  // Get formatted date
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
    return new Date().toLocaleDateString("pt-BR", options)
  }

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Get selected period label
  const getSelectedPeriodLabel = () => {
    return periodFilters.find(p => p.value === selectedPeriod)?.label || "Hoje"
  }

  return (
    <div className="flex h-screen bg-[#f7f8fb]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#f7f8fb] flex flex-col shadow-[4px_0_24px_-2px_rgba(16,24,40,0.06)]">
        {/* Logo */}
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 text-lg block leading-tight">LeadFlow</span>
            <span className="text-xs text-gray-400">CRM Intelligence</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-4 py-2">
          {/* PRINCIPAL */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">Principal</p>
            <div className="space-y-1">
              {mainMenuItems.map((item, index) => (
                <button
                  key={index}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25"
                      : "text-gray-600 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      item.active 
                        ? "bg-white/20 text-white" 
                        : "bg-blue-600 text-white"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* META ADS */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">Meta Ads</p>
            <div className="space-y-1">
              {metaAdsItems.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* INTEGRAÇÕES */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">Integrações</p>
            <div className="space-y-1">
              {integracoesItems.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Dark Mode Toggle */}
        <div className="p-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all"
          >
            <Sun className="w-5 h-5" />
            <span>Modo claro</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Content */}
        <div className="p-7">
          {/* Blue Hero Bar */}
          <div className="mb-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 rounded-2xl p-5 shadow-lg shadow-blue-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white">
                      {getGreeting()}, Murilo! Seus resultados de hoje em tempo real
                    </h1>
                    <span className="text-xl">🔥</span>
                  </div>
                  <p className="text-xs text-blue-100 mt-0.5">{getFormattedDate()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Period Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                    className="flex items-center gap-2 bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    {getSelectedPeriodLabel()}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showPeriodDropdown && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[140px] z-50">
                      {periodFilters.map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => {
                            setSelectedPeriod(filter.value)
                            setShowPeriodDropdown(false)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                            selectedPeriod === filter.value 
                              ? 'text-blue-600 font-medium bg-blue-50' 
                              : 'text-gray-700'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>

                {/* Search & Notifications */}
                <div className="flex items-center gap-2 ml-2">
                  <button className="w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/25 rounded-xl flex items-center justify-center transition-all">
                    <Search className="w-5 h-5 text-white" />
                  </button>
                  <button className="w-10 h-10 bg-white/15 backdrop-blur-sm hover:bg-white/25 rounded-xl flex items-center justify-center transition-all relative">
                    <Bell className="w-5 h-5 text-white" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-blue-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-5 mb-6">
            {/* Gasto Total */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Gasto Total</span>
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">R$</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ 86,56</p>
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 rotate-180" />
                +12.5% vs. mês anterior
              </p>
            </div>

            {/* Leads Aprovados */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Leads Aprovados</span>
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">56</p>
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 rotate-180" />
                +8.2% vs. mês anterior
              </p>
            </div>

            {/* Custo por Lead */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Custo por Lead</span>
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                  <span className="text-amber-600 font-semibold text-xs">CPL</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ 1,55</p>
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                -3.1% vs. mês anterior
              </p>
            </div>

            {/* Aprovados */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Aprovados</span>
                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                0.0% vs. mês anterior
              </p>
            </div>
          </div>

          {/* Main Grid - Charts Row */}
          <div className="grid grid-cols-12 gap-5 mb-6">
            {/* Leads por Dia Chart */}
            <div className="col-span-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="mb-5">
                <h3 className="font-semibold text-gray-900 text-base">Leads por Dia</h3>
                <p className="text-[13px] text-gray-400">Últimos 14 dias</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadsChartData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorLeads)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Funil de Conversão - Modern Visual Funnel */}
            <div className="col-span-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h3 className="font-semibold text-gray-900 text-base mb-6">Funil de Conversão</h3>

              <div className="space-y-4">
                {funnelStages.map((item, index) => {
                  const widths = [100, 75, 50, 30]
                  const width = widths[index]
                  
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">{item.stage}</span>
                        <span className="text-xs font-semibold text-gray-900">{item.value}</span>
                      </div>
                      <div 
                        className={`h-10 bg-gradient-to-r ${item.color} rounded-lg transition-all relative overflow-hidden`}
                        style={{ width: `${width}%` }}
                      >
                        <div className="absolute inset-0 bg-white/10" />
                        {item.value > 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
                            {item.value}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Taxa de conversão</span>
                  <span className="text-2xl font-bold text-blue-600">0.0%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row - Leads Recentes + Próximas Ações */}
          <div className="grid grid-cols-12 gap-5">
            {/* Leads Recentes */}
            <div className="col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900 text-base">Leads Recentes</h3>
                <Button variant="link" className="text-blue-600 text-sm font-medium p-0 h-auto">
                  Ver todos
                </Button>
              </div>

              <div className="space-y-0">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0"
                  >
                    <Avatar className={`w-10 h-10 ${lead.color}`}>
                      <AvatarFallback className="bg-transparent text-white font-medium text-sm">
                        {lead.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.location}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      lead.status === "Aguardando" 
                        ? "bg-amber-50 text-amber-600" 
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {lead.status}
                    </span>
                    <span className="text-xs text-gray-400 w-16">{lead.time}</span>
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 hover:bg-gray-50">
                      <MessageCircle className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Próximas Ações */}
            <div className="col-span-5 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="mb-5">
                <h3 className="font-semibold text-gray-900 text-base">Próximas Ações</h3>
                <p className="text-[13px] text-gray-400">Leads aguardando há mais tempo</p>
              </div>

              <div className="space-y-0">
                {proximasAcoes.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 py-4 border-b border-gray-50 last:border-0"
                  >
                    <Avatar className={`w-10 h-10 ${lead.color}`}>
                      <AvatarFallback className="bg-transparent text-white font-medium text-sm">
                        {lead.initials}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.location}</p>
                    </div>
                    
                    <div className="text-right mr-2">
                      <p className="text-xs text-red-500 font-medium">Esperando</p>
                      <p className="text-xs text-gray-400">{lead.waitingTime}</p>
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg h-8 px-3"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Ver todos os pendentes
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
