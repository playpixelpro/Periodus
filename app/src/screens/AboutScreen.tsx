import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { LunaraMark } from '../components/LunaraMark'
import { APP_VERSION } from '../lib/version'
import '../styles/health.css'

export interface AboutScreenProps {
  onBack: () => void
}

const SPONSOR_LINKS = [
  {
    name: 'GitHub Sponsors',
    icon: '💖',
    tagline: 'Sponsor recurring or one-time via GitHub',
    url: 'https://github.com/sponsors/playpixelpro',
    color: '#EA4AAA',
  },
  {
    name: 'Ko-fi',
    icon: '☕',
    tagline: 'Buy a coffee or support directly',
    url: 'https://ko-fi.com/playpixelpro',
    color: '#FF5E5B',
  },
  {
    name: 'Buy Me a Coffee',
    icon: '☕',
    tagline: 'Direct tip & appreciation',
    url: 'https://buymeacoffee.com/playpixelpro',
    color: '#FFDD00',
    textColor: '#16130B',
  },
  {
    name: 'Patreon',
    icon: '🎨',
    tagline: 'Monthly membership & community support',
    url: 'https://patreon.com/playpixelpro',
    color: '#FF424D',
  },
]

async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="health-overlay" role="dialog" aria-modal="true" aria-label="About Periodus">
      <header className="health-topbar">
        <button className="health-icon-button" onClick={onBack} aria-label="Close about screen">
          ‹
        </button>
        <div className="health-topbar-title">About Periodus</div>
        <span />
      </header>

      <div className="health-scroll">
        <div className="health-canvas" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
          {/* App Brand Header */}
          <section
            className="card"
            style={{
              padding: '24px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              background:
                'radial-gradient(circle at 50% 0%, rgba(255, 225, 163, 0.12), transparent 70%), var(--surface-container, #1F1B12)',
              border: '1px solid rgba(255, 225, 163, 0.18)',
              borderRadius: 24,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(255, 225, 163, 0.08)',
                border: '1px solid rgba(255, 225, 163, 0.25)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 0 30px rgba(238, 195, 94, 0.15)',
              }}
            >
              <LunaraMark size={48} decorative />
            </div>

            <div>
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--on-surface, #F5EFE6)',
                  margin: '4px 0 2px',
                  letterSpacing: '-0.02em',
                }}
              >
                Periodus
              </h1>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--gold, #FFE1A3)',
                  margin: 0,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Private, Local-First Health Companion
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 99,
                  background: 'rgba(255, 225, 163, 0.12)',
                  color: 'var(--gold, #FFE1A3)',
                  border: '1px solid rgba(255, 225, 163, 0.2)',
                }}
              >
                v{APP_VERSION}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 99,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--on-surface-variant, #D8C5B2)',
                  border: '1px solid var(--border-subtle, rgba(255, 225, 163, 0.1))',
                }}
              >
                AGPL-3.0 Open Source
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 99,
                  background: 'rgba(100, 200, 150, 0.12)',
                  color: '#86efac',
                  border: '1px solid rgba(100, 200, 150, 0.25)',
                }}
              >
                AES-256-GCM Vault
              </span>
            </div>
          </section>

          {/* Mission & Principles */}
          <div className="section-label" style={{ marginTop: 20, marginBottom: 8 }}>
            Core Ethos &amp; Architecture
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              className="card"
              style={{
                padding: '16px',
                borderRadius: 18,
                background: 'var(--surface-container, #1F1B12)',
                border: '1px solid var(--border-subtle, rgba(255, 225, 163, 0.12))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <strong style={{ fontSize: 14, color: 'var(--on-surface, #F5EFE6)' }}>
                  100% Zero Surveillance
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--on-surface-variant, #D8C5B2)' }}>
                Your cycle, intimacy, and symptom data is computed and saved entirely on this device.
                No third-party analytics trackers, no account requirements, and zero advertising telemetry.
              </p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px',
                borderRadius: 18,
                background: 'var(--surface-container, #1F1B12)',
                border: '1px solid var(--border-subtle, rgba(255, 225, 163, 0.12))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🚫</span>
                <strong style={{ fontSize: 14, color: 'var(--on-surface, #F5EFE6)' }}>
                  No Paywalls or Subscriptions
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--on-surface-variant, #D8C5B2)' }}>
                Essential reproductive health tracking should not be locked behind $80/year paywalls.
                Periodus provides all tracking features, charts, and export tools free for everyone.
              </p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px',
                borderRadius: 18,
                background: 'var(--surface-container, #1F1B12)',
                border: '1px solid var(--border-subtle, rgba(255, 225, 163, 0.12))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <strong style={{ fontSize: 14, color: 'var(--on-surface, #F5EFE6)' }}>
                  Private BYOK &amp; Local AI
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--on-surface-variant, #D8C5B2)' }}>
                Bring your own Anthropic or OpenAI key, or connect a local LLM. Key credentials never leave your
                hardware keystore, and tracker context is only attached with your explicit per-message consent.
              </p>
            </div>
          </div>

          {/* Support & Sponsorship Section */}
          <div className="section-label" style={{ marginTop: 24, marginBottom: 8 }}>
            💖 Support Independent Development
          </div>

          <section
            className="card"
            style={{
              padding: '18px 16px',
              borderRadius: 20,
              background: 'var(--surface-container, #1F1B12)',
              border: '1px solid rgba(255, 225, 163, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--on-surface-variant, #D8C5B2)' }}>
              Periodus is developed independently without venture capital, corporate tracking, or data monetization.
              If Periodus empowers your health autonomy, you can support development and maintenance here:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {SPONSOR_LINKS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => openExternal(item.url)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 225, 163, 0.14)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--on-surface, #F5EFE6)',
                    transition: 'all 0.16s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <strong style={{ fontSize: 13, display: 'block', color: 'var(--on-surface, #F5EFE6)' }}>
                        {item.name}
                      </strong>
                      <small style={{ fontSize: 11, color: 'var(--on-surface-variant, #D8C5B2)' }}>
                        {item.tagline}
                      </small>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: item.color,
                      color: item.textColor ?? '#FFFFFF',
                      flexShrink: 0,
                    }}
                  >
                    Support ↗
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* GitHub & Source */}
          <div className="section-label" style={{ marginTop: 24, marginBottom: 8 }}>
            Source Code &amp; Community
          </div>

          <button
            type="button"
            className="card"
            onClick={() => openExternal('https://github.com/playpixelpro/Periodus')}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: 'var(--surface-container, #1F1B12)',
              border: '1px solid var(--border-subtle, rgba(255, 225, 163, 0.12))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              cursor: 'pointer',
              color: 'var(--on-surface, #F5EFE6)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <div>
                <strong style={{ fontSize: 13, display: 'block' }}>Periodus on GitHub</strong>
                <small style={{ fontSize: 11, color: 'var(--on-surface-variant, #D8C5B2)' }}>
                  View source code, report issues, or star repository
                </small>
              </div>
            </div>
            <span style={{ fontSize: 16, color: 'var(--gold, #FFE1A3)' }}>↗</span>
          </button>

          {/* Disclaimer & Attribution */}
          <footer style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(216, 197, 178, 0.65)' }}>
              Periodus is an independent hard fork of Lunara. Not affiliated with or endorsed by Flo Health Inc.
            </p>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(216, 197, 178, 0.5)' }}>
              Periodus is not a medical device. Predictions are statistical estimates and not contraception or medical diagnosis.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
