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
    expect(r.avisos).toEqual(['jsonInvalid']);
    expect(r.config.maxFotos).toBe(3);
    expect(r.config.sortida.ppp).toBe(600);
  });

  it("JSON que no és un objecte: s'ignora i s'avisa", () => {
    expect(resolConfig({ configAvancada: '[1,2]' }).avisos).toEqual(['jsonNoObjecte']);
  });

  it("regex invàlida: es manté la per defecte i s'avisa", () => {
    const r = resolConfig({ matriculaRegex: '([' });
    expect(r.avisos).toEqual(['regexInvalida']);
    expect(r.config.matriculaRegex).toBe(CONFIG_PER_DEFECTE.matriculaRegex);
  });

  it("ppp fora de 300/600 s'ignora", () => {
    const r = resolConfig({ ppp: 123 });
    expect(r.avisos).toEqual(['pppInvalid']);
    expect(r.config.sortida.ppp).toBe(300);
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
