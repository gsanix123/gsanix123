import { type FormEvent, type ReactNode, type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  ClipboardList, Clock3, Globe2, Menu, Package, Plus, ShieldCheck, Sparkles,
  UserRound, WalletCards, X,
} from 'lucide-react';

type Role = 'client' | 'admin';
type Status = 'Новая заявка' | 'На выкупе' | 'Выкуплен' | 'В пути' | 'Получен';
type Account = { id: string; name: string; email: string; phone: string; role: Role; password: string };
type Order = {
  id: string; userId: string; name: string; platform: string; url: string; size: string;
  color: string; quantity: number; comment: string; status: Status; created: string;
};
type Profile = { name: string; email: string; phone: string; city: string; address: string };
const queryClient = new QueryClient();
const KEYS = { accounts: 'china-buy-accounts', orders: 'china-buy-orders', profiles: 'china-buy-profiles', profile: 'china-buy-profile', session: 'china-buy-session' };
const STATUSES: Status[] = ['Новая заявка', 'На выкупе', 'Выкуплен', 'В пути', 'Получен'];
const PLATFORMS = ['POIZON', '1688', 'Taobao'];
const demoAccounts: Account[] = [
  { id: 'client-1', name: 'Алина Смирнова', email: 'alina@example.ru', phone: '+7 916 245-18-30', role: 'client', password: 'demo123' },
  { id: 'admin-1', name: 'Команда CHINA BUY', email: 'admin@chinabuy.demo', phone: '+7 800 555-02-12', role: 'admin', password: 'demo123' },
  { id: 'client-2', name: 'Максим Волков', email: 'maxim@example.ru', phone: '+7 903 112-64-08', role: 'client', password: 'demo123' },
];
const seedOrders: Order[] = [
  { id: 'CB-24018', userId: 'client-1', name: 'Алина Смирнова', platform: 'POIZON', url: 'https://poizon.com/product/retro-runner', size: '38 EU', color: 'Молочный / серый', quantity: 1, comment: 'Проверить коробку перед отправкой', status: 'В пути', created: '18.05.2025' },
  { id: 'CB-24011', userId: 'client-1', name: 'Алина Смирнова', platform: 'Taobao', url: 'https://item.taobao.com/item.htm?id=48201', size: 'M', color: 'Графит', quantity: 2, comment: '', status: 'На выкупе', created: '14.05.2025' },
  { id: 'CB-24006', userId: 'client-2', name: 'Максим Волков', platform: '1688', url: 'https://detail.1688.com/offer/830044', size: 'Универсальный', color: 'Черный', quantity: 1, comment: '', status: 'Новая заявка', created: '12.05.2025' },
  { id: 'CB-23992', userId: 'client-2', name: 'Максим Волков', platform: 'POIZON', url: 'https://poizon.com/product/city-bag', size: 'One size', color: 'Хаки', quantity: 1, comment: '', status: 'Получен', created: '06.05.2025' },
];

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const saved = window.localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; }
  catch { return fallback; }
}
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label="CHINA BUY — главная" data-testid="link-brand">
    <span className="brand-mark">C<span>B</span></span><span className="brand-word">CHINA BUY<small>ПОКУПКИ ИЗ КИТАЯ</small></span>
  </Link>;
}

