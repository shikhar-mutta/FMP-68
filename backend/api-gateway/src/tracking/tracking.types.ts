export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface LocationPayload {
  pathId: string;
  userId: string;
  coordinate: Coordinate;
  role: string;
}
