/**
 * Base geográfica do Cidade Aberta: João Pessoa (PB) e entorno imediato.
 *
 * É um retângulo aproximado e generoso, NÃO o limite oficial do município
 * (inclui cidades vizinhas e um trecho de mar). Serve para barrar coordenadas
 * claramente erradas: outra cidade, lat/lng invertidos, geradas por engano.
 * Um polígono oficial de município/bairros pode substituí-lo numa etapa futura.
 *
 * IMPORTANTE: mantenha em sincronia com
 * artifacts/cidade-aberta/src/lib/geo.ts (o frontend usa os mesmos valores
 * para limitar o seletor de local no mapa).
 */
import { type Field, type FieldResult } from "./validate";

export const SERVICE_AREA = {
  south: -7.35,
  north: -6.9,
  west: -35.1,
  east: -34.7,
} as const;

/** Centro do mapa (mesmo valor usado no frontend). */
export const JOAO_PESSOA_CENTER = { lat: -7.1195, lng: -34.845 } as const;

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

function coordinateField(min: number, max: number, label: string): Field<number> {
  return {
    optional: false,
    parse(value: unknown): FieldResult<number> {
      // Aceita number ou string numérica; qualquer outra coisa não é coordenada.
      const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) {
        return { ok: false, error: `${label} deve ser um número` };
      }
      if (n < min || n > max) {
        return {
          ok: false,
          error: `${label} fora da área de atendimento (João Pessoa e região): deve estar entre ${min} e ${max}`,
        };
      }
      return { ok: true, value: n };
    },
  };
}

/** Campo de validação: latitude dentro da área atendida. */
export function serviceAreaLat(): Field<number> {
  return coordinateField(SERVICE_AREA.south, SERVICE_AREA.north, "latitude");
}

/** Campo de validação: longitude dentro da área atendida. */
export function serviceAreaLng(): Field<number> {
  return coordinateField(SERVICE_AREA.west, SERVICE_AREA.east, "longitude");
}
