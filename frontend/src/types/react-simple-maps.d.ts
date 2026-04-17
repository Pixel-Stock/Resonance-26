declare module "react-simple-maps" {
  import * as React from "react";

  export interface ComposableMapProps {
    projection?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    [key: string]: unknown;
  }
  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface ZoomableGroupProps {
    children?: React.ReactNode;
    [key: string]: unknown;
  }
  export const ZoomableGroup: React.FC<ZoomableGroupProps>;

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: GeoShape[] }) => React.ReactNode;
  }
  export const Geographies: React.FC<GeographiesProps>;

  export interface GeoShape {
    rsmKey: string;
    [key: string]: unknown;
  }

  export interface GeographyProps {
    geography: GeoShape;
    style?: { default?: React.CSSProperties; hover?: React.CSSProperties; pressed?: React.CSSProperties };
    [key: string]: unknown;
  }
  export const Geography: React.FC<GeographyProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    children?: React.ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    [key: string]: unknown;
  }
  export const Marker: React.FC<MarkerProps>;
}
