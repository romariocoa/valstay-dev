import { useState, useEffect, useRef } from 'react';
import { useRooms, useActiveStays, useHotelConfig } from './hooks/useData';
import { Dashboard } from './components/Dashboard';
import { CheckInForm } from './components/CheckInForm';
import { StayCard } from './components/StayCard';
import { StayHistory } from './components/StayHistory';
import { LoginScreen } from './components/LoginScreen';
import { ChangeInitialPassword } from './components/ChangeInitialPassword';
import { TenantManager } from './components/TenantManager';
import { Room, StayWithDetails, getClient } from './lib/supabase';
import { RoomManager } from './components/RoomManager';
import { UserManager } from './components/UserManager';
import { HotelConfig } from './components/HotelConfig';
import { ExportValorizacion } from './components/ExportValorizacion';
import { TenantMessages } from './components/TenantMessages';
import { useTheme } from './context/ThemeContext';
import {
  AppUser, getSession, logout, validateSession, clearSession,
  isAdmin as checkAdmin,
  isSuperuser as checkSuperuser,
  canEditFloorPlan as checkCanEditPlan,
  canDeleteHistory,
  canManageUsers,
  canExportValorizacion,
  canViewStays,
} from './lib/auth';
import {
  Hotel,
  Plus,
  LayoutDashboard,
  Users,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Building2,
  ShieldCheck,
  UserCircle,
  UsersRound,
  Settings,
  Sun,
  Moon,
  Search,
  Pin,
  PinOff,
  BellRing,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Sparkles,
} from 'lucide-react';

type Tab = 'dashboard' | 'stays' | 'history' | 'settings' | 'users' | 'config';

