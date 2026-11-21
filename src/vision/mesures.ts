/**
 * Mesures de qualitat sobre un fotograma (RF-05): funcions PURES que reben landmarks normalitzats, blendshapes,
 * la matriu facial, una imatge RGBA reduïda (~640 px d'amplada) i la màscara de segmentació, i en retornen
 * valors numèrics. L'avaluació (verd/àmbar/vermell i missatges) és a `avaluacio.ts`.
 */
import { calculaRetallCap, calculaRetallVisor, type IParamsEnquadrament, type IRetallCap } from '../captura/retallCap';
import { rectangleVisor } from '../captura/retall';
import type { ILlindars } from '../config/configuracio';
import { anglesDeMatriu } from './angles';
import { geometriaCara, rectCara, retallaAlFotograma, type IGeometriaCara } from './cara';
import { lluminancia, rgbAHsv } from './color';
import type { IImatgeRGBA, IMascara, IMatriu, IMesures, IPunt, IRectNorm } from './tipus';

/**
 * Zona del tors sota la barbeta (5.10, 5.11), en fraccions de l'alçada de la cara: comença a 0,20 per sota de la
 * barbeta (s'evita el coll) i acaba a 0,70; l'amplada és 1,6 × l'amplada de la cara, centrada a la cara.
 */
export const ZONA_TORS = { inici: 0.2, final: 0.7, amplada: 1.6 } as const;

/**
 * Zona del tors amb enquadrament «visor» (cap + espatlles + part del polo, cara petita: ≈0,27 de l'alçada del
 * visor). Amb la barbeta a ~50% de l'alçada i les espatlles ~0,5 alçades de cara per sota, la zona 0,20–0,70
 * quedaria al coll; per això aquí és més avall i més ampla (espatlles): 0,6–1,3 alçades de cara sota la barbeta
 * (≈ 66–85% de l'alçada del visor) i 2,2 × l'amplada de la cara. A calibrar amb fotos reals.
 */
export const ZONA_TORS_VISOR = { inici: 0.6, final: 1.3, amplada: 2.2 } as const;

/** Salt de mostreig (píxels) als recorreguts de fons i polo: n'hi ha prou amb una de cada 2×2. */
const SALT = 2;

export interface IMascaraBruta {
  data: ArrayLike<number>;
  w: number;
  h: number;
}

/** Punt de la cara que sempre és persona (entre el front i la barbeta): decideix quina etiqueta de la màscara és «persona». */
export function centreCaraMascara(landmarks: IPunt[]): { x: number; y: number } | undefined {
  const g = geometriaCara(landmarks);
  return g ? { x: g.centreX, y: (g.yFront + g.yBarbeta) / 2 } : undefined;
}

export interface IEntradaMesures {
  imatge: IImatgeRGBA;
  /** Landmarks de cada cara detectada (només se'n fa servir la primera quan n'hi ha exactament una). */
  cares: IPunt[][];
  /** Blendshapes de la primera cara: nom → puntuació. */
  blendshapes?: Record<string, number>;
  matriu?: IMatriu;
  /** Màscara de categories del segmentador (els valors no tenen per què significar «persona» = 1). */
  mascaraBruta?: IMascaraBruta;
  /** Màscara ja normalitzada (p. ex. la de l'última segmentació, reaprofitada); té prioritat sobre `mascaraBruta`. */
  mascara?: IMascara;
}

export interface IResultatMesures {
  mesures: IMesures;
  /** Màscara normalitzada (1 = persona). */
  mascara?: IMascara;
  /** Retall previst (RF-07 «cap» o rectangle del visor), en píxels del fotograma analitzat. */
  retall?: IRetallCap;
  /** Zones analitzades (normalitzades i dins el fotograma), per al mode diagnòstic. */
  zonaFons?: IRectNorm;
  zonaTors?: IRectNorm;
  zonaCara?: IRectNorm;
}

/**
 * Converteix la màscara de categories en una màscara binària «persona = 1». L'etiqueta de persona no se suposa:
 * és la més freqüent en una petita finestra al centre de la cara (que sempre és persona). Les coordenades de `centre`
 * són normalitzades (0..1) i es projecten sobre la mida PRÒPIA de la màscara (que pot ser més petita que el fotograma).
 * Si `reutilitza` té un buffer de la mida justa, s'hi escriu (sense reservar memòria nova a cada fotograma).
 */
