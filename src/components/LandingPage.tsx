import { useEffect, useState } from 'react';
import { BarChart3, BellRing, BedDouble, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, FileText, LogIn, Monitor, MousePointer2, PackageOpen, Smartphone, Tablet, Users } from 'lucide-react';
import { login } from '../lib/auth';

export function LandingPage() {
  const [blinking, setBlinking] = useState(false);
  const [valuationDemo, setValuationDemo] = useState<'ready' | 'creating' | 'done'>('ready');
  const [guidePage, setGuidePage] = useState(0);
  const [openingDemo, setOpeningDemo] = useState(false);
  const [demoError, setDemoError] = useState('');
  useEffect(() => {
    let timeout: number | undefined;
    const interval = window.setInterval(() => {
      setBlinking(true);
      timeout = window.setTimeout(() => setBlinking(false), 180);
    }, 3000);
    return () => { window.clearInterval(interval); if (timeout) window.clearTimeout(timeout); };
  }, []);

  const runValuationDemo = () => {
    if (valuationDemo === 'creating') return;
    setValuationDemo('creating');
    window.setTimeout(() => setValuationDemo('done'), 1300);
  };

  const openSystemDemo = async () => {
    if (openingDemo) return;
    setOpeningDemo(true);
    setDemoError('');
    const user = await login('demo', 'Demo2026');
    if (user) {
      window.location.href = '/';
      return;
    }
    setDemoError('La demostración todavía no está disponible.');
    setOpeningDemo(false);
  };

  const features = [
    { icon: BedDouble, title: 'Habitaciones', text: 'Controla disponibilidad, ocupación, limpieza y mantenimiento.' },
    { icon: Users, title: 'Huéspedes', text: 'Registra ingresos, salidas y datos de cada huésped.' },
    { icon: BarChart3, title: 'Valorizaciones mineras', text: 'Organiza estadías por empresa, trabajador y periodo para preparar valorizaciones con mayor rapidez.' },
    { icon: CreditCard, title: 'Pagos', text: 'Registra efectivo, tarjeta, Yape y Plin con comprobantes.' },
    { icon: BellRing, title: 'Notificaciones de bajada', text: 'Recibe en el celular avisos del personal que tiene salida o bajada programada.' },
  ];
  const valuationRows = [
    { name: 'Andrea Quispe Flores', type: 'Obrero', dni: '74821563', nights: [1, 1, 1, 1, 1, 1], rate: 'S/ 48.00', total: 'S/ 288.00' },
    { name: 'Luis Mamani Condori', type: 'Staff', dni: '70193624', nights: [1, 1, 1, 1, 0, 0], rate: 'S/ 68.00', total: 'S/ 272.00' },
    { name: 'Mariela Huamán Soto', type: 'Empleado', dni: '72984105', nights: [0, 1, 1, 1, 1, 1], rate: 'S/ 56.00', total: 'S/ 280.00' },
    { name: 'Carlos Apaza Yana', type: 'Obrero', dni: '76531029', nights: [0, 0, 1, 1, 1, 1], rate: 'S/ 48.00', total: 'S/ 192.00' },
  ];
  const guidePages = [
    { icon: BedDouble, title: 'Visualiza todo el hotel', text: 'Revisa en una sola pantalla qué habitaciones están libres, ocupadas, en limpieza o mantenimiento y registra un ingreso inmediatamente.', color: 'emerald', labels: ['Hab. 101 · Libre', 'Hab. 102 · Ocupada', 'Hab. 103 · En limpieza'] },
    { icon: Users, title: 'Administra tus huéspedes', text: 'Consulta estancias activas, salidas pendientes, empresa, habitación y datos de contacto desde tarjetas claras.', color: 'blue', labels: ['Lucía Mendoza · Hab. 204', 'Diego Salazar · Hab. 106', 'Elena Quispe · Hab. 301'] },
    { icon: BarChart3, title: 'Reportes y valorizaciones', text: 'Filtra por empresa, habitación o huésped y exporta historiales, CSV y valorizaciones de alojamiento.', color: 'cyan', labels: ['MMG · 18 noches', 'Minera Andina · 12 noches', 'Particular · 4 noches'] },
    { icon: BedDouble, title: 'Configura pisos y habitaciones', text: 'Crea habitaciones, define tipo, capacidad y tarifa, y distribúyelas por pisos de manera ordenada.', color: 'amber', labels: ['Piso 1 · 7 habitaciones', 'Piso 2 · 11 habitaciones', 'Agregar habitación'] },
    { icon: Users, title: 'Controla usuarios y permisos', text: 'Crea accesos separados para administradores y recepcionistas, cada uno con los permisos que necesita.', color: 'violet', labels: ['Andrea Torres · Administradora', 'Carlos Peña · Recepcionista', 'Nuevo usuario'] },
    { icon: CreditCard, title: 'Configura todos los datos del hotel', text: 'Guarda identidad, datos fiscales, firma, pagos con QR y el horario de notificaciones para tus valorizaciones.', color: 'emerald', labels: ['Datos del hospedaje', 'Valorización y firma', 'Pagos y notificaciones'] },
  ];

  return <div className="min-h-screen bg-slate-950 text-white">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <img src="/logovalstay.png" alt="ValStay" className="h-14 w-32 object-contain" />
        <a href="/" className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10"><LogIn className="h-4 w-4" />Iniciar sesión</a>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden px-5 pb-20 pt-14">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-sm font-semibold text-cyan-300">14 días de prueba gratuita</span>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">Tu hotel, más ordenado y listo para trabajar con el sector minero.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">ValStay reúne habitaciones, huéspedes, pagos y reportes en un solo lugar, con especial atención a los hospedajes que reciben personal de empresas mineras y necesitan preparar valorizaciones.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="https://wa.me/950336798?text=Hola%2C%20quiero%20probar%20ValStay%20durante%2014%20d%C3%ADas." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-3.5 font-bold shadow-lg shadow-cyan-950 hover:brightness-110">Probar gratis <ChevronRight className="h-5 w-5" /></a>
              <a href="/" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-semibold hover:bg-white/10">Ya tengo una cuenta</a>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <img src={blinking ? '/puchi-cerrado.png' : '/puchi-abierto.png'} alt="Puchi" className="h-64 w-64 object-contain drop-shadow-2xl" />
            <div className="-mt-8 max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur-xl">
              <p className="font-bold text-cyan-200">¡Hola! Soy Puchi</p>
              <p className="mt-1 text-sm text-slate-300">Te acompañaré para que administrar tu hotel sea mucho más sencillo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-7 rounded-3xl border border-violet-400/25 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-8 sm:flex-row sm:p-10">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] border border-violet-300/20 bg-slate-950 shadow-xl shadow-violet-950/40">
            <Smartphone className="h-12 w-12 text-violet-300" />
            <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white ring-4 ring-slate-950">3</span>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <span className="text-xs font-black uppercase tracking-widest text-violet-300">Avisos directamente en tu celular</span>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Conoce qué personal sale de bajada</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-300">Configura la hora del aviso y ValStay te mostrará mediante notificaciones del navegador qué huéspedes tienen salida o bajada programada, incluso desde tu celular.</p>
          </div>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-400/15 p-2 text-violet-300"><BellRing className="h-5 w-5" /></div><div><p className="text-sm font-bold">Salidas y bajadas de hoy</p><p className="mt-1 text-xs leading-5 text-slate-400">3 trabajadores tienen salida programada. Revisa sus habitaciones.</p></div></div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-orange-500/5 p-7 sm:p-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-amber-300">Especializado en operaciones mineras</span>
            <h2 className="mt-3 text-3xl font-black">Valorizaciones sin revisar habitación por habitación</h2>
            <p className="mt-4 leading-7 text-slate-300">Registra la empresa, el tipo de trabajador y las fechas de hospedaje. Luego consulta y exporta la información necesaria para sustentar los servicios brindados durante cada periodo.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {['Agrupación de huéspedes por empresa', 'Control de obreros, empleados y staff', 'Fechas de ingreso, salida y bajas', 'Exportación de valorizaciones y reportes'].map(item => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-200"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />{item}</div>)}
          </div>
        </div>
      </section>

      <section className="overflow-hidden px-5 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-cyan-300">Mira cómo funciona</span>
            <h2 className="mt-2 text-3xl font-black">Una valorización con un solo clic</h2>
            <p className="mt-2 text-slate-400">Prueba la demostración interactiva.</p>
          </div>

          <div className="relative mx-auto max-w-6xl rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-cyan-950/30 sm:p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /><span className="ml-3 text-xs text-slate-500">ValStay · Reportes y valorizaciones</span></div>
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="space-y-3 rounded-2xl bg-slate-950/70 p-4">
                <div><label className="text-[11px] font-bold uppercase text-slate-500">Empresa</label><div className="mt-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold">MMG</div></div>
                <div><label className="text-[11px] font-bold uppercase text-slate-500">Trabajadores</label><div className="mt-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm">4 huéspedes</div></div>
                <div><label className="text-[11px] font-bold uppercase text-slate-500">Documento</label><div className="mt-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm">Valorización de alojamiento</div></div>
                <button onClick={runValuationDemo} className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-3 py-3 text-sm font-bold transition-all ${valuationDemo === 'done' ? 'bg-emerald-600' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
                  {valuationDemo === 'creating' ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Generando...</> : valuationDemo === 'done' ? <><CheckCircle2 className="h-4 w-4" />¡Valorización lista!</> : <><MousePointer2 className="h-4 w-4 animate-bounce" />Generar valorización</>}
                </button>
              </div>

              <div className="relative min-h-[360px] overflow-x-auto rounded-2xl bg-slate-200 p-3 text-slate-900 sm:p-5">
                {valuationDemo === 'creating' && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white backdrop-blur-sm"><FileText className="h-12 w-12 animate-pulse text-cyan-300" /><p className="mt-3 font-bold">Organizando estadías y montos...</p><div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/15"><div className="h-full animate-pulse rounded-full bg-cyan-400" style={{ width: '78%' }} /></div></div>}
                <div className={`mx-auto h-full min-w-[610px] bg-white p-4 shadow-xl transition-all duration-700 ${valuationDemo === 'done' ? 'scale-100 opacity-100' : 'scale-[.97] opacity-75'}`}>
                  <div className="grid grid-cols-[100px_1fr_70px] items-start"><img src="/las-bambas-logo.svg" alt="Las Bambas" className="h-16 w-24 object-contain" /><div className="text-center"><p className="text-lg font-black">HOTEL CORDILLERA</p><p className="text-sm font-bold text-slate-600">VALORIZACIÓN DE ALOJAMIENTO</p></div><FileText className={`ml-auto h-8 w-8 ${valuationDemo === 'done' ? 'text-emerald-600' : 'text-slate-400'}`} /></div>
                  <div className="my-4 rounded bg-blue-200 py-2 text-center text-xs font-black">EMPRESA: MMG</div>
                  <div className="overflow-hidden border border-slate-300 text-[9px]">
                    <div className="grid grid-cols-[25px_1.5fr_55px_60px_repeat(6,25px)_35px_55px_65px] bg-blue-200 font-black"><span className="p-1">N°</span><span className="p-1">NOMBRES Y APELLIDOS</span><span className="p-1">CARGO</span><span className="p-1">DNI</span>{[1,2,3,4,5,6].map(n => <span key={n} className="p-1 text-center">N{n}</span>)}<span className="p-1">CANT.</span><span className="p-1">TARIFA</span><span className="p-1">TOTAL</span></div>
                    {valuationRows.map((row, index) => <div key={row.dni} className="grid grid-cols-[25px_1.5fr_55px_60px_repeat(6,25px)_35px_55px_65px] border-t border-slate-300"><span className="p-1 text-center">{index + 1}</span><span className="truncate p-1 font-semibold">{row.name}</span><span className="truncate p-1">{row.type}</span><span className="p-1">{row.dni}</span>{row.nights.map((night, nightIndex) => <span key={nightIndex} className={`border-l border-slate-300 p-1 text-center font-bold ${night ? 'bg-lime-400' : 'bg-white'}`}>{night || ''}</span>)}<span className="p-1 text-center font-bold">{row.nights.reduce((sum, night) => sum + night, 0)}</span><span className="p-1 text-right">{row.rate}</span><span className="p-1 text-right font-bold">{row.total}</span></div>)}
                  </div>
                  <div className="mt-4 ml-auto w-48 border border-slate-300 text-xs"><div className="flex justify-between bg-slate-200 p-2"><b>SUB TOTAL</b><b>S/ 1,032.00</b></div><div className="flex justify-between border-t border-slate-300 bg-slate-100 p-2"><b>IGV 18%</b><b>S/ 185.76</b></div><div className="flex justify-between border-t border-slate-300 bg-slate-300 p-2 text-sm"><b>TOTAL</b><b>S/ 1,217.76</b></div></div>
                  {valuationDemo === 'done' && <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Lista para exportar en PDF o Excel</div>}
                </div>
              </div>
            </div>
            <img src={blinking ? '/puchi-senalando-cerrado.png' : '/puchi-senalando-abierto.png'} alt="Puchi señalando la demostración" className="pointer-events-none absolute -bottom-10 -right-8 hidden h-36 w-36 object-contain drop-shadow-xl sm:block" />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center"><h2 className="text-3xl font-black">Todo lo que necesitas</h2><p className="mt-2 text-slate-400">Funciones claras para el trabajo diario de tu hotel.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {features.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 hover:border-cyan-500/30">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-5 w-5" /></div>
              <h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={openSystemDemo}
              disabled={openingDemo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-8 py-4 text-lg font-black text-white shadow-xl shadow-cyan-950/40 transition-all hover:scale-[1.02] hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {openingDemo ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <LogIn className="h-5 w-5" />}
              {openingDemo ? 'Abriendo demo...' : 'Mostrar demo'}
            </button>
            {demoError && <p className="mt-3 text-sm font-semibold text-red-400">{demoError}</p>}
          </div>

          <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950 p-3 shadow-2xl sm:p-6">
            <div className="grid min-h-[430px] overflow-hidden rounded-2xl bg-slate-100 text-slate-900 shadow-2xl lg:grid-cols-2">
              <div className="relative flex flex-col justify-center border-b border-slate-300 p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <div className="absolute bottom-0 right-0 top-0 w-px bg-slate-300 shadow-[4px_0_10px_rgba(15,23,42,.18)]" />
                <span className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">Página {guidePage + 1} de {guidePages.length}</span>
                {(() => { const Icon = guidePages[guidePage].icon; return <Icon className="mt-6 h-14 w-14 text-slate-800" />; })()}
                <h3 className="mt-5 text-3xl font-black">{guidePages[guidePage].title}</h3>
                <p className="mt-4 max-w-md leading-7 text-slate-600">{guidePages[guidePage].text}</p>
                <div className="mt-8 flex gap-2">
                  {guidePages.map((page, index) => <button key={page.title} onClick={() => setGuidePage(index)} aria-label={`Ir a página ${index + 1}`} className={`h-2 rounded-full transition-all ${index === guidePage ? 'w-8 bg-cyan-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />)}
                </div>
              </div>

              <div className="flex items-center justify-center bg-slate-200 p-5 sm:p-9">
                <div key={guidePage} className="w-full max-w-md animate-[pulse_0.5s_ease-out_1] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-2 text-[10px] text-slate-400">Vista de ValStay</span></div>
                  <div className="p-5">
                    <div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-slate-400">ValStay</p><p className="font-black">{guidePages[guidePage].title}</p></div><div className="rounded-lg bg-cyan-100 p-2 text-cyan-700">{(() => { const Icon = guidePages[guidePage].icon; return <Icon className="h-5 w-5" />; })()}</div></div>
                    <div className="mb-3 flex gap-2"><div className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-400">Buscar por nombre, empresa o habitación...</div><div className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white">+ Nuevo</div></div>
                    <div className={`grid gap-3 ${guidePage === 0 || guidePage === 3 ? 'sm:grid-cols-3' : ''}`}>{guidePages[guidePage].labels.map((label, index) => <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${guidePage === 0 ? index === 0 ? 'border-emerald-300' : index === 1 ? 'border-rose-300' : 'border-cyan-300' : 'border-slate-200'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${index === 0 ? 'bg-emerald-100 text-emerald-700' : index === 1 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{guidePage === 0 || guidePage === 3 ? String(101 + index) : index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{label}</p><div className="mt-1.5 h-1.5 w-3/4 rounded bg-slate-100" /></div>{guidePage !== 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}</div>)}</div>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setGuidePage(current => (current - 1 + guidePages.length) % guidePages.length)} className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white shadow-lg hover:bg-cyan-700" aria-label="Página anterior"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => setGuidePage(current => (current + 1) % guidePages.length)} className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white shadow-lg hover:bg-cyan-700" aria-label="Página siguiente"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-emerald-500/10 p-8 sm:p-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-cyan-300">Siempre conectado</span>
            <h2 className="mt-3 text-4xl font-black">Controla tu hotel desde cualquier lugar</h2>
            <p className="mt-4 leading-7 text-slate-300">Consulta habitaciones, huéspedes, pagos y notificaciones desde una computadora, tablet o celular. La interfaz se adapta automáticamente al tamaño de cada dispositivo.</p>
            <div className="mt-6 flex gap-5 text-slate-400"><span className="flex items-center gap-2 text-sm"><Monitor className="h-5 w-5 text-cyan-300" />Computadora</span><span className="flex items-center gap-2 text-sm"><Tablet className="h-5 w-5 text-cyan-300" />Tablet</span><span className="flex items-center gap-2 text-sm"><Smartphone className="h-5 w-5 text-cyan-300" />Celular</span></div>
          </div>
          <div className="relative min-h-[330px]">
            <div className="absolute left-0 top-3 w-[78%] rounded-xl border-4 border-slate-700 bg-slate-950 p-2 shadow-2xl"><div className="rounded-lg bg-slate-100 p-3"><div className="mb-3 h-3 w-28 rounded bg-slate-800" /><div className="grid grid-cols-3 gap-2">{['101', '102', '103', '201', '202', '203'].map((room, index) => <div key={room} className={`rounded-lg border p-3 ${index === 1 ? 'border-rose-300 bg-rose-50' : 'border-emerald-300 bg-emerald-50'}`}><b className="text-slate-800">{room}</b><div className={`mt-2 h-1.5 rounded ${index === 1 ? 'bg-rose-400' : 'bg-emerald-400'}`} /></div>)}</div></div></div>
            <div className="absolute bottom-0 right-[12%] w-[38%] rounded-xl border-4 border-slate-600 bg-slate-900 p-2 shadow-2xl"><div className="rounded-lg bg-white p-3"><div className="mb-3 h-2.5 w-20 rounded bg-slate-800" />{['Huéspedes', 'Salidas', 'Pagos'].map(item => <div key={item} className="mb-2 rounded border border-slate-200 p-2 text-[9px] font-bold text-slate-700">{item}</div>)}</div></div>
            <div className="absolute bottom-2 right-0 w-[22%] rounded-[1.4rem] border-4 border-slate-700 bg-slate-950 p-1.5 shadow-2xl"><div className="rounded-[1rem] bg-white p-2"><div className="mx-auto mb-2 h-1 w-8 rounded bg-slate-300" />{['101 Libre', '102 Ocupada', 'Salida hoy'].map((item, index) => <div key={item} className={`mb-1.5 rounded p-1.5 text-[7px] font-bold ${index === 1 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{item}</div>)}</div></div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] p-8 text-center sm:flex-row sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><PackageOpen className="h-8 w-8" /></div>
          <div className="flex-1"><span className="text-xs font-black uppercase tracking-widest text-emerald-300">Próximamente</span><h2 className="mt-1 text-2xl font-black">Control de artículos de limpieza</h2><p className="mt-2 text-slate-300">Registra existencias, entradas y consumo de productos para habitaciones, lavandería y áreas comunes.</p></div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">En desarrollo</span>
        </div>
      </section>
    </main>
    <footer className="px-5 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} ValStay · By Rch</footer>
  </div>;
}
