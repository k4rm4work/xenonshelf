import { useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { exportCsv } from '../lib/importRows';
import { CAN_EDIT, useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { isValidLibrary } from '../lib/validateLibrary';
import type { Game, Library } from '../types';
import { Button } from './Button';
import { DownloadIcon, UploadIcon } from './icons';

/** A settings row that does something: its name, then what it does, its icon where other rows have a chevron. */
function ActionRow({ label, action, icon, onClick }: { label: string; action: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="sheet-row">
      <span className="sheet-row-label">{label}</span>
      <span className="sheet-row-value sheet-row-action">
        {action}
        {icon}
      </span>
    </button>
  );
}

/** Hands the browser a file to save. */
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A library file as this app writes it: version 1 and a list of games with an id, a title and a list. */
function readBackup(text: string): Game[] | undefined {
  try {
    const data: unknown = JSON.parse(text);
    return isValidLibrary(data) ? data.games : undefined;
  } catch {
    return undefined;
  }
}

/** The settings rows for taking the library out and bringing a backup back: a spreadsheet
    the import reads, the exact library file, and a restore that asks first and can be
    undone from its toast. */
export function DataSettings() {
  const { t, plural } = useI18n();
  const { games, replaceGames } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Game[]>();
  const [problem, setProblem] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const backup = readBackup(await file.text());
    setProblem(!backup);
    setPending(backup);
  };

  const restore = async () => {
    if (!pending) return;
    const count = pending.length;
    setPending(undefined);
    if (await replaceGames(pending)) toast({ kicker: t('toast.restored'), title: plural('stats.games', count), undoable: true });
  };

  return (
    <>
      <h3 className="filter-group-label mt-3">{t('settings.data')}</h3>
      <div className="sheet">
        <ActionRow
          label={t('settings.exportCsv')}
          action={t('settings.download')}
          icon={<DownloadIcon />}
          onClick={() => download(`xenonshelf-${stamp}.csv`, exportCsv(games), 'text/csv;charset=utf-8')}
        />
        <ActionRow
          label={t('settings.backup')}
          action={t('settings.download')}
          icon={<DownloadIcon />}
          onClick={() =>
            download(`xenonshelf-${stamp}.json`, JSON.stringify({ version: 1, games } satisfies Library, null, 2), 'application/json')
          }
        />
        {CAN_EDIT && (
          <>
            <ActionRow
              label={t('settings.restore')}
              action={t('settings.chooseFile')}
              icon={<UploadIcon />}
              onClick={() => fileRef.current?.click()}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {pending && (
        <div className="data-confirm" role="alert">
          <p>{t('settings.restoreAsk', { now: plural('stats.games', games.length), from: plural('stats.games', pending.length) })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="quiet" size="sm" onClick={() => setPending(undefined)}>
              {t('copy.cancel')}
            </Button>
            <Button size="sm" onClick={restore}>
              {t('settings.restoreYes')}
            </Button>
          </div>
        </div>
      )}
      {problem && <p className="data-problem">{t('settings.restoreBad')}</p>}
      <p className="data-hint">{t('settings.dataHint')}</p>
    </>
  );
}
