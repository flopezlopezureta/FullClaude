
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
  Globe,
  Smartphone,
  Shield,
  ShoppingBag,
  Layers,
  Activity,
  Mail,
  Phone,
  User,
  Send,
  Menu,
  X as CloseIcon
} from 'lucide-react';
import { IconMercadoLibre } from '../components/Icon';

const LandingPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [currentImage, setCurrentImage] = useState(0);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [currentPlaybookPage, setCurrentPlaybookPage] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const images = [
    {
      url: '/assets/landing/hero_1.png',
      title: 'Logística de Próxima Generación',
      desc: 'Control total de tu operación con tecnología de punta y visualización en tiempo real.'
    },
    {
      url: '/assets/landing/hero_2.png',
      title: 'Rutas Inteligentes y Dinámicas',
      desc: 'Optimización basada en IA para reducir tiempos de entrega y costos operativos en toda la ciudad.'
    },
    {
      url: '/assets/landing/hero_3.png',
      title: 'Entrega de Última Milla',
      desc: 'Optimización de despachos y seguimiento en tiempo real para una experiencia de entrega superior.'
    },
    {
      url: '/assets/landing/hero_4.png',
      title: 'Ecosistema Conectado',
      desc: 'Integración fluida con tus canales de venta favoritos como Shopify, Mercado Libre y más.'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const integrations = [
    { name: "Shopify", color: "text-green-600" },
    { name: "Mercado Libre", color: "text-yellow-500" },
    { name: "WooCommerce", color: "text-purple-600" },
    { name: "Falabella", color: "text-orange-500" },
    { name: "Jumpseller", color: "text-blue-500" }
  ];

  const playbookPages = Array.from({ length: 12 }, (_, i) => ({
    url: `/assets/landing/playbook/Captura${i + 1}.PNG`,
    title: `Operación Detallada ${i + 1}`
  }));

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-indigo-600" />,
      title: "Rutas Optimizadas",
      desc: "Algoritmos inteligentes para reducir tiempos y costos de combustible en cada trayecto."
    },
    {
      icon: <Map className="w-8 h-8 text-pink-600" />,
      title: "Mapa en Vivo",
      desc: "Visualización en tiempo real de conductores, pedidos y estados de entrega dinámicos."
    },
    {
      icon: <IconMercadoLibre className="w-8 h-8 text-blue-600" />,
      title: "Integración Nativa",
      desc: "Importación masiva de pedidos desde Shopify, Mercado Libre y más con un solo clic."
    },
    {
      icon: <Activity className="w-8 h-8 text-indigo-700" />,
      title: "Reportes Avanzados",
      desc: "KPIs detallados sobre rendimiento de conductores, efectividad y tiempos de entrega."
    },
    {
      icon: <Package className="w-8 h-8 text-pink-500" />,
      title: "Gestión de Retiros",
      desc: "Automatización de solicitudes de recolección y asignación inmediata a transportistas."
    },
    {
      icon: <Shield className="w-8 h-8 text-indigo-500" />,
      title: "Seguridad y Control",
      desc: "Protocolos de entrega con foto, firma y geolocalización para total tranquilidad."
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      subtitle: "(Ruteo)",
      price: "5 UF",
      period: "/mes + IVA",
      setup: "Cancela cuando quieras",
      features: [
        "Órdenes: 3.000",
        "Software de ruteo (hasta 3 licencias)",
        "Integraciones Nativas (Shopify, WC, ML, PS, VTEX)",
        "Torre de control y Reportes descargables",
        "Portal Clientes (Carga y Status)",
        "Límite de clientes: 5",
        "Link de seguimiento y correos",
        "Generación de Etiquetas",
        "Fullenvios APP",
        "Escáner de etiquetas (0,5 UF por usuario)",
        <a href="https://wa.me/56985367387" target="_blank" className="text-indigo-600 hover:underline">Soporte WhatsApp (+56985367387)</a>
      ],
      footer: {
        orden: "0,005 UF netas",
        vehiculo: "1,5 UF netas"
      },
      highlight: false
    },
    {
      name: "Medium",
      subtitle: "(Ruteo)",
      price: "15 UF",
      period: "/mes + IVA",
      setup: "+ 15 UF (+ IVA) Setup / Implementación",
      features: [
        "Todo lo del plan Starter, más:",
        "Órdenes: 10.000",
        "Límite de clientes: 15",
        "Hasta 10 licencias módulo ruteo",
        "Posibilidad de integraciones (Costo adicional)",
        "Escáner de etiquetas (0,4 UF por usuario)",
        "Generación etiquetas Whitelabel",
        "Webhooks para sellers"
      ],
      footer: {
        orden: "0,004 UF netas",
        vehiculo: "1,2 UF netas"
      },
      highlight: true
    },
    {
      name: "Advanced",
      subtitle: "(Ruteo)",
      price: "40 UF",
      period: "/mes + IVA",
      setup: "+ 25 UF (+ IVA) Setup / Implementación",
      features: [
        "Todo lo del plan Medium, más:",
        "Órdenes: 30.000",
        "Clientes ilimitados",
        "Hasta 30 licencias módulo ruteo",
        "Whitelabel Full (etiquetas, correos, portal)",
        "Posibilidad de reportería avanzada",
        "Soporte full (WhatsApp y videollamada)",
        "Escáner de etiquetas (0,3 UF por usuario)"
      ],
      footer: {
        orden: "0,003 UF netas",
        vehiculo: "0,8 UF netas"
      },
      highlight: false
    }
  ];

  const [formState, setFormState] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simular envío
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setFormState({ name: '', email: '', phone: '', message: '' });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-900 scroll-smooth">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
               <img src="/assets/landing/logo_official.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-slate-900 uppercase">FULL ENVIOS</span>
              <span className="text-[9px] font-bold text-indigo-400 tracking-[0.2em] uppercase -mt-1">fullenvios.cl</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-10">
            <a href="#funciones" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Funciones</a>
            <a href="#precios" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Planes</a>
            <a href="#contacto" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Contacto</a>
            <a 
              href="https://fullenvios.selcom.cl"
              target="_blank"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              Acceso Cliente
            </a>
          </div>

          {/* Hamburger Menu Icon */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-slate-900"
          >
            {isMenuOpen ? <CloseIcon size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                <a href="#funciones" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-slate-800">Funciones</a>
                <a href="#precios" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-slate-800">Planes</a>
                <a href="#contacto" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-slate-800">Contacto</a>
                <a 
                  href="https://fullenvios.selcom.cl"
                  target="_blank"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg text-center"
                >
                  Acceso Cliente
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section - Full Width Carousel */}
      <section className="relative h-screen min-h-[700px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <div className="absolute inset-0 bg-black/40 z-10" /> {/* Overlay for contrast */}
            <img 
              src={images[currentImage].url} 
              alt={images[currentImage].title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-20 h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div className="max-w-3xl">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/20 backdrop-blur-md border border-indigo-400/30 text-indigo-100 rounded-full text-xs font-black tracking-widest uppercase mb-8"
            >
              <ShoppingBag size={14} /> Logística para tu E-commerce
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${currentImage}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl md:text-8xl font-bold text-white leading-[0.95] mb-8 tracking-tighter drop-shadow-2xl">
                  {images[currentImage].title.split(' ').map((word, i) => (
                    <span key={i} className={i % 2 === 1 ? "text-indigo-400" : ""}>
                      {word}{' '}
                    </span>
                  ))}
                </h1>
                <p className="text-xl md:text-2xl text-slate-200 mb-12 leading-relaxed font-medium max-w-xl drop-shadow-lg">
                  {images[currentImage].desc}
                </p>
              </motion.div>
            </AnimatePresence>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-5"
            >
              <button onClick={onLogin} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-900/40 hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95">
                Empieza Gratis <ArrowRight size={24} />
              </button>
              <a href="#contacto" className="px-10 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-bold text-lg hover:bg-white/20 transition-all text-center">
                Solicitar Demo
              </a>
            </motion.div>
          </div>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-30">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImage(index)}
              className={`h-2 rounded-full transition-all duration-500 ${index === currentImage ? 'bg-white w-12' : 'bg-white/30 w-3 hover:bg-white/50'}`}
            />
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="funciones" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Potencia Tecnológica Humana.</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium mb-10">Construido para los desafíos del mercado e-commerce actual.</p>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPlaybook(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-200"
            >
              <Activity size={20} /> Ver Presentación Operativa
            </motion.button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {features.map((f, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -8 }}
                className="p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 transition-all text-left"
              >
                <div className="mb-6 w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  {f.icon}
                </div>
                <h4 className="text-2xl font-black mb-3 tracking-tight text-slate-800">{f.title}</h4>
                <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precios" className="py-32 bg-[#0A0D14] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black mb-6 tracking-tight">Planes de Ruteo</h2>
            <p className="text-xl text-slate-400 font-medium">Escala tu operación con el plan que mejor se adapte a tu volumen.</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {pricingPlans.map((plan, i) => (
              <div 
                key={i}
                className={`p-10 rounded-[2.5rem] border transition-all duration-500 flex flex-col h-full ${
                  plan.highlight 
                    ? 'bg-[#0E1321] border-indigo-500/50 shadow-2xl shadow-indigo-500/10 scale-105 z-20' 
                    : 'bg-[#121826]/50 border-slate-800 hover:border-indigo-500/30'
                }`}
              >
                {plan.highlight && (
                   <div className="self-end bg-indigo-500 text-white px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">
                     Más Elegido
                   </div>
                )}
                <div className="mb-8">
                  <h3 className="text-2xl font-black mb-1">{plan.name} <span className="text-slate-500 text-sm font-bold">{plan.subtitle}</span></h3>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                    <span className="text-slate-400 font-bold">{plan.period}</span>
                  </div>
                  <p className={`mt-4 text-xs font-black uppercase tracking-widest ${plan.highlight ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {plan.setup}
                  </p>
                </div>
                
                <div className="flex-grow space-y-4 mb-12">
                   {plan.features.map((feat, j) => (
                     <div key={j} className="flex items-start gap-3">
                       <Check size={18} className="text-indigo-500 mt-1 flex-shrink-0" />
                       <span className="text-sm font-medium text-slate-300 leading-tight">{feat}</span>
                     </div>
                   ))}
                </div>

                <div className="mt-auto border-t border-slate-800 pt-8 mb-8">
                  <div className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <p>Orden adicional: {plan.footer.orden}</p>
                    <p>Licencia vehículo adic: {plan.footer.vehiculo}</p>
                  </div>
                </div>

                <button 
                  onClick={onLogin}
                  className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 ${
                    plan.highlight 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20' 
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Elegir {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                 <h2 className="text-5xl font-black text-slate-900 mb-8 tracking-tight">Hablemos de <br/> tu logística.</h2>
                 <p className="text-xl text-slate-500 mb-12 font-medium leading-relaxed">
                   ¿Tienes dudas sobre los planes o necesitas una solución a medida? Nuestro equipo de expertos está listo para ayudarte.
                 </p>
                 <div className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                          <Mail size={24} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Correo</p>
                          <p className="text-lg font-bold">info@fullenvios.cl</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-600">
                          <Smartphone size={24} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Soporte</p>
                          <a href="https://wa.me/56985367387" target="_blank" rel="noreferrer" className="text-lg font-bold hover:text-indigo-600 transition-colors">+569 8536 7387</a>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-[#F9FAFB] p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                 {submitted ? (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="text-center py-12"
                   >
                      <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-100">
                         <Check size={40} strokeWidth={3} />
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 mb-4">¡Solicitud Enviada!</h3>
                      <p className="text-lg text-slate-500 font-medium">Hemos recibido tu mensaje. Nos pondremos en contacto contigo a través de **info@fullenvios.cl** muy pronto.</p>
                      <button 
                        onClick={() => setSubmitted(false)}
                        className="mt-10 text-indigo-600 font-black uppercase tracking-widest text-xs hover:underline"
                      >
                        Enviar otro mensaje
                      </button>
                   </motion.div>
                 ) : (
                   <form onSubmit={handleContactSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                            <div className="relative">
                               <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                               <input 
                                 required
                                 type="text" 
                                 placeholder="Tu nombre"
                                 className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                                 value={formState.name}
                                 onChange={e => setFormState({...formState, name: e.target.value})}
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label>
                            <div className="relative">
                               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                               <input 
                                 required
                                 type="email" 
                                 placeholder="tu@email.com"
                                 className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                                 value={formState.email}
                                 onChange={e => setFormState({...formState, email: e.target.value})}
                               />
                            </div>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mensaje</label>
                         <textarea 
                           required
                           rows={4}
                           placeholder="¿En qué podemos ayudarte?"
                           className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium resize-none"
                           value={formState.message}
                           onChange={e => setFormState({...formState, message: e.target.value})}
                         />
                      </div>
                      <button 
                        disabled={isSubmitting}
                        type="submit" 
                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Enviando...' : (
                          <>Enviar Solicitud <Send size={20} /></>
                        )}
                      </button>
                   </form>
                 )}
              </div>
           </div>
        </div>
      </section>

      {/* Footer */}
      {/* Playbook Presentation Modal */}
      <AnimatePresence>
        {showPlaybook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
          >
            <button 
              onClick={() => setShowPlaybook(false)}
              className="absolute top-8 right-8 flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full font-black text-sm tracking-widest hover:bg-white/20 transition-all z-[110]"
            >
              <ArrowRight size={20} className="rotate-180" /> VOLVER
            </button>

            <div className="w-full max-w-6xl aspect-[16/9] relative bg-white rounded-[2rem] overflow-hidden shadow-2xl font-inter">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPlaybookPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute inset-0"
                >
                  <img 
                    src={playbookPages[currentPlaybookPage].url} 
                    alt={playbookPages[currentPlaybookPage].title}
                    className="w-full h-full object-contain bg-white"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-100 flex">
                {playbookPages.map((_, i) => (
                  <div 
                    key={i}
                    className={`h-full transition-all duration-500 ${i === currentPlaybookPage ? 'bg-indigo-600 flex-grow' : 'bg-slate-200 w-4'}`}
                  />
                ))}
              </div>

              {/* Controls */}
              <div className="absolute bottom-8 left-0 right-0 px-10 flex justify-between items-center pointer-events-none">
                <button 
                  disabled={currentPlaybookPage === 0}
                  onClick={() => setCurrentPlaybookPage(prev => prev - 1)}
                  className="p-4 bg-white/80 backdrop-blur shadow-lg rounded-full text-slate-900 pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-all"
                >
                  <ArrowRight size={24} className="rotate-180" />
                </button>
                <div className="bg-slate-900/10 backdrop-blur-md px-6 py-2 rounded-full text-slate-900 font-black text-sm uppercase tracking-widest">
                  {currentPlaybookPage + 1} / {playbookPages.length} : {playbookPages[currentPlaybookPage].title}
                </div>
                <button 
                  disabled={currentPlaybookPage === playbookPages.length - 1}
                  onClick={() => setCurrentPlaybookPage(prev => prev + 1)}
                  className="p-4 bg-indigo-600 shadow-lg rounded-full text-white pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all"
                >
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex items-center justify-center">
                <img src="/assets/landing/logo_official.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
             <span className="text-xl font-black tracking-tight text-slate-900">FULL ENVIOS</span>
          </div>
          <div className="flex gap-10 text-sm font-bold text-slate-400">
             <a href="#funciones" className="hover:text-indigo-600 transition-colors">Funciones</a>
             <a href="#precios" className="hover:text-indigo-600 transition-colors">Planes</a>
             <a href="#contacto" className="hover:text-indigo-600 transition-colors">Contacto</a>
          </div>
          <p className="text-sm font-bold text-slate-400">© 2026 Full Envios Chile.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
