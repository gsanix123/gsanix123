import { type FormEvent, type ReactNode, type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import {
  createOrder as createOrderApi,
  getCurrentUser,
  listOrders,
  listUsers,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  updateCurrentUser as updateCurrentUserApi,
  updateOrderStatus as updateOrderStatusApi,
  type CreateOrderInput,
  type OrderRecord,
  type User as ApiUser,
  type UpdateProfileInput,
} from '@workspace/api-client-react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleHelp,
  ClipboardList, Clock3, Globe2, Menu, Package, Plus, ShieldCheck, Sparkles,
  UserRound, WalletCards, X,
} from 'lucide-react';

type Account = ApiUser;
type Status = OrderRecord['status'];
type Order = OrderRecord & { name: string; created: string };
type Profile = UpdateProfileInput;
const queryClient = new QueryClient();
const STATUSES: Status[] = ['Новый', 'На выкупе', 'Выкуплен', 'В пути', 'На складе', 'Доставлен'];
const PLATFORMS: CreateOrderInput['platform'][] = ['POIZON', '1688', 'Taobao'];
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
const orderFromApi = (order: OrderRecord): Order => ({
  ...order,
  name: order.customerName,
  created: new Intl.DateTimeFormat('ru-RU').format(new Date(order.createdAt)),
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label="CHINA BUY — главная" data-testid="link-brand">
    <span className="brand-mark">C<span>B</span></span><span className="brand-word">CHINA BUY<small>ПОКУПКИ ИЗ КИТАЯ</small></span>
  </Link>;
}

function AppShell() {
  const [path, setPath] = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Все статусы');
  const isAdmin = account?.role === 'admin';
  const activeProfile: Profile = account
    ? { name: account.name, email: account.email, phone: account.phone, city: account.city, address: account.address }
    : { name: '', email: '', phone: '', city: '', address: '' };
  const go = (route: string) => { setPath(route); setMobileMenu(false); };

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then(({ user }) => { if (active) setAccount(user); })
      .catch(error => {
        if (active && getErrorStatus(error) !== 401) {
          setToast(getErrorMessage(error, 'Не удалось проверить авторизацию.'));
        }
      })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!account) {
      setOrders([]);
      setAccounts([]);
      setOrdersLoading(false);
      return () => { active = false; };
    }

    setOrdersLoading(true);
    Promise.all([
      listOrders(),
      account.role === 'admin' ? listUsers() : Promise.resolve([]),
    ])
      .then(([savedOrders, savedUsers]) => {
        if (!active) return;
        setOrders(savedOrders.map(orderFromApi));
        setAccounts(savedUsers);
      })
      .catch(error => {
        if (!active) return;
        if (getErrorStatus(error) === 401) setAccount(null);
        else setToast(getErrorMessage(error, 'Не удалось загрузить данные.'));
      })
      .finally(() => { if (active) setOrdersLoading(false); });
    return () => { active = false; };
  }, [account?.id, account?.role]);

  useEffect(() => {
    if (!authLoading && !account && ['/orders', '/orders/new', '/profile', '/admin'].includes(path)) {
      setPath('/auth');
    }
  }, [account, authLoading, path, setPath]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const createNewOrder = async (input: CreateOrderInput) => {
    const saved = await createOrderApi(input);
    setOrders(current => [orderFromApi(saved), ...current]);
    setToast('Заявка сохранена');
    go('/orders');
  };

  const changeOrderStatus = async (id: string, status: Status) => {
    const saved = await updateOrderStatusApi(id, { status });
    setOrders(current => current.map(order => order.id === id ? orderFromApi(saved) : order));
    setToast(`Статус ${id.slice(0, 8)} обновлен`);
  };

  const saveProfile = async (profile: Profile) => {
    const result = await updateCurrentUserApi(profile);
    setAccount(result.user);
    setToast('Профиль сохранен');
  };

  const signOut = async () => {
    try {
      await logoutApi();
      setToast('Вы вышли из аккаунта');
    } catch (error) {
      setToast(getErrorMessage(error, 'Не удалось завершить сессию.'));
    } finally {
      setAccount(null);
      setOrders([]);
      setAccounts([]);
      go('/');
    }
  };

  const navigation = [
    { href: '/', label: 'Обзор', icon: Sparkles },
    { href: '/orders', label: 'Мои заявки', icon: ClipboardList },
    { href: '/profile', label: 'Профиль', icon: UserRound },
  ];

  return <div className="app-frame">
    <header className="topbar">
      <div className="topbar-inner"><Brand />
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="Основная навигация">
          {navigation.map(item => <Link key={item.href} href={item.href} className={`nav-link ${path === item.href ? 'nav-active' : ''}`} onClick={() => setMobileMenu(false)} data-testid={`link-nav-${item.label}`}>
            <item.icon size={15} strokeWidth={1.7} />{item.label}
          </Link>)}
          {isAdmin && <Link href="/admin" className={`nav-link ${path === '/admin' ? 'nav-active' : ''}`} onClick={() => setMobileMenu(false)} data-testid="link-nav-admin"><ShieldCheck size={15} />Управление</Link>}
        </nav>
        <div className="top-actions">
          {account
            ? <div className="role-switch" data-testid="user-role" aria-label={`Роль: ${isAdmin ? 'администратор' : 'клиент'}`}><span className="role-dot" />{isAdmin ? 'Администратор' : 'Клиент'}</div>
            : <button className="role-switch" onClick={() => go('/auth')} data-testid="button-signin"><span className="role-dot" />Войти</button>}
          {account && <button className="avatar-button" onClick={() => go('/profile')} aria-label="Открыть профиль" data-testid="button-profile-shortcut"><span>{account.name.slice(0, 1)}</span></button>}
          <button className="menu-toggle" aria-label={mobileMenu ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMobileMenu(!mobileMenu)} data-testid="button-mobile-menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
    <main className="main-wrap">
      <Switch>
        <Route path="/"><HomePage account={account ?? undefined} orders={orders} go={go} /></Route>
        <Route path="/auth"><AuthPage onAuthenticated={setAccount} go={go} notify={setToast} /></Route>
        <Route path="/orders"><OrdersPage orders={orders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} go={go} loading={ordersLoading} /></Route>
        <Route path="/orders/new"><NewOrderPage onCreate={createNewOrder} go={go} /></Route>
        <Route path="/profile"><ProfilePage profile={activeProfile} account={account ?? undefined} go={go} onSave={saveProfile} onLogout={signOut} /></Route>
        <Route path="/admin"><AdminPage isAdmin={isAdmin} orders={orders} onUpdateStatus={changeOrderStatus} accounts={accounts} go={go} loading={ordersLoading} /></Route>
        <Route component={NotFound} />
      </Switch>
    </main>
    <footer className="site-footer"><span>© 2025 CHINA BUY</span><span>Покупки из Китая</span><button onClick={() => go(account ? '/profile' : '/auth')} data-testid="link-footer-auth">{account ? 'Мой аккаунт' : 'Войти'} <ArrowUpRight size={13} /></button></footer>
    {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
  </div>;
}

function HomePage({ account, orders, go }: { account?: Account; orders: Order[]; go: (path: string) => void }) {
  const active = orders.filter(order => order.status !== 'Доставлен').length;
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
      <div className="platform-list">{PLATFORMS.map((platform, i) => <button className="platform-row" key={platform} onClick={() => go(`/orders/new?platform=${encodeURIComponent(platform)}`)} data-testid={`button-platform-${platform}`}><span className="platform-num">0{i + 1}</span><span className="platform-name">{platform}</span><span className="platform-desc">{['Оригинальные бренды и кроссовки', 'Оптовые предложения от производителей', 'Мода, аксессуары и товары для дома'][i]}</span><ArrowUpRight size={17} /></button>)}</div>
    </section>
    <section className="process-band"><div className="section-kicker">БЕЗ СЛОЖНЫХ ИНСТРУКЦИЙ</div><div className="process-grid">{[['01', 'Пришлите ссылку', 'Добавьте товар и детали в короткую форму.'], ['02', 'Подтвердите выкуп', 'Менеджер уточнит наличие и итоговую стоимость.'], ['03', 'Следите за статусом', 'Все изменения заказа появятся в личном кабинете.']].map(([num, title, desc]) => <div className="process-item" key={num}><span>{num}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></section>
    <section className="demo-notice"><CircleHelp size={18} /><div><strong>Это демо-версия CHINA BUY</strong><span>Заявки и аккаунты сохраняются только в вашем браузере. Реальный выкуп, оплата и доставка не выполняются.</span></div></section>
  </div>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${statusClass(status)}`}><span />{status}</span>;
}
function statusClass(status: Status) {
  if (status === 'Доставлен') return 'status-done';
  if (status === 'На складе') return 'status-warehouse';
  if (status === 'В пути') return 'status-transit';
  if (status === 'Выкуплен') return 'status-bought';
  if (status === 'На выкупе') return 'status-process';
  return 'status-new';
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function OrdersPage({ orders, search, setSearch, filter, setFilter, go, loading }: { orders: Order[]; search: string; setSearch: (s: string) => void; filter: string; setFilter: (s: string) => void; go: (path: string) => void; loading: boolean }) {
  const shown = orders.filter(order => (filter === 'Все статусы' || order.status === filter) && `${order.id} ${order.platform} ${order.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="content-page">
    <PageHeading kicker="ВАШ КАБИНЕТ / 01" title="Мои заявки" description="Здесь собраны все товары, которые вы попросили выкупить." action={<button className="button button-gold" onClick={() => go('/orders/new')} data-testid="button-new-order"><Plus size={16} />Новая заявка</button>} />
    <div className="table-tools"><div className="search-wrap"><span className="search-icon">⌕</span><input type="search" aria-label="Поиск заявок" placeholder="Найти заявку или площадку" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-orders" /></div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Фильтр по статусу" data-testid="select-order-filter"><option>Все статусы</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select><span className="result-count">{shown.length} {shown.length === 1 ? 'заявка' : 'заявки'}</span></div>
    <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>НОМЕР / ДАТА</th><th>ТОВАР</th><th>ДЕТАЛИ</th><th>СТАТУС</th><th aria-label="Ссылка" /></tr></thead><tbody>{shown.map(order => <tr key={order.id} data-testid={`row-order-${order.id}`}><td><strong>{order.id}</strong><span>{order.created}</span></td><td><b>{order.platform}</b><span className="product-url">{order.url}</span></td><td><span>{order.size || '—'} · {order.color || 'цвет не указан'}</span><span>{order.quantity} шт.</span></td><td><StatusPill status={order.status} /></td><td><a href={order.url} target="_blank" rel="noreferrer" aria-label={`Открыть товар ${order.id}`} className="table-arrow" data-testid={`link-product-${order.id}`}><ArrowUpRight size={16} /></a></td></tr>)}</tbody></table>
      {!shown.length && <div className="empty-state"><Package size={28} /><strong>{loading ? 'Загружаем заявки…' : orders.length ? 'Ничего не найдено' : 'Пока нет заявок'}</strong><span>{loading ? 'Получаем ваши данные с сервера.' : orders.length ? 'Попробуйте изменить запрос или фильтр.' : 'Добавьте ссылку на товар — мы начнем с этого.'}</span>{!loading && !orders.length && <button className="button button-dark" onClick={() => go('/orders/new')} data-testid="button-empty-create">Создать заявку <ArrowRight size={15} /></button>}</div>}
    </div>
    <p className="disclaimer-line"><CircleHelp size={14} /> Все данные и статусы в этой версии демонстрационные.</p>
  </div>;
}

function NewOrderPage({ onCreate, go }: { onCreate: (input: CreateOrderInput) => Promise<void>; go: (path: string) => void }) {
  const [platform, setPlatform] = useState(() => {
    const requestedPlatform = new URLSearchParams(window.location.search).get('platform');
    return PLATFORMS.includes(requestedPlatform as CreateOrderInput['platform'])
      ? requestedPlatform as CreateOrderInput['platform']
      : 'POIZON';
  });
  const [url, setUrl] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const updateQuantity = (value: number) => setQuantity(Math.min(99, Math.max(1, Math.floor(value) || 1)));
  const priceNumber = Number(price) || 0;
  const estimate = Math.round((priceNumber * 12.9 + 450) * quantity);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^https?:\/\/.+/i.test(url)) { setError('Укажите полную ссылку на товар, начинающуюся с http:// или https://'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreate({ platform, url, size, color, quantity, comment });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не удалось сохранить заявку. Попробуйте еще раз.'));
    } finally {
      setSaving(false);
    }
  };
  return <div className="content-page">
    <PageHeading kicker="ВАШ КАБИНЕТ / 02" title="Новая заявка" description="Пришлите ссылку и укажите детали. Менеджер проверит товар и наличие." />
    <form className="order-form-layout" onSubmit={submit}>
      <div className="form-card"><div className="form-card-heading"><span>01</span><div><h2>О товаре</h2><p>Скопируйте ссылку на выбранную позицию.</p></div></div>
        <label className="field-label">ПЛОЩАДКА</label><div className="platform-select" role="group" aria-label="Площадка">{PLATFORMS.map(item => <button type="button" key={item} className={platform === item ? 'platform-choice selected' : 'platform-choice'} aria-pressed={platform === item} onClick={() => setPlatform(item)} data-testid={`button-select-${item}`}>{item}{platform === item && <Check size={14} />}</button>)}</div>
        <label className="field-label" htmlFor="product-url">ССЫЛКА НА ТОВАР <span>*</span></label><input id="product-url" required type="url" placeholder="https://..." value={url} onChange={e => { setUrl(e.target.value); setError(''); }} data-testid="input-product-url" />
        <div className="form-two-col"><div><label className="field-label" htmlFor="product-size">РАЗМЕР</label><input id="product-size" placeholder="Например, 38 EU" value={size} onChange={e => setSize(e.target.value)} data-testid="input-product-size" /></div><div><label className="field-label" htmlFor="product-color">ЦВЕТ</label><input id="product-color" placeholder="Например, графит" value={color} onChange={e => setColor(e.target.value)} data-testid="input-product-color" /></div></div>
        <div className="form-two-col quantity-row"><div><label className="field-label" htmlFor="quantity">КОЛИЧЕСТВО</label><div className="quantity-control"><button type="button" onClick={() => updateQuantity(quantity - 1)} aria-label="Уменьшить количество" data-testid="button-quantity-minus">−</button><input id="quantity" type="number" min="1" max="99" value={quantity} onChange={e => updateQuantity(Number(e.target.value))} data-testid="input-quantity" /><button type="button" onClick={() => updateQuantity(quantity + 1)} aria-label="Увеличить количество" data-testid="button-quantity-plus">+</button></div></div><div><label className="field-label" htmlFor="product-price">ЦЕНА НА ПЛОЩАДКЕ, ¥</label><input id="product-price" type="number" min="0" step="0.01" placeholder="Необязательно" value={price} onChange={e => setPrice(e.target.value)} data-testid="input-product-price" /></div></div>
        <label className="field-label" htmlFor="product-comment">КОММЕНТАРИЙ</label><textarea id="product-comment" rows={4} placeholder="Важные пожелания к выкупу или проверке товара" value={comment} onChange={e => setComment(e.target.value)} data-testid="input-product-comment" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-submit-row"><button className="button button-gold" type="submit" disabled={saving} data-testid="button-submit-order">{saving ? 'Сохраняем…' : 'Отправить заявку'} <ArrowRight size={15} /></button><span>Заявка сохранится в вашем аккаунте и станет доступна менеджеру.</span></div>
      </div>
      <aside className="estimate-card"><div className="section-kicker">ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ</div><div className="estimate-amount">{priceNumber > 0 ? money(estimate) : '—'}</div><p>примерно, с учетом товара и сервисного сбора</p>
        <div className="estimate-breakdown"><div><span>Курс для расчета</span><strong>1 ¥ = 12,9 ₽</strong></div><div><span>Сервисный сбор</span><strong>450 ₽ / шт.</strong></div><div><span>Количество</span><strong>{quantity} шт.</strong></div></div>
        <div className="estimate-alert"><CircleHelp size={16} /><span>Это ориентир, а не оферта. Не учитывает международную доставку и возможные комиссии площадки. Точную сумму подтвердит менеджер.</span></div>
        <div className="estimate-foot"><Clock3 size={14} />Обычно отвечаем в течение рабочего дня</div>
      </aside>
    </form>
  </div>;
}

function AuthPage({ onAuthenticated, go, notify }: { onAuthenticated: (user: Account) => void; go: (path: string) => void; notify: (s: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'register' && password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = mode === 'register'
        ? await registerApi({ name, email, phone, password })
        : await loginApi({ email, password });
      onAuthenticated(response.user);
      notify(mode === 'register' ? 'Аккаунт создан' : 'Вход выполнен');
      go('/');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не удалось выполнить вход. Проверьте данные.'));
    } finally {
      setSaving(false);
    }
  };
  return <div className="auth-layout">
    <section className="auth-intro"><div className="section-kicker">CHINA BUY</div><h1>Покупки,<br /><em>которые ближе.</em></h1><p>Один кабинет для заказов с любимых китайских площадок. Просто, прозрачно, по шагам.</p><div className="auth-quote"><span>«</span><strong>Сначала ссылка.<br />Дальше мы рядом.</strong><small>ПОДХОД CHINA BUY</small></div></section>
    <section className="auth-card"><div className="auth-tabs"><button className={mode === 'login' ? 'tab-active' : ''} onClick={() => { setMode('login'); setError(''); }} data-testid="button-auth-login-tab">Войти</button><button className={mode === 'register' ? 'tab-active' : ''} onClick={() => { setMode('register'); setError(''); }} data-testid="button-auth-register-tab">Регистрация</button></div>
      <h2>{mode === 'login' ? 'Рады видеть вас' : 'Создать аккаунт'}</h2><p className="auth-sub">{mode === 'login' ? 'Войдите, чтобы открыть свои заявки и профиль.' : 'После регистрации вы сможете создавать и отслеживать заявки.'}</p>
      <form onSubmit={submit}>{mode === 'register' && <><label className="field-label" htmlFor="auth-name">ИМЯ</label><input id="auth-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" data-testid="input-auth-name" /></>}
        <label className="field-label" htmlFor="auth-email">ЭЛЕКТРОННАЯ ПОЧТА</label><input id="auth-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.ru" data-testid="input-auth-email" />
        {mode === 'register' && <><label className="field-label" htmlFor="auth-phone">ТЕЛЕФОН</label><input id="auth-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 ___ ___-__-__" data-testid="input-auth-phone" /></>}
        <label className="field-label" htmlFor="auth-password">ПАРОЛЬ</label><input id="auth-password" required type="password" minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="Не менее 8 символов" data-testid="input-auth-password" />
        {error && <p className="form-error" role="alert">{error}</p>}<button type="submit" disabled={saving} className="button button-dark auth-submit" data-testid="button-auth-submit">{saving ? 'Подождите…' : mode === 'login' ? 'Войти в кабинет' : 'Зарегистрироваться'} <ArrowRight size={15} /></button>
      </form>
      <div className="demo-access"><div className="section-kicker">ВАШИ ДАННЫЕ</div><p>Заказы будут доступны только после входа в ваш аккаунт. Демо-аккаунты отключены.</p></div>
      <div className="auth-warning"><ShieldCheck size={15} />Пароль хранится на сервере в виде защищенного хэша, не в браузере.</div>
    </section>
  </div>;
}

function ProfilePage({ profile, account, go, onSave, onLogout }: { profile: Profile; account?: Account; go: (path: string) => void; onSave: (profile: Profile) => Promise<void>; onLogout: () => Promise<void> }) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(profile); }, [profile]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await onSave(draft); }
    catch (requestError) { setError(getErrorMessage(requestError, 'Не удалось сохранить профиль.')); }
    finally { setSaving(false); }
  };
  const reset = () => { setDraft({ name: account?.name ?? '', email: account?.email ?? '', phone: account?.phone ?? '', city: '', address: '' }); };
  return <div className="content-page"><PageHeading kicker="ВАШ КАБИНЕТ / 03" title="Профиль" description="Контактные данные для связи по вашим заявкам." />
    <div className="profile-layout"><form className="form-card profile-form" onSubmit={save}><div className="form-card-heading"><span>01</span><div><h2>Личные данные</h2><p>Обновите контакты, чтобы менеджер мог связаться с вами.</p></div></div>
      <label className="field-label" htmlFor="profile-name">ИМЯ</label><input id="profile-name" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} data-testid="input-profile-name" />
      <label className="field-label" htmlFor="profile-email">ЭЛЕКТРОННАЯ ПОЧТА</label><input id="profile-email" required type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} data-testid="input-profile-email" />
      <label className="field-label" htmlFor="profile-phone">ТЕЛЕФОН</label><input id="profile-phone" type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} data-testid="input-profile-phone" />
      <div className="form-two-col"><div><label className="field-label" htmlFor="profile-city">ГОРОД</label><input id="profile-city" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="Например, Москва" data-testid="input-profile-city" /></div><div><label className="field-label" htmlFor="profile-address">АДРЕС ДОСТАВКИ</label><input id="profile-address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Можно заполнить позже" data-testid="input-profile-address" /></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-submit-row"><button className="button button-gold" type="submit" disabled={saving} data-testid="button-save-profile">{saving ? 'Сохраняем…' : 'Сохранить изменения'} <Check size={15} /></button><button type="button" className="text-link" onClick={reset} data-testid="button-reset-profile">Сбросить</button></div></form>
      <aside className="profile-side"><div className="profile-avatar">{account?.name?.charAt(0) ?? 'А'}</div><div className="section-kicker">АККАУНТ</div><strong>{account?.name}</strong><span>{account?.email}</span><div className="profile-side-rule" /><span className="profile-role"><UserRound size={14} />{account?.role === 'admin' ? 'Роль: администратор' : 'Роль: клиент'}</span><button className="text-link" onClick={() => void onLogout()} data-testid="button-logout">Выйти из аккаунта <ArrowUpRight size={14} /></button><p>Профиль и заявки хранятся на сервере.</p></aside></div>
  </div>;
}