function localTodayStr(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function notificationLine(value: string, maxLength = 60): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function notificationDepartureDate(stay: StayWithDetails): string {
  const departure = new Date(stay.check_out_date + 'T12:00:00');
  departure.setDate(departure.getDate() + 1);
  return [departure.getFullYear(), String(departure.getMonth() + 1).padStart(2, '0'), String(departure.getDate()).padStart(2, '0')].join('-');
}

function App() {
  // Initialise from localStorage immediately — no loading screen when session exists.
  const localSession = getSession();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(localSession);
  // Only show the full-screen loader when there is no local session at all
  // (first visit or after explicit logout). Otherwise we render the app optimistically.
  const [authLoading, setAuthLoading] = useState(!localSession);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportOptions, setExportOptions] = useState<{ empresa: string; startDate: string; endDate: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [notificationClock, setNotificationClock] = useState(Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [receptionistNotificationsOpen, setReceptionistNotificationsOpen] = useState(false);
  const [pushSubscriptionActive, setPushSubscriptionActive] = useState(false);
  const [pushSubscriptionLoading, setPushSubscriptionLoading] = useState(false);
  const [pushSubscriptionError, setPushSubscriptionError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [showDepartureCards, setShowDepartureCards] = useState(true);
  const [sidebarPuchiBlinking, setSidebarPuchiBlinking] = useState(false);
  const tenantId = currentUser?.tenantId ?? null;
  const notificationOptOutKey = currentUser && tenantId
    ? `push_notifications_disabled_${tenantId}_${currentUser.id}`
    : null;
  const effectiveSidebarPinned = isDesktop && sidebarPinned;

  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms(tenantId);
  const { stays, loading: staysLoading, refetch: refetchStays } = useActiveStays(tenantId);
 const {
  config: hotelConfig,
  save: saveHotelConfig,
  refetch: refetchHotelConfig,
} = useHotelConfig(tenantId, currentUser?.sessionToken);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const blinkTimer = window.setInterval(() => {
      setSidebarPuchiBlinking(current => !current);
    }, 850);
    return () => window.clearInterval(blinkTimer);
  }, []);

  // Always-current refs so the visibility handler never captures stale closures
 const refetchRoomsRef = useRef(refetchRooms);
refetchRoomsRef.current = refetchRooms;

const refetchStaysRef = useRef(refetchStays);
refetchStaysRef.current = refetchStays;

const refetchHotelConfigRef = useRef(refetchHotelConfig);
refetchHotelConfigRef.current = refetchHotelConfig;

const currentUserRef = useRef(currentUser);
currentUserRef.current = currentUser;

const automaticRefreshRunningRef = useRef(false);
useEffect(() => {
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const handleDesktopChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
  setIsDesktop(desktopQuery.matches);
  desktopQuery.addEventListener('change', handleDesktopChange);
  return () => desktopQuery.removeEventListener('change', handleDesktopChange);
}, []);

useEffect(() => {
  let cancelled = false;

  const initAuth = async () => {
    const valid = await validateSession();

    if (cancelled) return;

    if (valid) {
      setCurrentUser(valid);
    } else {
      clearSession();
      setCurrentUser(null);
    }

    setAuthLoading(false);
  };

  const refreshAllData = async () => {
    if (automaticRefreshRunningRef.current) return;

    automaticRefreshRunningRef.current = true;

  try {
    // Volver a validar la sesión después de que la app estuvo suspendida
    const validUser = await validateSession();

    if (!validUser) {
      clearSession();
      setCurrentUser(null);
      return;
    }

    if (checkSuperuser(validUser)) return;

    // validateSession también reconstruye el cliente con el token vigente.
    currentUserRef.current = validUser;
    setCurrentUser(validUser);

    await Promise.all([
      refetchRoomsRef.current(),
      refetchStaysRef.current(),
      refetchHotelConfigRef.current(),
    ]);
  } catch (error) {
    console.error(
      'Error al recuperar la aplicación después de la suspensión:',
      error,
    );
  } finally {
    automaticRefreshRunningRef.current = false;
  }
};

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshAllData();
    }
  };

  const handleFocus = () => {
    refreshAllData();
  };

  const handlePageShow = () => {
    refreshAllData();
  };

  const handleOnline = () => {
    refreshAllData();
  };

  initAuth();

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  );

  window.addEventListener('focus', handleFocus);
  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('online', handleOnline);

  return () => {
    cancelled = true;

    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('pageshow', handlePageShow);
    window.removeEventListener('online', handleOnline);
  };

}, []);

  // Carga inicial y recarga cuando cambia la sesión o el tenant. Debe vivir en
  // el nivel superior del componente para cumplir las reglas de Hooks.
  useEffect(() => {
    if (!tenantId || !currentUser || checkSuperuser(currentUser)) return;

    const timer = window.setTimeout(() => {
      Promise.all([
        refetchRoomsRef.current(),
        refetchStaysRef.current(),
        refetchHotelConfigRef.current(),
      ]).catch(error => {
        console.error('Error al cargar los datos del tenant:', error);
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [tenantId, currentUser]);

  useEffect(() => {
    if (!hotelConfig.notifications_enabled) return;
    const now = new Date();
    const [configuredHour, configuredMinute] = (hotelConfig.notification_time || '07:00').split(':').map(Number);
    const scheduledTime = new Date(now);
    scheduledTime.setHours(configuredHour, configuredMinute, 0, 0);
    if (now >= scheduledTime) scheduledTime.setDate(scheduledTime.getDate() + 1);
    const timer = window.setTimeout(() => setNotificationClock(Date.now()), scheduledTime.getTime() - now.getTime());
    return () => window.clearTimeout(timer);
  }, [notificationClock, hotelConfig.notifications_enabled, hotelConfig.notification_time]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'OPEN_TODAY_DEPARTURES') setActiveTab('stays');
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    if (requestedSection === 'stays') {
      setActiveTab('stays');
      window.history.replaceState({}, '', window.location.pathname);
    }
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const todayForNotifications = localTodayStr();
  const notificationTime = new Date(notificationClock);
  const [configuredNotificationHour, configuredNotificationMinute] = (hotelConfig.notification_time || '07:00').split(':').map(Number);
  const afterSevenAm = hotelConfig.notifications_enabled && (
    notificationTime.getHours() > configuredNotificationHour ||
    (notificationTime.getHours() === configuredNotificationHour && notificationTime.getMinutes() >= configuredNotificationMinute)
  );
  const departuresForNotification = stays.filter(stay =>
    (stay.status === 'active' || stay.status === 'baja') &&
    notificationDepartureDate(stay) <= todayForNotifications
  );

  const showBrowserDepartureNotification = async () => {
    if (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY) return;
    if (notificationOptOutKey && localStorage.getItem(notificationOptOutKey) === 'true') return;
    if (!currentUser || !tenantId || !afterSevenAm || departuresForNotification.length === 0) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const configuredTimeKey = (hotelConfig.notification_time || '07:00').slice(0, 5).replace(':', '');
    const notificationKey = `departure_notification_${configuredTimeKey}_${tenantId}_${currentUser.id}_${todayForNotifications}`;
    if (localStorage.getItem(notificationKey)) return;

    const departureDetails = departuresForNotification.map(stay => notificationLine(
      `${stay.rooms?.number ?? '—'} · ${stay.guests?.name?.trim() || 'Huésped'} · ${stay.empresa?.trim() || 'Particular'}`
    )).join('\n');
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(
      `${departuresForNotification.length} ${departuresForNotification.length === 1 ? 'huésped sale' : 'huéspedes salen'} hoy`,
      {
        body: departureDetails,
        icon: '/MyHotel_logo_transparente.png',
        badge: '/MyHotel_logo_transparente.png',
        tag: `departures-${tenantId}-${todayForNotifications}`,
      }
    );
    localStorage.setItem(notificationKey, 'shown');
  };

  useEffect(() => {
    showBrowserDepartureNotification().catch(error => {
      console.error('No se pudo mostrar la notificación de salidas:', error);
    });
  // La lista se recalcula desde stays y el reloj diario.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationClock, notificationPermission, stays, tenantId, currentUser]);

  const requestBrowserNotifications = async () => {
    setPushSubscriptionError('');
    try {
      if (!('Notification' in window)) throw new Error('Este navegador no admite notificaciones.');
      if (notificationOptOutKey) localStorage.removeItem(notificationOptOutKey);
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        throw new Error('El navegador no concedió permiso para mostrar notificaciones.');
      }
      await registerWebPushSubscription();
      await showBrowserDepartureNotification();
    } catch (error) {
      const message = errorMessage(error, 'No se pudo activar este dispositivo.');
      setPushSubscriptionError(message);
      setPushSubscriptionActive(false);
    }
  };

  const registerWebPushSubscription = async () => {
    const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!currentUser || !('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
    setPushSubscriptionLoading(true);
    try {
      if (notificationOptOutKey && localStorage.getItem(notificationOptOutKey) === 'true') {
        setPushSubscriptionActive(false);
        return;
      }
      if (!publicKey) {
        throw new Error('La clave pública Web Push no está configurada en este despliegue.');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('El navegador creó una suscripción incompleta.');
      }
      const { error } = await getClient().rpc('register_push_subscription', {
        p_session_token: currentUser.sessionToken,
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      setPushSubscriptionError('');
      setPushSubscriptionActive(true);
    } finally {
      setPushSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    if (notificationPermission !== 'granted' || !currentUser || currentUser.role === 'demo') return;
    registerWebPushSubscription().catch(error => {
      console.error('No se pudo registrar este dispositivo para Web Push:', error);
      setPushSubscriptionError(errorMessage(error, 'No se pudo registrar este dispositivo.'));
      setPushSubscriptionActive(false);
    });
  // Se vuelve a registrar al cambiar la sesión o el permiso del dispositivo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationPermission, currentUser?.id, tenantId]);

  const sendTestNotification = async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Notificaciones activadas', {
      body: 'Las alertas de salidas del hotel están funcionando correctamente.',
      icon: '/MyHotel_logo_transparente.png',
      badge: '/MyHotel_logo_transparente.png',
      tag: 'hotel-notification-test',
    });
  };

  const clearLocalNotifications = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach(notification => notification.close());
    }

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('departure_notification_')) localStorage.removeItem(key);
    }
  };

  const disableDeviceNotifications = async () => {
    setPushSubscriptionLoading(true);
    setPushSubscriptionError('');
    if (notificationOptOutKey) localStorage.setItem(notificationOptOutKey, 'true');

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription && currentUser) {
          const { error } = await getClient().rpc('unregister_push_subscription', {
            p_session_token: currentUser.sessionToken,
            p_endpoint: subscription.endpoint,
          });
          if (error) throw error;
          await subscription.unsubscribe();
        }
      }

      await clearLocalNotifications();
      setPushSubscriptionActive(false);
    } catch (error) {
      setPushSubscriptionError(errorMessage(error, 'No se pudo desactivar este dispositivo.'));
    } finally {
      setPushSubscriptionLoading(false);
    }
  };


  // Force operational non-admin users back to the sections allowed by their role.
  useEffect(() => {
    if (!currentUser || checkAdmin(currentUser) || currentUser.role === 'demo') return;
    const allowed: Tab[] = ['dashboard', 'stays'];
    if (!allowed.includes(activeTab)) setActiveTab('dashboard');
  }, [currentUser, activeTab]);

  // Only show the full-screen loader when there is truly nothing to display
  // (first visit or post-logout redirect before login screen renders)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-zinc-700 flex items-center justify-center">
            <Hotel className="w-6 h-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-zinc-600 border-t-gray-800 dark:border-t-zinc-200 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">Cargando...</p>
        </div>
      </div>
    );
  }

 if (!currentUser) {
  return (
    <LoginScreen
      onLogin={(user) => {
        setSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
        setActiveTab('dashboard');
        setCurrentUser(user);
      }}
    />
  );
}

