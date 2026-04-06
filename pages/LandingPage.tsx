import React, { useEffect, useState } from 'react';

const LandingPage: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const features = [
        {
            title: 'Asignación y Seguimiento',
            description: 'Gestiona la flota de conductores, asigna paquetes masivamente y rastrea la ubicación en tiempo real.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            title: 'Integración Mercado Libre Oficial',
            description: 'Sincroniza tus envíos directamente con la API oficial, descarga etiquetas e importa rutas automáticamente.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )
        },
        {
            title: 'Impresión y Escaneo QR',
            description: 'Genera grillas detalladas de etiquetas e interactúa con escaneo de códigos QR súper nítidos.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            )
        },
        {
            title: 'Reportes y Facturación Masiva',
            description: 'Visualiza reportes detallados del rendimiento logístico y genera facturas de manera automatizada.',
            icon: (
                <svg className="w-8 h-8 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

    return (
        <div className="min-h-screen bg-[var(--background-primary)] font-sans text-[var(--text-primary)]">
            
            {/* Header / Navbar */}
            <header className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-[var(--brand-primary)] rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold tracking-tight">Full Envíos</span>
                </div>
                <button 
                    onClick={() => window.location.href = '/login'}
                    className="px-6 py-2 rounded-full font-semibold bg-[var(--background-secondary)] text-[var(--brand-primary)] hover:bg-[var(--background-muted)] border border-[var(--border-secondary)] shadow-sm transition-all"
                >
                    Ingresar a la App
                </button>
            </header>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden flex flex-col items-center justify-center text-center px-4">
                {/* Background Decorators */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[var(--brand-primary)] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

                <div className={`max-w-4xl transition-all duration-1000 ease-out transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    <span className="inline-block py-1 px-3 rounded-full bg-[var(--brand-muted)] text-[var(--brand-text)] text-sm font-semibold mb-6">
                        Logística Inteligente y Escalable
                    </span>
                    <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8">
                        La Solución Definitiva para <br className="hidden lg:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-purple-500">
                            Tus Envíos en LATAM
                        </span>
                    </h1>
                    <p className="text-lg lg:text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
                        Control total sobre tu cadena logística, desde la integración directa con Mercado Libre hasta el reporte detallado del rendimiento de tu flota de conductores.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button 
                            onClick={() => window.location.href = '/login'}
                            className="px-8 py-4 rounded-xl font-bold bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-secondary)] shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            Comenzar Ahora
                        </button>
                        <button 
                            onClick={() => {
                                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-8 py-4 rounded-xl font-bold bg-[var(--background-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--background-muted)] transition-all duration-300"
                        >
                            Ver Cualidades
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 bg-[var(--background-secondary)] px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-5xl font-bold mb-4">Cualidades de Alto Rendimiento</h2>
                        <p className="text-[var(--text-secondary)]">Optimiza recursos y aumenta la velocidad de tus entregas con herramientas avanzadas.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, i) => (
                            <div key={i} className="bg-[var(--background-primary)] p-8 rounded-2xl border border-[var(--border-primary)] shadow-sm hover:shadow-lg hover:border-[var(--brand-primary)] transition-all duration-300 group">
                                <div className="w-14 h-14 rounded-xl bg-[var(--brand-muted)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-[var(--text-muted)] leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Coverage Section */}
            <section className="py-24 px-4 bg-[var(--background-primary)] relative overflow-hidden">
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl lg:text-5xl font-bold mb-8">Conectando a <span className="text-[var(--brand-primary)]">Latinoamérica</span></h2>
                    <p className="text-lg text-[var(--text-secondary)] mb-12 max-w-3xl mx-auto">
                        Nuestra plataforma está adaptada para funcionar a nivel regional, brindando soporte y accesibilidad en múltiples países con la robustez y confianza que tu empresa necesita en todo el continente.
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-6 lg:gap-10">
                        {countries.map((country) => (
                            <div key={country.name} className="flex flex-col items-center p-6 bg-[var(--background-secondary)] rounded-2xl shadow-sm border border-[var(--border-primary)] min-w-[140px] hover:scale-105 hover:border-[var(--brand-primary)] transition-all cursor-default">
                                <span className="text-5xl mb-3 drop-shadow-md">{country.flag}</span>
                                <span className="font-semibold text-[var(--text-primary)]">{country.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Decorative map abstract bg in background */}
                <div className="absolute inset-0 opacity-5 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at center, var(--brand-primary) 0%, transparent 60%)', backgroundSize: '100% 100%' }}>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4 bg-gradient-to-b from-[var(--background-secondary)] to-[var(--background-primary)]">
                <div className="max-w-4xl mx-auto bg-[var(--brand-primary)] p-10 lg:p-16 rounded-3xl text-center text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    
                    <h2 className="text-3xl lg:text-5xl font-bold mb-6 relative z-10">¿Listo para escalar tus operaciones?</h2>
                    <p className="text-lg opacity-90 mb-10 relative z-10">
                        Únete a la plataforma elegida por las empresas de distribución más innovadoras. Accede a tu panel en <strong>www.fullenvios.cl</strong>.
                    </p>
                    <button 
                        onClick={() => window.location.href = '/login'}
                        className="px-10 py-5 rounded-xl font-bold bg-white text-[var(--brand-primary)] text-lg hover:bg-gray-100 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 relative z-10"
                    >
                        Ingresar a mi Cuenta
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 bg-[var(--background-secondary)] text-center text-[var(--text-muted)] border-t border-[var(--border-primary)]">
                <p>&copy; {new Date().getFullYear()} Full Envíos. Todos los derechos reservados. www.fullenvios.cl</p>
            </footer>
        </div>
    );
};

export default LandingPage;
