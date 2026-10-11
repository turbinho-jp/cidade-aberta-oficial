/**
 * Base geográfica do Cidade Aberta: João Pessoa (PB) e entorno imediato.
 *
 * IMPORTANTE: a área de atendimento abaixo é validada também no servidor, em
 * artifacts/api-server/src/lib/geo.ts. Ao ajustá-la, altere os dois arquivos.
 */

/** Centro inicial do mapa: [latitude, longitude]. */
export const JOAO_PESSOA_CENTER: [number, number] = [-7.1195, -34.845];

export const DEFAULT_ZOOM = 13;

export const SERVICE_AREA = {
  south: -7.35,
  north: -6.9,
  west: -35.1,
  east: -34.7,
} as const;

/** Mesma área no formato do Leaflet: [[sul, oeste], [norte, leste]]. */
export const SERVICE_AREA_BOUNDS: [[number, number], [number, number]] = [
  [SERVICE_AREA.south, SERVICE_AREA.west],
  [SERVICE_AREA.north, SERVICE_AREA.east],
];

export const OUT_OF_AREA_MESSAGE = "Esse ponto está fora da área de atendimento (João Pessoa e região).";

export function isInsideServiceArea(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SERVICE_AREA.south &&
    lat <= SERVICE_AREA.north &&
    lng >= SERVICE_AREA.west &&
    lng <= SERVICE_AREA.east
  );
}

/** Arredonda para 6 casas decimais (~0,1 m). */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