if (currentUser.mustChangePassword) {
  return <ChangeInitialPassword user={currentUser} onDone={() => setCurrentUser({ ...currentUser, mustChangePassword: false })} />;
}

// Superuser sees tenant management UI
if (checkSuperuser(currentUser)) {
    return (
      <TenantManager
        onLogout={() => { logout(); setCurrentUser(null); }}
      />
    );
  }

  const admin = checkAdmin(currentUser);
  const demo = currentUser.role === 'demo';
  const adminView = admin || demo;

 const handleLogout = () => {
  logout();
  setCurrentUser(null);
};

  const handleCheckIn = (room: Room) => {
    setSelectedRoom(room);
    setShowCheckIn(true);
  };

  const handleCheckOut = async (room: Room, stay: StayWithDetails | undefined) => {
    if (!stay) return;

    // Last night slept = today - 1 (local date)
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const lastNightStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    // Same-day checkout: the guest checked in today but no night was slept
    const isSameDay = lastNightStr < stay.check_in_date;

    if (isSameDay) {
      if (!confirm(
        `Confirmar salida del huesped ${stay.guests.name} de habitacion ${room.number}?\n\n` +
        `Esta salida no se registrará en el historial. ¿Deseas continuar?`
      )) return;
      // Delete the stay entirely and free the room
      await getClient().from('stays').delete().eq('id', stay.id);
      await getClient().from('rooms').update({ status: 'available' }).eq('id', room.id);
      refetchRooms();
      refetchStays();
      return;
    }

    if (!confirm(`Confirmar salida del huesped ${stay.guests.name} de habitacion ${room.number}?`)) return;

    const stayUpdates: Record<string, unknown> = { status: 'completed' };


    // Always record the actual last night, whether early or late checkout
    if (lastNightStr !== stay.check_out_date) {
      stayUpdates.check_out_date = lastNightStr;

      // Recalculate total proportionally only for early checkouts
      if (lastNightStr < stay.check_out_date && stay.total_amount != null) {
        const actualNights =
          Math.round(
            (new Date(lastNightStr + 'T12:00:00').getTime() -
              new Date(stay.check_in_date + 'T12:00:00').getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1;

        const scheduledNights = Math.round(
          (new Date(stay.check_out_date + 'T12:00:00').getTime() -
            new Date(stay.check_in_date + 'T12:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

        if (scheduledNights > 0) {
          const ratePerNight = stay.total_amount / scheduledNights;
          stayUpdates.total_amount = actualNights > 0
            ? Math.round(actualNights * ratePerNight * 100) / 100
            : 0;
        }
      }
    }

    await getClient().from('stays').update(stayUpdates).eq('id', stay.id);
    await getClient().from('rooms').update({ status: 'cleaning' }).eq('id', room.id);

    refetchRooms();
    refetchStays();
  };

  const handleCheckInSuccess = () => {
    setShowCheckIn(false);
    setSelectedRoom(null);
    refetchRooms();
    refetchStays();
  };

  // todayStr = today's date
  const todayStr = (() => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  })();

  // check_out_date always stores the last night slept; departure is the next day.
  function stayDepartureDateStr(s: StayWithDetails): string {
    const d = new Date(s.check_out_date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  // Guests departing today or overdue — shown in "Salidas de hoy"
  const todayDepartures = stays.filter(
    s => (s.status === 'active' || s.status === 'baja') && stayDepartureDateStr(s) <= todayStr
  );

  const activeStays = stays.filter(s => s.status === 'active' && stayDepartureDateStr(s) > todayStr);
  const bajaStays = stays.filter(s => s.status === 'baja' && stayDepartureDateStr(s) > todayStr);

  function matchesSearch(s: StayWithDetails, q: string): boolean {
    if (!q) return true;
    const lower = q.toLowerCase();
    return (
      s.guests.name.toLowerCase().includes(lower) ||
      s.guests.dni.includes(lower) ||
      (s.empresa?.toLowerCase().includes(lower) ?? false) ||
      (s.rooms?.number.includes(lower) ?? false)
    );
  }

  const filteredTodayDepartures = todayDepartures.filter(s => matchesSearch(s, guestSearch));
  const filteredActiveStays = activeStays.filter(s => matchesSearch(s, guestSearch));
  const filteredBajaStays = bajaStays.filter(s => matchesSearch(s, guestSearch));

  type NavItem = { tab: Tab; label: string; icon: typeof LayoutDashboard; visible: boolean };
  const navItems: NavItem[] = [
    { tab: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, visible: true },
    { tab: 'stays',     label: 'Huespedes',    icon: Users,           visible: canViewStays(currentUser) },
    { tab: 'history',   label: 'Reportes', icon: BarChart3, visible: adminView },
    { tab: 'settings',  label: 'Habitaciones', icon: Building2,       visible: adminView },
    { tab: 'users',     label: 'Usuarios',     icon: UsersRound,      visible: adminView },
    { tab: 'config',    label: 'Configuración', icon: Settings,       visible: adminView },
  ];

  const visibleNav = navItems.filter(item => item.visible);

  const pageTitle: Record<Tab, string> = {
    dashboard: 'Habitaciones',
    stays:     'Huespedes Activos',
    history:   'Reportes',
    settings:  'Gestion de Habitaciones',
    users:     'Usuarios del Sistema',
    config:    'Configuracion del Hotel',
  };
  const pageSubtitle: Record<Tab, string> = {
    dashboard: 'Estado actual de todas las habitaciones',
    stays:     'Estancias activas',
    history:   'Registro completo de todas las estancias finalizadas',
    settings:  'Crear y administrar pisos y habitaciones',
    users:     'Administrar accesos y permisos del sistema',
    config:    'Nombre, logo y datos del establecimiento',
  };

  const logoUrl = hotelConfig.logo_url;
  const hotelName = hotelConfig.name;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
  className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-zinc-900 shadow-xl transform transition-transform duration-300 ${
    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
  }`}
>
        <div className="h-full flex flex-col">
          {/* Brand */}
          <div className="px-4 py-5 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt={hotelName} className="w-full h-full object-contain" />
                  ) : (
                    <Hotel className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-gray-900 dark:text-white truncate">{hotelName}</h1>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Sistema de Gestion</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={() => setSidebarPinned(current => !current)}
                  className={`hidden lg:block p-1 rounded transition-colors ${sidebarPinned ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                  title={sidebarPinned ? 'Quitar menú fijo' : 'Dejar menú fijo'}
                  aria-label={sidebarPinned ? 'Quitar menú fijo' : 'Dejar menú fijo'}
                  aria-pressed={sidebarPinned}
                >
                  {sidebarPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded shrink-0"
                  title="Cerrar menú"
                  aria-label="Cerrar menú"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {visibleNav.map(({ tab, label, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (!effectiveSidebarPinned) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab
                    ? 'bg-gray-900 dark:bg-zinc-700 text-white shadow-sm'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
                {tab === 'stays' && todayDepartures.length > 0 && (
                  <span className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'stays'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  }`}>
                    <BellRing className="w-3 h-3" />
                    {todayDepartures.length}
                  </span>
                )}
              </button>
            ))}

          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 space-y-2">
            {theme === 'puchi' && (
              <div className="flex items-end justify-center pb-1">
                <img
                  src={sidebarPuchiBlinking ? '/puchi-senalando-cerrado.png' : '/puchi-senalando-abierto.png'}
                  alt="Puchi"
                  className="h-[62px] w-auto max-w-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
                />
              </div>
            )}
            {/* User info */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <div className={`p-1.5 rounded-lg ${admin ? 'bg-gray-200 dark:bg-zinc-700' : 'bg-green-100 dark:bg-green-900/40'}`}>
                {admin
                  ? <ShieldCheck className="w-4 h-4 text-gray-700 dark:text-zinc-300" />
                  : <UserCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">{currentUser.displayName}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{demo ? 'Recorrido de solo lectura' : admin ? 'Administrador' : 'Recepcionista'}</p>
              </div>
            </div>

            {currentUser.role === 'receptionist' && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setReceptionistNotificationsOpen(open => !open)}
                  aria-expanded={receptionistNotificationsOpen}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <BellRing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="flex-1">Notificaciones</span>
                  {pushSubscriptionActive && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Activadas en este dispositivo" />}
                  {receptionistNotificationsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {receptionistNotificationsOpen && (
                  <div className="space-y-2 border-t border-gray-200 p-2.5 dark:border-zinc-700">
                    <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-zinc-800">
                      <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">Horario configurado por el administrador</p>
                      <p className="mt-1 text-sm font-bold text-gray-800 dark:text-zinc-100">
                        {hotelConfig.notifications_enabled
                          ? `${(hotelConfig.notification_time || '07:00').slice(0, 5)} · Avisos activos`
                          : 'Avisos desactivados por el administrador'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-zinc-700">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Notificaciones en este dispositivo</p>
                        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                          {pushSubscriptionLoading ? 'Actualizando…' : pushSubscriptionActive ? 'Activadas' : 'Desactivadas'}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={pushSubscriptionActive}
                        aria-label="Notificaciones en este dispositivo"
                        onClick={pushSubscriptionActive ? disableDeviceNotifications : requestBrowserNotifications}
                        disabled={pushSubscriptionLoading || (!pushSubscriptionActive && notificationPermission === 'denied')}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pushSubscriptionActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'}`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${pushSubscriptionActive ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    {pushSubscriptionError && (
                      <p className="rounded-lg bg-red-50 px-2.5 py-2 text-[11px] leading-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        {pushSubscriptionError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={sendTestNotification}
                      disabled={!pushSubscriptionActive || notificationPermission !== 'granted'}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Probar notificación
                    </button>
                    {notificationPermission === 'denied' && (
                      <p className="px-1 text-[11px] leading-4 text-amber-600 dark:text-amber-400">Habilita las notificaciones desde los permisos del navegador para este sitio.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-sm"
            >
              {theme === 'light'
                ? <><Moon className="w-4 h-4" /> Modo oscuro</>
                : theme === 'dark'
                  ? <><Sparkles className="w-4 h-4" /> Estilo Puchi</>
                  : <><Sun className="w-4 h-4" /> Modo claro</>
              }
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-zinc-900 shadow-sm dark:shadow-zinc-800/50 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
            <Menu className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={hotelName} className="w-full h-full object-contain" />
              ) : (
                <Hotel className="w-4 h-4 text-white" />
              )}
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">{hotelName}</span>
          </div>
          <button
  onClick={() => {
    if (rooms.length === 0) return;
    setShowCheckIn(true);
  }}
  disabled={rooms.length === 0}
  className={`p-2 rounded-lg ${
    rooms.length === 0
      ? "bg-gray-300 cursor-not-allowed"
      : "bg-green-600 hover:bg-green-700"
  }`}
>
  <Plus
    className={`w-5 h-5 ${
      rooms.length === 0 ? "text-gray-500" : "text-white"
    }`}
  />
</button>
        </div>
      </header>

      {/* Main Content */}
      <main
  className={`pt-16 lg:pt-0 transition-all duration-300 ${
    sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
  }`}
>
        <div className="p-4 lg:p-8">
          {demo && <div className="mb-5 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200">Estás recorriendo la demostración. Los datos son ficticios y no pueden modificarse.</div>}
          {tenantId && <TenantMessages tenantId={tenantId} />}
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{pageTitle[activeTab]}</h2>
              <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">{pageSubtitle[activeTab]}</p>
            </div>

            {activeTab === 'dashboard' ? (
             <div className="flex items-center gap-2">
  {activeTab === 'dashboard' ? (
    <button
      onClick={() => setShowCheckIn(true)}
      disabled={rooms.length === 0}
      className={`hidden lg:flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors shadow-sm font-semibold ${
        rooms.length === 0
          ? 'cursor-not-allowed bg-gray-300 text-gray-500'
          : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
      }`}
    >
      <Plus className="h-5 w-5" />
      Nuevo ingreso
    </button>
  ) : activeTab === 'stays' && canViewStays(currentUser) ? (
    <button
      onClick={() => setShowCheckIn(true)}
      disabled={rooms.length === 0}
      className={`hidden lg:flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors shadow-sm font-semibold ${
        rooms.length === 0
          ? 'cursor-not-allowed bg-gray-300 text-gray-500'
          : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
      }`}
    >
      <Plus className="h-5 w-5" />
      Nuevo ingreso
    </button>
  ) : null}
</div>
            ) : activeTab === 'stays' && canViewStays(currentUser) ? (
              <button
                onClick={() => setShowCheckIn(true)}
                className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm font-semibold"
              >
                <Plus className="w-5 h-5" />
                Nuevo ingreso
              </button>
            ) : null}
          </div>

          {activeTab === 'dashboard' && (
            roomsLoading && rooms.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-8 h-8 text-gray-400 dark:text-zinc-600 animate-spin" />
              </div>
            ) : (
              <Dashboard
  tenantId={tenantId ?? ''}
  sessionToken={currentUser.sessionToken}
  rooms={rooms}
  stays={stays}
  onCheckIn={handleCheckIn}
  onCheckOut={handleCheckOut}
  onUpdate={() => {
    refetchRooms();
    refetchStays();
  }}
  canEditFloorPlan={checkCanEditPlan(currentUser)}
  canManageRooms={admin}
  readOnly={demo}
  onGoToRooms={() => setActiveTab('settings')}
/>
            )
          )}

          {activeTab === 'stays' && canViewStays(currentUser) && (
            <div className="space-y-6">
              {/* Search bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  placeholder="Buscar por nombre, DNI, empresa o habitacion..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-zinc-500"
                />
                {guestSearch && (
                  <button
                    onClick={() => setGuestSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {todayDepartures.length > 0 && (
                <section className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
                  <button type="button" onClick={() => setShowDepartureCards(current => !current)}
                    aria-expanded={showDepartureCards}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="flex-1 font-bold text-blue-900 dark:text-blue-200">Salidas de hoy o pendientes</h3>
                    <span className="px-2.5 py-0.5 bg-blue-200/70 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
                      {todayDepartures.length}
                    </span>
                    {showDepartureCards ? <ChevronUp className="w-5 h-5 text-blue-500" /> : <ChevronDown className="w-5 h-5 text-blue-500" />}
                  </button>
                  {showDepartureCards && (
                    <div className="px-4 pb-4 pt-1 border-t border-blue-200 dark:border-blue-800">
                      {filteredTodayDepartures.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-3">
                          {filteredTodayDepartures.map(stay => (
                            <StayCard key={stay.id} stay={stay}
                              onUpdate={() => { refetchStays(); refetchRooms(); }} currentUser={currentUser} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-blue-600 dark:text-blue-400 py-4 text-center">Ninguna salida coincide con la búsqueda.</p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {staysLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-8 h-8 text-gray-400 dark:text-zinc-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-8">
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-100">Estancias Activas</h3>
                      <span className="px-2.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold">
                        {filteredActiveStays.length}
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredActiveStays.map(stay => (
                        <StayCard
                          key={stay.id}
                          stay={stay}
                          onUpdate={() => { refetchStays(); refetchRooms(); }}
                          currentUser={currentUser}
                        />
                      ))}
                    </div>
                    {filteredActiveStays.length === 0 && (
                      <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <Users className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-gray-400 dark:text-zinc-500 font-medium">
                          {guestSearch ? 'No se encontraron resultados' : 'No hay estancias activas'}
                        </p>
                      </div>
                    )}
                  </section>

                  {filteredBajaStays.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-100">En Periodo de Baja</h3>
                        <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-semibold">
                          {filteredBajaStays.length}
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredBajaStays.map(stay => (
                          <StayCard
                            key={stay.id}
                            stay={stay}
                            onUpdate={() => { refetchStays(); refetchRooms(); }}
                            currentUser={currentUser}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && adminView && (
            <StayHistory
              tenantId={tenantId!}
              rooms={rooms}
              canDelete={canDeleteHistory(currentUser)}
              canValorizacion={canExportValorizacion(currentUser) || demo}
              canEditStays={currentUser.role === 'admin' && !demo}
              sessionToken={currentUser.sessionToken}
              onStaysUpdated={async () => {
                await Promise.all([refetchStays(), refetchRooms()]);
              }}
              onExportValorizacion={(options) => {
                if (!options) return;
                setExportOptions(options);
                setShowExport(true);
              }}
            />
          )}

          {activeTab === 'settings' && adminView && (
            <RoomManager tenantId={tenantId!} sessionToken={currentUser.sessionToken} rooms={rooms} stays={stays} onUpdate={() => refetchRooms()} readOnly={demo} />
          )}

          {activeTab === 'users' && (canManageUsers(currentUser) || demo) && (
            <UserManager currentUser={currentUser} tenantId={tenantId!} readOnly={demo} />
          )}

          {activeTab === 'config' && adminView && (
            <HotelConfig
              config={hotelConfig}
              onSave={saveHotelConfig}
              notificationPermission={notificationPermission}
              pushSubscriptionActive={pushSubscriptionActive}
              pushSubscriptionLoading={pushSubscriptionLoading}
              pushSubscriptionError={pushSubscriptionError}
              onToggleNotifications={pushSubscriptionActive ? disableDeviceNotifications : requestBrowserNotifications}
              onSendTestNotification={sendTestNotification}
            />
          )}
        </div>
      </main>

      {showExport && (
        <ExportValorizacion
          tenantId={tenantId!}
          initialEmpresa={exportOptions?.empresa}
          initialStartDate={exportOptions?.startDate}
          initialEndDate={exportOptions?.endDate}
          onClose={() => { setShowExport(false); setExportOptions(null); }}
        />
      )}

      {showCheckIn && (
        <CheckInForm
          tenantId={tenantId!}
          rooms={rooms}
          preselectedRoom={selectedRoom}
          onSuccess={handleCheckInSuccess}
          onCancel={() => { setShowCheckIn(false); setSelectedRoom(null); }}
          isAdmin={admin}
          readOnly={demo}
          defaultCompany={demo ? 'MMG' : ''}
        />
      )}

      {sidebarOpen && (
        <div
          onClick={() => { if (!effectiveSidebarPinned) setSidebarOpen(false); }}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}
    </div>
  );
}

export default App;
