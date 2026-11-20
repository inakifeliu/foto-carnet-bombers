import {
  CONFIG_PER_DEFECTE,
  fusioProfunda,
  resolConfig,
  validaJsonAvancat,
  validaRegex
} from './configuracio';

describe('fusioProfunda', () => {
  it('fusiona objectes de manera recursiva sense mutar les entrades', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const r = fusioProfunda(base, { b: { c: 9 }, e: 5 });
    expect(r).toEqual({ a: 1, b: { c: 9, d: 3 }, e: 5 });
    expect(base).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });

  it('substitueix els arrays i ignora __proto__', () => {
    const r = fusioProfunda({ x: [1, 2] } as Record<string, unknown>, JSON.parse('{"x":[3],"__proto__":{"p":1}}'));
    expect(r.x).toEqual([3]);
    expect(({} as Record<string, unknown>).p).toBeUndefined();
  });
});

describe('resolConfig', () => {
  it('sense propietats retorna la configuració per defecte', () => {
    const r = resolConfig({});
    expect(r.config).toEqual(CONFIG_PER_DEFECTE);
    expect(r.avisos).toEqual([]);
  });

  it('aplica els camps del panell sobre el per defecte', () => {
    const r = resolConfig({ urlPlantilla: 'https://x/{MATRICULA}', matriculaRegex: '^[0-9]{5}$', ppp: 600 });
    expect(r.config.forms.urlPlantilla).toBe('https://x/{MATRICULA}');
    expect(r.config.matriculaRegex).toBe('^[0-9]{5}$');
    expect(r.config.sortida.ppp).toBe(600);
    expect(r.config.sortida.qualitatJpeg).toBe(0.92);
  });

  it('el JSON avançat es fusiona en profunditat i els camps explícits hi guanyen', () => {
    const r = resolConfig({
      configAvancada: '{"llindars":{"yawMax":12},"maxFotos":2,"sortida":{"ppp":600}}',
      ppp: 300
    });
    expect(r.config.llindars.yawMax).toBe(12);
    expect(r.config.llindars.rollMax).toBe(5);
    expect(r.config.maxFotos).toBe(2);
    expect(r.config.sortida.ppp).toBe(300);
  });

  it("JSON invàlid: s'ignora i s'avisa", () => {
    const r = resolConfig({ configAvancada: '{ trencat', ppp: 600 });
    expect(r.avisos).toEqual([{ codi: 'jsonInvalid' }]);
    expect(r.config.maxFotos).toBe(3);
    expect(r.config.sortida.ppp).toBe(600);
  });

  it("JSON que no és un objecte: s'ignora i s'avisa", () => {
    expect(resolConfig({ configAvancada: '[1,2]' }).avisos).toEqual([{ codi: 'jsonNoObjecte' }]);
  });

  it("regex invàlida: es manté la per defecte i s'avisa", () => {
    const r = resolConfig({ matriculaRegex: '([' });
    expect(r.avisos).toEqual([{ codi: 'regexInvalida', camp: 'matriculaRegex' }]);
    expect(r.config.matriculaRegex).toBe(CONFIG_PER_DEFECTE.matriculaRegex);
  });

  it("ppp fora de 300/600 s'ignora", () => {
    const r = resolConfig({ ppp: 123 });
    expect(r.avisos).toEqual([{ codi: 'pppInvalid', camp: 'sortida.ppp' }]);
    expect(r.config.sortida.ppp).toBe(300);
  });
});