function AppShell() {
  const [path, setPath] = useLocation();
  const [accounts, setAccounts] = useState<Account[]>(() => readStore(KEYS.accounts, demoAccounts));
  const [orders, setOrders] = useState<Order[]>(() => readStore(KEYS.orders, seedOrders));
  const [session, setSession] = useState<string>(() => readStore(KEYS.session, 'client-1'));
  const [profiles, setProfiles] = useState<Record<string, Profile>>(() => readStore(KEYS.profiles, {}));
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Все статусы');
  const account = accounts.find(item => item.id === session) ?? accounts[0];
  const isAdmin = account?.role === 'admin';
  const userOrders = orders.filter(order => isAdmin || order.userId === account?.id);
  const activeProfile = useMemo<Profile>(() => profiles[account?.id ?? ''] ?? {
    name: account?.name ?? '', email: account?.email ?? '', phone: account?.phone ?? '', city: '', address: '',
  }, [profiles, account?.id, account?.name, account?.email, account?.phone]);
  useEffect(() => { localStorage.setItem(KEYS.accounts, JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem(KEYS.orders, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(KEYS.profiles, JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { localStorage.setItem(KEYS.session, JSON.stringify(session)); }, [session]);
  useEffect(() => {
    const legacyProfile = readStore<Profile | null>(KEYS.profile, null);
    if (!Object.keys(profiles).length && legacyProfile && account) setProfiles({ [account.id]: legacyProfile });
    if (legacyProfile) localStorage.removeItem(KEYS.profile);
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const switchRole = (role: Role) => {
    const next = accounts.find(item => item.role === role);
    if (next) { setSession(next.id); setToast(role === 'admin' ? 'Демо-режим менеджера включен' : 'Демо-режим клиента включен'); }
  };
  const go = (route: string) => { setPath(route); setMobileMenu(false); };
  const navigation = [
    { href: '/', label: 'Обзор', icon: Sparkles },
    { href: '/orders', label: 'Мои заявки', icon: ClipboardList },
    { href: '/profile', label: 'Профиль', icon: UserRound },
  ];

  return <div className="app-frame">
    <header className="topbar">
      <div className="topbar-inner"><Brand />
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="Основная навигация">
          {navigation.map(item => <Link key={item.href} href={item.href} className={`nav-link ${path === item.href ? 'nav-active' : ''}`} data-testid={`link-nav-${item.label}`}>
            <item.icon size={15} strokeWidth={1.7} />{item.label}
          </Link>)}
          {isAdmin && <Link href="/admin" className={`nav-link ${path === '/admin' ? 'nav-active' : ''}`} data-testid="link-nav-admin"><ShieldCheck size={15} />Управление</Link>}
        </nav>
        <div className="top-actions">
          <button className="role-switch" onClick={() => switchRole(isAdmin ? 'client' : 'admin')} data-testid="button-role-switch" aria-label="Переключить демо-роль">
            <span className="role-dot" />{isAdmin ? 'Менеджер' : 'Клиент'}<ChevronDown size={14} />
          </button>
          <button className="avatar-button" onClick={() => go('/profile')} aria-label="Открыть профиль" data-testid="button-profile-shortcut"><span>{account?.name?.slice(0, 1) ?? 'А'}</span></button>
          <button className="menu-toggle" aria-label={mobileMenu ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMobileMenu(!mobileMenu)} data-testid="button-mobile-menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
    <main className="main-wrap">
      <Switch>
        <Route path="/"><HomePage account={account} orders={userOrders} go={go} /></Route>
        <Route path="/auth"><AuthPage accounts={accounts} setAccounts={setAccounts} setSession={setSession} go={go} notify={setToast} /></Route>
        <Route path="/orders"><OrdersPage orders={userOrders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} go={go} /></Route>
        <Route path="/orders/new"><NewOrderPage account={account} setOrders={setOrders} go={go} notify={setToast} /></Route>
        <Route path="/profile"><ProfilePage profile={activeProfile} account={account} go={go} onSave={updated => {
          if (!account) return;
          setProfiles(current => ({ ...current, [account.id]: updated }));
          setAccounts(current => current.map(item => item.id === account.id
            ? { ...item, name: updated.name, email: updated.email, phone: updated.phone }
            : item));
          setToast('Профиль сохранен в браузере');
        }} /></Route>
        <Route path="/admin"><AdminPage isAdmin={isAdmin} orders={orders} setOrders={setOrders} accounts={accounts} go={go} notify={setToast} /></Route>
        <Route component={NotFound} />
      </Switch>
    </main>
    <footer className="site-footer"><span>© 2025 CHINA BUY</span><span>Демо-сервис для покупок из Китая</span><button onClick={() => go('/auth')} data-testid="link-footer-auth">Аккаунт и доступ <ArrowUpRight size={13} /></button></footer>
    {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
  </div>;
}

function HomePage({ account, orders, go }: { account?: Account; orders: Order[]; go: (path: string) => void }) {
  const active = orders.filter(order => order.status !== 'Получен').length;
  return <div className="home-page">
    <section className="hero-panel">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" />ВАШИ ПОКУПКИ. НАШ КИТАЙ.</div>
        <h1>Из Китая —<br /><em>с ясным маршрутом.</em></h1>
        <p>Отправьте ссылку на товар с POIZON, 1688 или Taobao. Мы поможем выкупить и доставить его вам.</p>
        <div className="hero-actions"><button className="button button-gold" onClick={() => go('/orders/new')} data-testid="button-start-order">Оставить заявку <ArrowRight size={16} /></button>
          <button className="text-link" onClick={() => go('/orders')} data-testid="button-view-orders">Мои заявки <ArrowUpRight size={15} /></button></div>
        <div className="hero-note"><ShieldCheck size={15} /><span>Без скрытых шагов. Каждый этап виден в кабинете.</span></div>
      </div>
      <div className="hero-art" aria-label="Абстрактная схема пути заказа">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-axis" />
        <div className="art-stamp">CB<span>•</span>01</div>
        <div className="art-package"><div className="package-top" /><div className="package-front"><span>CHINA<br />BUY</span><i /></div><div className="package-side" /></div>
        <div className="art-marker marker-a"><span>01</span><small>ВЫКУП</small></div><div className="art-marker marker-b"><span>02</span><small>ДОСТАВКА</small></div>
        <div className="art-caption"><span>ПУТЬ ЗАКАЗА</span><strong>Китай → Россия</strong></div>
      </div>
      <div className="hero-index">001 <span>—</span> ДОСТУПНЫЙ МАРШРУТ</div>
    </section>
    <div className="trust-strip"><span><Globe2 size={15} /> POIZON / 1688 / TAOBAO</span><span><span className="gold-dot" />ПЕРСОНАЛЬНОЕ СОПРОВОЖДЕНИЕ</span><span><WalletCards size={15} />ПОНЯТНАЯ ОЦЕНКА РАСХОДОВ</span></div>
    <section className="dashboard-row">
      <div className="welcome-block"><div className="section-kicker">ЛИЧНЫЙ КАБИНЕТ <span>01 / 03</span></div><h2>Добрый день,<br /><em>{account?.name?.split(' ')[0] ?? 'покупатель'}.</em></h2><p>Все ваши покупки и их движение — в одном месте.</p><button className="button button-dark" onClick={() => go('/orders')} data-testid="button-open-orders">Открыть заявки <ArrowRight size={15} /></button></div>
      <div className="stat-card"><div className="stat-heading">Активные заявки <ArrowUpRight size={16} /></div><div className="stat-value">{String(active).padStart(2, '0')}</div><div className="stat-foot"><span className="status-dot" />находятся в работе</div></div>
      <div className="latest-card"><div className="latest-head"><span>ПОСЛЕДНЯЯ ЗАЯВКА</span><button onClick={() => go('/orders')} aria-label="Все заявки" data-testid="button-all-orders"><ArrowUpRight size={15} /></button></div>
        {orders.length ? <><div className="latest-id">{orders[0].id}</div><div className="latest-detail">{orders[0].platform} <span>·</span> {orders[0].created}</div><StatusPill status={orders[0].status} /></> : <p className="muted-copy">Заявок пока нет. Начните с первой покупки.</p>}
      </div>
    </section>
    <section className="platform-section"><div className="platform-heading"><div><div className="section-kicker">ОТКУДА ПОКУПАЕМ</div><h2>Три площадки.<br /><em>Один понятный процесс.</em></h2></div><button className="text-link" onClick={() => go('/orders/new')} data-testid="button-platform-request">Создать заявку <ArrowRight size={15} /></button></div>
      <div className="platform-list">{PLATFORMS.map((platform, i) => <button className="platform-row" key={platform} onClick={() => go('/orders/new')} data-testid={`button-platform-${platform}`}><span className="platform-num">0{i + 1}</span><span className="platform-name">{platform}</span><span className="platform-desc">{['Оригинальные бренды и кроссовки', 'Оптовые предложения от производителей', 'Мода, аксессуары и товары для дома'][i]}</span><ArrowUpRight size={17} /></button>)}</div>
    </section>
    <section className="process-band"><div className="section-kicker">БЕЗ СЛОЖНЫХ ИНСТРУКЦИЙ</div><div className="process-grid">{[['01', 'Пришлите ссылку', 'Добавьте товар и детали в короткую форму.'], ['02', 'Подтвердите выкуп', 'Менеджер уточнит наличие и итоговую стоимость.'], ['03', 'Следите за статусом', 'Все изменения заказа появятся в личном кабинете.']].map(([num, title, desc]) => <div className="process-item" key={num}><span>{num}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></section>
    <section className="demo-notice"><CircleHelp size={18} /><div><strong>Это демо-версия CHINA BUY</strong><span>Заявки и аккаунты сохраняются только в вашем браузере. Реальный выкуп, оплата и доставка не выполняются.</span></div></section>
  </div>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${statusClass(status)}`}><span />{status}</span>;
}
function statusClass(status: Status) {
  if (status === 'Получен') return 'status-done';
  if (status === 'В пути') return 'status-transit';
  if (status === 'Выкуплен') return 'status-bought';
  if (status === 'На выкупе') return 'status-process';
  return 'status-new';
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function OrdersPage({ orders, search, setSearch, filter, setFilter, go }: { orders: Order[]; search: string; setSearch: (s: string) => void; filter: string; setFilter: (s: string) => void; go: (path: string) => void }) {
  const shown = orders.filter(order => (filter === 'Все статусы' || order.status === filter) && `${order.id} ${order.platform} ${order.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="content-page">
    <PageHeading kicker="ВАШ КАБИНЕТ / 01" title="Мои заявки" description="Здесь собраны все товары, которые вы попросили выкупить." action={<button className="button button-gold" onClick={() => go('/orders/new')} data-testid="button-new-order"><Plus size={16} />Новая заявка</button>} />
    <div className="table-tools"><div className="search-wrap"><span className="search-icon">⌕</span><input type="search" aria-label="Поиск заявок" placeholder="Найти заявку или площадку" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-orders" /></div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Фильтр по статусу" data-testid="select-order-filter"><option>Все статусы</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select><span className="result-count">{shown.length} {shown.length === 1 ? 'заявка' : 'заявки'}</span></div>
    <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>НОМЕР / ДАТА</th><th>ТОВАР</th><th>ДЕТАЛИ</th><th>СТАТУС</th><th aria-label="Ссылка" /></tr></thead><tbody>{shown.map(order => <tr key={order.id} data-testid={`row-order-${order.id}`}><td><strong>{order.id}</strong><span>{order.created}</span></td><td><b>{order.platform}</b><span className="product-url">{order.url}</span></td><td><span>{order.size || '—'} · {order.color || 'цвет не указан'}</span><span>{order.quantity} шт.</span></td><td><StatusPill status={order.status} /></td><td><a href={order.url} target="_blank" rel="noreferrer" aria-label={`Открыть товар ${order.id}`} className="table-arrow" data-testid={`link-product-${order.id}`}><ArrowUpRight size={16} /></a></td></tr>)}</tbody></table>
      {!shown.length && <div className="empty-state"><Package size={28} /><strong>{orders.length ? 'Ничего не найдено' : 'Пока нет заявок'}</strong><span>{orders.length ? 'Попробуйте изменить запрос или фильтр.' : 'Добавьте ссылку на товар — мы начнем с этого.'}</span>{!orders.length && <button className="button button-dark" onClick={() => go('/orders/new')} data-testid="button-empty-create">Создать заявку <ArrowRight size={15} /></button>}</div>}
    </div>
    <p className="disclaimer-line"><CircleHelp size={14} /> Все данные и статусы в этой версии демонстрационные.</p>
  </div>;
}

function NewOrderPage({ account, setOrders, go, notify }: { account?: Account; setOrders: React.Dispatch<React.SetStateAction<Order[]>>; go: (path: string) => void; notify: (s: string) => void }) {
  const [platform, setPlatform] = useState('POIZON');
  const [url, setUrl] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const priceNumber = Number(price) || 0;
  const estimate = Math.round((priceNumber * 12.9 + 450) * quantity);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^https?:\/\/.+/i.test(url)) { setError('Укажите полную ссылку на товар, начинающуюся с http:// или https://'); return; }
    const next: Order = { id: `CB-${Math.floor(24100 + Math.random() * 800)}`, userId: account?.id ?? 'client-1', name: account?.name ?? 'Демо-покупатель', platform, url, size, color, quantity, comment, status: 'Новая заявка', created: new Intl.DateTimeFormat('ru-RU').format(new Date()) };
    setOrders(old => [next, ...old]); notify('Демо-заявка создана'); go('/orders');
  };
  return <div className="content-page">
    <PageHeading kicker="ВАШ КАБИНЕТ / 02" title="Новая заявка" description="Пришлите ссылку и укажите детали. Менеджер проверит товар и наличие." />
    <form className="order-form-layout" onSubmit={submit}>
      <div className="form-card"><div className="form-card-heading"><span>01</span><div><h2>О товаре</h2><p>Скопируйте ссылку на выбранную позицию.</p></div></div>
        <label className="field-label">ПЛОЩАДКА</label><div className="platform-select">{PLATFORMS.map(item => <button type="button" key={item} className={platform === item ? 'platform-choice selected' : 'platform-choice'} onClick={() => setPlatform(item)} data-testid={`button-select-${item}`}>{item}{platform === item && <Check size={14} />}</button>)}</div>
        <label className="field-label" htmlFor="product-url">ССЫЛКА НА ТОВАР <span>*</span></label><input id="product-url" required type="url" placeholder="https://..." value={url} onChange={e => { setUrl(e.target.value); setError(''); }} data-testid="input-product-url" />
        <div className="form-two-col"><div><label className="field-label" htmlFor="product-size">РАЗМЕР</label><input id="product-size" placeholder="Например, 38 EU" value={size} onChange={e => setSize(e.target.value)} data-testid="input-product-size" /></div><div><label className="field-label" htmlFor="product-color">ЦВЕТ</label><input id="product-color" placeholder="Например, графит" value={color} onChange={e => setColor(e.target.value)} data-testid="input-product-color" /></div></div>
        <div className="form-two-col quantity-row"><div><label className="field-label" htmlFor="quantity">КОЛИЧЕСТВО</label><div className="quantity-control"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Уменьшить количество" data-testid="button-quantity-minus">−</button><input id="quantity" type="number" min="1" max="99" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} data-testid="input-quantity" /><button type="button" onClick={() => setQuantity(Math.min(99, quantity + 1))} aria-label="Увеличить количество" data-testid="button-quantity-plus">+</button></div></div><div><label className="field-label" htmlFor="product-price">ЦЕНА НА ПЛОЩАДКЕ, ¥</label><input id="product-price" type="number" min="0" step="0.01" placeholder="Необязательно" value={price} onChange={e => setPrice(e.target.value)} data-testid="input-product-price" /></div></div>
        <label className="field-label" htmlFor="product-comment">КОММЕНТАРИЙ</label><textarea id="product-comment" rows={4} placeholder="Важные пожелания к выкупу или проверке товара" value={comment} onChange={e => setComment(e.target.value)} data-testid="input-product-comment" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-submit-row"><button className="button button-gold" type="submit" data-testid="button-submit-order">Отправить заявку <ArrowRight size={15} /></button><span>Продолжая, вы отправляете демонстрационную заявку.</span></div>
      </div>
      <aside className="estimate-card"><div className="section-kicker">ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ</div><div className="estimate-amount">{priceNumber > 0 ? money(estimate) : '—'}</div><p>примерно, с учетом товара и сервисного сбора</p>
        <div className="estimate-breakdown"><div><span>Курс для расчета</span><strong>1 ¥ = 12,9 ₽</strong></div><div><span>Сервисный сбор</span><strong>450 ₽ / шт.</strong></div><div><span>Количество</span><strong>{quantity} шт.</strong></div></div>
        <div className="estimate-alert"><CircleHelp size={16} /><span>Это ориентир, а не оферта. Не учитывает международную доставку и возможные комиссии площадки. Точную сумму подтвердит менеджер.</span></div>
        <div className="estimate-foot"><Clock3 size={14} />Обычно отвечаем в течение рабочего дня</div>
      </aside>
    </form>
  </div>;
}

function AuthPage({ accounts, setAccounts, setSession, go, notify }: { accounts: Account[]; setAccounts: React.Dispatch<React.SetStateAction<Account[]>>; setSession: (id: string) => void; go: (path: string) => void; notify: (s: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const enter = (id: string) => { setSession(id); go('/'); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'register') {
      if (password.length < 4) { setError('Для демо-пароля укажите не менее 4 символов.'); return; }
      if (accounts.some(user => user.email.toLowerCase() === email.toLowerCase())) { setError('Аккаунт с такой почтой уже существует.'); return; }
      const newAccount: Account = { id: `user-${Date.now()}`, name, email, phone, role: 'client', password };
      setAccounts(current => [...current, newAccount]); setSession(newAccount.id);
      notify('Демо-аккаунт зарегистрирован'); go('/'); return;
    }
    const found = accounts.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);
    if (!found) { setError('Не удалось войти. Проверьте данные или используйте демо-доступ ниже.'); return; }
    enter(found.id);
  };
  return <div className="auth-layout">
    <section className="auth-intro"><div className="section-kicker">CHINA BUY / DEMO</div><h1>Покупки,<br /><em>которые ближе.</em></h1><p>Один кабинет для заказов с любимых китайских площадок. Просто, прозрачно, по шагам.</p><div className="auth-quote"><span>«</span><strong>Сначала ссылка.<br />Дальше мы рядом.</strong><small>ПОДХОД CHINA BUY</small></div></section>
    <section className="auth-card"><div className="auth-tabs"><button className={mode === 'login' ? 'tab-active' : ''} onClick={() => { setMode('login'); setError(''); }} data-testid="button-auth-login-tab">Войти</button><button className={mode === 'register' ? 'tab-active' : ''} onClick={() => { setMode('register'); setError(''); }} data-testid="button-auth-register-tab">Регистрация</button></div>
      <h2>{mode === 'login' ? 'Рады видеть вас' : 'Создать аккаунт'}</h2><p className="auth-sub">{mode === 'login' ? 'Войдите в демо-кабинет или попробуйте быстрый доступ.' : 'Это локальный демо-профиль — данные останутся в браузере.'}</p>
      <form onSubmit={submit}>{mode === 'register' && <><label className="field-label" htmlFor="auth-name">ИМЯ</label><input id="auth-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" data-testid="input-auth-name" /></>}
        <label className="field-label" htmlFor="auth-email">ЭЛЕКТРОННАЯ ПОЧТА</label><input id="auth-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.ru" data-testid="input-auth-email" />
        {mode === 'register' && <><label className="field-label" htmlFor="auth-phone">ТЕЛЕФОН</label><input id="auth-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 ___ ___-__-__" data-testid="input-auth-phone" /></>}
        <label className="field-label" htmlFor="auth-password">ПАРОЛЬ</label><input id="auth-password" required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Не менее 4 символов" data-testid="input-auth-password" />
        {error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-dark auth-submit" data-testid="button-auth-submit">{mode === 'login' ? 'Войти в кабинет' : 'Зарегистрироваться'} <ArrowRight size={15} /></button>
      </form>
      <div className="demo-access"><div className="section-kicker">БЫСТРЫЙ ДЕМО-ДОСТУП</div><button onClick={() => enter(accounts.find(user => user.role === 'client')?.id ?? '')} data-testid="button-demo-client"><span>Клиент</span><small>alina@example.ru · demo123</small><ArrowRight size={14} /></button><button onClick={() => enter(accounts.find(user => user.role === 'admin')?.id ?? '')} data-testid="button-demo-admin"><span>Менеджер</span><small>admin@chinabuy.demo · demo123</small><ArrowRight size={14} /></button></div>
      <div className="auth-warning"><ShieldCheck size={15} />Демо-доступ не является защищенной авторизацией. Не используйте реальные пароли.</div>
    </section>
  </div>;
}

function ProfilePage({ profile, account, go, onSave }: { profile: Profile; account?: Account; go: (path: string) => void; onSave: (profile: Profile) => void }) {
  const [draft, setDraft] = useState<Profile>(profile);
  useEffect(() => { setDraft(profile); }, [profile]);
  const save = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave(draft); };
  const reset = () => { setDraft({ name: account?.name ?? '', email: account?.email ?? '', phone: account?.phone ?? '', city: '', address: '' }); };
  return <div className="content-page"><PageHeading kicker="ВАШ КАБИНЕТ / 03" title="Профиль" description="Контактные данные для связи по вашим заявкам." />
    <div className="profile-layout"><form className="form-card profile-form" onSubmit={save}><div className="form-card-heading"><span>01</span><div><h2>Личные данные</h2><p>Обновите контакты, чтобы менеджер мог связаться с вами.</p></div></div>
      <label className="field-label" htmlFor="profile-name">ИМЯ</label><input id="profile-name" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} data-testid="input-profile-name" />
      <label className="field-label" htmlFor="profile-email">ЭЛЕКТРОННАЯ ПОЧТА</label><input id="profile-email" required type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} data-testid="input-profile-email" />
      <label className="field-label" htmlFor="profile-phone">ТЕЛЕФОН</label><input id="profile-phone" type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} data-testid="input-profile-phone" />
      <div className="form-two-col"><div><label className="field-label" htmlFor="profile-city">ГОРОД</label><input id="profile-city" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="Например, Москва" data-testid="input-profile-city" /></div><div><label className="field-label" htmlFor="profile-address">АДРЕС ДОСТАВКИ</label><input id="profile-address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Можно заполнить позже" data-testid="input-profile-address" /></div></div>
      <div className="form-submit-row"><button className="button button-gold" type="submit" data-testid="button-save-profile">Сохранить изменения <Check size={15} /></button><button type="button" className="text-link" onClick={reset} data-testid="button-reset-profile">Сбросить</button></div></form>
      <aside className="profile-side"><div className="profile-avatar">{account?.name?.charAt(0) ?? 'А'}</div><div className="section-kicker">ДЕМО-ПРОФИЛЬ</div><strong>{account?.name}</strong><span>{account?.email}</span><div className="profile-side-rule" /><span className="profile-role"><UserRound size={14} />{account?.role === 'admin' ? 'Роль: менеджер' : 'Роль: клиент'}</span><button className="text-link" onClick={() => go('/auth')} data-testid="button-open-auth">Перейти к входу <ArrowUpRight size={14} /></button><p>Профиль сохраняется в localStorage этого браузера. Секретные данные здесь не нужны.</p></aside></div>
  </div>;
}

function AdminPage({ isAdmin, orders, setOrders, accounts, go, notify }: { isAdmin: boolean; orders: Order[]; setOrders: Dispatch<SetStateAction<Order[]>>; accounts: Account[]; go: (path: string) => void; notify: (s: string) => void }) {
  const [query, setQuery] = useState('');
  const updateStatus = (id: string, status: Status) => { setOrders(current => current.map(order => order.id === id ? { ...order, status } : order)); notify(`Статус ${id} обновлен`); };
  const filteredOrders = orders.filter(order => `${order.id} ${order.name} ${order.platform}`.toLowerCase().includes(query.toLowerCase()));
  const activeCount = orders.filter(order => order.status !== 'Получен').length;
  if (!isAdmin) return <div className="access-denied"><div className="access-icon"><ShieldCheck /></div><div className="section-kicker">ДОСТУП МЕНЕДЖЕРА</div><h1>Эта страница<br /><em>для команды.</em></h1><p>Переключитесь в демо-режим менеджера, чтобы посмотреть управление заявками и клиентами.</p><button className="button button-gold" onClick={() => go('/auth')} data-testid="button-admin-signin">Открыть демо-доступ <ArrowRight size={15} /></button></div>;
  return <div className="content-page admin-page"><PageHeading kicker="УПРАВЛЕНИЕ / DEMO" title="Панель менеджера" description="Заявки и клиенты этого браузера. Все изменения демонстрационные." />
    <div className="admin-metrics"><div><span>ЗАЯВОК ВСЕГО</span><strong>{String(orders.length).padStart(2, '0')}</strong><small><ClipboardList size={13} />в системе</small></div><div><span>В РАБОТЕ</span><strong>{String(activeCount).padStart(2, '0')}</strong><small><ArrowDownRight size={13} />не получены клиентом</small></div><div><span>ДЕМО-КЛИЕНТОВ</span><strong>{String(accounts.filter(user => user.role === 'client').length).padStart(2, '0')}</strong><small><UserRound size={13} />профилей в браузере</small></div></div>
    <div className="admin-section-head"><div><div className="section-kicker">ОЧЕРЕДЬ ЗАЯВОК</div><h2>Все заказы <span>{orders.length}</span></h2></div><div className="admin-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по номеру или клиенту" aria-label="Поиск по заявкам" data-testid="input-admin-search" /></div></div>
    <div className="admin-orders">{filteredOrders.map(order => <article className="admin-order-row" key={order.id} data-testid={`admin-order-${order.id}`}><div className="admin-order-main"><span className="admin-order-id">{order.id} <small>{order.created}</small></span><strong>{order.name}</strong><span>{order.platform} · {order.quantity} шт. {order.size && `· ${order.size}`}</span></div><a href={order.url} target="_blank" rel="noreferrer" className="admin-product-link" aria-label={`Открыть товар ${order.id}`}><ArrowUpRight size={15} />Товар</a><label className="sr-only" htmlFor={`status-${order.id}`}>Статус заявки {order.id}</label><select id={`status-${order.id}`} value={order.status} onChange={e => updateStatus(order.id, e.target.value as Status)} aria-label={`Изменить статус ${order.id}`} data-testid={`select-status-${order.id}`}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></article>)}
      {!filteredOrders.length && <div className="empty-state"><Package size={28} /><strong>Заявки не найдены</strong><span>Поменяйте поисковый запрос.</span></div>}</div>
    <div className="admin-section-head customers-head"><div><div className="section-kicker">КЛИЕНТСКАЯ БАЗА</div><h2>Профили <span>{accounts.filter(user => user.role === 'client').length}</span></h2></div><span className="muted-copy">Только демо-аккаунты из localStorage</span></div>
    <div className="customer-list">{accounts.filter(user => user.role === 'client').map(user => <div className="customer-row" key={user.id} data-testid={`customer-${user.id}`}><div className="customer-avatar">{user.name.charAt(0)}</div><div className="customer-info"><strong>{user.name}</strong><span>{user.email}</span></div><span className="customer-phone">{user.phone || 'Телефон не указан'}</span><span className="customer-order-count">{orders.filter(order => order.userId === user.id).length} заяв.</span></div>)}</div>
    <div className="admin-disclaimer"><ShieldCheck size={16} />Демо-панель не связана с реальными клиентами или сервисами CHINA BUY.</div>
  </div>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AppShell /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
