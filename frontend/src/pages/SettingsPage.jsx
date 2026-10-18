import { MonitorCog, MoonStar, Sparkles } from "lucide-react";
import {
  ThemeSwitch,
  Toggle,
} from "../components/common/DesignSystem";
import { useReducedMotionPreference } from "../components/common/useDesignSystem";

export default function SettingsPage() {
  const [reducedMotion, setReducedMotion] = useReducedMotionPreference();
  return (
    <section className="settings-page">
      <article className="panel settings-card">
        <div className="settings-card-icon"><MoonStar size={19} /></div>
        <div className="settings-card-copy">
          <h2>Appearance</h2>
          <p>Choose a bright daytime workspace or a calm, immersive night theme.</p>
        </div>
        <ThemeSwitch />
      </article>
      <article className="panel settings-card">
        <div className="settings-card-icon"><MonitorCog size={19} /></div>
        <div className="settings-card-copy">
          <h2>Motion</h2>
          <p>Reduce decorative animation while keeping important feedback visible.</p>
        </div>
        <Toggle checked={reducedMotion} onChange={setReducedMotion} label={reducedMotion ? "Reduced" : "Full"} />
      </article>
      <article className="panel settings-note">
        <Sparkles size={19} />
        <div>
          <strong>Your workspace, your way</strong>
          <p>Appearance and motion preferences are saved on this device.</p>
        </div>
      </article>
    </section>
  );
}
