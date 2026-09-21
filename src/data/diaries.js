import { findVariety } from './varieties.js';
import { generateWeeks, generateComments } from '../utils/helpers.js';

export const DIARY_SEED = [
  {title:'Reaper на балконе: первый сезон', varietyId:'v1', growerId:'g1', stage:'Плодоношение', location:'Дома', medium:'Почва', techniques:['LST','Дефолиация'], weeksCount:7, likes:312, startDate:'2026-04-02',
   desc:'Мой первый заход на официальный рекорд остроты. Балкон на юг, минимум оборудования — проверяю, можно ли вырастить Reaper без теплицы и досветки.'},
  {title:'Moruga Scorpion в теплице 20м²', varietyId:'v3', growerId:'g2', stage:'Цветение', location:'Теплица', medium:'Кокос', techniques:['Топпинг','ScrOG'], weeksCount:5, likes:487, startDate:'2026-04-10',
   desc:'Полноценная теплица с климат-контролем — веду Moruga Scorpion по сетке ScrOG, чтобы равномерно распределить крону и получить максимум завязей.'},
  {title:'Призрачный перец на подоконнике', varietyId:'v4', growerId:'g3', stage:'Вегетация', location:'Дома', medium:'Почва', techniques:['LST'], weeksCount:4, likes:156, startDate:'2026-05-01',
   desc:'Bhut Jolokia в квартирных условиях под LED-панелью. Цель сезона — понять, хватит ли обычной комнатной температуры для нормального налива стручков.'},
  {title:'7 Pot Primo — гидропоника от старта', varietyId:'v5', growerId:'g4', stage:'Плодоношение', location:'Теплица', medium:'Гидропоника', techniques:['ScrOG','Дефолиация'], weeksCount:8, likes:601, startDate:'2026-03-20',
   desc:'Первый опыт выращивания острого чинензе на гидропонике. Веду подробный лог ЕС и pH раствора — интересно, ускорит ли это созревание стручков.'},
  {title:'Habanero Red: скоростной цикл', varietyId:'v10', growerId:'g5', stage:'Собран урожай', location:'Дома', medium:'Кокос', techniques:['Топпинг'], weeksCount:9, likes:274, startDate:'2026-02-15',
   desc:'Классический Habanero Red от рассады до полного сбора урожая — весь цикл уложился в девять недельных отчётов. Хороший ориентир для новичков.'},
  {title:'Scotch Bonnet для джерк-соуса', varietyId:'v12', growerId:'g6', stage:'Плодоношение', location:'Открытый грунт', medium:'Почва', techniques:['Органика'], weeksCount:6, likes:198, startDate:'2026-04-18',
   desc:'Выращиваю Scotch Bonnet исключительно на органике для домашнего джерк-соуса — никакой минеральной химии, только компост и настои трав.'},
  {title:'Тайские перчики на подоконнике зимой', varietyId:'v15', growerId:'g9', stage:'Вегетация', location:'Дома', medium:'Почва', techniques:['LST'], weeksCount:3, likes:88, startDate:'2026-05-20',
   desc:'Компактный зимний гров прик ки ну на кухонном подоконнике — минимум места, максимум мелких острых стручков к столу круглый год.'},
  {title:'Кайенский на сушку — дачный проект', varietyId:'v18', growerId:'g8', stage:'Плодоношение', location:'Открытый грунт', medium:'Почва', techniques:[], weeksCount:5, likes:143, startDate:'2026-04-25',
   desc:'Целая грядка кайенского на даче — весь урожай пойдёт на сушку и домашний перечный порошок для заготовок на зиму.'},
  {title:'Серрано для сальсы, второй заход', varietyId:'v20', growerId:'g10', stage:'Собран урожай', location:'Теплица', medium:'Гидропоника', techniques:['ScrOG'], weeksCount:10, likes:221, startDate:'2026-01-30',
   desc:'Второй сезон Серрано после не самого удачного первого опыта — на этот раз с гидропоникой и полным контролем питательного раствора.'},
  {title:'Халапеньо для начинающих — гайд-дневник', varietyId:'v25', growerId:'g7', stage:'Вегетация', location:'Дома', medium:'Почва', techniques:['Топпинг'], weeksCount:4, likes:365, startDate:'2026-05-05',
   desc:'Веду этот дневник специально подробно — как гайд для новичков сообщества, которые никогда раньше не выращивали острый перец.'},
  {title:'Второй Reaper — учимся на ошибках', varietyId:'v1', growerId:'g2', stage:'Цветение', location:'Теплица', medium:'Кокос', techniques:['LST','Топпинг'], weeksCount:6, likes:409, startDate:'2026-04-08',
   desc:'В прошлом сезоне Reaper сбросил половину цветков от жары под лампой. В этом дневнике фиксирую все изменения в режиме, чтобы не повторить ошибку.'},
  {title:'Bhut Jolokia в открытом грунте юга', varietyId:'v4', growerId:'g6', stage:'Плодоношение', location:'Открытый грунт', medium:'Почва', techniques:['Дефолиация'], weeksCount:7, likes:177, startDate:'2026-03-28',
   desc:'Проверяю, переживёт ли Bhut Jolokia открытый грунт в тёплом южном климате без укрытия — обычно этот сорт держат только в теплице.'},
  {title:'Fatalii: жёлтый огонь на подоконнике', varietyId:'v9', growerId:'g3', stage:'Плодоношение', location:'Дома', medium:'Кокос', techniques:['LST'], weeksCount:6, likes:203, startDate:'2026-04-14',
   desc:'Fatalii обещает яркую цитрусовую кислинку при огромной остроте — веду дневник, чтобы отследить, насколько аромат раскрывается в комнатных условиях.'},
  {title:'Rocoto в прохладной теплице', varietyId:'v19', growerId:'g4', stage:'Цветение', location:'Теплица', medium:'Почва', techniques:['Топпинг'], weeksCount:5, likes:134, startDate:'2026-04-22',
   desc:'Rocoto — единственный вид с чёрными семенами, любит прохладу. Держу теплицу без досветки и слежу, как куст переносит перепады температур.'}
];

/**
 * Builds the initial in-memory DIARIES array from DIARY_SEED, mirroring the
 * original vanilla prototype's derivation logic (weeks/comments are computed,
 * not hand-authored, so this stays exactly in sync with the old behaviour).
 */
export function buildInitialDiaries(growers) {
  return DIARY_SEED.map((seed, idx) => {
    const v = findVariety(seed.varietyId);
    const avgShu = (v.shuMin + v.shuMax) / 2;
    return {
      ...seed,
      id: 'd' + (idx + 1),
      liked: false,
      followers: Math.round(seed.likes * 0.4),
      shu: avgShu,
      reportInterval: 'weekly',
      weeks: generateWeeks(seed.stage, seed.weeksCount, seed.startDate, 'weekly'),
      comments: generateComments(1 + ((idx * 7) % 4), idx, growers)
    };
  });
}
