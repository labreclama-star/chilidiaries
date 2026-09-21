import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import FilterBar, { FilterChip } from '../components/FilterBar.jsx';

const CATEGORIES = [
  { value: 'all', label: 'Все категории' },
  { value: 'Соус', label: 'Соусы' },
  { value: 'Приправа', label: 'Приправы' },
  { value: 'Заготовка', label: 'Заготовки' },
  { value: 'Паста', label: 'Пасты' }
];

export default function Recipes() {
  const { recipes, currentUser, openModal, showToast } = useApp();
  const [cat, setCat] = useState('all');

  const visible = recipes.filter((r) => !r.hidden);
  const list = cat === 'all' ? visible : visible.filter((r) => r.category === cat);

  function handleAddRecipe() {
    if (!currentUser) { showToast('Войди, чтобы добавить рецепт'); openModal('auth'); return; }
    openModal('addRecipe');
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Кухня сообщества</span>
            <h1>Рецепты: соусы, приправы, заготовки</h1>
            <p>Гроверы делятся тем, что готовят из своего урожая — от классического хот-соуса до ферментированной пасты.</p>
          </div>
          <button className="btn btn-primary" onClick={handleAddRecipe}>+ Добавить рецепт</button>
        </div>
      </div>
      <div className="wrap">
        <FilterBar resultsLabel={`${list.length} рецептов`}>
          {CATEGORIES.map((c) => (
            <FilterChip key={c.value} active={cat === c.value} onClick={() => setCat(c.value)}>
              {c.label}
            </FilterChip>
          ))}
        </FilterBar>
        <div className="grid grid-3">
          {list.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      </div>
    </>
  );
}
