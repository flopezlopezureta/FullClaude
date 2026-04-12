
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, 
  Map, 
  Package, 
  MessageSquare, 
  BarChart3, 
  Zap, 
  ArrowRight, 
  Check, 
  Target,
  Globe,
  Smartphone,
  Shield
} from 'lucide-react';
import { IconMercadoLibre } from '../components/Icon';

const LandingPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [currentImage, setCurrentImage] = useState(0);
  const images = [
    {
      url: '/assets/landing/dashboard.png',
      title: 'Monitoreo en Tiempo Real',
      desc: 'Control total de tu flota con mapas dinámicos y analíticas en vivo.'
    },
    {
      url: '/assets/landing/driver.png',
      title: 'App Nativa para Conductores',
      desc: 'Optimización de rutas y confirmación de entregas con fotos y firma digital.'
    },
    {
      url: '/assets/landing/warehouse.png',
      title: 'Gestión de Bodega Inteligente',
      desc: 'Sincronización automática con Mercado Libre para una recepción sin errores.'
    },
    {
      url: '/assets/landing/customer.png',
      title: 'Experiencia de Cliente Premium',
      desc: 'Seguimiento público en tiempo real y notificaciones automáticas.'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: <IconMercadoLibre className="w-8 h-8 text-blue-600" />,
      title: "Mercado Libre Sync",
      desc: "Sincronización automática de pedidos Flex y generación de etiquetas oficiales."
    },
    {
      icon: <Map className="w-8 h-8 text-indigo-600" />,
      title: "Mapas en Vivo",
      desc: "Visualiza la ubicación exacta de tus conductores y el progreso de las rutas."
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-blue-500" />,
      title: "Omnicanalidad",
      desc: "Notificaciones por WhatsApp y Email automáticas para cada evento de entrega."
    },
    {
      icon: <Globe className="w-8 h-8 text-indigo-700" />,
      title: "Cobertura Total",
      desc: "Gestión eficiente de zonas de entrega y conductores asignados por comuna."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-blue-700" />,
      title: "Reportes Avanzados",
      desc: "Analítica detallada de rendimiento, pagos y métricas operativas."
    },
    {
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      title: "Circuit Integration",
      desc: "Optimización de rutas masivas con exportación directa a Circuit Route Planner."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
            <span className="text-2xl font-black text-blue-900 tracking-tight">FULL ENVIOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-bold text-slate-600">
            <a href="#funciones" className="hover:text-blue-600 transition-colors">Funciones</a>
            <a href="#planes" className="hover:text-blue-600 transition-colors">Precios</a>
            <button 
              onClick={onLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              Ingresar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              V2.4 • Logística Inteligente
            </span>
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-tight mb-6">
              Potencia tus <br/>
              <span className="text-blue-600">Envíos de Última Milla</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-lg leading-relaxed">
              La plataforma definitiva para operadores logísticos. Controla tu flota, automatiza tus procesos y fideliza a tus clientes con tecnología de vanguardia.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={onLogin}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-200"
              >
                Empezar Ahora <ArrowRight size={20} />
              </button>
              <button className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-lg hover:border-blue-200 hover:text-blue-600 transition-all">
                Ver Demo
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[3rem] p-2 shadow-2xl relative z-10 overflow-hidden aspect-video flex items-center justify-center">
               <img src="/assets/landing/dashboard.png" className="w-full h-full object-cover rounded-[2.5rem]" />
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-yellow-400 rounded-full blur-3xl opacity-20 -z-10" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-400 rounded-full blur-3xl opacity-20 -z-10" />
          </div>
        </div>
      </section>

      {/* Image Carousel Train */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl h-[500px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImage}
                src={images[currentImage].url}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-blue-900/20" />
            <div className="absolute bottom-10 left-10 text-white">
              <motion.h3 
                key={`t-${currentImage}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-black mb-2"
              >
                {images[currentImage].title}
              </motion.h3>
              <motion.p 
                key={`d-${currentImage}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-lg font-medium opacity-90"
              >
                {images[currentImage].desc}
              </motion.p>
            </div>
          </div>
          <div className="flex justify-center gap-3 mt-8">
            {images.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`h-2 rounded-full transition-all ${i === currentImage ? 'w-12 bg-blue-600' : 'w-2 bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funciones" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-slate-900 mb-4">Funciones de Nivel Superior</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-16">Todo lo que necesitas para escalar tu operación logística en una sola plataforma integrada.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="p-8 bg-white rounded-3xl border border-slate-100 hover:shadow-xl transition-shadow text-left">
                <div className="mb-6 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                  {f.icon}
                </div>
                <h4 className="text-xl font-bold mb-3">{f.title}</h4>
                <p className="text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planes" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-slate-900 mb-16">Planes para cada Etapa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 rounded-3xl border border-slate-200 hover:border-blue-600 transition-colors">
               <h3 className="text-xl font-bold mb-2">Básico</h3>
               <p className="text-3xl font-black mb-6">Gratis <span className="text-sm font-medium text-slate-400">/ 50 envíos</span></p>
               <ul className="text-left space-y-4 mb-8 text-slate-600 font-medium">
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Sincronización ML</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> App de Conductor</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Seguimiento Público</li>
               </ul>
               <button onClick={onLogin} className="w-full py-3 rounded-xl border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 font-bold transition-all">Empezar</button>
            </div>
            <div className="p-10 rounded-3xl border-2 border-blue-600 bg-blue-50 relative">
               <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Más Popular</div>
               <h3 className="text-xl font-bold mb-2">Profesional</h3>
               <p className="text-3xl font-black mb-6">$49.990 <span className="text-sm font-medium text-slate-400">/ mes</span></p>
               <ul className="text-left space-y-4 mb-8 text-slate-600 font-medium">
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Envíos Ilimitados</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> WhatsApp Ilimitado</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Reportes Estadísticos</li>
               </ul>
               <button onClick={onLogin} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">Suscribirse</button>
            </div>
            <div className="p-10 rounded-3xl border border-slate-200 hover:border-blue-600 transition-colors">
               <h3 className="text-xl font-bold mb-2">Empresarial</h3>
               <p className="text-3xl font-black mb-6">Cotizar <span className="text-sm font-medium text-slate-400">/ personalizado</span></p>
               <ul className="text-left space-y-4 mb-8 text-slate-600 font-medium">
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> API Directa</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Soporte Dedicado</li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-green-500" /> Marca Blanca</li>
               </ul>
               <button onClick={onLogin} className="w-full py-3 rounded-xl border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 font-bold transition-all">Contactar</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Logo" className="h-8 brightness-0 invert" />
              <span className="text-xl font-black tracking-tight">FULL ENVIOS</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-6">Potenciando el ecosistema logístico en Chile con tecnología local y soporte de clase mundial.</p>
          </div>
          <div>
            <h5 className="font-bold mb-6">Producto</h5>
            <ul className="space-y-4 text-slate-400">
               <li><a href="#funciones" className="hover:text-white transition-colors">Funciones</a></li>
               <li><a href="#planes" className="hover:text-white transition-colors">Precios</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Seguimiento</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6">Contacto</h5>
            <ul className="space-y-4 text-slate-400">
               <li><a href="mailto:hola@fullenvios.cl" className="hover:text-white transition-colors">hola@fullenvios.cl</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Santiago, Chile</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          © 2026 Full Envios. Construido por SELCOM.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
