import { useI18n } from '../lib/i18n';
import { SlidersIcon } from './icons';
import { RingMark } from './RingMark';

/** App wordmark in the header: the ring symbol, powering on as the app opens, the name and
    its tagline. It is also the settings button, like the Guide button on the console's
    pad: the badge on the ring says so. */
export function Brand() {
  const { t } = useI18n();
  return (
    <span className="brand">
      <span className="brand-ring">
        <RingMark className="brand-mark" />
        <span className="brand-badge" aria-hidden>
          <SlidersIcon />
        </span>
      </span>
      <span className="brand-name hidden sm:block">
        {/* Xenon, the Xbox 360's codename, carries the weight; Shelf follows in regular. */}
        <span className="brand-xenon">Xenon</span>Shelf
        <span className="brand-tm" aria-label="trademark">
          TM
        </span>
      </span>
      <span className="brand-tagline hidden sm:block">{t('app.tagline')}</span>
    </span>
  );
}
