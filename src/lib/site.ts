// Контакты и навигация – одно место для шапки, меню, подвала и страниц.
export const SITE = {
  name: 'Milovini Flowers',
  city: 'Самара',
  address: 'ул. Первомайская, 26',
  phone: '+7 (937) 171-11-77',
  phoneHref: 'tel:+79371711177',
  hours: 'Круглосуточно',
  owner: 'ИП Нелипенко Николай Дмитриевич',
  inn: '635007922915',
  yandexOrg: 'https://yandex.ru/maps/org/19061492696/',
  yandexReviews: 'https://yandex.ru/maps/org/19061492696/reviews/',
};

export const SOCIALS = [
  { id: 'wa', label: 'WhatsApp', href: 'https://wa.me/79371711177' },
  { id: 'vk', label: 'ВКонтакте', href: 'https://vk.com/milovini_samara' },
  { id: 'max', label: 'MAX', href: 'https://max.ru/u/f9LHodD0cOJVoLWt5U-wY4KrOi-LInMxkMIpKx2TMrNrl9NpfRqyWCclW5E' },
  { id: 'tg', label: 'Telegram', href: 'https://t.me/milovini_samara' },
] as const;

/** Верхнее меню – как на оригинале. */
export const NAV = [
  { label: 'Главная', href: '/' },
  { label: 'Акции', href: '/akcii' },
  { label: 'Корпоративным клиентам', href: '/corparate' },
  { label: 'Доставка 24/7', href: '/delivery' },
  { label: 'Каталог цветов', href: '/catalog' },
  { label: 'Авторские букеты', href: '/catalog/author_bouquets' },
  { label: 'Отзывы', href: '/#rev' },
  { label: 'Преимущества', href: '/#preim' },
  { label: 'Гарантии', href: '/garantee' },
  { label: 'Контакты', href: '/contact' },
];

/** Страницы-каталоги: адрес оригинала → раздел магазина. */
export const CATALOGS = [
  { slug: 'byket', title: 'Букеты', h1: 'Букеты с доставкой в Самаре', heading: 'Каталог букетов' },
  { slug: 'compositions', title: 'Композиции', h1: 'Композиции с доставкой в Самаре', heading: 'Каталог композиций' },
  { slug: 'author_bouquets', title: 'Авторские букеты', h1: 'Авторские букеты с доставкой в Самаре', heading: 'Каталог авторских букетов' },
  { slug: 'monobooks', title: 'Монобукеты', h1: 'Монобукеты с доставкой в Самаре', heading: 'Каталог монобукетов' },
  { slug: 'kenyan_roses', title: 'Кенийские розы', h1: 'Кенийские розы с доставкой в Самаре', heading: 'Каталог кенийских роз' },
  { slug: 'ecuadorian_roses', title: 'Эквадорские розы', h1: 'Эквадорские розы с доставкой в Самаре', heading: 'Каталог эквадорских роз' },
  { slug: 'akcii', title: 'Акции', h1: 'Акции', heading: 'Каталог акций' },
  { slug: 'baloon', title: 'Шары', h1: 'Шары', heading: 'Каталог шары' },
  { slug: '1_september', title: '1 сентября', h1: '1 сентября', heading: 'Каталог 1 сентября' },
] as const;

export const FOOTER = {
  menu: [
    { label: 'Главная', href: '/' },
    { label: 'Акции', href: '/akcii' },
    { label: 'Корпоративным клиентам', href: '/corparate' },
    { label: 'Каталог цветов', href: '/catalog' },
    { label: 'Уникальные букеты', href: '/catalog/author_bouquets' },
    { label: 'Отзывы', href: '/#rev' },
    { label: 'Преимущества', href: '/#preim' },
    { label: 'Гарантии', href: '/garantee' },
    { label: 'Доставка 24/7', href: '/delivery' },
    { label: 'Контакты', href: '/contact' },
  ],
  catalog: CATALOGS.map((c) => ({ label: c.title, href: `/catalog/${c.slug}` })),
  buyers: [
    { label: 'Акции', href: '/akcii' },
    { label: 'Доставка и оплата', href: '/delivery' },
    { label: 'Избранное', href: '/favorites' },
    { label: 'Корзина', href: '/order' },
  ],
  info: [
    { label: 'Политика конфиденциальности', href: '/policy' },
    { label: 'Пользовательское соглашение', href: '/agreement' },
  ],
};
