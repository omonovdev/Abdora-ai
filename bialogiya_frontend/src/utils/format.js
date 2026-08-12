export const formatDate = (date, locale = 'uz-UZ') => {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const formatDateTime = (date, locale = 'uz-UZ') => {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
};

// How far before/after a deadline something happened, e.g. "muddatdan 10 daqiqa
// oldin" / "2 soat kech". Returns null when either timestamp is missing.
export const formatDeadlineOffset = (submittedAt, dueDate) => {
  if (!submittedAt || !dueDate) return null;
  const diffMs = new Date(dueDate) - new Date(submittedAt);
  const late = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);

  let amount;
  if (minutes < 1) amount = 'bir daqiqa';
  else if (minutes < 60) amount = `${minutes} daqiqa`;
  else if (minutes < 1440) amount = `${Math.round(minutes / 60)} soat`;
  else amount = `${Math.round(minutes / 1440)} kun`;

  return {
    late,
    label: late ? `muddatdan ${amount} kech` : `muddatdan ${amount} oldin`,
  };
};

export const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export const calculateLevel = (xp) => Math.max(1, Math.floor(Math.sqrt(xp / 100)));

export const xpForLevel = (level) => level * level * 100;

export const getLevelProgress = (xp) => {
  const level = calculateLevel(xp);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
  return { level, progress: Math.max(0, Math.min(100, progress)), currentLevelXP, nextLevelXP };
};

export const getScoreColor = (score) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-primary';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-500';
};

export const getScoreBg = (score) => {
  if (score >= 90) return 'bg-green-50 text-green-700';
  if (score >= 70) return 'bg-primary-50 text-primary-700';
  if (score >= 50) return 'bg-yellow-50 text-yellow-700';
  return 'bg-red-50 text-red-700';
};