describe('resolConfig: validació de la configuració fusionada', () => {
  const avis = (json: string): { config: ReturnType<typeof resolConfig>['config']; avisos: ReturnType<typeof resolConfig>['avisos'] } =>
    resolConfig({ configAvancada: json });

  it('matriculaRegex no string: es manté la per defecte amb avís', () => {
    const r = avis('{"matriculaRegex":123}');
    expect(r.config.matriculaRegex).toBe(CONFIG_PER_DEFECTE.matriculaRegex);
    expect(r.avisos).toEqual([{ codi: 'valorInvalid', camp: 'matriculaRegex' }]);
  });

  it('matriculaRegex buida o que no compila: per defecte amb avís', () => {
    expect(avis('{"matriculaRegex":""}').avisos).toEqual([{ codi: 'regexInvalida', camp: 'matriculaRegex' }]);
    expect(avis('{"matriculaRegex":"(("}').config.matriculaRegex).toBe(CONFIG_PER_DEFECTE.matriculaRegex);
  });

  it('forms.urlPlantilla no string: per defecte amb avís', () => {
    const r = avis('{"forms":{"urlPlantilla":5}}');
    expect(r.config.forms.urlPlantilla).toBe(CONFIG_PER_DEFECTE.forms.urlPlantilla);
    expect(r.avisos).toEqual([{ codi: 'valorInvalid', camp: 'forms.urlPlantilla' }]);
  });

  it('sortida.ppp fora de {300, 600} (JSON): per defecte amb avís', () => {
    const r = avis('{"sortida":{"ppp":450,"qualitatJpeg":0.8}}');
    expect(r.config.sortida.ppp).toBe(300);
    expect(r.config.sortida.qualitatJpeg).toBe(0.8);
    expect(r.avisos).toEqual([{ codi: 'pppInvalid', camp: 'sortida.ppp' }]);
  });

  it('un objecte substituït per null, array o primitiu es descarta', () => {
    ['null', '[1]', '7', '"x"'].forEach((valor) => {
      const r = avis(`{"llindars":${valor}}`);
      expect(r.config.llindars).toEqual(CONFIG_PER_DEFECTE.llindars);
      expect(r.avisos).toEqual([{ codi: 'valorInvalid', camp: 'llindars' }]);
    });
  });

  it('maxFotos: ha de ser un enter entre 1 i 10', () => {
    expect(avis('{"maxFotos":"x"}').avisos).toEqual([{ codi: 'valorInvalid', camp: 'maxFotos' }]);
    expect(avis('{"maxFotos":"x"}').config.maxFotos).toBe(3);
    [0, 11, 2.5, -1].forEach((n) => {
      const r = avis(`{"maxFotos":${n}}`);
      expect(r.config.maxFotos).toBe(3);
      expect(r.avisos).toEqual([{ codi: 'maxFotosInvalid', camp: 'maxFotos' }]);
    });
    expect(avis('{"maxFotos":10}').avisos).toEqual([]);
    expect(avis('{"maxFotos":1}').config.maxFotos).toBe(1);
  });

  it('les fulles numèriques han de ser finites (no strings ni null)', () => {
    const r = avis('{"llindars":{"yawMax":"8","rollMax":null,"pitchMax":9}}');
    expect(r.config.llindars.yawMax).toBe(8);
    expect(r.config.llindars.rollMax).toBe(5);
    expect(r.config.llindars.pitchMax).toBe(9);
    expect(r.avisos).toEqual([
      { codi: 'valorInvalid', camp: 'llindars.yawMax' },
      { codi: 'valorInvalid', camp: 'llindars.rollMax' }
    ]);
  });

  it('arrays en lloc de valors escalars: es descarten', () => {
    const r = avis('{"maxFotos":[2],"matriculaRegex":["a"],"forms":[]}');
    expect(r.config).toEqual(CONFIG_PER_DEFECTE);
    expect(r.avisos.map((a) => a.camp)).toEqual(['matriculaRegex', 'maxFotos', 'forms']);
  });

  it("claus desconegudes (també niuades): s'ignoren amb avís", () => {
    const r = avis('{"nova":1,"llindars":{"inventat":3,"yawMax":9},"forms":{"x":{"y":1}}}');
    expect(r.config).toEqual({ ...CONFIG_PER_DEFECTE, llindars: { ...CONFIG_PER_DEFECTE.llindars, yawMax: 9 } });
    expect(r.avisos).toEqual([
      { codi: 'campDesconegut', camp: 'forms.x' },
      { codi: 'campDesconegut', camp: 'llindars.inventat' },
      { codi: 'campDesconegut', camp: 'nova' }
    ]);
  });

  it('els camps del panell invàlids també es validen', () => {
    expect(resolConfig({ maxFotos: 1 } as never).config).toEqual(CONFIG_PER_DEFECTE);
    expect(resolConfig({ ppp: 'x' as never }).config.sortida.ppp).toBe(300);
    expect(resolConfig({ ppp: NaN }).avisos.length).toBe(1);
  });

  it('no llança mai: entrades estranyes tornen la configuració per defecte', () => {
    [undefined, null, {}, { configAvancada: 5 as never, urlPlantilla: 5 as never, matriculaRegex: {} as never }].forEach(
      (props) => {
        expect(() => resolConfig(props as never)).not.toThrow();
        expect(resolConfig(props as never).config).toEqual(CONFIG_PER_DEFECTE);
      }
    );
  });

  it('no comparteix referències amb la configuració per defecte', () => {
    const r = resolConfig({});
    r.config.llindars.yawMax = 99;
    expect(CONFIG_PER_DEFECTE.llindars.yawMax).toBe(8);
  });
});

describe('validacions', () => {
  it('validaJsonAvancat', () => {
    expect(validaJsonAvancat(undefined)).toBeUndefined();
    expect(validaJsonAvancat('  ')).toBeUndefined();
    expect(validaJsonAvancat('{"a":1}')).toBeUndefined();
    expect(validaJsonAvancat('{a')).toBe('jsonInvalid');
    expect(validaJsonAvancat('42')).toBe('jsonNoObjecte');
  });

  it('validaRegex', () => {
    expect(validaRegex('^[0-9]+$')).toBe(true);
    expect(validaRegex('(')).toBe(false);
    expect(validaRegex('')).toBe(true);
  });
});