export function normalitzaMascara(
  bruta: IMascaraBruta,
  centre: { x: number; y: number },
  reutilitza?: IMascara
): IMascara | undefined {
  if (bruta.w <= 0 || bruta.h <= 0 || bruta.data.length < bruta.w * bruta.h) {
    return undefined;
  }
  const cx = Math.min(bruta.w - 1, Math.max(0, Math.floor(centre.x * bruta.w)));
  const cy = Math.min(bruta.h - 1, Math.max(0, Math.floor(centre.y * bruta.h)));
  const vots = new Map<number, number>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.min(bruta.w - 1, Math.max(0, cx + dx));
      const y = Math.min(bruta.h - 1, Math.max(0, cy + dy));
      const v = bruta.data[y * bruta.w + x];
      vots.set(v, (vots.get(v) ?? 0) + 1);
    }
  }
  let etiqueta = bruta.data[cy * bruta.w + cx];
  let max = 0;
  vots.forEach((n, v) => {
    if (n > max) {
      max = n;
      etiqueta = v;
    }
  });
  const sortida =
    reutilitza && reutilitza.data.length === bruta.w * bruta.h ? reutilitza.data : new Uint8Array(bruta.w * bruta.h);
  for (let i = 0; i < sortida.length; i++) {
    sortida[i] = bruta.data[i] === etiqueta ? 1 : 0;
  }
  return { data: sortida, w: bruta.w, h: bruta.h };
}

interface ILimitsPx {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function limitsPx(r: IRectNorm, w: number, h: number, marge = 0): ILimitsPx {
  return {
    x0: Math.max(marge, Math.floor(r.x * w)),
    y0: Math.max(marge, Math.floor(r.y * h)),
    x1: Math.min(w - marge, Math.ceil((r.x + r.w) * w)),
    y1: Math.min(h - marge, Math.ceil((r.y + r.h) * h))
  };
}

/** Rectangle interior de la cara que s'analitza (llum, ombres, nitidesa): evita les vores amb cabell i fons. */
export function zonaInteriorCara(g: IGeometriaCara): IRectNorm {
  const c = rectCara(g);
  return { x: g.centreX - 0.45 * c.w, y: c.y + 0.1 * c.h, w: 0.9 * c.w, h: 0.8 * c.h };
}

/** Luminància mitjana (0-255) d'una zona normalitzada; 0 si és buida. */
export function lluminanciaMitjana(img: IImatgeRGBA, zona: IRectNorm): number {
  const { x0, y0, x1, y1 } = limitsPx(zona, img.w, img.h);
  let suma = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.w + x) * 4;
      suma += lluminancia(img.data[i], img.data[i + 1], img.data[i + 2]);
      n++;
    }
  }
  return n === 0 ? 0 : suma / n;
}

/**
 * Diferència relativa de luminància entre la meitat esquerra i la dreta de la zona (5.8):
 * |E − D| / mitjana(E, D). 0 = simètrica.
 */
export function diferenciaEsquerraDreta(img: IImatgeRGBA, zona: IRectNorm): number {
  const meitat = zona.w / 2;
  const e = lluminanciaMitjana(img, { x: zona.x, y: zona.y, w: meitat, h: zona.h });
  const d = lluminanciaMitjana(img, { x: zona.x + meitat, y: zona.y, w: meitat, h: zona.h });
  return Math.abs(e - d) / Math.max((e + d) / 2, 1);
}

/** Variància del Laplacià (nucli 4-veïns) de la luminància de la zona (5.9): més alta = més nítida. */
export function varianciaLaplaciana(img: IImatgeRGBA, zona: IRectNorm): number {
  const { x0, y0, x1, y1 } = limitsPx(zona, img.w, img.h, 1);
  const gris = (x: number, y: number): number => {
    const i = (y * img.w + x) * 4;
    return lluminancia(img.data[i], img.data[i + 1], img.data[i + 2]);
  };
  let suma = 0;
  let suma2 = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const l = gris(x - 1, y) + gris(x + 1, y) + gris(x, y - 1) + gris(x, y + 1) - 4 * gris(x, y);
      suma += l;
      suma2 += l * l;
      n++;
    }
  }
  if (n === 0) {
    return 0;
  }
  const mitjana = suma / n;
  return suma2 / n - mitjana * mitjana;
}

