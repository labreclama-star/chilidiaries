// role: 'user' | 'admin' — используется AppContext.isAdmin и защитой /admin/* роутов.
// joinedAt/banned/deleted — поля для будущей админ-панели (управление пользователями,
// дашборд "новые за N дней"); заведены сразу для всех сид-гроверов, чтобы не было
// разнотипных объектов в одном массиве.
export const INITIAL_GROWERS = [
  {id:'g1',name:'ChiliKrot',loc:'Москва, РФ',bio:'Выращиваю только chinense третий сезон подряд. Балкон превратился в мини-теплицу.',diaries:6,followers:214,avatar:null,online:true,role:'user',joinedAt:'2025-11-03T09:12:00.000Z',banned:false,deleted:false},
  {id:'g2',name:'ОгненныйСад',loc:'Краснодар, РФ',bio:'Теплица 20м², гидропоника. Специализируюсь на рекордных сортах.',diaries:9,followers:501,avatar:null,online:true,role:'user',joinedAt:'2025-09-18T14:40:00.000Z',banned:false,deleted:false},
  {id:'g3',name:'PepperMaster73',loc:'Тюмень, РФ',bio:'Домашний гров под LED, начинал с Халапеньо — теперь только Reaper.',diaries:4,followers:132,avatar:null,online:false,role:'user',joinedAt:'2026-01-22T11:05:00.000Z',banned:false,deleted:false},
  {id:'g4',name:'ЮльчаGrows',loc:'Минск, БЛР',bio:'Люблю документировать каждую неделю с фото — веду дневник как блог.',diaries:7,followers:388,avatar:null,online:true,role:'user',joinedAt:'2025-08-05T08:30:00.000Z',banned:false,deleted:false},
  {id:'g5',name:'ScovilleScout',loc:'Алматы, КЗ',bio:'Тестирую новые гибриды и делюсь замерами остроты после сушки.',diaries:5,followers:276,avatar:null,online:false,role:'user',joinedAt:'2025-12-14T17:55:00.000Z',banned:false,deleted:false},
  {id:'g6',name:'DimaHeat',loc:'Санкт-Петербург, РФ',bio:'Открытый грунт, органическое земледелие, никакой химии.',diaries:3,followers:97,avatar:null,online:false,role:'user',joinedAt:'2026-02-01T10:00:00.000Z',banned:false,deleted:false},
  {id:'g7',name:'GreenhouseGena',loc:'Ростов-на-Дону, РФ',bio:'Профессиональная теплица, продаю рассаду редких сортов.',diaries:8,followers:612,avatar:null,online:true,role:'user',joinedAt:'2025-07-11T13:20:00.000Z',banned:false,deleted:false},
  {id:'g8',name:'RedPodRanch',loc:'Воронеж, РФ',bio:'Семейный гров на даче — растим на еду и на конкурсы.',diaries:5,followers:189,avatar:null,online:false,role:'user',joinedAt:'2025-10-27T19:15:00.000Z',banned:false,deleted:false},
  {id:'g9',name:'СмолДачник',loc:'Казань, РФ',bio:'Маленький балкон, большие амбиции. В этом сезоне — Scorpion.',diaries:2,followers:64,avatar:null,online:true,role:'user',joinedAt:'2026-03-09T07:45:00.000Z',banned:false,deleted:false},
  {id:'g10',name:'CapsaicinCat',loc:'Новосибирск, РФ',bio:'Три года в гидропонике, делюсь таблицами подкормок.',diaries:6,followers:301,avatar:null,online:false,role:'user',joinedAt:'2025-09-30T16:00:00.000Z',banned:false,deleted:false},
  // Сид-администратор. Логин "admin" всегда резолвится в этого гровера (см.
  // authService.login + AppContext.login) — не через обычную схему "u_<name>".
  {id:'admin',name:'admin',loc:'—',bio:'Администратор ChiliDiaries.',diaries:0,followers:0,avatar:null,online:false,role:'admin',joinedAt:'2025-01-01T00:00:00.000Z',banned:false,deleted:false}
];

export function findGrower(growers, id) {
  return growers.find((g) => g.id === id);
}
