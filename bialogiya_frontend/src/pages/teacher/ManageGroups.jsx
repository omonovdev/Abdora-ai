import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Calendar, Clock, DoorOpen } from 'lucide-react';
import api from '../../config/axios';
import { getSubjectLabel, getSubjectBadgeClass } from '../../utils/subjects';

const DAYS = [
  { key: 'mon', label: 'Du' }, { key: 'tue', label: 'Se' }, { key: 'wed', label: 'Cho' },
  { key: 'thu', label: 'Pa' }, { key: 'fri', label: 'Ju' }, { key: 'sat', label: 'Sha' }, { key: 'sun', label: 'Ya' },
];
const parseWeekDays = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
};

// Teachers can only view/enter their groups now - creating, editing, and
// deleting groups (and adding/removing students) is reception's job.
export default function ManageGroups() {
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useQuery({ 
    queryKey: ['my-groups'], 
    queryFn: () => api.get('/groups').then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }) 
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Guruhlarim</h1>
        <p className="text-sm text-gray-500 mt-0.5">Guruh sozlamalarini o'zgartirish uchun qabulxonaga murojaat qiling</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {groups?.map((g, i) => {
          const days = parseWeekDays(g.weekDays);
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/teacher/groups/${g.id}`)}
              className="card hover:shadow-soft transition-all cursor-pointer hover:border-primary/30 hover:bg-primary/2 group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 gradient-bg rounded-2xl flex items-center justify-center text-2xl">{g.icon || '📚'}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-primary transition-colors">{g.name}</h3>
                  <span className={`badge text-xs mt-0.5 ${getSubjectBadgeClass(g.subject)}`}>
                    {getSubjectLabel(g.subject)}
                  </span>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1.5">
                <Users size={14} />
                <span>{g.students?.length ?? g._count?.students ?? 0} o'quvchi</span>
              </div>
              {(days.length > 0 || g.startTime || g.room) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                  {days.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {days.map(d => DAYS.find(x => x.key === d)?.label).filter(Boolean).join(', ')}
                    </span>
                  )}
                  {g.startTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />{g.startTime}{g.endTime ? `–${g.endTime}` : ''}
                    </span>
                  )}
                  {g.room && (
                    <span className="flex items-center gap-1">
                      <DoorOpen size={11} />{g.room}
                    </span>
                  )}
                </div>
              )}
              {g.description && <p className="text-xs text-gray-400 mt-2">{g.description}</p>}
            </motion.div>
          );
        })}
        {!isLoading && groups?.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p>Sizga hali guruh biriktirilmagan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