/**
 * Proporció de píxels de FONS «blancs» a la zona (5.6): només es compten els píxels que la màscara marca com a fons;
 * són blancs si luminància > `fonsLumMin` i saturació < `fonsSatMax`. Retorna undefined si a la zona no hi ha prou fons
 * per jutjar (menys d'un 1% dels píxels mostrejats).
 */
export function proporcioFonsBlanc(
  img: IImatgeRGBA,
  mascara: IMascara,
  zona: IRectNorm,
  llindars: Pick<ILlindars, 'fonsLumMin' | 'fonsSatMax'>
): number | undefined {
  const { x0, y0, x1, y1 } = limitsPx(zona, img.w, img.h);
  let fons = 0;
  let blancs = 0;
  let total = 0;
  for (let y = y0; y < y1; y += SALT) {
    const my = Math.min(mascara.h - 1, Math.floor(((y + 0.5) / img.h) * mascara.h));
    for (let x = x0; x < x1; x += SALT) {
      total++;
      const mx = Math.min(mascara.w - 1, Math.floor(((x + 0.5) / img.w) * mascara.w));
      if (mascara.data[my * mascara.w + mx] === 1) {
        continue;
      }
      fons++;
      const i = (y * img.w + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      if (lluminancia(r, g, b) > llindars.fonsLumMin && rgbAHsv(r, g, b).s < llindars.fonsSatMax) {
        blancs++;
      }
    }
  }
  if (total === 0 || fons < Math.max(10, total * 0.01)) {
    return undefined;
  }
  return blancs / fons;
}

/**
 * Proporció de píxels de PERSONA de la zona del tors que són blau polo (5.10): to entre `poloHueMin` i `poloHueMax`,
 * saturació > `poloSatMin` i valor entre `poloValMin` i `poloValMax`. Si a la zona gairebé no hi ha persona (< 5%),
 * és 0.
 */
export function proporcioPolo(
  img: IImatgeRGBA,
  mascara: IMascara,
  zona: IRectNorm,
  llindars: Pick<ILlindars, 'poloHueMin' | 'poloHueMax' | 'poloSatMin' | 'poloValMin' | 'poloValMax'>
): number {
  const { x0, y0, x1, y1 } = limitsPx(zona, img.w, img.h);
  let persona = 0;
  let blaus = 0;
  let total = 0;
  for (let y = y0; y < y1; y += SALT) {
    const my = Math.min(mascara.h - 1, Math.floor(((y + 0.5) / img.h) * mascara.h));
    for (let x = x0; x < x1; x += SALT) {
      total++;
      const mx = Math.min(mascara.w - 1, Math.floor(((x + 0.5) / img.w) * mascara.w));
      if (mascara.data[my * mascara.w + mx] !== 1) {
        continue;
      }
      persona++;
      const i = (y * img.w + x) * 4;
      const { h, s, v } = rgbAHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      if (
        h >= llindars.poloHueMin &&
        h <= llindars.poloHueMax &&
        s > llindars.poloSatMin &&
        v >= llindars.poloValMin &&
        v <= llindars.poloValMax
      ) {
        blaus++;
      }
    }
  }
  if (total === 0 || persona < total * 0.05) {
    return 0;
  }
  return blaus / persona;
}

function interseccio(a: IRectNorm, b: IRectNorm): IRectNorm {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Zona NOMINAL del tors (pot sortir del fotograma) i la part visible. */
export function zonesTors(
  g: IGeometriaCara,
  /** Part del fotograma que acaba a la foto (per defecte, tot el fotograma; amb enquadrament «visor», el visor). */
  limit?: IRectNorm,
  zona: { inici: number; final: number; amplada: number } = ZONA_TORS
): { nominal: IRectNorm; visible: IRectNorm; fraccioVisible: number } {
  const ample = zona.amplada * g.ample;
  const nominal: IRectNorm = {
    x: g.centreX - ample / 2,
    y: g.yBarbeta + zona.inici * g.alcada,
    w: ample,
    h: (zona.final - zona.inici) * g.alcada
  };
  const visible = interseccio(nominal, limit ?? { x: 0, y: 0, w: 1, h: 1 });
  const area = nominal.w * nominal.h;
  return { nominal, visible, fraccioVisible: area > 0 ? (visible.w * visible.h) / area : 0 };
}

/** Totes les mesures d'un fotograma. Sense exactament una cara (o sense geometria vàlida) només hi ha `nCares`. */
export function calculaMesures(
  entrada: IEntradaMesures,
  llindars: ILlindars,
  params: IParamsEnquadrament
): IResultatMesures {
  const nCares = entrada.cares.length;
  const { imatge } = entrada;
  if (nCares !== 1) {
    return { mesures: { nCares } };
  }
  const landmarks = entrada.cares[0];
  const g = geometriaCara(landmarks);
  if (!g) {
    return { mesures: { nCares } };
  }
  // Amb enquadrament «visor» la foto és el rectangle visible al visor: la distància és relativa a la seva alçada
  // (en una càmera 16:9 coincideix amb l'alçada del fotograma) i les zones es limiten a aquest rectangle.
  const visor = params.enquadrament === 'visor';
  const rectVisor = rectangleVisor(imatge.w, imatge.h);
  const visorNorm: IRectNorm = {
    x: rectVisor.x / imatge.w,
    y: rectVisor.y / imatge.h,
    w: rectVisor.w / imatge.w,
    h: rectVisor.h / imatge.h
  };
  const mesures: IMesures = {
    nCares,
    desviacio: g.centreX - 0.5,
    alcadaCara: visor ? g.alcada / visorNorm.h : g.alcada
  };

  const angles = anglesDeMatriu(entrada.matriu);
  if (angles) {
    mesures.yaw = angles.yaw * llindars.yawSigne;
    mesures.pitch = angles.pitch * llindars.pitchSigne;
    mesures.roll = angles.roll;
  }
  const bs = entrada.blendshapes;
  if (bs) {
    if (bs.eyeBlinkLeft !== undefined || bs.eyeBlinkRight !== undefined) {
      mesures.parpelleig = Math.max(bs.eyeBlinkLeft ?? 0, bs.eyeBlinkRight ?? 0);
    }
    if (bs.jawOpen !== undefined) {
      mesures.bocaOberta = bs.jawOpen;
    }
  }

  const zonaCara = zonaInteriorCara(g);
  mesures.llum = lluminanciaMitjana(imatge, zonaCara);
  mesures.ombra = diferenciaEsquerraDreta(imatge, zonaCara);
  mesures.nitidesa = varianciaLaplaciana(imatge, zonaCara);

  const tors = zonesTors(g, visor ? visorNorm : undefined, visor ? ZONA_TORS_VISOR : ZONA_TORS);
  mesures.torsVisible = tors.fraccioVisible;

  const resultat: IResultatMesures = { mesures, zonaTors: tors.visible, zonaCara };
  const mascara =
    entrada.mascara ??
    (entrada.mascaraBruta
      ? normalitzaMascara(entrada.mascaraBruta, { x: g.centreX, y: (g.yFront + g.yBarbeta) / 2 })
      : undefined);
  resultat.mascara = mascara;

  const retall = visor
    ? calculaRetallVisor(landmarks, imatge.w, imatge.h)
    : calculaRetallCap(landmarks, mascara, imatge.w, imatge.h, params);
  resultat.retall = retall;
  const rectRetall = retall
    ? {
        x: retall.rect.x / imatge.w,
        y: retall.rect.y / imatge.h,
        w: retall.rect.w / imatge.w,
        h: retall.rect.h / imatge.h
      }
    : visorNorm;
  resultat.zonaFons = retallaAlFotograma(rectRetall);

  if (mascara) {
    mesures.fons = proporcioFonsBlanc(imatge, mascara, resultat.zonaFons, llindars);
    // Si gairebé no es veu la zona del tors no té sentit jutjar el polo (parla 5.11).
    if (tors.fraccioVisible >= 0.3) {
      mesures.polo = proporcioPolo(imatge, mascara, tors.visible, llindars);
    }
  }
  return resultat;
}
