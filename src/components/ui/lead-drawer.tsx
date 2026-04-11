import { useState } from 'react';
import { Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { X, MessageCircle, User, MapPin, Phone, Calendar, Info, Target, Clock, DollarSign, Users, Settings, ChevronDown, ChevronUp, Instagram, Briefcase, Home, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

export function LeadDrawer({ lead, isOpen, onClose, onUpdate }: LeadDrawerProps) {
  const [observacoes, setObservacoes] = useState(lead?.observacoes || '');
  const [status, setStatus] = useState(lead?.status !== undefined ? lead.status : 0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identification: true,
    objectives: false,
    personal: false,
    availability: false,
    experience: false,
    crm: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSaveObservacoes = async () => {
    if (!lead) return;
    
    const { error } = await supabase
      .from('leads')
      .update({ observacoes })
      .eq('id', lead.id);
    
    if (error) {
      toast.error('Erro ao salvar observações');
      return;
    }
    
    onUpdate({ ...lead, observacoes });
    toast.success('Observações salvas!');
  };

  const handleStatusChange = async (newStatus: number) => {
    if (!lead) return;
    
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', lead.id);
    
    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }
    
    setStatus(newStatus);
    onUpdate({ ...lead, status: newStatus });
    toast.success('Status atualizado!');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!lead) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Perfil do Lead</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {getInitials(lead.nome)}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{lead.nome}</h3>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <MapPin className="w-4 h-4" />
                {lead.cidade || 'Sem cidade'}
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Phone className="w-4 h-4" />
                {lead.whatsapp || 'Sem WhatsApp'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Seção 1 - Identificação */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('identification')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="font-bold">Identificação</span>
              </div>
              {expandedSections.identification ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.identification && (
              <div className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-gray-500">Nome:</span>
                      <p className="font-medium">{lead.nome || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-gray-500">WhatsApp:</span>
                      <p className="font-medium">{lead.whatsapp || '-'}</p>
                      <Button
                        onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank')}
                        className="mt-1 text-xs bg-green-500 hover:bg-green-600 text-white"
                        size="sm"
                      >
                        Abrir WhatsApp
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-gray-500">Cidade:</span>
                      <p className="font-medium">{lead.cidade || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-gray-500">Instagram:</span>
                      <p className="font-medium">{lead.instagram || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-gray-500">Data de entrada:</span>
                      <p className="font-medium">{lead.created_at ? getRelativeTime(lead.created_at) : '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 2 - Objetivos Financeiros */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('objectives')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="font-bold">Objetivos Financeiros</span>
              </div>
              {expandedSections.objectives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.objectives && (
              <div className="p-4 pt-0 space-y-3">
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">O que mais te atrai:</span>
                    <p className="font-medium">{lead.o_que_mais_te_atrai || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Quanto gostaria de ganhar:</span>
                    <p className="font-medium">{lead.quanto_ganha || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">O que gostaria de conquistar:</span>
                    <p className="font-medium">{lead.o_que_conquistar || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Onde se imagina em 6 meses:</span>
                    <p className="font-medium">{lead.imagina_6_meses || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 3 - Perfil Pessoal */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('personal')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                <span className="font-bold">Perfil Pessoal</span>
              </div>
              {expandedSections.personal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.personal && (
              <div className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Idade:</span>
                    <p className="font-medium">{lead.idade || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tem filhos:</span>
                    <p className="font-medium">{lead.tem_filhos || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Idade do filho mais novo:</span>
                    <p className="font-medium">{lead.idade_filho || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Rede de apoio:</span>
                    <p className="font-medium">{lead.rede_apoio || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Mora com alguém:</span>
                    <p className="font-medium">{lead.mora_com || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Situação atual:</span>
                    <p className="font-medium">{lead.situacao_atual || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 4 - Disponibilidade */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('availability')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-bold">Disponibilidade</span>
              </div>
              {expandedSections.availability ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.availability && (
              <div className="p-4 pt-0 space-y-3">
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Meios de venda:</span>
                    <p className="font-medium">{lead.meios_venda || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Horas por semana:</span>
                    <p className="font-medium">{lead.horas_semana || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Quando gostaria de começar:</span>
                    <p className="font-medium">{lead.quando_comecar || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 5 - Experiência */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('experience')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span className="font-bold">Experiência</span>
              </div>
              {expandedSections.experience ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.experience && (
              <div className="p-4 pt-0 space-y-3">
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Experiência em vendas:</span>
                    <p className="font-medium">{lead.experiencia_vendas || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Já tentou vender semijoia:</span>
                    <p className="font-medium">{lead.tentou_semijoia || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Para começar no consignado:</span>
                    <p className="font-medium">{lead.consignado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nome está negativado:</span>
                    <p className="font-medium">{lead.negativado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Aceita regras do consignado:</span>
                    <p className="font-medium">{lead.aceita_regras || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 6 - CRM */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('crm')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span className="font-bold">CRM</span>
              </div>
              {expandedSections.crm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.crm && (
              <div className="p-4 pt-0 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <Select value={String(status)} onValueChange={(value) => handleStatusChange(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_LABELS.map((label, index) => (
                        <SelectItem key={index} value={String(index)}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[index].dot}`} />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações sobre este lead..."
                    className="min-h-[80px]"
                  />
                  <Button onClick={handleSaveObservacoes} size="sm" className="mt-2">
                    Salvar Observações
                  </Button>
                </div>
                
                <div>
                  <span className="text-gray-500 text-sm">Histórico de status:</span>
                  <p className="text-xs text-gray-400 mt-1">Status atual: {STATUS_LABELS[status]}</p>
                  <p className="text-xs text-gray-400">Data de criação: {lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
