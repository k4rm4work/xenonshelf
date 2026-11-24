import { useState, type FormEvent, type ReactNode } from 'react';
import { reasonFor } from '../lib/apiError';
import { LANGUAGE_OPTIONS, useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { changeSetup, type SetupStatus } from '../lib/setup';
import { Button } from './Button';
import { CloseButton, Dialog, useDialogClose } from './Dialog';
import { Dropdown } from './Dropdown';
import { CompletedIcon } from './icons';
import { RingMark } from './RingMark';

const TWITCH_APPS = 'https://dev.twitch.tv/console/apps';
const MIN_PASSWORD = 12;

type FormProps = { status: SetupStatus; onChange: (status: SetupStatus) => void };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label block">{label}</span>
      {children}
    </label>
  );
}

const input = 'nxe-input w-full';

/** How a setting stands, with what can be done about it. */
function State({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="notice notice-green mt-5">
      <CompletedIcon />
      <span className="min-w-0 flex-1">{children}</span>
      {actions}
    </div>
  );
}

/** A part set in the app: says so, and offers to change it or take it off. */
function SetInApp({
  part,
  removeLabel,
  onEdit,
  onChange,
  children,
}: Pick<FormProps, 'onChange'> & { part: 'igdb' | 'login'; removeLabel: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const remove = async () => {
    const result = await changeSetup('DELETE', part);
    if ('status' in result) onChange(result.status);
  };
  return (
    <State
      actions={
        <>
          <button type="button" className="notice-action" onClick={onEdit}>
            {t('setup.change')}
          </button>
          <button type="button" className="notice-action" onClick={remove}>
            {removeLabel}
          </button>
        </>
      }
    >
      {children}
    </State>
  );
}

/** The IGDB keys: where to get them, step by step, and a form that checks them with Twitch. */
export function IgdbForm({ status, onChange }: FormProps) {
  const { t, rich } = useI18n();
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (status.igdb === 'env') return <State>{t('setup.igdbEnv')}</State>;
  if (status.igdb === 'app' && !editing)
    return (
      <SetInApp part="igdb" removeLabel={t('setup.remove')} onEdit={() => setEditing(true)} onChange={onChange}>
        {t('setup.igdbOn')}
      </SetInApp>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await changeSetup('PUT', 'igdb', { clientId, clientSecret: secret });
    setBusy(false);
    if ('error' in result) {
      const known = { rejected: 'setup.igdbRejected', unreachable: 'setup.unreachable' } as const;
      return setError(
        result.error in known
          ? t(known[result.error as keyof typeof known])
          : t('setup.failed', { message: t(`apiError.${reasonFor(result.error)}`) }),
      );
    }
    setEditing(false);
    setSecret('');
    onChange(result.status);
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <ol className="setup-steps">
        <li>
          {rich('setup.igdbStep1', {
            link: (
              <a href={TWITCH_APPS} target="_blank" rel="noreferrer" className="font-semibold text-x360-dark hover:underline">
                dev.twitch.tv
              </a>
            ),
          })}
        </li>
        <li>{rich('setup.igdbStep2', { url: <code className="setup-code">http://localhost</code> })}</li>
        <li>{t('setup.igdbStep3')}</li>
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('setup.clientId')}>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={input}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
        <Field label={t('setup.clientSecret')}>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className={input} autoComplete="off" required />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={busy || !clientId.trim() || !secret.trim()}>
          {busy ? t('setup.checking') : t('setup.igdbSave')}
        </Button>
        {status.igdb === 'app' && (
          <Button variant="link" onClick={() => setEditing(false)}>
            {t('import.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

/** The optional login: a user name and a password the browser will ask for. */
export function LoginForm({ status, onChange }: FormProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState(status.user ?? '');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (status.login === 'env') return <State>{t('setup.loginEnv')}</State>;
  if (status.login === 'app' && !editing)
    return (
      <SetInApp part="login" removeLabel={t('setup.loginOffAction')} onEdit={() => setEditing(true)} onChange={onChange}>
        {t('setup.loginOn', { user: status.user ?? '' })}
      </SetInApp>
    );

  const problem = password.length < MIN_PASSWORD ? t('setup.passwordShort') : password !== again ? t('setup.passwordMismatch') : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    setBusy(true);
    const result = await changeSetup('PUT', 'login', { user, password });
    setBusy(false);
    if ('error' in result) return setError(t('setup.failed', { message: t(`apiError.${reasonFor(result.error)}`) }));
    setEditing(false);
    setPassword('');
    setAgain('');
    setError(undefined);
    onChange(result.status);
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('setup.user')}>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value.replace(/:/g, ''))}
            className={input}
            autoComplete="username"
            required
          />
        </Field>
        <Field label={t('setup.password')}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label={t('setup.passwordAgain')}>
          <input
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            className={input}
            autoComplete="new-password"
            required
          />
        </Field>
      </div>
      <p className="text-sm text-slate-500">{t('setup.loginNote')}</p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={busy || !user.trim() || !password}>
          {t('setup.loginSave')}
        </Button>
        {status.login === 'app' && (
          <Button variant="link" onClick={() => setEditing(false)}>
            {t('import.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

function Heading({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          {kicker && <div className="field-label">{kicker}</div>}
          <h2 className="text-3xl font-light tracking-tight text-slate-800">{title}</h2>
        </div>
        <CloseButton />
      </div>
      {children && <p className="mt-3 max-w-2xl text-[15px] text-slate-600">{children}</p>}
    </>
  );
}

/** The server's settings, from the settings panel: the IGDB keys and the login. */
export function ServerSettingsDialog({ status, onChange, onClose }: FormProps & { onClose: () => void }) {
  const { t } = useI18n();
  const loginBefore = status.login;
  return (
    <Dialog label={t('setup.dialog')} onClose={onClose}>
      <div className="gloss rounded-3xl p-6 sm:p-8">
        <Heading title={t('setup.dialog')} />
        <h3 className="mt-6 text-xl font-semibold text-slate-800">{t('setup.igdbTitle')}</h3>
        <p className="mt-1 max-w-2xl text-[15px] text-slate-600">{t('setup.igdbIntro')}</p>
        <IgdbForm status={status} onChange={onChange} />
        <h3 className="mt-8 border-t border-slate-300/70 pt-6 text-xl font-semibold text-slate-800">{t('setup.loginTitle')}</h3>
        <p className="mt-1 max-w-2xl text-[15px] text-slate-600">{t('setup.loginIntro')}</p>
        <LoginForm status={status} onChange={onChange} />
        {status.login === 'app' && loginBefore !== 'app' && <ReloadNote />}
      </div>
    </Dialog>
  );
}

/** A login just turned on asks for itself from the next page load. */
function ReloadNote() {
  const { t } = useI18n();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <span className="text-sm text-slate-600">{t('setup.reloadNote')}</span>
      <Button size="sm" onClick={() => window.location.reload()}>
        {t('error.reload')}
      </Button>
    </div>
  );
}

export const SETUP_STEPS = ['welcome', 'igdb', 'login', 'done'] as const;
const STEPS = SETUP_STEPS;

/**
 * The first-run guide on a fresh server: the language, then the IGDB keys and the login,
 * each one skippable, then where to begin. Leaving it at any step counts as done; the same
 * settings stay in the settings panel.
 */
export function SetupWizard({ status, onChange, onClose }: FormProps & { onClose: () => void }) {
  return (
    <Dialog label={useI18n().t('setup.dialog')} onClose={onClose}>
      <WizardSteps status={status} onChange={onChange} />
    </Dialog>
  );
}

/** The guide's steps in their panel; `start` opens it on a later one (the #/ui gallery). */
export function WizardSteps({ status, onChange, start = 0 }: FormProps & { start?: number }) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const close = useDialogClose();
  const [step, setStep] = useState(start);
  const name = STEPS[step];
  const next = async () => {
    setStep((s) => s + 1);
    // Done from here on: a login saved on the next step would refuse the request afterwards.
    if (STEPS[step + 1] === 'login' && status.firstRun) {
      const result = await changeSetup('POST', 'done');
      if ('status' in result) onChange(result.status);
    }
  };
  const kicker = t('setup.step', { n: step, total: STEPS.length - 2 });
  const footer = (done: boolean) => (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-300/70 pt-6">
      <Button variant="link" onClick={() => setStep((s) => s - 1)}>
        {t('setup.back')}
      </Button>
      <Button variant={done ? 'primary' : 'secondary'} size="lg" onClick={next}>
        {done ? t('setup.next') : t('setup.skip')}
      </Button>
    </div>
  );

  return (
    <div className="gloss rounded-3xl p-6 sm:p-9">
      {name === 'welcome' && (
        <>
          <div className="flex items-start justify-between gap-4">
            <RingMark className="size-14" />
            <CloseButton />
          </div>
          <h2 className="mt-5 text-3xl font-light tracking-tight text-slate-800">{t('setup.welcomeTitle')}</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-600">{t('setup.welcomeIntro')}</p>
          <div className="mt-6">
            <Dropdown
              label={t('settings.language')}
              value={settings.language}
              options={LANGUAGE_OPTIONS}
              onChange={(language) => update({ language })}
            />
          </div>
          <div className="mt-8 flex justify-end border-t border-slate-300/70 pt-6">
            <Button size="lg" onClick={next}>
              {t('setup.start')}
            </Button>
          </div>
        </>
      )}
      {name === 'igdb' && (
        <>
          <Heading kicker={kicker} title={t('setup.igdbTitle')}>
            {t('setup.igdbIntro')}
          </Heading>
          <IgdbForm status={status} onChange={onChange} />
          {footer(status.igdb !== 'none')}
        </>
      )}
      {name === 'login' && (
        <>
          <Heading kicker={kicker} title={t('setup.loginTitle')}>
            {t('setup.loginIntro')}
          </Heading>
          <LoginForm status={status} onChange={onChange} />
          {footer(status.login !== 'none')}
        </>
      )}
      {name === 'done' && (
        <>
          <Heading title={t('setup.doneTitle')}>{t('setup.doneIntro')}</Heading>
          <div className="mt-8 flex justify-end border-t border-slate-300/70 pt-6">
            <Button
              size="lg"
              // A login just turned on asks for itself on a fresh page load.
              onClick={() => (status.login === 'app' ? window.location.reload() : close())}
            >
              {t('setup.finish')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