function AdminPage({ isAdmin, orders, onUpdateStatus, accounts, go, loading }: { isAdmin: boolean; orders: Order[]; onUpdateStatus: (id: string, status: Status) => Promise<void>; accounts: Account[]; go: (path: string) => void; loading: boolean }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const updateStatus = async (id: string, status: Status) => {
    setError('');
    try { await onUpdateStatus(id, status); }
    catch (requestError) { setError(getErrorMessage(requestError, 'Не удалось обновить статус.')); }
  };
  const filteredOrders = orders.filter(order => `${order.id} ${order.name} ${order.platform}`.toLowerCase().includes(query.toLowerCase()));
  const activeCount = orders.filter(order => order.status !== 'Доставлен').length;
  if (!isAdmin) return <div className="access-denied"><div className="access-icon"><ShieldCheck /></div><div className="section-kicker">ДОСТУП АДМИНИСТРАТОРА</div><h1>Эта страница<br /><em>для команды.</em></h1><p>Войдите под аккаунтом с ролью администратора, чтобы управлять заявками.</p><button className="button button-gold" onClick={() => go('/auth')} data-testid="button-admin-signin">Войти в аккаунт <ArrowRight size={15} /></button></div>;
  return <div className="content-page admin-page"><PageHeading kicker="УПРАВЛЕНИЕ" title="Панель менеджера" description="Заявки и клиенты, сохраненные в базе данных." />
    <div className="admin-metrics"><div><span>ЗАЯВОК ВСЕГО</span><strong>{String(orders.length).padStart(2, '0')}</strong><small><ClipboardList size={13} />в системе</small></div><div><span>В РАБОТЕ</span><strong>{String(activeCount).padStart(2, '0')}</strong><small><ArrowDownRight size={13} />не доставлены</small></div><div><span>КЛИЕНТОВ</span><strong>{String(accounts.filter(user => user.role === 'customer').length).padStart(2, '0')}</strong><small><UserRound size={13} />в базе</small></div></div>
    <div className="admin-section-head"><div><div className="section-kicker">ОЧЕРЕДЬ ЗАЯВОК</div><h2>Все заказы <span>{orders.length}</span></h2></div><div className="admin-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по номеру или клиенту" aria-label="Поиск по заявкам" data-testid="input-admin-search" /></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="admin-orders">{filteredOrders.map(order => <article className="admin-order-row" key={order.id} data-testid={`admin-order-${order.id}`}><div className="admin-order-main"><span className="admin-order-id">{order.id.slice(0, 8).toUpperCase()} <small>{order.created}</small></span><strong>{order.name}</strong><span>{order.platform} · {order.quantity} шт. {order.size && `· ${order.size}`}</span></div><a href={order.url} target="_blank" rel="noreferrer" className="admin-product-link" aria-label={`Открыть товар ${order.id}`}><ArrowUpRight size={15} />Товар</a><label className="sr-only" htmlFor={`status-${order.id}`}>Статус заявки {order.id}</label><select id={`status-${order.id}`} value={order.status} onChange={e => void updateStatus(order.id, e.target.value as Status)} aria-label={`Изменить статус ${order.id}`} data-testid={`select-status-${order.id}`}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></article>)}
      {!filteredOrders.length && <div className="empty-state"><Package size={28} /><strong>{loading ? 'Загружаем заявки…' : 'Заявки не найдены'}</strong><span>{loading ? 'Получаем данные с сервера.' : 'Поменяйте поисковый запрос или дождитесь первой заявки.'}</span></div>}</div>
    <div className="admin-section-head customers-head"><div><div className="section-kicker">КЛИЕНТСКАЯ БАЗА</div><h2>Профили <span>{accounts.filter(user => user.role === 'customer').length}</span></h2></div><span className="muted-copy">Аккаунты из базы данных</span></div>
    <div className="customer-list">{accounts.filter(user => user.role === 'customer').map(user => <div className="customer-row" key={user.id} data-testid={`customer-${user.id}`}><div className="customer-avatar">{user.name.charAt(0)}</div><div className="customer-info"><strong>{user.name}</strong><span>{user.email}</span></div><span className="customer-phone">{user.phone || 'Телефон не указан'}</span><span className="customer-order-count">{orders.filter(order => order.userId === user.id).length} заяв.</span></div>)}</div>
    <div className="admin-disclaimer"><ShieldCheck size={16} />Права администратора проверяются сервером.</div>
  </div>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AppShell /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
