import React from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export default function Pricing({ onOpenMissionModal }) {
  const plans = [
    {
      name: 'Basic plan',
      price: '$49 USD',
      description: 'Ideal for solo builders and indie creators orchestrating standard autonomous missions.',
      isFeatured: false,
      buttonText: 'Get started',
      features: [
        'Access to all basic features',
        'Basic reporting and analytics',
        'Up to 10 individual users',
        '20GB individual data each user',
        'Basic chat and email support'
      ]
    },
    {
      name: 'Business plan',
      price: '$79 USD',
      description: 'Designed for scaling teams requiring high-concurrency swarms and priority recovery.',
      isFeatured: true,
      buttonText: 'Get started',
      features: [
        'Access to all basic features',
        'Basic reporting and analytics',
        'Up to 10 individual users',
        '20GB individual data each user',
        'Basic chat and email support',
        '20GB Easter Egg Test'
      ]
    },
    {
      name: 'Enterprise plan',
      price: '$90 USD',
      description: 'Custom infrastructure, private cloud deployment, and deterministic safety verifications.',
      isFeatured: false,
      buttonText: 'Get started',
      features: [
        'Access to all basic features',
        'Basic reporting and analytics',
        'Up to 10 individual users',
        '20GB individual data each user',
        'Basic chat and email support'
      ]
    }
  ];

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#eb6920]/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-[1240px] mx-auto px-6">
        
        {/* Header matching video Frame 00:11 */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Pricing Plans for Success
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Discover the perfect plan for your coding journey with AgentOS. Our pricing options are designed to provide you with the flexibility.
          </p>
        </div>

        {/* 3 Pricing Cards Grid matching video Frame 00:11 - 00:13 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                plan.isFeatured
                  ? 'featured-card scale-105 z-10'
                  : 'glass-card hover:border-white/20'
              }`}
            >
              {plan.isFeatured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-[10px] font-extrabold tracking-wider uppercase text-white shadow-[0_0_15px_rgba(235,105,32,0.6)]">
                  Most Popular
                </div>
              )}

              <div>
                {/* Price */}
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                  {plan.price}
                </div>

                {/* Plan Name */}
                <div className="text-sm font-semibold text-gray-300 mb-3">
                  {plan.name}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed mb-6">
                  {plan.description}
                </p>

                {/* CTA Button */}
                <button
                  onClick={onOpenMissionModal}
                  className={`w-full py-3 rounded-2xl text-xs font-semibold tracking-wider transition-all mb-8 ${
                    plan.isFeatured
                      ? 'btn-orange'
                      : 'btn-dark'
                  }`}
                >
                  {plan.buttonText}
                </button>

                {/* Features List */}
                <div className="space-y-3.5 border-t border-white/5 pt-6">
                  {plan.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-[#eb6920] flex items-center justify-center text-white shadow-[0_0_6px_#eb6920] shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="text-xs text-gray-300 font-medium">
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 text-[11px] text-gray-400 text-center">
                Billed monthly • Cancel anytime
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
