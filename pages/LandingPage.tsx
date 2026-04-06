import React, { useEffect, useState } from 'react';

const LandingPage: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const features = [
        {
            title: 'Asignación Inteligente',
            description: 'Gestiona tu flota de conductores y asigna paquetes de forma masiva en segundos, optimizando cada ruta.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            )
        },
        {
            title: 'Mercado Libre SCA',
            description: 'Integración oficial con la API de Mercado Libre. Sincroniza tracking IDs y usa etiquetas SCA auténticas.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )
        },
        {
            title: 'Seguimiento Real-Time',
            description: 'Tus clientes podrán rastrear sus envíos en vivo con una interfaz intuitiva y actualizaciones automáticas.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
                </svg>
            )
        },
        {
            title: 'Reportes y Facturación',
            description: 'Visualiza el rendimiento de tu logística y genera facturación masiva de forma automatizada y sin errores.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        }
    ];

    const countries = [
        { name: 'Chile', flag: '🇨🇱' },
        { name: 'Argentina', flag: '🇦🇷' },
        { name: 'Colombia', flag: '🇨🇴' },
        { name: 'México', flag: '🇲🇽' },
        { name: 'Perú', flag: '🇵🇪' }
    ];

    const steps = [
        {
            number: '01',
            title: 'Conecta tu Negocio',
            text: 'Integramos tus ventas de Mercado Libre y otras plataformas directamente al panel administrador.'
        },
        {
            number: '02',
            title: 'Gestiona y Despacha',
            text: 'Asigna a tus conductores, genera las etiquetas oficiales y deja que el sistema organice la logística.'
        },
        {
            number: '03',
            title: 'Monitoreo Total',
            text: 'Recibe confirmaciones digitales, fotos de entrega y mantén a tus clientes informados de cada paso.'
        }
    ];

    return (
        <div className="min-h-screen bg-[var(--background-primary)] font-sans text-[var(--text-primary)] selection:bg-[var(--brand-primary)] selection:text-white">
            
            {/* Nav Header */}
            <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/70 border-b border-[var(--border-primary)] transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Full Envíos" className="h-10 lg:h-12 w-auto" />
                        <span className="text-xl lg:text-2xl font-black tracking-tighter text-[var(--text-primary)] hidden sm:block">FULL ENVÍOS</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-8">
                        <a href="#proceso" className="text-sm font-semibold hover:text-[var(--brand-primary)] transition-colors">Cómo Funciona</a>
                        <a href="#cualidades" className="text-sm font-semibold hover:text-[var(--brand-primary)] transition-colors">Cualidades</a>
                        <a href="#latam" className="text-sm font-semibold hover:text-[var(--brand-primary)] transition-colors">Cobertura</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => window.location.href = '/login'}
                            className="px-6 py-2.5 rounded-full font-bold bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-secondary)] shadow-md hover:shadow-xl transition-all duration-300 scale-95 hover:scale-100"
                        >
                            Ingresar
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-40 pb-24 lg:pt-56 lg:pb-40 overflow-hidden px-6">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-screen bg-gradient-to-b from-[var(--brand-muted)] to-transparent opacity-20 blur-3xl -z-10 pointer-events-none"></div>

                <div className={`max-w-5xl mx-auto text-center transition-all duration-1000 ease-out transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    <div className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-8 uppercase tracking-widest animate-pulse">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
                        LOGÍSTICA CORPORATIVA 4.0
                    </div>
                    
                    <h1 className="text-5xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.05] text-[var(--text-primary)]">
                        Lleva tu distribución <br className="hidden lg:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600">
                             al siguiente nivel
                        </span>
                    </h1>
                    
                    <p className="text-lg lg:text-2xl text-[var(--text-secondary)] mb-12 max-w-3xl mx-auto leading-relaxed">
                        Optimiza tu operación logística con tecnología SCA de Mercado Libre, gestión de rutas automatizada y monitoreo en tiempo real.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-5 justify-center">
                        <button 
                            onClick={() => window.location.href = '/login'}
                            className="px-10 py-5 rounded-2xl font-extrabold bg-[var(--text-primary)] text-white hover:bg-black shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 transform"
                        >
                            Comenzar ahora
                        </button>
                        <button 
                            onClick={() => {
                                document.getElementById('proceso')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-10 py-5 rounded-2xl font-extrabold bg-white border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--background-muted)] shadow-lg transition-all duration-300"
                        >
                            Ver Proceso
                        </button>
                    </div>
                </div>
            </section>

            {/* How it Works (Proceso) */}
            <section id="proceso" className="py-24 bg-white px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <h2 className="text-3xl lg:text-5xl font-black mb-16 tracking-tight">El Proceso de Full Envíos</h2>
                    
                    <div className="grid lg:grid-cols-3 gap-12 text-left">
                        {steps.map((step) => (
                            <div key={step.number} className="relative group">
                                <span className="text-8xl font-black text-slate-50 absolute -top-10 -left-4 z-0 group-hover:text-indigo-50 transition-colors">{step.number}</span>
                                <div className="relative z-10 pt-10">
                                    <h3 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">{step.title}</h3>
                                    <p className="text-[var(--text-secondary)] text-lg leading-relaxed">{step.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="cualidades" className="py-24 bg-[var(--background-muted)]/50 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <span className="text-[var(--brand-primary)] font-bold text-sm uppercase tracking-widest block mb-4">Eficiencia Absoluta</span>
                        <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Cualidades para tu Éxito</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, i) => (
                            <div key={i} className="bg-white p-10 rounded-3xl border border-white shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-[var(--brand-primary)]/20 transition-all duration-300 group">
                                <div className="w-16 h-16 rounded-2xl bg-[var(--brand-muted)] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-4 text-[var(--text-primary)]">{feature.title}</h3>
                                <p className="text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Coverage Section */}
            <section id="latam" className="py-32 px-6 bg-[var(--text-primary)] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--brand-primary)] opacity-10 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500 opacity-10 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2"></div>

                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl lg:text-6xl font-black mb-10 tracking-tight leading-tight">Presencia Estratégica en <br/> <span className="text-[var(--brand-primary)]">Latinoamérica</span></h2>
                    <p className="text-xl lg:text-2xl text-slate-400 mb-16 max-w-4xl mx-auto leading-relaxed">
                        Nuestra infraestructura está diseñada para escalar regionalmente, ofreciendo el mismo nivel de precisión y seguridad en cada rincón del continente.
                    </p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-8 justify-center">
                        {countries.map((country) => (
                            <div key={country.name} className="flex flex-col items-center p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:border-[var(--brand-primary)]/50 hover:bg-white/10 transition-all duration-300 group">
                                <span className="text-6xl mb-4 group-hover:scale-125 transition-transform duration-300 filter drop-shadow-lg">{country.flag}</span>
                                <span className="font-bold text-lg text-slate-100 tracking-wide">{country.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-32 px-6 bg-white overflow-hidden relative">
                <div className="max-w-5xl mx-auto bg-gradient-to-br from-[var(--brand-primary)] to-indigo-900 p-12 lg:p-24 rounded-[3rem] text-center text-white shadow-3xl shadow-indigo-600/20 relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <h2 className="text-4xl lg:text-6xl font-black mb-8 leading-tight">¿Listo para transformar <br/> tu logística?</h2>
                    <p className="text-xl opacity-80 mb-12 max-w-2xl mx-auto">
                        Únete hoy a la plataforma integral de envíos. Accede ahora a <strong>www.fullenvios.cl</strong>
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                         <button 
                            onClick={() => window.location.href = '/login'}
                            className="px-12 py-6 rounded-2xl font-black bg-white text-[var(--brand-primary)] text-xl hover:bg-indigo-50 shadow-2xl hover:scale-105 transition-all duration-300"
                        >
                            Ingresar a mi Cuenta
                        </button>
                    </div>
                </div>
            </section>

            {/* Realistic Footer */}
            <footer className="py-16 bg-slate-50 border-t border-slate-200 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Full Envíos" className="h-8 grayscale opacity-50" />
                        <span className="font-black text-slate-400 tracking-tighter">FULL ENVÍOS</span>
                    </div>
                    <div className="text-slate-400 text-sm font-medium">
                        &copy; {new Date().getFullYear()} Todos los derechos reservados. 
                        <a href="https://www.fullenvios.cl" className="ml-2 hover:text-[var(--brand-primary)]">www.fullenvios.cl</a>
                    </div>
                    <div className="flex gap-6">
                         <a href="mailto:soporte@fullenvios.cl" className="text-sm font-bold text-slate-500 hover:text-[var(--brand-primary)]">Soporte</a>
                         <a href="#" className="text-sm font-bold text-slate-500 hover:text-[var(--brand-primary)]">Privacidad</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
