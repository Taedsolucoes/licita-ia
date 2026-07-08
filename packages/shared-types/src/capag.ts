import { CapagRating } from './enums';

export interface CapagRecordDto {
  id: string;
  municipalityIbgeCode: string;
  municipalityName: string;
  uf: string;
  capagRating: CapagRating;
  explanationShort: string | null;
  referenceYear: number;
  updatedFromSourceAt: string | null;
}
