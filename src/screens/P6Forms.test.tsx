import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Contingut } from '../app/App';
import { ProveidorApp, useApp } from '../app/AppContext';
import { CONFIG_PER_DEFECTE, type IConfig } from '../config/configuracio';
import { t } from '../i18n';

const act = (React as unknown as { act: (cb: () => void) => void }).act;
const FUNCIONALITATS = {
  getUserMedia: true,
  webAssembly: true,
  decompressionStream: true,
  webGL2: true,
  webGL: true,
  compatible: true
};

const SaltaAP6: React.FC<{ matricula?: string }> = ({ matricula = '12345' }) => {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ tipus: 'DESA_MATRICULA', matricula });
    for (let i = 0; i < 6; i++) {
      dispatch({ tipus: 'ENDAVANT' });
    }
  }, [dispatch, matricula]);
  return null;
};

function monta(
  config: IConfig = CONFIG_PER_DEFECTE,
  matricula?: string
): { div: HTMLDivElement; desmonta: () => void } {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  act(() =>
    root.render(
      <ProveidorApp config={config} funcionalitats={FUNCIONALITATS}>
        <SaltaAP6 matricula={matricula} />
        <Contingut />
      </ProveidorApp>
    )
  );
  return {
    div,
    desmonta: () => {
      act(() => root.unmount());
      div.remove();
    }
  };
}

function posaOnLine(valor: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: valor, configurable: true });
}

describe('P6: avís sense connexió', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).onLine;
  });

  it('amb navigator.onLine === false mostra l’avís de la spec §3 P6', () => {
    posaOnLine(false);
    const { div, desmonta } = monta();
    expect(div.querySelector('[data-offline]')?.textContent).toBe(
      "Cal connexió a internet per enviar el formulari. La foto ja la tens desada: la trobaràs a la carpeta on l'has desada (per defecte, Imatges). Pots enviar-la més tard."
    );
    desmonta();
  });

  it('amb connexió no mostra l’avís, i reacciona als esdeveniments offline/online', () => {
    posaOnLine(true);
    const { div, desmonta } = monta();
    expect(div.querySelector('[data-offline]')).toBeNull();
    posaOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(div.querySelector('[data-offline]')).not.toBeNull();
    posaOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(div.querySelector('[data-offline]')).toBeNull();
    desmonta();
  });
});

describe('P0: privacitat', () => {
  it('el text de P0 diu que la imatge no surt del dispositiu fins que l’usuari la puja manualment al formulari', () => {
    expect(t('p0.privacitatTitol')).toContain('no surt del teu dispositiu');
    expect(t('p0.privacitat')).toContain('manualment mitjançant el formulari');
    expect(t('p0.privacitat')).toContain('dins el teu dispositiu');
  });
});

const PLANTILLA = 'https://forms.office.com/Pages/ResponsePage.aspx?id=abc&r1={MATRICULA}';
const ambPlantilla = (urlPlantilla: string): IConfig => ({
  ...CONFIG_PER_DEFECTE,
  forms: { ...CONFIG_PER_DEFECTE.forms, urlPlantilla }
});
const botoText = (div: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent === text);

describe('P6: obertura del formulari (RF-12, RF-13)', () => {
  let obre: jest.SpyInstance;
  beforeEach(() => {
    obre = jest.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete (navigator as unknown as Record<string, unknown>).onLine;
    document.body.innerHTML = '';
  });

  it('el modal mostra les 4 instruccions numerades amb el nom del fitxer', () => {
    const { div, desmonta } = monta(ambPlantilla(PLANTILLA));
    const passos = Array.from(div.querySelectorAll('[role="dialog"] ol li')).map((li) => li.textContent);
    expect(passos).toHaveLength(4);
    expect(passos[2]).toContain('12345.jpg');
    desmonta();
  });

  it('«Obrir el formulari» crida window.open dins el clic amb la URL i la matrícula codificada', () => {
    const { div, desmonta } = monta(ambPlantilla(PLANTILLA), '12 34/é');
    expect(obre).not.toHaveBeenCalled();
    act(() => botoText(div, t('p6.obrir'))?.click());
    expect(obre).toHaveBeenCalledTimes(1);
    expect(obre).toHaveBeenCalledWith(
      'https://forms.office.com/Pages/ResponsePage.aspx?id=abc&r1=' + encodeURIComponent('12 34/é'),
      '_blank',
      'noopener'
    );
    desmonta();
  });

  it('mostra l’enllaç alternatiu amb target=_blank i rel=noopener noreferrer', () => {
    const { div, desmonta } = monta(ambPlantilla(PLANTILLA));
    const a = Array.from(div.querySelectorAll('a')).find((x) => x.textContent === t('p6.enllac'));
    expect(a?.getAttribute('href')).toBe('https://forms.office.com/Pages/ResponsePage.aspx?id=abc&r1=12345');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    desmonta();
  });

  it('amb la configuració per defecte, el formulari s’obre amb la matrícula a la URL', () => {
    const { div, desmonta } = monta();
    act(() => botoText(div, t('p6.obrir'))?.click());
    expect(obre).toHaveBeenCalledTimes(1);
    expect(String(obre.mock.calls[0][0])).toContain('12345');
    desmonta();
  });

  it('l’avís sense connexió és dins el modal quan és obert', () => {
    posaOnLine(false);
    const { div, desmonta } = monta(ambPlantilla(PLANTILLA));
    expect(div.querySelector('[role="dialog"] [data-offline]')).not.toBeNull();
    desmonta();
  });

  it.each([
    ['http://forms.office.com/x?r={MATRICULA}', 'p6.urlNoHttps'],
    ['https://forms.office.com/x?r=1', 'p6.sensePlantilla'],
    ['https://exemple.cat/x?r={MATRICULA}', 'p6.urlHostNoPermes']
  ] as const)(
    'plantilla no vàlida (%s): error de configuració, cap enllaç i el botó no obre res',
    (plantilla, clau) => {
      const { div, desmonta } = monta(ambPlantilla(plantilla));
      expect(div.querySelector('[role="alert"]')?.textContent).toBe(t(clau));
      expect(Array.from(div.querySelectorAll('a')).some((x) => x.textContent === t('p6.enllac'))).toBe(false);
      const boto = botoText(div, t('p6.obrir'));
      expect(boto?.disabled).toBe(true);
      act(() => boto?.click());
      expect(obre).not.toHaveBeenCalled();
      desmonta();
    }
  );

  it('«Ja l’he enviat» porta a P7', () => {
    const { div, desmonta } = monta(ambPlantilla(PLANTILLA));
    act(() => botoText(div, t('nav.tancar'))?.click());
    act(() => botoText(div, t('p6.jaEnviat'))?.click());
    expect(div.querySelector('h1')?.textContent).toBe(t('p7.titol'));
    desmonta();
  });
});
