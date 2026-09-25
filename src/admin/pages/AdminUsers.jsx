import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Avatar from '../../components/Avatar.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';
import { growerScore } from '../../utils/helpers.js';

export default function AdminUsers() {
  const navigate = useNavigate();
  const { growers, diaries, currentUser, adminSetGrowerRole, adminSetGrowerBanned, adminSetGrowerDeleted } = useApp();

  const [search, setSearch] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null); // { grower, action: 'delete' | 'restore' }

  const list = useMemo(() => growers.filter((g) => (
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  )), [growers, search]);

  const columns = [
    {
      key: 'name', label: 'Гровер', render: (g) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={g.name} photo={g.avatar} size={30} online={g.online} />
          <span>{g.name}{g.deleted ? ' (удалён)' : ''}</span>
        </div>
      )
    },
    { key: 'loc', label: 'Локация' },
    { key: 'joinedAt', label: 'Регистрация', render: (g) => (g.joinedAt ? new Date(g.joinedAt).toLocaleDateString('ru-RU') : '—') },
    { key: 'diaries', label: 'Дневников' },
    { key: 'followers', label: 'Подписчиков' },
    { key: 'score', label: 'Рейтинг', render: (g) => growerScore(g, diaries) },
    {
      key: 'role', label: 'Роль', render: (g) => (
        g.role === 'admin'
          ? <span className="admin-pill admin-pill--accent">Админ</span>
          : <span className="admin-pill admin-pill--muted">Гровер</span>
      )
    },
    {
      key: 'status', label: 'Статус', render: (g) => (
        g.banned
          ? <span className="admin-pill admin-pill--danger">Забанен</span>
          : (g.online
            ? <span style={{ color: 'var(--leaf)' }}><span className="admin-status-dot" />Онлайн</span>
            : <span className="sub">Оффлайн</span>)
      )
    }
  ];

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Гроверы / Пользователи</h1>

      <div className="admin-toolbar">
        <div className="field">
          <input type="text" placeholder="Поиск по имени…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        emptyText="Гроверы не найдены"
        renderActions={(g) => {
          const isSelf = currentUser && currentUser.growerId === g.id;
          return (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/growers/${g.id}`)}>Профиль</button>
              {!isSelf && (
                <button className="btn btn-outline btn-sm" onClick={() => adminSetGrowerRole(g.id, g.role === 'admin' ? 'user' : 'admin')}>
                  {g.role === 'admin' ? 'Снять админа' : 'Сделать админом'}
                </button>
              )}
              {!isSelf && (
                <button className="btn btn-outline btn-sm" onClick={() => adminSetGrowerBanned(g.id, !g.banned)}>
                  {g.banned ? 'Разбанить' : 'Забанить'}
                </button>
              )}
              {!isSelf && (
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmTarget({ grower: g, action: g.deleted ? 'restore' : 'delete' })}>
                  {g.deleted ? 'Восстановить' : 'Удалить'}
                </button>
              )}
            </div>
          );
        }}
      />

      <AdminConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget?.action === 'delete' ? 'Удалить гровера?' : 'Восстановить гровера?'}
        message={
          confirmTarget?.action === 'delete'
            ? `Гровер «${confirmTarget?.grower.name}» будет скрыт из публичного каталога. Его дневники, рецепты и комментарии не удаляются — это мягкое удаление, его можно отменить.`
            : `Гровер «${confirmTarget?.grower.name}» снова появится в публичном каталоге.`
        }
        confirmLabel={confirmTarget?.action === 'delete' ? 'Удалить' : 'Восстановить'}
        danger={confirmTarget?.action === 'delete'}
        onConfirm={() => confirmTarget && adminSetGrowerDeleted(confirmTarget.grower.id, confirmTarget.action === 'delete')}
      />
    </div>
  );
}
