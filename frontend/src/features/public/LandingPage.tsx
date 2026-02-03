import { ArrowRight, Box, Server, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LandingPage = () => {
    return (
        <div className="bg-white">
            {/* Hero Section */}
            <div className="relative isolate px-6 pt-14 lg:px-8">
                <div className="mx-auto max-w-2xl py-20 sm:py-32 lg:py-40">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                            Cloud-Native Order Fulfillment
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Orchestrate your logistics with a polyglot microservices architecture.
                            Manage inventory, track deliveries, and scale effortlessly with our
                            Spring Boot & Go powered platform.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <Link
                                to="/register"
                                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            >
                                Start Fulfillment
                            </Link>
                            <Link to="/login" className="text-sm font-semibold leading-6 text-gray-900 flex items-center gap-1">
                                Log in to Dashboard <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
                <div className="grid grid-cols-1 gap-y-16 gap-x-8 lg:grid-cols-3">
                    <FeatureCard
                        icon={<Box className="h-6 w-6 text-white" />}
                        title="Smart Inventory"
                        desc="Real-time stock tracking with strong consistency guarantees using Spring Boot."
                    />
                    <FeatureCard
                        icon={<Server className="h-6 w-6 text-white" />}
                        title="Polyglot Backend"
                        desc="Hybrid architecture leveraging Java for logic and Go for high-performance warehousing."
                    />
                    <FeatureCard
                        icon={<Activity className="h-6 w-6 text-white" />}
                        title="Live Observability"
                        desc="End-to-end tracing and centralized logging with the ELK Stack."
                    />
                </div>
            </div>
        </div>
    );
};

// Simple helper component for features
const FeatureCard = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="flex flex-col items-start">
        <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-white/10 mb-4">
            {icon}
        </div>
        <h3 className="text-lg font-semibold leading-8 text-gray-900">{title}</h3>
        <p className="mt-2 text-base leading-7 text-gray-600">{desc}</p>
    </div>
);