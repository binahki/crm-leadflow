export function getRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';

  let data: Date;

  // Suporta formato brasileiro "9/4/2026 15:15" e ISO "2026-04-09T15:15:00"
  if (dateStr.includes('T') || dateStr.endsWith('Z')) {
    let normalized = dateStr;
    if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
      normalized += 'Z';
    }
    data = new Date(normalized);
  } else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    // formato "D/M/YYYY HH:mm"
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour = '0', min = '0'] = (timePart || '').split(':');
    data = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min));
  } else {
    data = new Date(dateStr);
  }

  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return 'ontem';
  return `há ${diffD} dias`;
}

export function formatDDMM(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = getDateObj(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = getDateObj(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatarWhatsapp(wa: string | null | undefined): string {
  if (!wa || typeof wa !== 'string') return String(wa || '');
  const n = wa.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return wa;
}

function getDateObj(dateStr: string): Date {
  if (dateStr.includes('T') || dateStr.endsWith('Z')) {
    let normalized = dateStr;
    if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
      normalized += 'Z';
    }
    return new Date(normalized);
  }
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour = '0', min = '0'] = (timePart || '').split(':');
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min));
  }
  return new Date(dateStr);
}
